"""
TRUE FACE AI — Email OTP API Routes

Endpoints:
- POST /api/v1/otp/send
- POST /api/v1/otp/verify
"""

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app.config import settings
from app.schemas.otp import OTPSendRequest, OTPVerifyRequest
from app.services.email_service import send_otp_email
from app.services.otp_service import (
    generate_otp_with_expiration,
    save_otp_record,
    verify_stored_otp,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/otp", tags=["Email OTP"])


@router.post(
    "/send",
    summary="Send Email OTP",
    description="Generates a 6-digit OTP, stores its hash in MongoDB, and dispatches it via SMTP email.",
)
async def send_otp(payload: OTPSendRequest) -> dict[str, Any]:
    """
    Generate and send a 6-digit OTP code to the requested email address.
    """
    email = payload.email.lower().strip()

    # 1. Generate OTP and expiry timestamp
    otp_code, expires_at = generate_otp_with_expiration()

    # 2. Save hashed record to MongoDB
    try:
        save_otp_record(email=email, otp_code=otp_code, expires_at=expires_at)
    except Exception as e:
        logger.error("Failed to save OTP record to database: %s", type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process OTP request due to a database error.",
        )

    # 3. Dispatch OTP email via SMTP
    try:
        send_otp_email(to_email=email, otp_code=otp_code)
    except ValueError as e:
        logger.error("SMTP configuration missing or invalid: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Email service is unconfigured on the server. Please configure SMTP credentials.",
        )
    except RuntimeError as e:
        logger.error("SMTP delivery failure: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to deliver OTP email. Please check the recipient address or try again later.",
        )
    except Exception as e:
        logger.error("Unexpected error during OTP email delivery: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while sending the OTP email.",
        )

    return {
        "success": True,
        "message": f"Verification OTP code successfully sent to {email}.",
        "email": email,
        "expires_in_minutes": settings.otp_expire_minutes,
    }


@router.post(
    "/verify",
    summary="Verify Email OTP",
    description="Verifies an incoming 6-digit OTP against active stored records in MongoDB.",
)
async def verify_otp(payload: OTPVerifyRequest) -> dict[str, Any]:
    """
    Verify an incoming 6-digit OTP code for a given email address.
    """
    email = payload.email.lower().strip()

    try:
        is_valid = verify_stored_otp(email=email, otp_code=payload.otp)
    except Exception as e:
        logger.error("Failed to query OTP record from database: %s", type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database operational error during OTP verification.",
        )

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid, expired, or previously used OTP code.",
        )

    return {
        "success": True,
        "message": "Email OTP verification successful.",
        "email": email,
    }
