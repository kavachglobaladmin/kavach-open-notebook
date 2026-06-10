from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from loguru import logger

from api.auth import get_current_user, get_current_user_role, require_roles
from api.i_Notes_access import (can_access_i_Notes, get_accessible_i_Notes_ids, normalize_i_Notes_id)

from api.models import (i_NotesDeletePreview, i_NotesDeleteResponse, i_NotesResponse, i_NotesUpdate, i_NotesCreate,
                        i_NotesAccessListResponse, i_NotesAccessGrant)
from api.roles import is_super_admin_role, normalize_user_role
from i_Notes.database.repository import ensure_record_id, repo_query
from i_Notes.domain.i_Notes import i_Notes, Source
from i_Notes.exceptions import InvalidInputError

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


def _calc_storage_used_mb(i_Notes_id: str, sources: list) -> float:
    """Sum file sizes (MB) of all uploaded sources linked to this i_Notes."""
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


async def _get_i_Notes_storage_used_mb(i_Notes_id: str) -> float:
    """Query sources for an i_Notes and calculate total file storage used."""
    try:
        srcs = await repo_query(
            "SELECT asset FROM (SELECT in as source FROM reference WHERE out=$id FETCH source)[*].source",
            {"id": ensure_record_id(i_Notes_id)},
        )
        return _calc_storage_used_mb(i_Notes_id, srcs)
    except Exception:
        return 0.0


@router.get("/i_Notes", response_model=List[i_NotesResponse])
async def get_i_Notes(
    request: Request,
    archived: Optional[bool] = Query(None, description="Filter by archived status"),
    order_by: str = Query("updated desc", description="Order by field and direction"),
    current_user: Optional[str] = Depends(get_current_user),
    current_role: str = Depends(get_current_user_role),
):
    """Get all i_Notes with optional filtering and ordering."""
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

        accessible_ids = await get_accessible_i_Notes_ids(current_user, current_role)

        if accessible_ids is None:
            # Super admin or no auth: return all i_Notes
            if archived_condition:
                where_clause = f"WHERE 1=1 {archived_condition}"
            else:
                where_clause = ""
            query = f"""
                SELECT *,
                count(<-reference.in) as source_count,
                count(<-artifact.in) as note_count
                FROM i_Notes
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
                f"nb_{i}": ensure_record_id(i_Notes_id)
                for i, i_Notes_id in enumerate(sorted(accessible_ids))
            }

            where_clause = f"WHERE ({id_conditions})"
            if archived_condition:
                where_clause += f" {archived_condition}"

            query = f"""
                SELECT *,
                count(<-reference.in) as source_count,
                count(<-artifact.in) as note_count
                FROM i_Notes
                {where_clause}
                ORDER BY `updated` DESC
            """
            result = await repo_query(query, id_params)

        # Build responses — calculate storage_used_mb only for i_Notes with a limit
        responses = []
        for i_Notes in result:
            i_Notes_id = str(i_Notes.get("id", ""))
            limit = i_Notes.get("storage_limit_mb")
            used = await _get_i_Notes_storage_used_mb(i_Notes_id) if limit else None
            responses.append(i_NotesResponse(
                id=i_Notes_id,
                name=i_Notes.get("name", ""),
                description=i_Notes.get("description", ""),
                archived=i_Notes.get("archived", False),
                storage_limit_mb=limit,
                storage_used_mb=used,
                created=str(i_Notes.get("created", "")),
                updated=str(i_Notes.get("updated", "")),
                source_count=i_Notes.get("source_count", 0),
                note_count=i_Notes.get("note_count", 0),
            ))
        return responses
    except Exception as e:
        logger.error(f"Error fetching i_Notes: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error fetching i_Notes: {str(e)}"
        )


@router.post("/i_Notes/claim-unowned")
async def claim_unowned_i_Notes(
    current_user: Optional[str] = Depends(get_current_user),
):
    """
    Assign all unowned i_Notes (owner = NONE/null/'user') to the current user.
    Called automatically on the i_Notes page load to migrate legacy data.
    Returns the count of i_Notes claimed.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        # SurrealDB v3: type::is::none() renamed to type::is_none()
        # Simple equality checks like `owner = NONE` don't always work in WHERE clauses
        result = await repo_query(
            """
            UPDATE i_Notes
            SET owner = $owner
            WHERE type::is_none(owner)
               OR owner = null
               OR owner = 'user'
            """,
            {"owner": current_user},
        )
        claimed = len(result) if result else 0
        logger.info(f"[i_Notes] {current_user} claimed {claimed} unowned i_Notes")
        return {"claimed": claimed}
    except Exception as e:
        logger.error(f"Error claiming unowned i_Notes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/i_Notes/debug-owner")
