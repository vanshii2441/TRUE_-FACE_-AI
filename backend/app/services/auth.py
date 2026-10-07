"""
TRUE FACE AI — Admin Authentication & Token Verification Service
"""

import hmac
import hashlib
import time
from typing import Annotated, Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

security = HTTPBearer(auto_error=False)


def generate_admin_token(username: str) -> str:
    """Generate a signed bearer token for admin authentication."""
    timestamp = str(int(time.time()))
    payload = f"{username}:{timestamp}"
    signature = hmac.new(
        settings.secret_key.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{payload}:{signature}"


def verify_admin_token(token: str) -> dict[str, Any]:
    """Verify an admin bearer token signature and expiration (8h validity)."""
    parts = token.split(":")
    if len(parts) != 3:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token format.",
        )

    username, timestamp_str, sig = parts
    try:
        ts = int(timestamp_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token timestamp.",
        )

    # Expiration check: 8 hours (28800 seconds)
    if time.time() - ts > 28800:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin session expired. Please log in again.",
        )

    expected_sig = hmac.new(
        settings.secret_key.encode("utf-8"),
        f"{username}:{timestamp_str}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(sig, expected_sig):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token signature.",
        )

    if username != settings.admin_username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not have admin privileges.",
        )

    return {"username": username, "authenticated_at": ts}


def require_admin(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)] = None
) -> dict[str, Any]:
    """FastAPI dependency requiring a valid Admin Bearer Token."""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication required. Please provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return verify_admin_token(credentials.credentials)
