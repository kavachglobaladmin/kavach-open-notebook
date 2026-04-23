from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from loguru import logger

from api.auth import get_current_user
from api.models import (
    NotebookCreate,
    NotebookDeletePreview,
    NotebookDeleteResponse,
    NotebookResponse,
    NotebookUpdate,
)
from open_notebook.database.repository import ensure_record_id, repo_query
from open_notebook.domain.notebook import Notebook, Source
from open_notebook.exceptions import InvalidInputError

router = APIRouter()


def _calc_storage_used_mb(nb_id: str, sources: list) -> float:
    """Sum file sizes (MB) of all uploaded sources linked to this notebook."""
    total_bytes = 0
    for src in sources:
        asset = src.get("asset") or {}
        file_path = asset.get("file_path") if isinstance(asset, dict) else None
        if file_path:
            try:
                total_bytes += Path(file_path).stat().st_size
            except OSError:
                pass
    return round(total_bytes / (1024 * 1024), 2)


async def _get_notebook_storage_used_mb(notebook_id: str) -> float:
    """Query sources for a notebook and calculate total file storage used."""
    try:
        srcs = await repo_query(
            "SELECT asset FROM (SELECT in as source FROM reference WHERE out=$id FETCH source)[*].source",
            {"id": ensure_record_id(notebook_id)},
        )
        return _calc_storage_used_mb(notebook_id, srcs)
    except Exception:
        return 0.0


@router.get("/notebooks", response_model=List[NotebookResponse])
async def get_notebooks(
    request: Request,
    archived: Optional[bool] = Query(None, description="Filter by archived status"),
    order_by: str = Query("updated desc", description="Order by field and direction"),
    current_user: Optional[str] = Depends(get_current_user),
):
    """Get all notebooks with optional filtering and ordering."""
    try:
        # Build the query with counts, filtered by owner when a user is present
        if current_user:
            query = f"""
                SELECT *,
                count(<-reference.in) as source_count,
                count(<-artifact.in) as note_count
                FROM notebook
                WHERE owner = $owner
                ORDER BY {order_by}
            """
            result = await repo_query(query, {"owner": current_user})
        else:
            query = f"""
                SELECT *,
                count(<-reference.in) as source_count,
                count(<-artifact.in) as note_count
                FROM notebook
                ORDER BY {order_by}
            """
            result = await repo_query(query)

        # Filter by archived status if specified
        if archived is not None:
            result = [nb for nb in result if nb.get("archived") == archived]

        # Build responses — calculate storage_used_mb only for notebooks with a limit
        responses = []
        for nb in result:
            nb_id = str(nb.get("id", ""))
            limit = nb.get("storage_limit_mb")
            used = await _get_notebook_storage_used_mb(nb_id) if limit else None
            responses.append(NotebookResponse(
                id=nb_id,
                name=nb.get("name", ""),
                description=nb.get("description", ""),
                archived=nb.get("archived", False),
                storage_limit_mb=limit,
                storage_used_mb=used,
                created=str(nb.get("created", "")),
                updated=str(nb.get("updated", "")),
                source_count=nb.get("source_count", 0),
                note_count=nb.get("note_count", 0),
            ))
        return responses
    except Exception as e:
        logger.error(f"Error fetching notebooks: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error fetching notebooks: {str(e)}"
        )


@router.post("/notebooks", response_model=NotebookResponse)
async def create_notebook(
    notebook: NotebookCreate,
    current_user: Optional[str] = Depends(get_current_user),
):
    """Create a new notebook."""
    try:
        new_notebook = Notebook(
            name=notebook.name,
            description=notebook.description,
            owner=current_user,
            storage_limit_mb=notebook.storage_limit_mb,
        )
        await new_notebook.save()

        return NotebookResponse(
            id=new_notebook.id or "",
            name=new_notebook.name,
            description=new_notebook.description,
            archived=new_notebook.archived or False,
            storage_limit_mb=new_notebook.storage_limit_mb,
            storage_used_mb=0.0,
            created=str(new_notebook.created),
            updated=str(new_notebook.updated),
            source_count=0,
            note_count=0,
        )
    except InvalidInputError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating notebook: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error creating notebook: {str(e)}"
        )