async def debug_i_Notes_owners(
    current_user: str = Depends(require_roles("super_admin")),
):
    """
    Debug endpoint — returns all i_Notes with their owner field.
    Shows what email is being received as X-User-Email and what owners exist in DB.
    """
    all_i_Notes = await repo_query("SELECT id, name, owner FROM i_Notes")
    return {
        "received_x_user_email": current_user,
        "total_i_Notes": len(all_i_Notes),
        "i_Notes": [
            {
                "id": str(i_Notes.get("id", "")),
                "name": i_Notes.get("name", ""),
                "owner": i_Notes.get("owner"),
            }
            for i_Notes in all_i_Notes
        ],
    }


@router.post("/i_Notes", response_model=i_NotesResponse)
async def create_i_Notes(
    i_Notes: i_NotesCreate,
    request: Request,
    current_user: Optional[str] = Depends(get_current_user),
):
    """Create a new i_Notes."""
    try:
        # Ensure owner is always set — fall back to X-User-Email header directly
        # in case get_current_user() returns None due to a timing issue.
        owner = current_user or request.headers.get("X-User-Email") or None
        logger.info(f"[i_Notes] Creating i_Notes '{i_Notes.name}' with owner='{owner}' (current_user='{current_user}', header='{request.headers.get('X-User-Email')}')")

        new_i_Notes = i_Notes(
            name=i_Notes.name,
            description=i_Notes.description,
            owner=owner,
            storage_limit_mb=i_Notes.storage_limit_mb,
        )
        await new_i_Notes.save()

        return i_NotesResponse(
            id=new_i_Notes.id or "",
            name=new_i_Notes.name,
            description=new_i_Notes.description,
            archived=new_i_Notes.archived or False,
            storage_limit_mb=new_i_Notes.storage_limit_mb,
            storage_used_mb=0.0,
            created=str(new_i_Notes.created),
            updated=str(new_i_Notes.updated),
            source_count=0,
            note_count=0,
        )
    except InvalidInputError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating i_Notes: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error creating i_Notes: {str(e)}"
        )


