"""
TRUE FACE AI — Email OTP Generation, Hashing & MongoDB Storage Service

Provides cryptographically secure generation, HMAC-SHA256 hashing,
resend cooldown enforcement, max attempt limits, and single-use verification
backed by MongoDB persistence.
"""

from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import logging
import secrets
from typing import Any

from pymongo import MongoClient

from app.config import settings
from app.services.database import get_database, get_mongo_client

logger = logging.getLogger(__name__)

OTP_COLLECTION_NAME = "otp_codes"


class OTPCooldownError(Exception):
    """Raised when an OTP request is made before the cooldown period has elapsed."""

    def __init__(self, remaining_seconds: int):
        self.remaining_seconds = remaining_seconds
        super().__init__(
            f"Please wait {remaining_seconds} seconds before requesting a new OTP."
        )


# --- Generation & Expiry ---

def generate_otp_code(digits: int = 6) -> str:
    """
    Securely generate a numeric OTP string of fixed length.
    Uses Python's cryptographically secure 'secrets' module.
    Preserves leading zeros (e.g. '012345').
    """
    max_val = 10**digits
    num = secrets.randbelow(max_val)
    return f"{num:0{digits}d}"


def calculate_otp_expiration(expire_minutes: int | None = None) -> datetime:
    """
    Calculate timezone-aware UTC expiration datetime for an OTP.
    Defaults to settings.otp_expire_minutes if not specified.
    """
    minutes = (
        expire_minutes if expire_minutes is not None else settings.otp_expire_minutes
    )
    return datetime.now(timezone.utc) + timedelta(minutes=minutes)


def generate_otp_with_expiration() -> tuple[str, datetime]:
    """
    Generate a 6-digit numeric OTP alongside its UTC expiration timestamp.

    Returns:
        tuple[str, datetime]: (otp_code, expires_at)
    """
    otp_code = generate_otp_code(digits=6)
    expires_at = calculate_otp_expiration()
    return otp_code, expires_at


# --- Cryptographic Hashing ---

def hash_otp(email: str, otp_code: str) -> str:
    """
    Cryptographically hash an OTP code using HMAC-SHA256 and settings.secret_key.
    Normalizes email address to lowercase and strips whitespace before hashing.
    """
    normalized_email = email.lower().strip()
    msg = f"{normalized_email}:{otp_code}".encode("utf-8")
    key = settings.secret_key.encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).hexdigest()


def verify_otp_hash(email: str, otp_code: str, stored_hash: str) -> bool:
    """
    Securely compare an incoming OTP code against a stored OTP hash.
    Uses hmac.compare_digest to prevent timing attack side-channels.
    """
    computed_hash = hash_otp(email, otp_code)
    return hmac.compare_digest(computed_hash, stored_hash)


# In-memory store for local development mode when MongoDB URI is not configured
_dev_otp_store: dict[str, dict[str, Any]] = {}


# --- Database Operations ---

def check_resend_cooldown(
    email: str,
    client: MongoClient | None = None,
) -> int:
    """
    Check if an email address is within the OTP resend cooldown window.

    Returns:
        int: Remaining cooldown seconds, or 0 if allowed to resend.
    """
    normalized_email = email.lower().strip()
    try:
        db = client[settings.mongodb_db_name] if client else get_database()
        collection = db[OTP_COLLECTION_NAME]
        record = collection.find_one({"email": normalized_email})
    except ValueError:
        record = _dev_otp_store.get(normalized_email)

    if not record:
        return 0

    created_at = record.get("created_at")
    if not created_at:
        return 0

    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    now = datetime.now(timezone.utc)
    elapsed_seconds = (now - created_at).total_seconds()
    cooldown = settings.otp_resend_cooldown_seconds

    if elapsed_seconds < cooldown:
        remaining = int(cooldown - elapsed_seconds)
        return max(remaining, 1)

    return 0


def save_otp_record(
    email: str,
    otp_code: str,
    expires_at: datetime,
    client: MongoClient | None = None,
) -> dict[str, Any]:
    """
    Store or replace the active OTP record for an email address in MongoDB
    (or local memory in dev mode).
    Enforces resend cooldown, stores HMAC hash, and initializes attempt counter.
    Never stores plain-text OTPs.

    Raises:
        OTPCooldownError: If the request is made before the cooldown window elapses.
    """
    normalized_email = email.lower().strip()

    # Verify cooldown before overwriting
    remaining = check_resend_cooldown(normalized_email, client=client)
    if remaining > 0:
        raise OTPCooldownError(remaining_seconds=remaining)

    hashed = hash_otp(normalized_email, otp_code)
    now = datetime.now(timezone.utc)

    record = {
        "email": normalized_email,
        "otp_hash": hashed,
        "created_at": now,
        "expires_at": expires_at,
        "is_used": False,
        "attempts": 0,
        "max_attempts": settings.otp_max_attempts,
    }

    try:
        db = client[settings.mongodb_db_name] if client else get_database()
        collection = db[OTP_COLLECTION_NAME]
        collection.update_one(
            {"email": normalized_email},
            {"$set": record},
            upsert=True,
        )
    except ValueError:
        logger.info("[DEV MODE] Storing OTP record in-memory for %s", normalized_email)
        _dev_otp_store[normalized_email] = record

    return record