@router.get("/notebooks/{notebook_id}/delete-preview", response_model=NotebookDeletePreview)
async def get_notebook_delete_preview(
    notebook_id: str,
    current_user: Optional[str] = Depends(get_current_user),
):
    """Get a preview of what will be deleted when this notebook is deleted."""
    try:
        notebook = await Notebook.get(notebook_id)
        if not notebook:
            raise HTTPException(status_code=404, detail="Notebook not found")
        if current_user and notebook.owner and notebook.owner != current_user:
            raise HTTPException(status_code=403, detail="Access denied")

        preview = await notebook.get_delete_preview()

        return NotebookDeletePreview(
            notebook_id=str(notebook.id),
            notebook_name=notebook.name,
            note_count=preview["note_count"],
            exclusive_source_count=preview["exclusive_source_count"],
            shared_source_count=preview["shared_source_count"],
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting delete preview for notebook {notebook_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching notebook deletion preview: {str(e)}",
        )


@router.get("/notebooks/{notebook_id}", response_model=NotebookResponse)
async def get_notebook(
    notebook_id: str,
    current_user: Optional[str] = Depends(get_current_user),
):
    """Get a specific notebook by ID."""
    try:
        # Query with counts for single notebook
        query = """
            SELECT *,
            count(<-reference.in) as source_count,
            count(<-artifact.in) as note_count
            FROM $notebook_id
        """
        result = await repo_query(query, {"notebook_id": ensure_record_id(notebook_id)})

        if not result:
            raise HTTPException(status_code=404, detail="Notebook not found")

        nb = result[0]

        # Owner check — deny access if notebook belongs to a different user
        nb_owner = nb.get("owner")
        if current_user and nb_owner and nb_owner != current_user:
            raise HTTPException(status_code=403, detail="Access denied")

        nb_id = str(nb.get("id", ""))
        storage_used = await _get_notebook_storage_used_mb(nb_id)
        return NotebookResponse(
            id=nb_id,
            name=nb.get("name", ""),
            description=nb.get("description", ""),
            archived=nb.get("archived", False),
            storage_limit_mb=nb.get("storage_limit_mb"),
            storage_used_mb=storage_used,
            created=str(nb.get("created", "")),
            updated=str(nb.get("updated", "")),
            source_count=nb.get("source_count", 0),
            note_count=nb.get("note_count", 0),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching notebook {notebook_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error fetching notebook: {str(e)}"
        )


@router.put("/notebooks/{notebook_id}", response_model=NotebookResponse)
async def update_notebook(
    notebook_id: str,
    notebook_update: NotebookUpdate,
    current_user: Optional[str] = Depends(get_current_user),
):
    """Update a notebook."""
    try:
        notebook = await Notebook.get(notebook_id)
        if not notebook:
            raise HTTPException(status_code=404, detail="Notebook not found")

        # Owner check
        if current_user and notebook.owner and notebook.owner != current_user:
            raise HTTPException(status_code=403, detail="Access denied")

        # Update only provided fields
        if notebook_update.name is not None:
            notebook.name = notebook_update.name
        if notebook_update.description is not None:
            notebook.description = notebook_update.description
        if notebook_update.archived is not None:
            notebook.archived = notebook_update.archived

        await notebook.save()

        # Query with counts after update
        query = """
            SELECT *,
            count(<-reference.in) as source_count,
            count(<-artifact.in) as note_count
            FROM $notebook_id
        """
        result = await repo_query(query, {"notebook_id": ensure_record_id(notebook_id)})

        if result:
            nb = result[0]
            return NotebookResponse(
                id=str(nb.get("id", "")),
                name=nb.get("name", ""),
                description=nb.get("description", ""),
                archived=nb.get("archived", False),
                created=str(nb.get("created", "")),
                updated=str(nb.get("updated", "")),
                source_count=nb.get("source_count", 0),
                note_count=nb.get("note_count", 0),
            )

        # Fallback if query fails
        return NotebookResponse(
            id=notebook.id or "",
            name=notebook.name,
            description=notebook.description,
            archived=notebook.archived or False,
            created=str(notebook.created),
            updated=str(notebook.updated),
            source_count=0,
            note_count=0,
        )
    except HTTPException:
        raise
    except InvalidInputError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating notebook {notebook_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error updating notebook: {str(e)}"
        )


@router.post("/notebooks/{notebook_id}/sources/{source_id}")
async def add_source_to_notebook(
    notebook_id: str,
    source_id: str,
    current_user: Optional[str] = Depends(get_current_user),
):
    """Add an existing source to a notebook (create the reference)."""
    try:
        notebook = await Notebook.get(notebook_id)
        if not notebook:
            raise HTTPException(status_code=404, detail="Notebook not found")
        if current_user and notebook.owner and notebook.owner != current_user:
            raise HTTPException(status_code=403, detail="Access denied")

        # Check if source exists
        source = await Source.get(source_id)
        if not source:
            raise HTTPException(status_code=404, detail="Source not found")

        # Check if reference already exists (idempotency)
        existing_ref = await repo_query(
            "SELECT * FROM reference WHERE out = $source_id AND in = $notebook_id",
            {
                "notebook_id": ensure_record_id(notebook_id),
                "source_id": ensure_record_id(source_id),
            },
        )

        # If reference doesn't exist, create it
        if not existing_ref:
            await repo_query(
                "RELATE $source_id->reference->$notebook_id",
                {
                    "notebook_id": ensure_record_id(notebook_id),
                    "source_id": ensure_record_id(source_id),
                },
            )

        return {"message": "Source linked to notebook successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error linking source {source_id} to notebook {notebook_id}: {str(e)}"
        )
        raise HTTPException(
            status_code=500, detail=f"Error linking source to notebook: {str(e)}"
        )


@router.delete("/notebooks/{notebook_id}/sources/{source_id}")
async def remove_source_from_notebook(
    notebook_id: str,
    source_id: str,
    current_user: Optional[str] = Depends(get_current_user),
):
    """Remove a source from a notebook (delete the reference)."""
    try:
        notebook = await Notebook.get(notebook_id)
        if not notebook:
            raise HTTPException(status_code=404, detail="Notebook not found")
        if current_user and notebook.owner and notebook.owner != current_user:
            raise HTTPException(status_code=403, detail="Access denied")

        # Delete the reference record linking source to notebook
        await repo_query(
            "DELETE FROM reference WHERE out = $notebook_id AND in = $source_id",
            {
                "notebook_id": ensure_record_id(notebook_id),
                "source_id": ensure_record_id(source_id),
            },
        )

        return {"message": "Source removed from notebook successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error removing source {source_id} from notebook {notebook_id}: {str(e)}"
        )
        raise HTTPException(
            status_code=500, detail=f"Error removing source from notebook: {str(e)}"
        )


@router.delete("/notebooks/{notebook_id}", response_model=NotebookDeleteResponse)
async def delete_notebook(
    notebook_id: str,
    delete_exclusive_sources: bool = Query(False),
    current_user: Optional[str] = Depends(get_current_user),
):
    """Delete a notebook with cascade deletion."""
    try:
        notebook = await Notebook.get(notebook_id)
        if not notebook:
            raise HTTPException(status_code=404, detail="Notebook not found")
        if current_user and notebook.owner and notebook.owner != current_user:
            raise HTTPException(status_code=403, detail="Access denied")

        result = await notebook.delete(delete_exclusive_sources=delete_exclusive_sources)

        return NotebookDeleteResponse(
            message="Notebook deleted successfully",
            deleted_notes=result["deleted_notes"],
            deleted_sources=result["deleted_sources"],
            unlinked_sources=result["unlinked_sources"],
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting notebook {notebook_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error deleting notebook: {str(e)}"
        )
