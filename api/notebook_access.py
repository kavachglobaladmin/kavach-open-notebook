from typing import Any, Optional, Set

from api.roles import is_super_admin_role
from open_notebook.database.repository import ensure_record_id, repo_query
from open_notebook.domain.notebook import Notebook


def normalize_notebook_id(notebook_id: str) -> str:
    """Ensure notebook IDs use the full 'notebook:xxx' form."""
    if ":" not in notebook_id:
        return f"notebook:{notebook_id}"
    return notebook_id


def record_id_to_str(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return str(value)


async def get_granted_notebook_ids(user_email: str) -> Set[str]:
    normalized_email = user_email.strip().lower()
    if not normalized_email:
        return set()

    rows = await repo_query(
        "SELECT notebook_id FROM notebook_access WHERE user_email = $user_email",
        {"user_email": normalized_email},
    )
    return {
        notebook_id
        for notebook_id in (record_id_to_str(row.get("notebook_id")) for row in rows or [])
        if notebook_id
    }


async def get_owned_notebook_ids(user_email: str) -> Set[str]:
    normalized_email = user_email.strip().lower()
    if not normalized_email:
        return set()

    rows = await repo_query(
        "SELECT VALUE id FROM notebook WHERE owner = $owner",
        {"owner": normalized_email},
    )
    return {
        notebook_id
        for notebook_id in (record_id_to_str(value) for value in rows or [])
        if notebook_id
    }


async def get_accessible_notebook_ids(
    current_user: Optional[str],
    current_role: str,
) -> Optional[Set[str]]:
    """
    Return all notebook IDs visible to this user.

    `None` means unrestricted access.
    """
    if not current_user or is_super_admin_role(current_role):
        return None

    owned_ids = await get_owned_notebook_ids(current_user)
    granted_ids = await get_granted_notebook_ids(current_user)
    return owned_ids | granted_ids


async def can_access_notebook(
    current_user: Optional[str],
    current_role: str,
    notebook_id: str,
) -> bool:
    """Check whether the current user can access the notebook."""
    if is_super_admin_role(current_role):
        return True
    if not current_user:
        return True

    notebook = await Notebook.get(normalize_notebook_id(notebook_id))
    if not notebook:
        return False

    normalized_user = current_user.strip().lower()
    if (notebook.owner or "").strip().lower() == normalized_user:
        return True

    access = await repo_query(
        """
        SELECT id
        FROM notebook_access
        WHERE notebook_id = $notebook_id AND user_email = $user_email
        LIMIT 1
        """,
        {
            "notebook_id": ensure_record_id(str(notebook.id)),
            "user_email": normalized_user,
        },
    )
    return bool(access)
