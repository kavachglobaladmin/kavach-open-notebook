"""
Authentication router for Open Notebook API.
Provides endpoints to check authentication status and user login.
"""

import hashlib
import hmac

from fastapi import APIRouter, HTTPException
from loguru import logger
from pydantic import BaseModel, Field

from open_notebook.database.repository import repo_query
from open_notebook.utils.encryption import get_secret_from_env

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/status")
async def get_auth_status():
    """
    Check if authentication is enabled.
    Returns whether a password is required to access the API.
    """
    auth_enabled = bool(get_secret_from_env("OPEN_NOTEBOOK_PASSWORD"))
    return {
        "auth_enabled": auth_enabled,
        "message": "Authentication is required" if auth_enabled else "Authentication is disabled",
    }


class UserLoginRequest(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)


class LoginResponse(BaseModel):
    email: str
    name: str
    # The global API bearer token the frontend must use for all subsequent requests.
    # Returned only after successful kavach_user credential validation.
    api_token: str


def _verify_password(password: str, stored: str) -> bool:
    """Constant-time SHA-256 + salt verification."""
    try:
        salt, h = stored.split(":", 1)
        expected = hmac.new(salt.encode(), password.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, h)
    except Exception:
        return False


@router.post("/login", response_model=LoginResponse)
async def user_login(data: UserLoginRequest):
    """
    Unified login — excluded from PasswordAuthMiddleware (see main.py excluded_paths).

    Flow:
      1. Validate email + password against kavach_user table.
      2. On success, return the global OPEN_NOTEBOOK_PASSWORD as api_token.

    The frontend stores api_token and sends it as 'Authorization: Bearer <api_token>'
    on every subsequent request. This completely removes the need for the user to
    know the global API password.
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

    api_password = get_secret_from_env("OPEN_NOTEBOOK_PASSWORD") or ""

    logger.info(f"[auth] Successful login: {email}")
    return LoginResponse(
        email=email,
        name=user.get("name", ""),
        api_token=api_password,
    )
