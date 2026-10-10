"""
TRUE FACE AI — Email OTP Generation, Hashing & MongoDB Storage Service

Provides secure generation, HMAC hashing, and MongoDB persistence/retrieval
for numeric One-Time Passwords (OTPs).
"""

from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import secrets
from typing import Any

from pymongo import MongoClient

from app.config import settings
from app.services.database import get_mongo_client

# Collection configuration
OTP_COLLECTION_NAME = "otp_codes"
DB_NAME = "TRUE_FACE_AI"


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


# --- MongoDB Storage & Retrieval ---

def save_otp_record(
    email: str,
    otp_code: str,
    expires_at: datetime,
    client: MongoClient | None = None,
) -> dict[str, Any]:
    """
    Store or replace the active OTP record for an email address in MongoDB.

    Saves the HMAC-SHA256 hashed OTP, created timestamp, and expiration timestamp.
    Never stores the plain-text OTP.
    """
    normalized_email = email.lower().strip()
    hashed = hash_otp(normalized_email, otp_code)
    now = datetime.now(timezone.utc)

    record = {
        "email": normalized_email,
        "otp_hash": hashed,
        "created_at": now,
        "expires_at": expires_at,
        "is_used": False,
    }

    close_client = False
    if client is None:
        client = get_mongo_client()
        close_client = True

    try:
        db = client[DB_NAME]
        collection = db[OTP_COLLECTION_NAME]
        collection.update_one(
            {"email": normalized_email},
            {"$set": record},
            upsert=True,
        )
        return record
    finally:
        if close_client:
            client.close()


def get_active_otp_record(
    email: str,
    client: MongoClient | None = None,
) -> dict[str, Any] | None:
    """
    Retrieve the active, non-expired, unused OTP record for an email address.

    Rejects expired records using application-level UTC datetime comparison.
    """
    normalized_email = email.lower().strip()
    close_client = False
    if client is None:
        client = get_mongo_client()
        close_client = True

    try:
        db = client[DB_NAME]
        collection = db[OTP_COLLECTION_NAME]
        record = collection.find_one({"email": normalized_email, "is_used": False})

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
    finally:
        if close_client:
            client.close()


def verify_stored_otp(
    email: str,
    otp_code: str,
    client: MongoClient | None = None,
) -> bool:
    """
    Verify an incoming OTP against the active stored record for an email address.

    If valid and non-expired, marks the record as used (is_used=True).
    Returns True if verification succeeded, False otherwise.
    """
    normalized_email = email.lower().strip()
    close_client = False
    if client is None:
        client = get_mongo_client()
        close_client = True

    try:
        db = client[DB_NAME]
        collection = db[OTP_COLLECTION_NAME]

        record = collection.find_one({"email": normalized_email, "is_used": False})
        if not record:
            return False

        # Expiration check
        expires_at = record.get("expires_at")
        if expires_at:
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) >= expires_at:
                return False

        # Secure hash comparison
        stored_hash = record.get("otp_hash", "")
        if not verify_otp_hash(normalized_email, otp_code, stored_hash):
            return False

        # Mark OTP as used to prevent replay attacks
        collection.update_one(
            {"_id": record["_id"]},
            {
                "$set": {
                    "is_used": True,
                    "used_at": datetime.now(timezone.utc),
                }
            },
        )
        return True
    finally:
        if close_client:
            client.close()
