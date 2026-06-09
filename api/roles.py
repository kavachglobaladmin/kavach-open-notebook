import os
from typing import Literal, Sequence

from open_notebook.database.repository import repo_query

UserRole = Literal["user", "admin", "super_admin"]

ROLE_HIERARCHY: dict[UserRole, int] = {
    "user": 0,
    "admin": 1,
    "super_admin": 2,
}


def normalize_user_role(value: object) -> UserRole:
    role = str(value or "").strip().lower()
    if role == "superadmin":
        role = "super_admin"
    if role in ROLE_HIERARCHY:
        return role  # type: ignore[return-value]
    return "user"


def role_has_access(actual_role: object, required_role: object) -> bool:
    actual = normalize_user_role(actual_role)
    required = normalize_user_role(required_role)
    return ROLE_HIERARCHY[actual] >= ROLE_HIERARCHY[required]


def role_in(actual_role: object, allowed_roles: Sequence[object]) -> bool:
    actual = normalize_user_role(actual_role)
    return any(actual == normalize_user_role(role) for role in allowed_roles)


def is_super_admin_role(role: object) -> bool:
    return normalize_user_role(role) == "super_admin"


def has_elevated_data_access(role: object) -> bool:
    return role_has_access(role, "admin")


def _configured_emails(env_name: str) -> set[str]:
    raw = os.environ.get(env_name, "")
    values = {item.strip().lower() for item in raw.split(",")}
    return {value for value in values if value}


def configured_super_admin_emails() -> set[str]:
    return _configured_emails("KAVACH_SUPER_ADMIN_EMAILS")


def configured_admin_emails() -> set[str]:
    return _configured_emails("KAVACH_ADMIN_EMAILS")


def configured_role_for_email(email: str) -> UserRole | None:
    email_lc = email.strip().lower()
    if email_lc in configured_super_admin_emails():
        return "super_admin"
    if email_lc in configured_admin_emails():
        return "admin"
    return None


async def super_admin_exists() -> bool:
    rows = await repo_query(
        "SELECT id FROM kavach_user WHERE role = 'super_admin' LIMIT 1"
    )
    return bool(rows)


async def resolve_role_for_new_user(email: str) -> UserRole:
    configured_role = configured_role_for_email(email)
    if configured_role == "super_admin":
        return "super_admin"
    if not await super_admin_exists():
        # Bootstrap the very first privileged account automatically.
        return "super_admin"
    if configured_role == "admin":
        return "admin"
    return "user"


async def ensure_user_role(email: str, stored_role: object) -> UserRole:
    current_role = normalize_user_role(stored_role)
    desired_role = current_role

    configured_role = configured_role_for_email(email)
    if configured_role and ROLE_HIERARCHY[configured_role] > ROLE_HIERARCHY[desired_role]:
        desired_role = configured_role

    if desired_role != "super_admin" and not await super_admin_exists():
        desired_role = "super_admin"

    if desired_role != current_role:
        await repo_query(
            "UPDATE kavach_user SET role = $role WHERE email = $email",
            {"email": email.strip().lower(), "role": desired_role},
        )

    return desired_role


async def count_users_with_role(role: object) -> int:
    normalized_role = normalize_user_role(role)
    rows = await repo_query(
        "SELECT id FROM kavach_user WHERE role = $role",
        {"role": normalized_role},
    )
    return len(rows or [])
