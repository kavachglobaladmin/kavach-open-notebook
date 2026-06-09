from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from loguru import logger

from api.auth import get_current_user, get_current_user_role
from api.notebook_access import (
    can_access_notebook,
    get_accessible_notebook_ids,
    normalize_notebook_id,
)
from api.models import NoteCreate, NoteResponse, NoteUpdate
from api.roles import has_elevated_data_access
from open_notebook.domain.notebook import Note
from open_notebook.exceptions import InvalidInputError

router = APIRouter()


def _can_access_owner(
    current_user: Optional[str],
    current_role: str,
    owner: Optional[str],
) -> bool:
    if has_elevated_data_access(current_role):
        return True
    if not current_user or not owner:
        return True
    return owner == current_user


@router.get("/notes", response_model=List[NoteResponse])
async def get_notes(
    request: Request,
    notebook_id: Optional[str] = Query(None, description="Filter by notebook ID"),
    current_user: Optional[str] = Depends(get_current_user),
    current_role: str = Depends(get_current_user_role),
):
    """Get all notes with optional notebook filtering."""
    try:
        if notebook_id:
            # Get notes for a specific notebook — verify ownership first
            from open_notebook.domain.notebook import Notebook

            notebook = await Notebook.get(normalize_notebook_id(notebook_id))
            if not notebook:
                raise HTTPException(status_code=404, detail="Notebook not found")
            if not await can_access_notebook(current_user, current_role, notebook_id):
                raise HTTPException(status_code=403, detail="Access denied")
            notes = await notebook.get_notes()
        elif current_user and not has_elevated_data_access(current_role):
            from open_notebook.database.repository import repo_query
            accessible_notebook_ids = await get_accessible_notebook_ids(
                current_user, current_role
            )
            notebook_note_ids = []
            if accessible_notebook_ids:
                notebook_note_ids = await repo_query(
                    "SELECT VALUE in FROM artifact WHERE out IN $notebook_ids",
                    {"notebook_ids": list(accessible_notebook_ids)},
                )
            direct_note_ids = await repo_query(
                "SELECT VALUE id FROM note WHERE owner = $owner",
                {"owner": current_user},
            )
            note_ids = list({str(note_id) for note_id in notebook_note_ids + direct_note_ids})
            if note_ids:
                result = await repo_query(
                    "SELECT * FROM note WHERE id IN $note_ids ORDER BY updated DESC",
                    {"note_ids": note_ids},
                )
            else:
                result = []
            notes = [Note(**n) for n in result]
        else:
            # No user context — return all notes (auth disabled / legacy)
            notes = await Note.get_all(order_by="updated desc")

        return [
            NoteResponse(
                id=note.id or "",
                title=note.title,
                content=note.content,
                note_type=note.note_type,
                created=str(note.created),
                updated=str(note.updated),
            )
            for note in notes
        ]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching notes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching notes: {str(e)}")


@router.post("/notes", response_model=NoteResponse)
async def create_note(
    note_data: NoteCreate,
    current_user: Optional[str] = Depends(get_current_user),
    current_role: str = Depends(get_current_user_role),
):
    """Create a new note."""
    try:
        # Auto-generate title if not provided and it's an AI note
        title = note_data.title
        if not title and note_data.note_type == "ai" and note_data.content:
            from open_notebook.graphs.prompt import graph as prompt_graph

            prompt = "Based on the Note below, please provide a Title for this content, with max 15 words"
            result = await prompt_graph.ainvoke(
                {  # type: ignore[arg-type]
                    "input_text": note_data.content,
                    "prompt": prompt,
                }
            )
            title = result.get("output", "Untitled Note")

        # Validate note_type
        note_type: Optional[Literal["human", "ai"]] = None
        if note_data.note_type in ("human", "ai"):
            note_type = note_data.note_type  # type: ignore[assignment]
        elif note_data.note_type is not None:
            raise HTTPException(
                status_code=400, detail="note_type must be 'human' or 'ai'"
            )

        new_note = Note(
            title=title,
            content=note_data.content,
            note_type=note_type,
            owner=current_user,
        )
        command_id = await new_note.save()

        # Add to notebook if specified
        if note_data.notebook_id:
            from open_notebook.domain.notebook import Notebook

            notebook = await Notebook.get(normalize_notebook_id(note_data.notebook_id))
            if not notebook:
                raise HTTPException(status_code=404, detail="Notebook not found")
            if not await can_access_notebook(
                current_user, current_role, note_data.notebook_id
            ):
                raise HTTPException(status_code=403, detail="Access denied")
            await new_note.add_to_notebook(note_data.notebook_id)

        return NoteResponse(
            id=new_note.id or "",
            title=new_note.title,
            content=new_note.content,
            note_type=new_note.note_type,
            created=str(new_note.created),
            updated=str(new_note.updated),
            command_id=str(command_id) if command_id else None,
        )
    except HTTPException:
        raise
    except InvalidInputError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating note: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error creating note: {str(e)}")


@router.get("/notes/{note_id}", response_model=NoteResponse)
async def get_note(
    note_id: str,
    current_user: Optional[str] = Depends(get_current_user),
    current_role: str = Depends(get_current_user_role),
):
    """Get a specific note by ID."""
    try:
        note = await Note.get(note_id)
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        if not _can_access_owner(current_user, current_role, getattr(note, "owner", None)):
            raise HTTPException(status_code=403, detail="Access denied")

        return NoteResponse(
            id=note.id or "",
            title=note.title,
            content=note.content,
            note_type=note.note_type,
            created=str(note.created),
            updated=str(note.updated),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching note {note_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching note: {str(e)}")


@router.put("/notes/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: str,
    note_update: NoteUpdate,
    current_user: Optional[str] = Depends(get_current_user),
    current_role: str = Depends(get_current_user_role),
):
    """Update a note."""
    try:
        note = await Note.get(note_id)
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        if not _can_access_owner(current_user, current_role, getattr(note, "owner", None)):
            raise HTTPException(status_code=403, detail="Access denied")

        # Update only provided fields
        if note_update.title is not None:
            note.title = note_update.title
        if note_update.content is not None:
            note.content = note_update.content
        if note_update.note_type is not None:
            if note_update.note_type in ("human", "ai"):
                note.note_type = note_update.note_type  # type: ignore[assignment]
            else:
                raise HTTPException(
                    status_code=400, detail="note_type must be 'human' or 'ai'"
                )

        command_id = await note.save()

        return NoteResponse(
            id=note.id or "",
            title=note.title,
            content=note.content,
            note_type=note.note_type,
            created=str(note.created),
            updated=str(note.updated),
            command_id=str(command_id) if command_id else None,
        )
    except HTTPException:
        raise
    except InvalidInputError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating note {note_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating note: {str(e)}")


@router.delete("/notes/{note_id}")
async def delete_note(
    note_id: str,
    current_user: Optional[str] = Depends(get_current_user),
    current_role: str = Depends(get_current_user_role),
):
    """Delete a note."""
    try:
        note = await Note.get(note_id)
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        if not _can_access_owner(current_user, current_role, getattr(note, "owner", None)):
            raise HTTPException(status_code=403, detail="Access denied")

        await note.delete()

        return {"message": "Note deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting note {note_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error deleting note: {str(e)}")
