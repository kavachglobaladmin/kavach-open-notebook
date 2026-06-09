from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from loguru import logger

from api.auth import get_current_user, get_current_user_role, require_roles
from api.notebook_access import (
    can_access_notebook,
    get_accessible_notebook_ids,
    normalize_notebook_id,
)
from api.models import (
    NotebookCreate,
    NotebookDeletePreview,
    NotebookDeleteResponse,
    NotebookResponse,
    NotebookUpdate,
    NotebookAccessGrant,
    NotebookAccessListResponse,
)
from api.roles import is_super_admin_role, normalize_user_role
from open_notebook.database.repository import ensure_record_id, repo_query
from open_notebook.domain.notebook import Notebook, Source
from open_notebook.exceptions import InvalidInputError

router = APIRouter()


def _can_access_owner(
    current_user: Optional[str],
    current_role: str,
    owner: Optional[str],
) -> bool:
    if is_super_admin_role(current_role):
        return True
    if not current_user or not owner:
        return True
    return owner == current_user


async def _get_target_user_role(email: str) -> Optional[str]:
    rows = await repo_query(
        "SELECT role FROM kavach_user WHERE email = $email LIMIT 1",
        {"email": email.strip().lower()},
    )
    if not rows:
        return None
    return normalize_user_role(rows[0].get("role"))


def _can_manage_grantee(actor_role: str, target_role: Optional[str]) -> bool:
    normalized_actor = normalize_user_role(actor_role)
    normalized_target = normalize_user_role(target_role)

    if normalized_target == "super_admin":
        return False
    if normalized_actor == "super_admin":
        return normalized_target in {"admin", "user"}
    if normalized_actor == "admin":
        return normalized_target == "user"
    return False


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
    current_role: str = Depends(get_current_user_role),
):
    """Get all notebooks with optional filtering and ordering."""
    try:
        # Wrap field name in backticks to avoid SurrealDB v2 keyword conflicts
        safe_order_by = order_by.replace("updated", "`updated`").replace("created", "`created`")
        if archived is True:
            archived_condition = "AND (archived = true)"
        elif archived is False:
            archived_condition = (
                "AND (archived = false OR archived = NONE "
                "OR archived = null OR archived IS NULL)"
            )
        else:
            archived_condition = ""

        accessible_ids = await get_accessible_notebook_ids(current_user, current_role)

        if accessible_ids is None:
            # Super admin or no auth: return all notebooks
            if archived_condition:
                where_clause = f"WHERE 1=1 {archived_condition}"
            else:
                where_clause = ""
            query = f"""
                SELECT *,
                count(<-reference.in) as source_count,
                count(<-artifact.in) as note_count
                FROM notebook
                {where_clause}
                ORDER BY `updated` DESC
            """
            result = await repo_query(query)
        elif not accessible_ids:
            result = []
        else:
            id_conditions = " OR ".join(
                [f"id = $nb_{i}" for i in range(len(accessible_ids))]
            )
            id_params = {
                f"nb_{i}": ensure_record_id(notebook_id)
                for i, notebook_id in enumerate(sorted(accessible_ids))
            }

            where_clause = f"WHERE ({id_conditions})"
            if archived_condition:
                where_clause += f" {archived_condition}"

            query = f"""
                SELECT *,
                count(<-reference.in) as source_count,
                count(<-artifact.in) as note_count
                FROM notebook
                {where_clause}
                ORDER BY `updated` DESC
            """
            result = await repo_query(query, id_params)

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


