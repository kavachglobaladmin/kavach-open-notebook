"""
Authentication router for Open Notebook API.

Endpoints:
  GET  /api/auth/status  – public, check if auth is enabled
  POST /api/auth/login   – public, validate credentials and return a JWT

The JWT returned by /login must be sent on every subsequent request as:
    Authorization: Bearer <access_token>

All original logic (DB lookup, password verification) is preserved.
The role stored in kavach_user is embedded into the JWT payload and
returned in the login response so the frontend can use it immediately.
"""

import hashlib
import hmac
import re

from fastapi import APIRouter, HTTPException
from loguru import logger
from pydantic import BaseModel, Field, field_validator

from api.auth import create_access_token
from open_notebook.database.repository import repo_query

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Status ────────────────────────────────────────────────────────────────────
@router.get("/status")
async def get_auth_status():
    """
    Report whether authentication is required by the current backend.

    The API uses JWTAuthMiddleware globally (see api/main.py), so protected
    endpoints always require a Bearer token.
    """
    return {
        "auth_enabled": True,
        "message": "Authentication is required",
    }


# ── Login ─────────────────────────────────────────────────────────────────────
class UserLoginRequest(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        email = value.strip().lower()
        email_regex = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")
        if not email_regex.match(email):
            raise ValueError("Enter a valid email address.")
        if len(email) > 254:
            raise ValueError("Email address is too long.")
        return email

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Password is required.")
        return value


class LoginResponse(BaseModel):
    email: str
    name: str
    role: str
    # Signed JWT — send as:  Authorization: Bearer <access_token>
    access_token: str
    token_type: str = "bearer"


def _verify_password(password: str, stored: str) -> bool:
    """Constant-time SHA-256 + salt verification. Original logic preserved."""
    try:
        salt, h = stored.split(":", 1)
        expected = hmac.new(salt.encode(), password.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, h)
    except Exception:
        return False


def _verify_user_password(password: str, user: dict) -> bool:
    """Support both hashed passwords and legacy plain-text passwords."""
    stored_hash = user.get("password_hash", "")
    if isinstance(stored_hash, str) and stored_hash and _verify_password(password, stored_hash):
        return True
    legacy_password = user.get("password")
    if isinstance(legacy_password, str) and legacy_password == password:
        return True
    return False


@router.post("/login", response_model=LoginResponse)
async def user_login(data: UserLoginRequest):
    """
    Unified login — excluded from JWTAuthMiddleware (see main.py excluded_paths).

    Flow:
      1. Validate email + password against kavach_user table.
      2. Read the user's role from the DB record.
      3. Embed role into the signed JWT and return it in the response.

    The frontend stores the token and sends it as:
        Authorization: Bearer <access_token>
    on every subsequent request.
    """
    email = data.email.strip().lower()

    result = await repo_query(
        "SELECT * FROM kavach_user WHERE email = $email LIMIT 1",
        {"email": email},
    )
    user = result[0] if result else None

    if not user or not _verify_user_password(data.password, user):
        # Intentionally vague — prevents user enumeration
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    name = user.get("name", "")
    role: str = user.get("role") or "user"

    # Generate a signed JWT containing the user's email, name, and role
    token = create_access_token(email=email, name=name, role=role)

    logger.info(f"[auth] Successful login for: {email} (role={role})")
    return LoginResponse(
        email=email,
        name=name,
        role=role,
        access_token=token,
        token_type="bearer",
    )
