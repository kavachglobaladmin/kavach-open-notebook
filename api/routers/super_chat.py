import asyncio
import json
import traceback
from typing import Any, AsyncIterator, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.runnables import RunnableConfig
from pydantic import BaseModel, Field
import logging as logger

from i_Notes.database.repository import ensure_record_id, repo_query
from i_Notes.domain.i_Notes import ChatSession, Note, i_Notes, Source
from i_Notes.exceptions import NotFoundError
from i_Notes.graphs.super_chat import (
    graph as super_chat_graph,
    stream_model_tokens as stream_super_chat_tokens,
)
from i_Notes.utils.graph_utils import get_session_message_count

router = APIRouter()


def _fallback_suggested_questions(user_message: str, ai_response: str) -> list[str]:
    prompt = (user_message or "").strip().rstrip("?.!")
    if not prompt:
        return [
            "Which sub-folder is most relevant here?",
            "What are the key facts across the folders?",
            "What should I investigate next in this case?",
        ]

    topic = prompt[:80]
    return [
        f"Which sub-folder has the strongest evidence about {topic}?",
        f"What supporting facts exist across folders for {topic}?",
        f"What should I explore next about {topic}?",
    ]


def _ensure_super_session(session: Optional[ChatSession]) -> ChatSession:
    if not session or getattr(session, "chat_mode", None) != "super":
        raise HTTPException(status_code=404, detail="Super chat session not found")
    return session


async def _get_related_i_Notes(
    record_table: str, record_id: str
) -> list[dict[str, str]]:
    relation_table = "reference" if record_table == "source" else "artifact"
    try:
        rows = await repo_query(
            f"SELECT out AS i_Notes FROM {relation_table} WHERE in = $record_id",
            {"record_id": ensure_record_id(record_id)},
        )
    except Exception:
        return []

    i_Notes: list[dict[str, str]] = []
    for row in rows or []:
        i_Notes_obj = row.get("i_Notes")
        if not i_Notes_obj:
            continue
        try:
            i_Notes = (
                i_Notes(**i_Notes_obj)
                if isinstance(i_Notes_obj, dict)
                else await i_Notes.get(str(i_Notes_obj))
            )
        except Exception:
            continue
        if i_Notes and i_Notes.id:
            i_Notes.append({"id": str(i_Notes.id), "name": i_Notes.name})
    return i_Notes


class CreateSessionRequest(BaseModel):
    i_Notes_id: str = Field(..., description="i_Notes ID to create session for")
    title: Optional[str] = Field(None, description="Optional session title")
    model_override: Optional[str] = Field(
        None, description="Optional model override for this session"
    )


class UpdateSessionRequest(BaseModel):
    title: Optional[str] = Field(None, description="New session title")
    model_override: Optional[str] = Field(
        None, description="Model override for this session"
    )


class ChatMessage(BaseModel):
    id: str = Field(..., description="Message ID")
    type: str = Field(..., description="Message type (human|ai)")
    content: str = Field(..., description="Message content")
    timestamp: Optional[str] = Field(None, description="Message timestamp")


class ChatSessionResponse(BaseModel):
    id: str = Field(..., description="Session ID")
    title: str = Field(..., description="Session title")
    i_Notes_id: Optional[str] = Field(None, description="i_Notes ID")
    created: str = Field(..., description="Creation timestamp")
    updated: str = Field(..., description="Last update timestamp")
    message_count: Optional[int] = Field(
        None, description="Number of messages in session"
    )
    model_override: Optional[str] = Field(
        None, description="Model override for this session"
    )


class ChatSessionWithMessagesResponse(ChatSessionResponse):
    messages: List[ChatMessage] = Field(
        default_factory=list, description="Session messages"
    )
    suggested_questions: Optional[List[str]] = Field(
        None, description="Last suggested follow-up questions"
    )


class ExecuteChatRequest(BaseModel):
    session_id: str = Field(..., description="Chat session ID")
    message: str = Field(..., description="User message content")
    context: Dict[str, Any] = Field(
        ..., description="Chat context with sources and notes"
    )
    model_override: Optional[str] = Field(
        None, description="Optional model override for this message"
    )