@router.post("/notebooks/claim-unowned")
async def claim_unowned_notebooks(
    current_user: Optional[str] = Depends(get_current_user),
):
    """
    Assign all unowned notebooks (owner = NONE/null/'user') to the current user.
    Called automatically on the notebooks page load to migrate legacy data.
    Returns the count of notebooks claimed.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        # SurrealDB v3: type::is::none() renamed to type::is_none()
        # Simple equality checks like `owner = NONE` don't always work in WHERE clauses
        result = await repo_query(
            """
            UPDATE notebook
            SET owner = $owner
            WHERE type::is_none(owner)
               OR owner = null
               OR owner = 'user'
            """,
            {"owner": current_user},
        )
        claimed = len(result) if result else 0
        logger.info(f"[notebooks] {current_user} claimed {claimed} unowned notebooks")
        return {"claimed": claimed}
    except Exception as e:
        logger.error(f"Error claiming unowned notebooks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/notebooks/debug-owner")
async def debug_notebook_owners(
    current_user: str = Depends(require_roles("super_admin")),
):
    """
    Debug endpoint — returns all notebooks with their owner field.
    Shows what email is being received as X-User-Email and what owners exist in DB.
    """
    all_notebooks = await repo_query("SELECT id, name, owner FROM notebook")
    return {
        "received_x_user_email": current_user,
        "total_notebooks": len(all_notebooks),
        "notebooks": [
            {
                "id": str(nb.get("id", "")),
                "name": nb.get("name", ""),
                "owner": nb.get("owner"),
            }
            for nb in all_notebooks
        ],
    }


@router.post("/notebooks", response_model=NotebookResponse)
async def create_notebook(
    notebook: NotebookCreate,
    request: Request,
    current_user: Optional[str] = Depends(get_current_user),
):
    """Create a new notebook."""
    try:
        # Ensure owner is always set — fall back to X-User-Email header directly
        # in case get_current_user() returns None due to a timing issue.
        owner = current_user or request.headers.get("X-User-Email") or None
        logger.info(f"[notebooks] Creating notebook '{notebook.name}' with owner='{owner}' (current_user='{current_user}', header='{request.headers.get('X-User-Email')}')")

        new_notebook = Notebook(
            name=notebook.name,
            description=notebook.description,
            owner=owner,
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
    current_role: str = Depends(get_current_user_role),
):
    """Get a preview of what will be deleted when this notebook is deleted."""
    try:
        notebook = await Notebook.get(normalize_notebook_id(notebook_id))
        if not notebook:
            raise HTTPException(status_code=404, detail="Notebook not found")
        if not await can_access_notebook(current_user, current_role, notebook_id):
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
    current_role: str = Depends(get_current_user_role),
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
        nb_id_str = str(nb.get("id", ""))
        if not await can_access_notebook(current_user, current_role, nb_id_str):
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
    current_role: str = Depends(get_current_user_role),
):
    """Update a notebook."""
    try:
        notebook = await Notebook.get(normalize_notebook_id(notebook_id))
        if not notebook:
            raise HTTPException(status_code=404, detail="Notebook not found")

        # Owner check
        if not await can_access_notebook(current_user, current_role, notebook_id):
            raise HTTPException(status_code=403, detail="Access denied")

        # Update only provided fields
        if notebook_update.name is not None:
            notebook.name = notebook_update.name
        if notebook_update.description is not None:
            notebook.description = notebook_update.description
        if notebook_update.archived is not None:
            notebook.archived = notebook_update.archived

        await notebook.save()

        # Re-fetch with counts after save
        result = await repo_query(
            """
            SELECT *,
            count(<-reference.in) as source_count,
            count(<-artifact.in) as note_count
            FROM $notebook_id
            """,
            {"notebook_id": ensure_record_id(notebook_id)},
        )

        if result:
            nb = result[0]
            return NotebookResponse(
                id=str(nb.get("id", "")),
                name=nb.get("name", ""),
                description=nb.get("description", ""),
                archived=nb.get("archived", False),
                storage_limit_mb=nb.get("storage_limit_mb"),
                storage_used_mb=None,
                created=str(nb.get("created", "")),
                updated=str(nb.get("updated", "")),
                source_count=nb.get("source_count", 0),
                note_count=nb.get("note_count", 0),
            )

        # Fallback
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
    current_role: str = Depends(get_current_user_role),
):
    """Add an existing source to a notebook (create the reference)."""
    try:
        notebook = await Notebook.get(normalize_notebook_id(notebook_id))
        if not notebook:
            raise HTTPException(status_code=404, detail="Notebook not found")
        if not await can_access_notebook(current_user, current_role, notebook_id):
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
    current_role: str = Depends(get_current_user_role),
):
    """Remove a source from a notebook (delete the reference)."""
    try:
        notebook = await Notebook.get(normalize_notebook_id(notebook_id))
        if not notebook:
            raise HTTPException(status_code=404, detail="Notebook not found")
        if not await can_access_notebook(current_user, current_role, notebook_id):
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
    current_role: str = Depends(get_current_user_role),
):
    """Delete a notebook with cascade deletion."""
    try:
        notebook = await Notebook.get(normalize_notebook_id(notebook_id))
        if not notebook:
            raise HTTPException(status_code=404, detail="Notebook not found")
        if not await can_access_notebook(current_user, current_role, notebook_id):
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


# ── Notebook Access Management (Super Admin only) ─────────────────────────────

@router.get("/notebooks/{notebook_id}/access", response_model=NotebookAccessListResponse)
async def get_notebook_access(
    notebook_id: str,
    current_user: str = Depends(require_roles("admin", "super_admin")),
    current_role: str = Depends(get_current_user_role),
):
    """Get the list of users granted access to a notebook."""
    try:
        notebook = await Notebook.get(normalize_notebook_id(notebook_id))
        if not notebook:
            raise HTTPException(status_code=404, detail="Notebook not found")
        if not is_super_admin_role(current_role) and not await can_access_notebook(
            current_user, current_role, notebook_id
        ):
            raise HTTPException(status_code=403, detail="Access denied")

        # Use the full notebook ID from the fetched object (includes table prefix)
        full_notebook_id = ensure_record_id(str(notebook.id))

        result = await repo_query(
            "SELECT user_email FROM notebook_access WHERE notebook_id = $notebook_id",
            {"notebook_id": full_notebook_id},
        )
        granted_users = [row["user_email"] for row in result] if result else []
        return NotebookAccessListResponse(
            notebook_id=notebook_id,
            granted_users=granted_users,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching notebook access for {notebook_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/notebooks/{notebook_id}/access")
async def grant_notebook_access(
    notebook_id: str,
    body: NotebookAccessGrant,
    current_user: str = Depends(require_roles("admin", "super_admin")),
    current_role: str = Depends(get_current_user_role),
):
    """Grant a user access to a notebook."""
    try:
        notebook = await Notebook.get(normalize_notebook_id(notebook_id))
        if not notebook:
            raise HTTPException(status_code=404, detail="Notebook not found")

        if not is_super_admin_role(current_role) and not await can_access_notebook(
            current_user, current_role, notebook_id
        ):
            raise HTTPException(status_code=403, detail="Access denied")

        target_email = body.user_email.strip().lower()
        target_role = await _get_target_user_role(target_email)
        if not target_role:
            raise HTTPException(status_code=404, detail="User not found")
        if not _can_manage_grantee(current_role, target_role):
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        full_notebook_id = ensure_record_id(str(notebook.id))

        # Upsert — avoid duplicates
        existing = await repo_query(
            "SELECT id FROM notebook_access WHERE notebook_id = $notebook_id AND user_email = $user_email LIMIT 1",
            {"notebook_id": full_notebook_id, "user_email": target_email},
        )
        if not existing:
            await repo_query(
                """
                CREATE notebook_access SET
                    notebook_id = $notebook_id,
                    user_email = $user_email,
                    granted_by = $granted_by,
                    granted_at = time::now()
                """,
                {
                    "notebook_id": full_notebook_id,
                    "user_email": target_email,
                    "granted_by": current_user,
                },
            )
        return {"message": f"Access granted to {target_email}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error granting notebook access: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/notebooks/{notebook_id}/access/{user_email}")
async def revoke_notebook_access(
    notebook_id: str,
    user_email: str,
    current_user: str = Depends(require_roles("admin", "super_admin")),
    current_role: str = Depends(get_current_user_role),
):
    """Revoke a user's access to a notebook."""
    try:
        notebook = await Notebook.get(normalize_notebook_id(notebook_id))
        if not notebook:
            raise HTTPException(status_code=404, detail="Notebook not found")

        if not is_super_admin_role(current_role) and not await can_access_notebook(
            current_user, current_role, notebook_id
        ):
            raise HTTPException(status_code=403, detail="Access denied")

        normalized_email = user_email.strip().lower()
        target_role = await _get_target_user_role(normalized_email)
        if not target_role:
            raise HTTPException(status_code=404, detail="User not found")
        if not _can_manage_grantee(current_role, target_role):
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        full_notebook_id = ensure_record_id(str(notebook.id))

        await repo_query(
            "DELETE notebook_access WHERE notebook_id = $notebook_id AND user_email = $user_email",
            {"notebook_id": full_notebook_id, "user_email": normalized_email},
        )
        return {"message": f"Access revoked for {normalized_email}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error revoking notebook access: {e}")
        raise HTTPException(status_code=500, detail=str(e))
