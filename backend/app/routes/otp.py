"""
TRUE FACE AI — Email OTP API Routes

Endpoints:
- POST /api/v1/otp/send
- POST /api/v1/otp/verify
"""

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pymongo.errors import (
    ConfigurationError,
    ConnectionFailure,
    OperationFailure,
    ServerSelectionTimeoutError,
)

from app.config import settings
from app.schemas.otp import OTPSendRequest, OTPVerifyRequest
from app.services.database import mask_credentials
from app.services.email_service import send_otp_email
from app.services.otp_service import (
    OTPCooldownError,
    generate_otp_with_expiration,
    invalidate_otp_record,
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
    Enforces resend cooldown, saves HMAC hash to MongoDB, and dispatches via SMTP.
    """
    email = payload.email.lower().strip()

    # 1. Generate OTP and expiry timestamp
    otp_code, expires_at = generate_otp_with_expiration()

    # 2. Save hashed record to MongoDB with cooldown validation
    try:
        save_otp_record(email=email, otp_code=otp_code, expires_at=expires_at)
    except OTPCooldownError as ce:
        logger.warning(
            "OTP request rejected due to resend cooldown for %s: %d seconds remaining",
            email,
            ce.remaining_seconds,
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Please wait {ce.remaining_seconds} seconds before requesting another OTP.",
        )
    except ValueError as ve:
        logger.error("Database configuration error during OTP send: %s", ve)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service is not configured on the server. Please set MONGODB_URI in backend environment.",
        )
    except ServerSelectionTimeoutError as te:
        logger.error(
            "Database connection timeout during OTP send for %s: %s",
            email,
            mask_credentials(str(te)),
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Database connection timed out. Please check network connectivity and ensure the server IP "
                "is whitelisted in MongoDB Atlas Network Access."
            ),
        )
    except OperationFailure as ofe:
        logger.error(
            "Database operation/auth failure during OTP send for %s: %s",
            email,
            mask_credentials(str(ofe)),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database authentication failed. Please verify MongoDB credentials in backend environment.",
        )
    except (ConnectionFailure, ConfigurationError) as ce:
        logger.error("Database connection failure: %s", mask_credentials(str(ce)))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service is currently unreachable. Please check database server status.",
        )
    except Exception as e:
        logger.error("Unexpected error saving OTP record to database: %s", mask_credentials(str(e)))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected database error occurred while processing the OTP request.",
        )

    # 3. Dispatch OTP email via SMTP
    try:
        send_otp_email(to_email=email, otp_code=otp_code)
    except ValueError as e:
        logger.error("SMTP configuration missing: %s", e)
        # Roll back stored OTP so user is not locked by a failed send
        invalidate_otp_record(email=email)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email service is unconfigured on the server. Please configure SMTP credentials in backend/.env.",
        )
    except RuntimeError as e:
        logger.error("SMTP delivery failure: %s", e)
        invalidate_otp_record(email=email)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to deliver OTP email. Please verify your email address or check SMTP server availability.",
        )
    except Exception as e:
        logger.error("Unexpected error during OTP email delivery: %s", e)
        invalidate_otp_record(email=email)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while sending the OTP email.",
        )

    return {
        "success": True,
        "message": f"Verification OTP code successfully sent to {email}.",
        "email": email,
        "expires_in_minutes": settings.otp_expire_minutes,
        "cooldown_seconds": settings.otp_resend_cooldown_seconds,
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
        is_valid, message = verify_stored_otp(email=email, otp_code=payload.otp)
    except ValueError as ve:
        logger.error("Database configuration error during OTP verification: %s", ve)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service is not configured on the server. Please set MONGODB_URI in backend environment.",
        )
    except ServerSelectionTimeoutError as te:
        logger.error(
            "Database connection timeout during OTP verification for %s: %s",
            email,
            mask_credentials(str(te)),
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection timed out during OTP verification. Please verify network access.",
        )
    except OperationFailure as ofe:
        logger.error(
            "Database authentication failure during OTP verification: %s",
            mask_credentials(str(ofe)),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database operational error during OTP verification.",
        )
    except (ConnectionFailure, ConfigurationError) as ce:
        logger.error("Database connection failure: %s", mask_credentials(str(ce)))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service is currently unreachable.",
        )
    except Exception as e:
        logger.error("Failed to query OTP record from database: %s", mask_credentials(str(e)))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database operational error during OTP verification.",
        )

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message,
        )

    return {
        "success": True,
        "message": message,
        "email": email,
    }