class BuildContextRequest(BaseModel):
    i_Notes_id: str = Field(..., description="i_Notes ID")
    context_config: Dict[str, Any] = Field(..., description="Context configuration")
    folder_structure: Optional[List[Dict[str, Any]]] = Field(
        None, description="Folder structure with source/note IDs per folder"
    )


class BuildContextResponse(BaseModel):
    context: Dict[str, Any] = Field(..., description="Built context data")
    token_count: int = Field(..., description="Estimated token count")
    char_count: int = Field(..., description="Character count")


class SuccessResponse(BaseModel):
    success: bool = Field(True, description="Operation success status")
    message: str = Field(..., description="Success message")


@router.get("/super-chat/sessions", response_model=List[ChatSessionResponse])
async def get_sessions(i_Notes_id: str = Query(..., description="i_Notes ID")):
    try:
        i_Notes = await i_Notes.get(i_Notes_id)
        if not i_Notes:
            raise HTTPException(status_code=404, detail="i_Notes not found")

        sessions_list = await i_Notes.get_chat_sessions()

        results = []
        for session in sessions_list:
            if getattr(session, "chat_mode", None) != "super":
                continue

            session_id = str(session.id)
            msg_count = await get_session_message_count(super_chat_graph, session_id)
            results.append(
                ChatSessionResponse(
                    id=session.id or "",
                    title=session.title or "Untitled Session",
                    i_Notes_id=i_Notes_id,
                    created=str(session.created),
                    updated=str(session.updated),
                    message_count=msg_count,
                    model_override=getattr(session, "model_override", None),
                )
            )

        return results
    except NotFoundError:
        raise HTTPException(status_code=404, detail="i_Notes not found")
    except Exception as e:
        logger.error(f"Error fetching super chat sessions: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error fetching super chat sessions: {str(e)}"
        )


@router.post("/super-chat/sessions", response_model=ChatSessionResponse)
async def create_session(request: CreateSessionRequest):
    try:
        i_Notes = await i_Notes.get(request.i_Notes_id)
        if not i_Notes:
            raise HTTPException(status_code=404, detail="i_Notes not found")

        session = ChatSession(
            title=request.title
            or f"Super Chat {asyncio.get_event_loop().time():.0f}",
            model_override=request.model_override,
            chat_mode="super",
        )
        await session.save()
        await session.relate_to_i_Notes(request.i_Notes_id)

        return ChatSessionResponse(
            id=session.id or "",
            title=session.title or "",
            i_Notes_id=request.i_Notes_id,
            created=str(session.created),
            updated=str(session.updated),
            message_count=0,
            model_override=session.model_override,
        )
    except NotFoundError:
        raise HTTPException(status_code=404, detail="i_Notes not found")
    except Exception as e:
        logger.error(f"Error creating super chat session: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error creating super chat session: {str(e)}"
        )


@router.get(
    "/super-chat/sessions/{session_id}",
    response_model=ChatSessionWithMessagesResponse,
)
async def get_session(session_id: str):
    try:
        full_session_id = (
            session_id
            if session_id.startswith("chat_session:")
            else f"chat_session:{session_id}"
        )
        session = _ensure_super_session(await ChatSession.get(full_session_id))

        thread_state = await asyncio.to_thread(
            super_chat_graph.get_state,
            config=RunnableConfig(configurable={"thread_id": full_session_id}),
        )

        messages: list[ChatMessage] = []
        if thread_state and thread_state.values and "messages" in thread_state.values:
            for msg in thread_state.values["messages"]:
                messages.append(
                    ChatMessage(
                        id=getattr(msg, "id", f"msg_{len(messages)}"),
                        type=msg.type if hasattr(msg, "type") else "unknown",
                        content=msg.content if hasattr(msg, "content") else str(msg),
                        timestamp=None,
                    )
                )

        i_Notes_query = await repo_query(
            "SELECT out FROM refers_to WHERE in = $session_id",
            {"session_id": ensure_record_id(full_session_id)},
        )
        i_Notes_id = i_Notes_query[0]["out"] if i_Notes_query else None

        return ChatSessionWithMessagesResponse(
            id=session.id or "",
            title=session.title or "Untitled Session",
            i_Notes_id=i_Notes_id,
            created=str(session.created),
            updated=str(session.updated),
            message_count=len(messages),
            messages=messages,
            model_override=getattr(session, "model_override", None),
            suggested_questions=getattr(session, "suggested_questions", None),
        )
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Super chat session not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching super chat session: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error fetching super chat session: {str(e)}"
        )


