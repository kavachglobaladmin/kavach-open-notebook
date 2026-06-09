"""
User management API — stores users in SurrealDB (kavach_user table).

Each user record stores:
  - email            : normalised lowercase email (unique index)
  - name             : display name
  - password_hash    : SHA-256 + random-salt hash used for login verification
  - password_encrypted: Fernet-encrypted plaintext password (AES-128-CBC + HMAC)
                        used only for admin visibility; decryptable with
                        OPEN_NOTEBOOK_ENCRYPTION_KEY
  - created_at       : auto-set by SurrealDB on first write
"""

import hashlib
import hmac
import os
import re
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from loguru import logger
from pydantic import BaseModel, Field, field_validator

from api.auth import get_current_user, get_current_user_role, require_roles
from api.roles import (
    count_users_with_role,
    ensure_user_role,
    normalize_user_role,
    resolve_role_for_new_user,
)
from open_notebook.database.repository import repo_query
from open_notebook.utils.encryption import encrypt_value, decrypt_value

router = APIRouter()

# ── Validation constants ──────────────────────────────────────────────────────

EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
)


def _validate_email_format(email: str) -> str:
    email = email.strip().lower()
    if not email:
        raise ValueError("Email is required.")
    if not EMAIL_REGEX.match(email):
        raise ValueError("Enter a valid email address (e.g. user@example.com).")
    if len(email) > 254:
        raise ValueError("Email address is too long.")
    return email


def _validate_password_strength(password: str) -> str:
    errors = []
    if len(password) < 8:
        errors.append("at least 8 characters")
    if not re.search(r"[A-Z]", password):
        errors.append("at least 1 uppercase letter (A–Z)")
    if not re.search(r"[a-z]", password):
        errors.append("at least 1 lowercase letter (a–z)")
    if not re.search(r"[^a-zA-Z0-9]", password):
        errors.append("at least 1 special character")
    if errors:
        raise ValueError("Password must contain: " + ", ".join(errors) + ".")
    return password


# ── Password hashing (for login verification) ─────────────────────────────────

def _hash_password(password: str) -> str:
    """SHA-256 + random salt. Stored as 'salt:hash'. Used only for login check."""
    salt = os.urandom(32).hex()
    h = hmac.new(salt.encode(), password.encode(), hashlib.sha256).hexdigest()
    return f"{salt}:{h}"


def _verify_password(password: str, stored: str) -> bool:
    """Constant-time comparison against stored salt:hash."""
    try:
        salt, h = stored.split(":", 1)
        expected = hmac.new(salt.encode(), password.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, h)
    except Exception:
        return False


# ── Pydantic models ───────────────────────────────────────────────────────────

class UserRegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., min_length=3, max_length=254)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Name must be at least 2 characters.")
        return v

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return _validate_email_format(v)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return _validate_password_strength(v)


class UserLoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    password: str = Field(..., min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_REGEX.match(v):
            raise ValueError("Enter a valid email address.")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Password is required.")
        return v


class UserResponse(BaseModel):
    email: str
    name: str
    role: str


class UserAdminRecord(BaseModel):
    """Full user record returned by the admin list endpoint — includes decrypted password."""
    id: str
    email: str
    name: str
    role: str
    password: str          # decrypted plaintext (from password_encrypted field)
    password_encrypted: str  # raw Fernet token stored in DB
    created_at: Optional[str] = None


class UserDirectoryRecord(BaseModel):
    id: str
    email: str
    name: str
    role: str


# ── DB helpers ────────────────────────────────────────────────────────────────

async def _find_user(email: str) -> Optional[dict]:
    try:
        result = await repo_query(
            "SELECT * FROM kavach_user WHERE email = $email LIMIT 1",
            {"email": email.lower().strip()},
        )
        return result[0] if result else None
    except Exception as e:
        # SurrealDB v3 raises an error if the table doesn't exist yet.
        # Treat that as "no user found" — the table is created by migration 17.
        if "does not exist" in str(e):
            return None
        raise


def _normalize_role_value(value: str) -> str:
    return normalize_user_role(value)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/users/register", response_model=UserResponse)
async def register_user(data: UserRegisterRequest):
    """
    Register a new user.
    Stores:
      - password_hash      : SHA-256 + salt (for login verification)
      - password_encrypted : Fernet-encrypted plaintext (for admin visibility)
    Returns 409 if email already exists.
    """
    email = data.email  # already normalised by validator
    existing = await _find_user(email)
    if existing:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists. Please sign in.",
        )

    assigned_role = await resolve_role_for_new_user(email)
    pw_hash = _hash_password(data.password)
    pw_encrypted = encrypt_value(data.password)   # Fernet AES-128-CBC + HMAC

    await repo_query(
        """
        CREATE kavach_user SET
            email              = $email,
            name               = $name,
            role               = $role,
            password_hash      = $pw_hash,
            password_encrypted = $pw_encrypted,
            created_at         = time::now()
        """,
        {
            "email": email,
            "name": data.name,
            "role": assigned_role,
            "pw_hash": pw_hash,
            "pw_encrypted": pw_encrypted,
        },
    )
    logger.info(f"[users] Registered new user: {email} ({assigned_role})")
    return UserResponse(email=email, name=data.name, role=assigned_role)


@router.post("/users/login", response_model=UserResponse)
async def login_user(data: UserLoginRequest):
    """
    Validate email + password against kavach_user table.
    Uses password_hash for constant-time verification.
    Returns 401 for wrong credentials (intentionally vague — prevents enumeration).
    """
    email = data.email
    user = await _find_user(email)
    if not user or not _verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    role = await ensure_user_role(email, user.get("role"))
    return UserResponse(email=email, name=user.get("name", ""), role=role)


@router.get("/users/all", response_model=List[UserAdminRecord])
async def list_all_users(
    _: str = Depends(require_roles("super_admin")),
):
    """
    Admin endpoint — returns all kavach_user records with decrypted passwords.
    Requires the API bearer token (same as all other protected endpoints).

    Use from terminal:
        curl -s http://localhost:5055/api/users/all \\
             -H "Authorization: Bearer <your-api-password>" | python -m json.tool
    """
    rows = await repo_query("SELECT * FROM kavach_user ORDER BY created_at ASC")
    result = []
    for row in rows:
        pw_encrypted = row.get("password_encrypted", "")
        try:
            pw_plain = decrypt_value(pw_encrypted) if pw_encrypted else "(not set)"
        except Exception:
            pw_plain = "(decryption failed — check OPEN_NOTEBOOK_ENCRYPTION_KEY)"

        result.append(UserAdminRecord(
            id=str(row.get("id", "")),
            email=row.get("email", ""),
            name=row.get("name", ""),
            role=normalize_user_role(row.get("role")),
            password=pw_plain,
            password_encrypted=pw_encrypted,
            created_at=str(row.get("created_at", "")),
        ))
    return result


@router.get("/users/directory", response_model=List[UserDirectoryRecord])
async def list_user_directory(
    request: Request,
    _: str = Depends(require_roles("admin", "super_admin")),
):
    """Safe user directory for notebook access management.
    Admin: returns only 'user' role accounts.
    Super admin: returns all non-super-admin accounts.
    """
    from api.roles import normalize_user_role as _normalize
    current_role = _normalize(getattr(request.state, "jwt_role", None))

    if current_role == "admin":
        rows = await repo_query(
            "SELECT id, email, name, role FROM kavach_user WHERE role = 'user' ORDER BY created_at ASC"
        )
    else:
        # super_admin: all users except super_admins
        rows = await repo_query(
            "SELECT id, email, name, role FROM kavach_user WHERE role != 'super_admin' ORDER BY created_at ASC"
        )

    return [
        UserDirectoryRecord(
            id=str(row.get("id", "")),
            email=row.get("email", ""),
            name=row.get("name", ""),
            role=normalize_user_role(row.get("role")),
        )
        for row in rows
    ]