@router.get("/i_Notes/{i_Notes_id}/delete-preview", response_model=i_NotesDeletePreview)
async def get_i_Notes_delete_preview(
    i_Notes_id: str,
    current_user: Optional[str] = Depends(get_current_user),
    current_role: str = Depends(get_current_user_role),
):
    """Get a preview of what will be deleted when this i_Notes is deleted."""
    try:
        i_Notes = await i_Notes.get(normalize_i_Notes_id(i_Notes_id))
        if not i_Notes:
            raise HTTPException(status_code=404, detail="i_Notes not found")
        if not await can_access_i_Notes(current_user, current_role, i_Notes_id):
            raise HTTPException(status_code=403, detail="Access denied")

        preview = await i_Notes.get_delete_preview()

        return i_NotesDeletePreview(
            i_Notes_id=str(i_Notes.id),
            i_Notes_name=i_Notes.name,
            note_count=preview["note_count"],
            exclusive_source_count=preview["exclusive_source_count"],
            shared_source_count=preview["shared_source_count"],
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting delete preview for i_Notes {i_Notes_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching i_Notes deletion preview: {str(e)}",
        )


@router.get("/i_Notes/{i_Notes_id}", response_model=i_NotesResponse)
async def get_single_i_Notes(
    i_Notes_id: str,
    current_user: Optional[str] = Depends(get_current_user),
    current_role: str = Depends(get_current_user_role),
):
    """Get a specific i_Notes by ID."""
    try:
        # Query with counts for single i_Notes
        query = """
            SELECT *,
            count(<-reference.in) as source_count,
            count(<-artifact.in) as note_count
            FROM $i_Notes_id
        """
        result = await repo_query(query, {"i_Notes_id": ensure_record_id(i_Notes_id)})

        if not result:
            raise HTTPException(status_code=404, detail="i_Notes not found")

        nb = result[0]

        # Owner check — deny access if i_Notes belongs to a different user
        nb_id_str = str(nb.get("id", ""))
        if not await can_access_i_Notes(current_user, current_role, nb_id_str):
            raise HTTPException(status_code=403, detail="Access denied")

        nb_id = str(nb.get("id", ""))
        storage_used = await _get_i_Notes_storage_used_mb(nb_id)
        return i_NotesResponse(
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
        logger.error(f"Error fetching i_Notes {i_Notes_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error fetching i_Notes: {str(e)}"
        )


@router.put("/i_Notes/{i_Notes_id}", response_model=i_NotesResponse)
async def update_i_Notes(
    i_Notes_id: str,
    i_Notes_update: i_NotesUpdate,
    current_user: Optional[str] = Depends(get_current_user),
    current_role: str = Depends(get_current_user_role),
):
    """Update a i_Notes."""
    try:
        i_Notes = await i_Notes.get(normalize_i_Notes_id(i_Notes_id))
        if not i_Notes:
            raise HTTPException(status_code=404, detail="i_Notes not found")

        # Owner check
        if not await can_access_i_Notes(current_user, current_role, i_Notes_id):
            raise HTTPException(status_code=403, detail="Access denied")

        # Update only provided fields
        if i_Notes_update.name is not None:
            i_Notes.name = i_Notes_update.name
        if i_Notes_update.description is not None:
            i_Notes.description = i_Notes_update.description
        if i_Notes_update.archived is not None:
            i_Notes.archived = i_Notes_update.archived

        await i_Notes.save()

        # Re-fetch with counts after save
        result = await repo_query(
            """
            SELECT *,
            count(<-reference.in) as source_count,
            count(<-artifact.in) as note_count
            FROM $i_Notes_id
            """,
            {"i_Notes_id": ensure_record_id(i_Notes_id)},
        )

        if result:
            nb = result[0]
            return i_NotesResponse(
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
        return i_NotesResponse(
            id=i_Notes.id or "",
            name=i_Notes.name,
            description=i_Notes.description,
            archived=i_Notes.archived or False,
            created=str(i_Notes.created),
            updated=str(i_Notes.updated),
            source_count=0,
            note_count=0,
        )
    except HTTPException:
        raise
    except InvalidInputError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating i_Notes {i_Notes_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error updating i_Notes: {str(e)}"
        )


@router.post("/i_Notes/{i_Notes_id}/sources/{source_id}")
async def add_source_to_i_Notes(
    i_Notes_id: str,
    source_id: str,
    current_user: Optional[str] = Depends(get_current_user),
    current_role: str = Depends(get_current_user_role),
):
    """Add an existing source to a i_Notes (create the reference)."""
    try:
        i_Notes = await i_Notes.get(normalize_i_Notes_id(i_Notes_id))
        if not i_Notes:
            raise HTTPException(status_code=404, detail="i_Notes not found")
        if not await can_access_i_Notes(current_user, current_role, i_Notes_id):
            raise HTTPException(status_code=403, detail="Access denied")

        # Check if source exists
        source = await Source.get(source_id)
        if not source:
            raise HTTPException(status_code=404, detail="Source not found")

        # Check if reference already exists (idempotency)
        existing_ref = await repo_query(
            "SELECT * FROM reference WHERE out = $source_id AND in = $i_Notes_id",
            {
                "i_Notes_id": ensure_record_id(i_Notes_id),
                "source_id": ensure_record_id(source_id),
            },
        )

        # If reference doesn't exist, create it
        if not existing_ref:
            await repo_query(
                "RELATE $source_id->reference->$i_Notes_id",
                {
                    "i_Notes_id": ensure_record_id(i_Notes_id),
                    "source_id": ensure_record_id(source_id),
                },
            )

        return {"message": "Source linked to i_Notes successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error linking source {source_id} to i_Notes {i_Notes_id}: {str(e)}"
        )
        raise HTTPException(
            status_code=500, detail=f"Error linking source to i_Notes: {str(e)}"
        )


@router.delete("/i_Notes/{i_Notes_id}/sources/{source_id}")
async def remove_source_from_i_Notes(
    i_Notes_id: str,
    source_id: str,
    current_user: Optional[str] = Depends(get_current_user),
    current_role: str = Depends(get_current_user_role),
):
    """Remove a source from a i_Notes (delete the reference)."""
    try:
        i_Notes = await i_Notes.get(normalize_i_Notes_id(i_Notes_id))
        if not i_Notes:
            raise HTTPException(status_code=404, detail="i_Notes not found")
        if not await can_access_i_Notes(current_user, current_role, i_Notes_id):
            raise HTTPException(status_code=403, detail="Access denied")

        # Delete the reference record linking source to i_Notes
        await repo_query(
            "DELETE FROM reference WHERE out = $i_Notes_id AND in = $source_id",
            {
                "i_Notes_id": ensure_record_id(i_Notes_id),
                "source_id": ensure_record_id(source_id),
            },
        )

        return {"message": "Source removed FROM i_Notes successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error removing source {source_id} FROM i_Notes {i_Notes_id}: {str(e)}"
        )
        raise HTTPException(
            status_code=500, detail=f"Error removing source FROM i_Notes: {str(e)}"
        )


@router.delete("/i_Notes/{i_Notes_id}", response_model=i_NotesDeleteResponse)
async def delete_i_Notes(
    i_Notes_id: str,
    delete_exclusive_sources: bool = Query(False),
    current_user: Optional[str] = Depends(get_current_user),
    current_role: str = Depends(get_current_user_role),
):
    """Delete a i_Notes with cascade deletion."""
    try:
        i_Notes = await i_Notes.get(normalize_i_Notes_id(i_Notes_id))
        if not i_Notes:
            raise HTTPException(status_code=404, detail="i_Notes not found")
        if not await can_access_i_Notes(current_user, current_role, i_Notes_id):
            raise HTTPException(status_code=403, detail="Access denied")

        result = await i_Notes.delete(delete_exclusive_sources=delete_exclusive_sources)

        return i_NotesDeleteResponse(
            message="i_Notes deleted successfully",
            deleted_notes=result["deleted_notes"],
            deleted_sources=result["deleted_sources"],
            unlinked_sources=result["unlinked_sources"],
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting i_Notes {i_Notes_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error deleting i_Notes: {str(e)}"
        )


# ── i_Notes Access Management (Super Admin only) ─────────────────────────────

@router.get("/i_Notes/{i_Notes_id}/access", response_model=i_NotesAccessListResponse)
async def get_i_Notes_access(
    i_Notes_id: str,
    current_user: str = Depends(require_roles("admin", "super_admin")),
    current_role: str = Depends(get_current_user_role),
):
    """Get the list of users granted access to a i_Notes."""
    try:
        i_Notes = await i_Notes.get(normalize_i_Notes_id(i_Notes_id))
        if not i_Notes:
            raise HTTPException(status_code=404, detail="i_Notes not found")
        if not is_super_admin_role(current_role) and not await can_access_i_Notes(
            current_user, current_role, i_Notes_id
        ):
            raise HTTPException(status_code=403, detail="Access denied")

        # Use the full i_Notes ID from the fetched object (includes table prefix)
        full_i_Notes_id = ensure_record_id(str(i_Notes.id))

        result = await repo_query(
            "SELECT user_email FROM i_Notes_access WHERE i_Notes_id = $i_Notes_id",
            {"i_Notes_id": full_i_Notes_id},
        )
        granted_users = [row["user_email"] for row in result] if result else []
        return i_NotesAccessListResponse(
            i_Notes_id=i_Notes_id,
            granted_users=granted_users,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching i_Notes access for {i_Notes_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/i_Notes/{i_Notes_id}/access")
async def grant_i_Notes_access(
    i_Notes_id: str,
    body: i_NotesAccessGrant,
    current_user: str = Depends(require_roles("admin", "super_admin")),
    current_role: str = Depends(get_current_user_role),
):
    """Grant a user access to a i_Notes."""
    try:
        i_Notes = await i_Notes.get(normalize_i_Notes_id(i_Notes_id))
        if not i_Notes:
            raise HTTPException(status_code=404, detail="i_Notes not found")

        if not is_super_admin_role(current_role) and not await can_access_i_Notes(
            current_user, current_role, i_Notes_id
        ):
            raise HTTPException(status_code=403, detail="Access denied")

        target_email = body.user_email.strip().lower()
        target_role = await _get_target_user_role(target_email)
        if not target_role:
            raise HTTPException(status_code=404, detail="User not found")
        if not _can_manage_grantee(current_role, target_role):
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        full_i_Notes_id = ensure_record_id(str(i_Notes.id))

        # Upsert — avoid duplicates
        existing = await repo_query(
            "SELECT id FROM i_Notes_access WHERE i_Notes_id = $i_Notes_id AND user_email = $user_email LIMIT 1",
            {"i_Notes_id": full_i_Notes_id, "user_email": target_email},
        )
        if not existing:
            await repo_query(
                """
                CREATE i_Notes_access SET
                    i_Notes_id = $i_Notes_id,
                    user_email = $user_email,
                    granted_by = $granted_by,
                    granted_at = time::now()
                """,
                {
                    "i_Notes_id": full_i_Notes_id,
                    "user_email": target_email,
                    "granted_by": current_user,
                },
            )
        return {"message": f"Access granted to {target_email}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error granting i_Notes access: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/i_Notes/{i_Notes_id}/access/{user_email}")
async def revoke_i_Notes_access(
    i_Notes_id: str,
    user_email: str,
    current_user: str = Depends(require_roles("admin", "super_admin")),
    current_role: str = Depends(get_current_user_role),
):
    """Revoke a user's access to a i_Notes."""
    try:
        i_Notes = await i_Notes.get(normalize_i_Notes_id(i_Notes_id))
        if not i_Notes:
            raise HTTPException(status_code=404, detail="i_Notes not found")

        if not is_super_admin_role(current_role) and not await can_access_i_Notes(
            current_user, current_role, i_Notes_id
        ):
            raise HTTPException(status_code=403, detail="Access denied")

        normalized_email = user_email.strip().lower()
        target_role = await _get_target_user_role(normalized_email)
        if not target_role:
            raise HTTPException(status_code=404, detail="User not found")
        if not _can_manage_grantee(current_role, target_role):
            raise HTTPException(status_code=403, detail="Insufficient permissions")

        full_i_Notes_id = ensure_record_id(str(i_Notes.id))

        await repo_query(
            "DELETE i_Notes_access WHERE i_Notes_id = $i_Notes_id AND user_email = $user_email",
            {"i_Notes_id": full_i_Notes_id, "user_email": normalized_email},
        )
        return {"message": f"Access revoked for {normalized_email}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error revoking i_Notes access: {e}")
        raise HTTPException(status_code=500, detail=str(e))