@router.put("/super-chat/sessions/{session_id}", response_model=ChatSessionResponse)
async def update_session(session_id: str, request: UpdateSessionRequest):
    try:
        full_session_id = (
            session_id
            if session_id.startswith("chat_session:")
            else f"chat_session:{session_id}"
        )
        session = _ensure_super_session(await ChatSession.get(full_session_id))

        update_data = request.model_dump(exclude_unset=True)
        if "title" in update_data:
            session.title = update_data["title"]
        if "model_override" in update_data:
            session.model_override = update_data["model_override"]
        await session.save()

        i_Notes_query = await repo_query(
            "SELECT out FROM refers_to WHERE in = $session_id",
            {"session_id": ensure_record_id(full_session_id)},
        )
        i_Notes_id = i_Notes_query[0]["out"] if i_Notes_query else None
        msg_count = await get_session_message_count(super_chat_graph, full_session_id)

        return ChatSessionResponse(
            id=session.id or "",
            title=session.title or "",
            i_Notes_id=i_Notes_id,
            created=str(session.created),
            updated=str(session.updated),
            message_count=msg_count,
            model_override=session.model_override,
        )
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Super chat session not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating super chat session: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error updating super chat session: {str(e)}"
        )


@router.delete("/super-chat/sessions/{session_id}", response_model=SuccessResponse)
async def delete_session(session_id: str):
    try:
        full_session_id = (
            session_id
            if session_id.startswith("chat_session:")
            else f"chat_session:{session_id}"
        )
        session = _ensure_super_session(await ChatSession.get(full_session_id))
        await session.delete()
        return SuccessResponse(
            success=True, message="Super chat session deleted successfully"
        )
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Super chat session not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting super chat session: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error deleting super chat session: {str(e)}"
        )


