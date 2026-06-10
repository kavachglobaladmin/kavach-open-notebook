import json
from typing import Any, AsyncGenerator, Dict, List, Optional, Set

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from loguru import logger

from api.auth import get_current_user
from api.models import AskRequest, AskResponse, SearchRequest, SearchResponse
from open_notebook.ai.models import Model, model_manager
from open_notebook.database.repository import repo_query
from open_notebook.domain.notebook import text_search, vector_search
from open_notebook.exceptions import DatabaseOperationError, InvalidInputError
from open_notebook.graphs.ask import graph as ask_graph

router = APIRouter()


def _id_to_str(value: Any) -> str:
    """Normalize SurrealDB IDs (RecordID/string/dict) to plain string."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        # Some adapters may return RecordID-like dicts with 'tb'/'id' keys
        tb = value.get("tb")
        rid = value.get("id")
        if tb and rid:
            return f"{tb}:{rid}"
    return str(value)


def _extract_parent_id(result: Dict[str, Any]) -> str:
    parent_id = _id_to_str(result.get("parent_id"))
    if parent_id:
        return parent_id
    return _id_to_str(result.get("id"))


async def _get_accessible_ids_for_user(current_user: str) -> tuple[Set[str], Set[str]]:
    """
    Build allowed source and note IDs for the current user.

    Source visibility is determined via notebook references.
    Note visibility supports both note.owner and notebook artifact links.
    """
    notebook_ids = await repo_query(
        "SELECT VALUE id FROM notebook WHERE owner = $owner",
        {"owner": current_user},
    )
    if not notebook_ids:
        # No owned notebooks => no visible sources/notes via notebook links.
        direct_notes = await repo_query(
            "SELECT VALUE id FROM note WHERE owner = $owner",
            {"owner": current_user},
        )
        return set(), {_id_to_str(nid) for nid in direct_notes if _id_to_str(nid)}

    source_ids = await repo_query(
        """
        SELECT VALUE in
        FROM reference
        WHERE out IN $notebook_ids
        """,
        {"notebook_ids": notebook_ids},
    )

    notebook_note_ids = await repo_query(
        """
        SELECT VALUE in
        FROM artifact
        WHERE out IN $notebook_ids
        """,
        {"notebook_ids": notebook_ids},
    )
    direct_note_ids = await repo_query(
        "SELECT VALUE id FROM note WHERE owner = $owner",
        {"owner": current_user},
    )

    allowed_sources = {_id_to_str(sid) for sid in source_ids if _id_to_str(sid)}
    allowed_notes = {
        _id_to_str(nid)
        for nid in (notebook_note_ids + direct_note_ids)
        if _id_to_str(nid)
    }
    return allowed_sources, allowed_notes


async def _filter_results_by_owner(
    results: List[Dict[str, Any]], current_user: Optional[str]
) -> List[Dict[str, Any]]:
    """
    Restrict search results to records visible to current authenticated user.
    """
    if not current_user:
        return results

    allowed_sources, allowed_notes = await _get_accessible_ids_for_user(current_user)
    if not allowed_sources and not allowed_notes:
        return []

    filtered: List[Dict[str, Any]] = []
    for row in results:
        parent_id = _extract_parent_id(row)
        if not parent_id:
            continue
        lower = parent_id.lower()
        if lower.startswith("source:"):
            if parent_id in allowed_sources:
                filtered.append(row)
        elif lower.startswith("note:"):
            if parent_id in allowed_notes:
                filtered.append(row)
        else:
            # Unknown type in search results: keep conservative and hide.
            continue
    return filtered


@router.post("/search", response_model=SearchResponse)
async def search_knowledge_base(
    search_request: SearchRequest,
    current_user: Optional[str] = Depends(get_current_user),
):
    """Search the knowledge base using text or vector search."""
    try:
        if search_request.type == "vector":
            # Check if embedding model is available for vector search
            if not await model_manager.get_embedding_model():
                raise HTTPException(
                    status_code=400,
                    detail="Vector search requires an embedding model. Please configure one in the Models section.",
                )

            results = await vector_search(
                keyword=search_request.query,
                results=search_request.limit,
                source=search_request.search_sources,
                note=search_request.search_notes,
                minimum_score=search_request.minimum_score,
            )
        else:
            # Text search
            results = await text_search(
                keyword=search_request.query,
                results=search_request.limit,
                source=search_request.search_sources,
                note=search_request.search_notes,
            )

        scoped_results = await _filter_results_by_owner(results or [], current_user)

        return SearchResponse(
            results=scoped_results,
            total_count=len(scoped_results),
            search_type=search_request.type,
        )

    except InvalidInputError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except DatabaseOperationError as e:
        logger.error(f"Database error during search: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error during search: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


async def stream_ask_response(
    question: str, strategy_model: Model, answer_model: Model, final_answer_model: Model
) -> AsyncGenerator[str, None]:
    """Stream the ask response as Server-Sent Events."""
    try:
        final_answer = None

        async for chunk in ask_graph.astream(
            input=dict(question=question),  # type: ignore[arg-type]
            config=dict(
                configurable=dict(
                    strategy_model=strategy_model.id,
                    answer_model=answer_model.id,
                    final_answer_model=final_answer_model.id,
                )
            ),
            stream_mode="updates",
        ):
            if "agent" in chunk:
                strategy_data = {
                    "type": "strategy",
                    "reasoning": chunk["agent"]["strategy"].reasoning,
                    "searches": [
                        {"term": search.term, "instructions": search.instructions}
                        for search in chunk["agent"]["strategy"].searches
                    ],
                }
                yield f"data: {json.dumps(strategy_data)}\n\n"

            elif "provide_answer" in chunk:
                for answer in chunk["provide_answer"]["answers"]:
                    answer_data = {"type": "answer", "content": answer}
                    yield f"data: {json.dumps(answer_data)}\n\n"

            elif "write_final_answer" in chunk:
                final_answer = chunk["write_final_answer"]["final_answer"]
                final_data = {"type": "final_answer", "content": final_answer}
                yield f"data: {json.dumps(final_data)}\n\n"

        # Send completion signal
        completion_data = {"type": "complete", "final_answer": final_answer}
        yield f"data: {json.dumps(completion_data)}\n\n"

    except Exception as e:
        from open_notebook.utils.error_classifier import classify_error

        _, user_message = classify_error(e)
        logger.error(f"Error in ask streaming: {str(e)}")
        error_data = {"type": "error", "message": user_message}
        yield f"data: {json.dumps(error_data)}\n\n"


@router.post("/search/ask")
async def ask_knowledge_base(ask_request: AskRequest):
    """Ask the knowledge base a question using AI models."""
    try:
        # Validate models exist
        strategy_model = await Model.get(ask_request.strategy_model)
        answer_model = await Model.get(ask_request.answer_model)
        final_answer_model = await Model.get(ask_request.final_answer_model)

        if not strategy_model:
            raise HTTPException(
                status_code=400,
                detail=f"Strategy model {ask_request.strategy_model} not found",
            )
        if not answer_model:
            raise HTTPException(
                status_code=400,
                detail=f"Answer model {ask_request.answer_model} not found",
            )
        if not final_answer_model:
            raise HTTPException(
                status_code=400,
                detail=f"Final answer model {ask_request.final_answer_model} not found",
            )

        # Check if embedding model is available
        if not await model_manager.get_embedding_model():
            raise HTTPException(
                status_code=400,
                detail="Ask feature requires an embedding model. Please configure one in the Models section.",
            )

        # For streaming response
        return StreamingResponse(
            stream_ask_response(
                ask_request.question, strategy_model, answer_model, final_answer_model
            ),
            media_type="text/plain",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in ask endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ask operation failed: {str(e)}")


@router.post("/search/ask/simple", response_model=AskResponse)
async def ask_knowledge_base_simple(ask_request: AskRequest):
    """Ask the knowledge base a question and return a simple response (non-streaming)."""
    try:
        # Validate models exist
        strategy_model = await Model.get(ask_request.strategy_model)
        answer_model = await Model.get(ask_request.answer_model)
        final_answer_model = await Model.get(ask_request.final_answer_model)

        if not strategy_model:
            raise HTTPException(
                status_code=400,
                detail=f"Strategy model {ask_request.strategy_model} not found",
            )
        if not answer_model:
            raise HTTPException(
                status_code=400,
                detail=f"Answer model {ask_request.answer_model} not found",
            )
        if not final_answer_model:
            raise HTTPException(
                status_code=400,
                detail=f"Final answer model {ask_request.final_answer_model} not found",
            )

        # Check if embedding model is available
        if not await model_manager.get_embedding_model():
            raise HTTPException(
                status_code=400,
                detail="Ask feature requires an embedding model. Please configure one in the Models section.",
            )

        # Run the ask graph and get final result
        final_answer = None
        async for chunk in ask_graph.astream(
            input=dict(question=ask_request.question),  # type: ignore[arg-type]
            config=dict(
                configurable=dict(
                    strategy_model=strategy_model.id,
                    answer_model=answer_model.id,
                    final_answer_model=final_answer_model.id,
                )
            ),
            stream_mode="updates",
        ):
            if "write_final_answer" in chunk:
                final_answer = chunk["write_final_answer"]["final_answer"]

        if not final_answer:
            raise HTTPException(status_code=500, detail="No answer generated")

        return AskResponse(answer=final_answer, question=ask_request.question)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in ask simple endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ask operation failed: {str(e)}")
