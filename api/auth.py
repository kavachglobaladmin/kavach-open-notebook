"""
Authentication helpers for Open Notebook API.

JWT-based authentication:
  - Login  → POST /api/auth/login  → returns a signed JWT (access_token)
  - Every subsequent request must send:
        Authorization: Bearer <jwt_token>
  - The middleware validates the JWT signature + expiry on every request.
  - The user's email is read from the JWT 'sub' claim and made available
    via get_current_user() for ownership-scoped queries.

JWT secret is read from the JWT_SECRET_KEY environment variable.
Falls back to OPEN_NOTEBOOK_ENCRYPTION_KEY if JWT_SECRET_KEY is not set.
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from open_notebook.utils.encryption import get_secret_from_env

# ── JWT configuration ──────────────────────────────────────────────────────────
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours


def _jwt_secret() -> str:
    """
    Return the secret key used to sign/verify JWTs.
    Priority: JWT_SECRET_KEY env var → OPEN_NOTEBOOK_ENCRYPTION_KEY → hard fallback.
    """
    secret = (
        os.environ.get("JWT_SECRET_KEY")
        or get_secret_from_env("OPEN_NOTEBOOK_ENCRYPTION_KEY")
        or "open-notebook-jwt-secret-change-me"
    )
    return secret


def create_access_token(email: str, name: str = "", role: str = "user") -> str:
    """
    Create a signed JWT access token.

    Payload:
      sub   – user email (used as identity throughout the app)
      name  – display name (convenience, not used for auth)
      role  – user role: 'user', 'admin', or 'super_admin'
      iat   – issued-at timestamp
      exp   – expiry timestamp (24 h from now)
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": email,
        "name": name,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """
    Decode and verify a JWT token.
    Raises jwt.PyJWTError on invalid / expired tokens.
    """
    return jwt.decode(token, _jwt_secret(), algorithms=[ALGORITHM])


# ── Per-request user identity ─────────────────────────────────────────────────
def get_current_user(request: Request) -> Optional[str]:
    """
    Extract the current user's email from the validated JWT stored in
    request.state.jwt_email (set by JWTAuthMiddleware).

    Falls back to the X-User-Email header for backward compatibility with
    any internal service-to-service calls that still use the old header.

    Returns None when auth is disabled or no identity is available.
    """
    # Primary: email injected by JWTAuthMiddleware after token validation
    email = getattr(request.state, "jwt_email", None)
    if email:
        return email
    # Fallback: explicit header (internal / legacy calls)
    return request.headers.get("X-User-Email") or None


def get_current_user_role(request: Request) -> Optional[str]:
    """
    Extract the current user's role from the validated JWT stored in
    request.state.jwt_role (set by JWTAuthMiddleware).

    Returns None when no role is available.
    """
    return getattr(request.state, "jwt_role", None)


# ── JWT Auth Middleware ────────────────────────────────────────────────────────
class JWTAuthMiddleware(BaseHTTPMiddleware):
    """
    Middleware that validates JWT Bearer tokens on every protected request.

    Replaces the old PasswordAuthMiddleware — the global API password is no
    longer accepted as a Bearer token. Clients must obtain a JWT via
    POST /api/auth/login and send it as:
        Authorization: Bearer <jwt_token>

    Public paths listed in excluded_paths bypass validation entirely.
    """

    def __init__(self, app, excluded_paths: Optional[list] = None):
        super().__init__(app)
        self.excluded_paths = excluded_paths or [
            "/",
            "/health",
            "/docs",
            "/openapi.json",
            "/redoc",
        ]

    async def dispatch(self, request: Request, call_next):
        # Always allow CORS preflight
        if request.method == "OPTIONS":
            return await call_next(request)

        # Allow public paths without any token
        if request.url.path in self.excluded_paths:
            return await call_next(request)

        # Extract Bearer token from Authorization header
        auth_header = request.headers.get("Authorization", "")
        if not auth_header:
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing authorization header"},
                headers={"WWW-Authenticate": "Bearer"},
            )

        parts = auth_header.split(" ", 1)
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid authorization header format. Expected: Bearer <token>"},
                headers={"WWW-Authenticate": "Bearer"},
            )

        token = parts[1].strip()

        # Validate JWT
        try:
            payload = decode_access_token(token)
        except jwt.ExpiredSignatureError:
            return JSONResponse(
                status_code=401,
                content={"detail": "Token has expired. Please log in again."},
                headers={"WWW-Authenticate": "Bearer"},
            )
        except jwt.InvalidTokenError as exc:
            return JSONResponse(
                status_code=401,
                content={"detail": f"Invalid token: {str(exc)}"},
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Inject email and role into request state so handlers can read them
        request.state.jwt_email = payload.get("sub", "")
        request.state.jwt_role = payload.get("role", "user")

        return await call_next(request)


# ── Legacy helper kept for route-level dependency injection ──────────────────
security = HTTPBearer(auto_error=False)


def check_api_password(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> bool:
    """
    Route-level dependency — validates the JWT token.
    Kept for backward compatibility with any routes that use it directly.
    Returns True on success, raises 401 on failure.
    """
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Missing authorization",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        decode_access_token(credentials.credentials)
        return True
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid token: {str(exc)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