@router.post("/super-chat/stream-execute")
async def stream_execute_chat(request: ExecuteChatRequest):
    try:
        full_session_id = (
            request.session_id
            if request.session_id.startswith("chat_session:")
            else f"chat_session:{request.session_id}"
        )
        session = _ensure_super_session(await ChatSession.get(full_session_id))

        model_override = (
            request.model_override
            if request.model_override is not None
            else getattr(session, "model_override", None)
        )

        current_state = await asyncio.to_thread(
            super_chat_graph.get_state,
            config=RunnableConfig(configurable={"thread_id": full_session_id}),
        )

        state_values = current_state.values if current_state else {}
        state_values["messages"] = state_values.get("messages", [])
        state_values["context"] = request.context
        state_values["model_override"] = model_override

        user_message = HumanMessage(content=request.message)
        state_values["messages"].append(user_message)

        await asyncio.to_thread(
            super_chat_graph.update_state,
            config=RunnableConfig(
                configurable={
                    "thread_id": full_session_id,
                    "model_id": model_override,
                }
            ),
            values={"messages": user_message},
        )

        async def generate_stream() -> AsyncIterator[str]:
            accumulated_response = ""
            token_count = 0
            try:
                async for token in stream_super_chat_tokens(
                    state_values["messages"], model_override, state_values
                ):
                    accumulated_response += token
                    token_count += 1
                    yield f"data: {json.dumps({'token': token})}\n\n"
                    await asyncio.sleep(0)

                ai_message = AIMessage(content=accumulated_response)
                await asyncio.to_thread(
                    super_chat_graph.update_state,
                    config=RunnableConfig(
                        configurable={
                            "thread_id": full_session_id,
                            "model_id": model_override,
                        }
                    ),
                    values={"messages": ai_message},
                )

                await session.save()

                try:
                    prompt_text = f"""Based on the conversation below, generate 3 insightful follow-up questions that the user might want to ask next.

User Question: {request.message}

AI Response: {accumulated_response[:1000]}

Requirements:
- Generate exactly 3 questions
- Questions should be natural follow-ups to the current conversation
- Keep questions concise and clear (under 15 words each)
- Return ONLY a valid JSON array - nothing else

Return ONLY this format:
["First question here?", "Second question here?", "Third question here?"]"""

                    from i_Notes.ai.provision import provision_langchain_model
                    from langchain_core.messages import SystemMessage

                    model = await provision_langchain_model(
                        prompt_text,
                        model_override,
                        "chat",
                        max_tokens=200,
                    )
                    response = model.invoke([SystemMessage(content=prompt_text)])
                    response_text = (
                        response.content if hasattr(response, "content") else str(response)
                    )

                    import json as json_lib
                    import re

                    questions = None
                    try:
                        questions = json_lib.loads(response_text.strip())
                    except json_lib.JSONDecodeError:
                        pass

                    if not questions:
                        cleaned = re.sub(r"```(?:json)?\n?", "", response_text).strip()
                        cleaned = cleaned.replace("```", "").strip()
                        try:
                            questions = json_lib.loads(cleaned)
                        except json_lib.JSONDecodeError:
                            pass

                    if not questions:
                        json_match = re.search(
                            r'\[\s*["\'].*?["\'][^\]]*\]',
                            response_text,
                            re.DOTALL,
                        )
                        if json_match:
                            try:
                                questions = json_lib.loads(json_match.group())
                            except json_lib.JSONDecodeError:
                                pass

                    questions_list = []
                    if questions and isinstance(questions, list):
                        questions_list = [
                            q.strip()
                            for q in questions
                            if isinstance(q, str) and q.strip()
                        ][:3]

                    if not questions_list:
                        questions_list = _fallback_suggested_questions(
                            request.message, accumulated_response
                        )

                    session.suggested_questions = questions_list
                    await session.save()
                    yield (
                        "data: "
                        + json.dumps(
                            {
                                "type": "suggested_questions",
                                "questions": questions_list,
                            }
                        )
                        + "\n\n"
                    )
                except Exception:
                    fallback_questions = _fallback_suggested_questions(
                        request.message, accumulated_response
                    )
                    session.suggested_questions = fallback_questions
                    await session.save()
                    yield (
                        "data: "
                        + json.dumps(
                            {
                                "type": "suggested_questions",
                                "questions": fallback_questions,
                            }
                        )
                        + "\n\n"
                    )

                yield (
                    "data: "
                    + json.dumps(
                        {
                            "done": True,
                            "total_length": len(accumulated_response),
                            "total_tokens": token_count,
                        }
                    )
                    + "\n\n"
                )
            except Exception as e:
                logger.error(
                    f"Error during super chat streaming: {str(e)}\n{traceback.format_exc()}"
                )
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

        return StreamingResponse(
            generate_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
                "Transfer-Encoding": "chunked",
            },
        )
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Super chat session not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in super chat stream_execute: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error executing chat: {str(e)}")


