"""
Authentication router for Open Notebook API.

Endpoints:
  GET  /api/auth/status  – public, check if auth is enabled
  POST /api/auth/login   – public, validate credentials and return a JWT

The JWT returned by /login must be sent on every subsequent request as:
    Authorization: Bearer <access_token>

All original logic (DB lookup, password verification) is preserved.
The only change is that api_token is now a real signed JWT instead of
the raw OPEN_NOTEBOOK_PASSWORD string.
"""

import hashlib
import hmac

from fastapi import APIRouter, HTTPException
from loguru import logger
from pydantic import BaseModel, Field

from api.auth import create_access_token
from open_notebook.database.repository import repo_query
from open_notebook.utils.encryption import get_secret_from_env

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/status")
async def get_auth_status():
    """
    Check if authentication is enabled.
    Returns whether a password is required to access the API.
    """
    auth_enabled = bool(get_secret_from_env("OPEN_NOTEBOOK_PASSWORD"))
    return {
        "auth_enabled": auth_enabled,
        "message": (
            "Authentication is required" if auth_enabled else "Authentication is disabled"
        ),
    }


# ── Login ─────────────────────────────────────────────────────────────────────

class UserLoginRequest(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)


class LoginResponse(BaseModel):
    email: str
    name: str
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


@router.post("/login", response_model=LoginResponse)
async def user_login(data: UserLoginRequest):
    """
    Unified login — excluded from JWTAuthMiddleware (see main.py excluded_paths).

    Flow:
      1. Validate email + password against kavach_user table (unchanged).
      2. On success, generate and return a signed JWT access token.

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

    if not user or not _verify_password(data.password, user.get("password_hash", "")):
        # Intentionally vague — prevents user enumeration
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    name = user.get("name", "")

    # Generate a signed JWT containing the user's email as the 'sub' claim
    token = create_access_token(email=email, name=name)

    logger.info(f"[auth] Successful login, JWT issued for: {email}")
    return LoginResponse(
        email=email,
        name=name,
        access_token=token,
        token_type="bearer",
    )