def invalidate_otp_record(
    email: str,
    client: MongoClient | None = None,
) -> None:
    """
    Invalidate or remove an OTP record (e.g. if email transmission failed).
    """
    normalized_email = email.lower().strip()
    _dev_otp_store.pop(normalized_email, None)
    try:
        db = client[settings.mongodb_db_name] if client else get_database()
        collection = db[OTP_COLLECTION_NAME]
        collection.delete_one({"email": normalized_email})
    except Exception as e:
        logger.debug("Failed to invalidate OTP record in database for %s: %s", normalized_email, e)


def get_active_otp_record(
    email: str,
    client: MongoClient | None = None,
) -> dict[str, Any] | None:
    """
    Retrieve the active, non-expired, unused OTP record for an email address.
    """
    normalized_email = email.lower().strip()
    try:
        db = client[settings.mongodb_db_name] if client else get_database()
        collection = db[OTP_COLLECTION_NAME]
        record = collection.find_one({"email": normalized_email, "is_used": False})
    except ValueError:
        record = _dev_otp_store.get(normalized_email)
        if record and record.get("is_used"):
            record = None

    if not record:
        return None

    # Application-level expiration validation
    expires_at = record.get("expires_at")
    if expires_at:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) >= expires_at:
            return None

    return record


def verify_stored_otp(
    email: str,
    otp_code: str,
    client: MongoClient | None = None,
) -> tuple[bool, str]:
    """
    Verify an incoming OTP against the active stored record for an email address.

    Enforces:
    1. Active record existence
    2. UTC expiration check
    3. Maximum attempt limits with failed attempt counter
    4. Timing-safe cryptographic hash comparison
    5. Single-use invalidation (marks is_used=True to prevent replay)

    Returns:
        tuple[bool, str]: (is_valid, message)
    """
    normalized_email = email.lower().strip()
    is_dev = False
    try:
        db = client[settings.mongodb_db_name] if client else get_database()
        collection = db[OTP_COLLECTION_NAME]
        record = collection.find_one({"email": normalized_email, "is_used": False})
    except ValueError:
        is_dev = True
        record = _dev_otp_store.get(normalized_email)
        if record and record.get("is_used"):
            record = None

    if not record:
        return False, "No active OTP request found for this email address. Please request a new code."

    # 1. Expiration check
    expires_at = record.get("expires_at")
    if expires_at:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) >= expires_at:
            if is_dev:
                record["is_used"] = True
                record["reason"] = "expired"
            else:
                collection.update_one(
                    {"_id": record["_id"]},
                    {"$set": {"is_used": True, "reason": "expired"}},
                )
            return False, "Verification OTP has expired. Please request a new code."

    # 2. Maximum attempts check
    attempts = record.get("attempts", 0)
    max_attempts = record.get("max_attempts", settings.otp_max_attempts)
    if attempts >= max_attempts:
        if is_dev:
            record["is_used"] = True
            record["reason"] = "max_attempts_exceeded"
        else:
            collection.update_one(
                {"_id": record["_id"]},
                {"$set": {"is_used": True, "reason": "max_attempts_exceeded"}},
            )
        return False, "Maximum verification attempts exceeded. Please request a new code."

    # 3. Secure hash comparison
    stored_hash = record.get("otp_hash", "")
    if not verify_otp_hash(normalized_email, otp_code, stored_hash):
        new_attempts = attempts + 1
        remaining_attempts = max_attempts - new_attempts
        if remaining_attempts <= 0:
            if is_dev:
                record["attempts"] = new_attempts
                record["is_used"] = True
                record["reason"] = "max_attempts_exceeded"
            else:
                collection.update_one(
                    {"_id": record["_id"]},
                    {
                        "$set": {
                            "attempts": new_attempts,
                            "is_used": True,
                            "reason": "max_attempts_exceeded",
                        }
                    },
                )
            return (
                False,
                "Invalid OTP code. Maximum verification attempts reached. Please request a new code.",
            )
        else:
            if is_dev:
                record["attempts"] = new_attempts
            else:
                collection.update_one(
                    {"_id": record["_id"]},
                    {"$set": {"attempts": new_attempts}},
                )
            return (
                False,
                f"Invalid OTP code. {remaining_attempts} attempt(s) remaining.",
            )

    # 4. Success: Mark OTP as used to prevent replay attacks
    if is_dev:
        record["is_used"] = True
        record["used_at"] = datetime.now(timezone.utc)
        record["reason"] = "verified"
    else:
        collection.update_one(
            {"_id": record["_id"]},
            {
                "$set": {
                    "is_used": True,
                    "used_at": datetime.now(timezone.utc),
                    "reason": "verified",
                }
            },
        )
    return True, "Email OTP verification successful."