@router.post("/super-chat/context", response_model=BuildContextResponse)
async def build_context(request: BuildContextRequest):
    try:
        i_Notes = await i_Notes.get(request.i_Notes_id)
        if not i_Notes:
            raise HTTPException(status_code=404, detail="i_Notes not found")

        context_data: dict[str, list[dict[str, Any]]] = {"sources": [], "notes": []}
        total_content = ""

        # Collect ALL source/note IDs that should be loaded.
        # Use context_config as the primary list, then supplement with any
        # source/note IDs from folder_structure that are missing — this handles
        # the case where the frontend's merged sources list was stale when
        # buildContext ran.
        source_configs: dict[str, str] = {}
        note_configs: dict[str, str] = {}

        if request.context_config:
            for sid, status in request.context_config.get("sources", {}).items():
                source_configs[sid] = status
            for nid, status in request.context_config.get("notes", {}).items():
                note_configs[nid] = status

        # Supplement from folder_structure — any source/note ID not already
        # in context_config gets added with "full content" as default mode.
        for folder in (request.folder_structure or []):
            if not isinstance(folder, dict):
                continue
            if not folder.get("has_context"):
                continue
            for source_meta in folder.get("sources") or []:
                if not isinstance(source_meta, dict):
                    continue
                sid = str(source_meta.get("id") or "").strip()
                if sid and sid not in source_configs:
                    logger.info(f"[SuperChat] folder_structure supplement: adding source {sid}")
                    source_configs[sid] = "full content"
            for note_meta in folder.get("notes") or []:
                if not isinstance(note_meta, dict):
                    continue
                nid = str(note_meta.get("id") or "").strip()
                if nid and nid not in note_configs:
                    note_configs[nid] = "full content"

        loaded_source_ids: set[str] = set()
        logger.info(f"[SuperChat] build_context: {len(source_configs)} total sources to load")

        for source_id, status in source_configs.items():
            if "not in" in status:
                continue
            try:
                full_source_id = (
                    source_id
                    if source_id.startswith("source:")
                    else f"source:{source_id}"
                )
                try:
                    source = await Source.get(full_source_id)
                except Exception as e:
                    logger.warning(f"[SuperChat] Could not load source {full_source_id}: {e}")
                    continue

                if "insights" in status:
                    source_context = await source.get_context(context_size="short")
                elif "full content" in status:
                    source_context = await source.get_context(context_size="long")
                else:
                    source_context = await source.get_context(context_size="short")

                source_context["i_Notes"] = await _get_related_i_Notes("source", source_id)
                context_data["sources"].append(source_context)
                loaded_source_ids.add(str(source_context.get("id", source_id)))
                total_content += str(source_context)
            except Exception as e:
                logger.warning(f"[SuperChat] Error processing source {source_id}: {str(e)}")
                continue

        logger.info(f"[SuperChat] build_context: loaded {len(context_data['sources'])} sources")

        for note_id, status in note_configs.items():
            if "not in" in status:
                continue
            try:
                full_note_id = (
                    note_id if note_id.startswith("note:") else f"note:{note_id}"
                )
                note = await Note.get(full_note_id)
                if not note:
                    continue
                if "full content" in status:
                    note_context = note.get_context(context_size="long")
                else:
                    note_context = note.get_context(context_size="short")
                note_context["i_Notes"] = await _get_related_i_Notes("note", note_id)
                context_data["notes"].append(note_context)
                total_content += str(note_context)
            except Exception as e:
                logger.warning(f"[SuperChat] Error processing note {note_id}: {str(e)}")
                continue

        if not source_configs and not note_configs:
            # Fallback: load all sources/notes from the i_Notes if no specific context_config was provided
            sources = await i_Notes.get_sources()
            for source in sources:
                try:
                    source_context = await source.get_context(context_size="short")
                    source_context["i_Notes"] = await _get_related_i_Notes(
                        "source", source.id or ""
                    )
                    context_data["sources"].append(source_context)
                    total_content += str(source_context)
                except Exception as e:
                    logger.warning(f"Error processing source {source.id}: {str(e)}")
                    continue

            notes_list = await i_Notes.get_notes()
            for note in notes_list:
                try:
                    note_context = note.get_context(context_size="short")
                    note_context["i_Notes"] = await _get_related_i_Notes(
                        "note", note.id or ""
                    )
                    context_data["notes"].append(note_context)
                    total_content += str(note_context)
                except Exception as e:
                    logger.warning(f"Error processing note {note.id}: {str(e)}")
                    continue

        char_count = len(total_content)
        try:
            from i_Notes.utils import token_count

            estimated_tokens = token_count(total_content) if total_content else 0
        except ImportError:
            estimated_tokens = char_count // 4

        return BuildContextResponse(
            context=context_data,
            token_count=estimated_tokens,
            char_count=char_count,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error building super chat context: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error building context: {str(e)}"
        )