@router.get("/users/profile", response_model=UserResponse)
async def get_profile(
    request: Request,
    current_user: Optional[str] = Depends(get_current_user),
):
    """Return profile for the currently logged-in user."""
    email = (current_user or request.headers.get("X-User-Email", "")).strip().lower()
    if not email:
        raise HTTPException(status_code=401, detail="Authentication required")
    user = await _find_user(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    role = await ensure_user_role(email, user.get("role"))
    return UserResponse(email=email, name=user.get("name", ""), role=role)


class UserUpsertRequest(BaseModel):
    name: str = Field(..., min_length=1)
    email: str = Field(..., min_length=3)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Name must be at least 2 characters.")
        return v

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return _validate_email_format(v)


@router.post("/users/upsert", response_model=UserResponse)
async def upsert_user(data: UserUpsertRequest):
    """
    Create the user record if it doesn't exist, or update the name if it does.
    No password required — API-level auth (bearer token) already guards this endpoint.
    """
    email = data.email.lower().strip()
    name = data.name.strip()

    existing = await _find_user(email)
    if existing:
        existing_role = await ensure_user_role(email, existing.get("role"))
        if existing.get("name") != name:
            await repo_query(
                "UPDATE kavach_user SET name = $name WHERE email = $email",
                {"email": email, "name": name},
            )
            logger.info(f"[users] Updated name for: {email}")
    else:
        assigned_role = await resolve_role_for_new_user(email)
        await repo_query(
            "CREATE kavach_user SET email = $email, name = $name, role = $role",
            {"email": email, "name": name, "role": assigned_role},
        )
        logger.info(f"[users] Auto-created user record: {email}")
        existing_role = assigned_role

    return UserResponse(email=email, name=name, role=existing_role)


# ── Reset password (used by forgot-password OTP flow) ─────────────────────────

class ResetPasswordRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return _validate_email_format(v)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        return _validate_password_strength(v)


class UpdateUserRoleRequest(BaseModel):
    role: str = Field(...)

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        return _normalize_role_value(v)


@router.patch("/users/{user_email}/role", response_model=UserResponse)
async def update_user_role(
    user_email: str,
    data: UpdateUserRoleRequest,
    current_user: str = Depends(require_roles("super_admin")),
):
    email = _validate_email_format(user_email)
    user = await _find_user(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    current_role = normalize_user_role(user.get("role"))
    new_role = normalize_user_role(data.role)

    if current_role == "super_admin" and new_role != "super_admin":
        super_admin_count = await count_users_with_role("super_admin")
        if super_admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="At least one super admin account is required.",
            )

    await repo_query(
        "UPDATE kavach_user SET role = $role WHERE email = $email",
        {"email": email, "role": new_role},
    )
    logger.info(f"[users] {current_user} changed role for {email} to {new_role}")
    return UserResponse(email=email, name=user.get("name", ""), role=new_role)


@router.post("/users/reset-password")
async def reset_password(data: ResetPasswordRequest):
    """
    Update the password for an existing user in the database.
    Called after OTP verification in the forgot-password flow.
    Updates both password_hash (for login) and password_encrypted (for admin visibility).
    Returns 404 if the user does not exist.
    """
    email = data.email  # already normalised by validator
    user = await _find_user(email)
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email.")

    pw_hash = _hash_password(data.new_password)
    pw_encrypted = encrypt_value(data.new_password)

    await repo_query(
        """
        UPDATE kavach_user
        SET password_hash      = $pw_hash,
            password_encrypted = $pw_encrypted
        WHERE email = $email
        """,
        {
            "email": email,
            "pw_hash": pw_hash,
            "pw_encrypted": pw_encrypted,
        },
    )
    logger.info(f"[users] Password reset for: {email}")
    return {"message": "Password updated successfully"}
