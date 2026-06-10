from typing import Any, Optional, Set

from api.roles import is_super_admin_role
from i_Notes.database.repository import ensure_record_id, repo_query
from i_Notes.domain.i_Notes import i_Notes


def normalize_i_Notes_id(i_Notes_id: str) -> str:
    """Ensure i_Notes IDs use the full 'i_Notes:xxx' form."""
    if ":" not in i_Notes_id:
        return f"i_Notes:{i_Notes_id}"
    return i_Notes_id


def record_id_to_str(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return str(value)


async def get_granted_i_Notes_ids(user_email: str) -> Set[str]:
    normalized_email = user_email.strip().lower()
    if not normalized_email:
        return set()

    rows = await repo_query(
        "SELECT i_Notes_id FROM i_Notes_access WHERE user_email = $user_email",
        {"user_email": normalized_email},
    )
    return {
        nb_id
        for nb_id in (record_id_to_str(row.get("i_Notes_id")) for row in rows or [])
        if nb_id
    }


async def get_owned_i_Notes_ids(user_email: str) -> Set[str]:
    normalized_email = user_email.strip().lower()
    if not normalized_email:
        return set()

    rows = await repo_query(
        "SELECT VALUE id FROM i_Notes WHERE owner = $owner",
        {"owner": normalized_email},
    )
    return {
        nb_id
        for nb_id in (record_id_to_str(value) for value in rows or [])
        if nb_id
    }


async def get_accessible_i_Notes_ids(
    current_user: Optional[str],
    current_role: str,
) -> Optional[Set[str]]:
    """
    Return all i_Notes IDs visible to this user.
    `None` means unrestricted access (super admin).
    """
    if not current_user or is_super_admin_role(current_role):
        return None

    owned_ids = await get_owned_i_Notes_ids(current_user)
    granted_ids = await get_granted_i_Notes_ids(current_user)
    return owned_ids | granted_ids


async def can_access_i_Notes(
    current_user: Optional[str],
    current_role: str,
    i_Notes_id: str,
) -> bool:
    """Check whether the current user can access the i_Notes."""
    if is_super_admin_role(current_role):
        return True
    if not current_user:
        return True

    i_Notes = await i_Notes.get(normalize_i_Notes_id(i_Notes_id))
    if not i_Notes:
        return False

    normalized_user = current_user.strip().lower()
    if (i_Notes.owner or "").strip().lower() == normalized_user:
        return True

    access = await repo_query(
        """
        SELECT id
        FROM i_Notes_access
        WHERE i_Notes_id = $i_Notes_id AND user_email = $user_email
        LIMIT 1
        """,
        {
            "i_Notes_id": ensure_record_id(str(i_Notes.id)),
            "user_email": normalized_user,
        },
    )
    return bool(access)
