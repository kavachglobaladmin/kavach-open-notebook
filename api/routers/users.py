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

from fastapi import APIRouter, HTTPException, Request
from loguru import logger
from pydantic import BaseModel, Field, field_validator

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


class UserAdminRecord(BaseModel):
    """Full user record returned by the admin list endpoint — includes decrypted password."""
    id: str
    email: str
    name: str
    password: str          # decrypted plaintext (from password_encrypted field)
    password_encrypted: str  # raw Fernet token stored in DB
    created_at: Optional[str] = None


# ── DB helpers ────────────────────────────────────────────────────────────────

async def _find_user(email: str) -> Optional[dict]:
    result = await repo_query(
        "SELECT * FROM kavach_user WHERE email = $email LIMIT 1",
        {"email": email.lower().strip()},
    )
    return result[0] if result else None


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

    pw_hash = _hash_password(data.password)
    pw_encrypted = encrypt_value(data.password)   # Fernet AES-128-CBC + HMAC

    await repo_query(
        """
        CREATE kavach_user SET
            email              = $email,
            name               = $name,
            password_hash      = $pw_hash,
            password_encrypted = $pw_encrypted,
            created_at         = time::now()
        """,
        {
            "email": email,
            "name": data.name,
            "pw_hash": pw_hash,
            "pw_encrypted": pw_encrypted,
        },
    )
    logger.info(f"[users] Registered new user: {email}")
    return UserResponse(email=email, name=data.name)


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
    return UserResponse(email=email, name=user.get("name", ""))


@router.get("/users/all", response_model=List[UserAdminRecord])
async def list_all_users(request: Request):
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
            password=pw_plain,
            password_encrypted=pw_encrypted,
            created_at=str(row.get("created_at", "")),
        ))
    return result


@router.get("/users/profile", response_model=UserResponse)
async def get_profile(request: Request):
    """Return profile for the currently logged-in user (via X-User-Email header)."""
    email = request.headers.get("X-User-Email", "").strip()
    if not email:
        raise HTTPException(status_code=400, detail="X-User-Email header required")
    user = await _find_user(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(email=email, name=user.get("name", ""))


class UserUpsertRequest(BaseModel):
    name: str = Field(..., min_length=1)
    email: str = Field(..., min_length=3)


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
        if existing.get("name") != name:
            await repo_query(
                "UPDATE kavach_user SET name = $name WHERE email = $email",
                {"email": email, "name": name},
            )
            logger.info(f"[users] Updated name for: {email}")
    else:
        await repo_query(
            "CREATE kavach_user SET email = $email, name = $name",
            {"email": email, "name": name},
        )
        logger.info(f"[users] Auto-created user record: {email}")

    return UserResponse(email=email, name=name)
