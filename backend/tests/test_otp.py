"""
TRUE FACE AI — Comprehensive Automated Tests for Email OTP & Database Services

Covers:
1. Secure 6-digit OTP generation using secrets module
2. Expiration timestamps and HMAC-SHA256 hashing
3. Resend cooldown enforcement
4. Failed attempt counter and maximum attempt lock
5. Single-use invalidation (replay attack prevention)
6. API endpoint integration (/api/v1/otp/send, /api/v1/otp/verify)
7. Error resilience (database timeout, missing config, SMTP failures, rollback)
8. MongoDB URI sanitization and credential masking
"""

from datetime import datetime, timedelta, timezone
import re
import smtplib
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from pymongo.errors import OperationFailure, ServerSelectionTimeoutError

from app.config import settings
from app.main import app
from app.services.database import mask_credentials, sanitize_mongo_uri
from app.services.email_service import send_otp_email
from app.services.otp_service import (
    OTPCooldownError,
    calculate_otp_expiration,
    check_resend_cooldown,
    generate_otp_code,
    generate_otp_with_expiration,
    hash_otp,
    invalidate_otp_record,
    save_otp_record,
    verify_otp_hash,
    verify_stored_otp,
)

client = TestClient(app)


# ==============================================================================
# 1. OTP Generation, Expiration & Hashing Unit Tests
# ==============================================================================

def test_generate_otp_code_format_and_length():
    """Verify generated OTP is exactly 6 numeric digits with leading zeros supported."""
    for _ in range(50):
        code = generate_otp_code(digits=6)
        assert isinstance(code, str)
        assert len(code) == 6
        assert code.isdigit()
        assert re.match(r"^\d{6}$", code)


def test_generate_otp_code_entropy():
    """Verify secrets module produces varied values across iterations."""
    codes = {generate_otp_code(digits=6) for _ in range(30)}
    # At least 25 distinct values in 30 samples
    assert len(codes) >= 25


def test_calculate_otp_expiration():
    """Verify UTC expiration datetime calculation against settings."""
    before = datetime.now(timezone.utc)
    expires = calculate_otp_expiration(expire_minutes=5)
    after = datetime.now(timezone.utc)

    assert expires.tzinfo is not None
    assert expires >= before + timedelta(minutes=4, seconds=58)
    assert expires <= after + timedelta(minutes=5, seconds=2)


def test_generate_otp_with_expiration():
    """Verify combined generation function returns valid code and future timestamp."""
    code, expires_at = generate_otp_with_expiration()
    assert len(code) == 6
    assert code.isdigit()
    assert expires_at > datetime.now(timezone.utc)


def test_hash_otp_hmac_and_normalization():
    """Verify HMAC hashing normalizes email casing and trims whitespace."""
    email_clean = "user@example.com"
    email_messy = "  UsEr@ExAmPlE.cOm  "
    code = "123456"

    hash1 = hash_otp(email_clean, code)
    hash2 = hash_otp(email_messy, code)

    assert isinstance(hash1, str)
    assert len(hash1) == 64  # SHA256 hex length
    assert hash1 == hash2


def test_verify_otp_hash():
    """Verify timing-safe hash comparison accepts valid OTP and rejects invalid."""
    email = "test@example.com"
    code = "987654"
    valid_hash = hash_otp(email, code)

    assert verify_otp_hash(email, code, valid_hash) is True
    assert verify_otp_hash(email, "000000", valid_hash) is False
    assert verify_otp_hash("other@example.com", code, valid_hash) is False


# ==============================================================================
# 2. Database Record Persistence, Cooldown, and Attempt Limits
# ==============================================================================

class MockCollection:
    """In-memory mock for MongoDB collection to unit test database logic."""

    def __init__(self):
        self.docs: dict[str, dict] = {}

    def find_one(self, query):
        for doc in self.docs.values():
            match = True
            for k, v in query.items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                return dict(doc)
        return None

    def update_one(self, filter_query, update_op, upsert=False):
        email = filter_query.get("email") or filter_query.get("_id")
        doc = self.docs.get(email)

        if not doc and upsert:
            doc = {"_id": email}
            self.docs[email] = doc

        if doc:
            if "$set" in update_op:
                doc.update(update_op["$set"])
            if "$inc" in update_op:
                for k, v in update_op["$inc"].items():
                    doc[k] = doc.get(k, 0) + v
        return MagicMock(modified_count=1)

    def delete_one(self, filter_query):
        email = filter_query.get("email")
        if email in self.docs:
            del self.docs[email]
            return MagicMock(deleted_count=1)
        return MagicMock(deleted_count=0)


class MockDatabase:
    def __init__(self):
        self.collections = {"otp_codes": MockCollection()}

    def __getitem__(self, item):
        if item not in self.collections:
            self.collections[item] = MockCollection()
        return self.collections[item]


class MockMongoClient:
    def __init__(self):
        self.db = MockDatabase()

    def __getitem__(self, item):
        return self.db


def test_save_otp_record_stores_hashed_record():
    """Verify save_otp_record stores hashed OTP, timestamps, and never plain text."""
    mock_client = MockMongoClient()
    email = "persisted@example.com"
    code = "654321"
    expires = calculate_otp_expiration(2)

    record = save_otp_record(email, code, expires, client=mock_client)

    assert record["email"] == email
    assert record["is_used"] is False
    assert record["attempts"] == 0
    assert record["otp_hash"] == hash_otp(email, code)
    assert "654321" not in str(record)  # Plain text OTP is never stored

    stored = mock_client[settings.mongodb_db_name]["otp_codes"].find_one({"email": email})
    assert stored is not None
    assert stored["otp_hash"] == hash_otp(email, code)


def test_otp_resend_cooldown_enforcement():
    """Verify resend cooldown prevents immediate subsequent OTP creation."""
    mock_client = MockMongoClient()
    email = "cooldown@example.com"
    expires = calculate_otp_expiration(2)

    # First send succeeds
    save_otp_record(email, "111111", expires, client=mock_client)

    # Immediate second send must raise OTPCooldownError
    with pytest.raises(OTPCooldownError) as exc_info:
        save_otp_record(email, "222222", expires, client=mock_client)

    assert exc_info.value.remaining_seconds > 0
    assert exc_info.value.remaining_seconds <= settings.otp_resend_cooldown_seconds


def test_verify_stored_otp_success_and_single_use():
    """Verify OTP verification succeeds and immediately marks record as used (no replay)."""
    mock_client = MockMongoClient()
    email = "singleuse@example.com"
    code = "456789"
    expires = calculate_otp_expiration(2)

    save_otp_record(email, code, expires, client=mock_client)

    # First verification should succeed
    is_valid, msg = verify_stored_otp(email, code, client=mock_client)
    assert is_valid is True
    assert "successful" in msg.lower()

    # Second verification with same code must fail (single-use constraint)
    is_valid_again, msg_again = verify_stored_otp(email, code, client=mock_client)
    assert is_valid_again is False
    assert "no active otp request" in msg_again.lower() or "expired" in msg_again.lower()


def test_verify_stored_otp_expired():
    """Verify expired OTP code is rejected."""
    mock_client = MockMongoClient()
    email = "expired@example.com"
    code = "123456"
    # Set expiration in the past
    past_expiry = datetime.now(timezone.utc) - timedelta(minutes=1)

    mock_col = mock_client[settings.mongodb_db_name]["otp_codes"]
    mock_col.update_one(
        {"email": email},
        {
            "$set": {
                "_id": email,
                "email": email,
                "otp_hash": hash_otp(email, code),
                "expires_at": past_expiry,
                "is_used": False,
                "attempts": 0,
                "max_attempts": 5,
            }
        },
        upsert=True,
    )

    is_valid, msg = verify_stored_otp(email, code, client=mock_client)
    assert is_valid is False
    assert "expired" in msg.lower()


def test_verify_stored_otp_attempt_limits():
    """Verify failed attempts increment counter and lock out at max_attempts."""
    mock_client = MockMongoClient()
    email = "attempts@example.com"
    real_code = "777888"
    wrong_code = "000000"
    expires = calculate_otp_expiration(2)

    save_otp_record(email, real_code, expires, client=mock_client)

    # 4 wrong attempts
    for i in range(1, 5):
        is_valid, msg = verify_stored_otp(email, wrong_code, client=mock_client)
        assert is_valid is False
        assert f"{5 - i} attempt(s) remaining" in msg

    # 5th wrong attempt triggers lock
    is_valid, msg = verify_stored_otp(email, wrong_code, client=mock_client)
    assert is_valid is False
    assert "maximum" in msg.lower()

    # Even the correct code is now rejected because attempts were exceeded
    is_valid, msg = verify_stored_otp(email, real_code, client=mock_client)
    assert is_valid is False


def test_invalidate_otp_record():
    """Verify rollback function cleanly removes the active record."""
    mock_client = MockMongoClient()
    email = "rollback@example.com"
    expires = calculate_otp_expiration(2)

    save_otp_record(email, "123123", expires, client=mock_client)
    assert mock_client[settings.mongodb_db_name]["otp_codes"].find_one({"email": email}) is not None

    invalidate_otp_record(email, client=mock_client)
    assert mock_client[settings.mongodb_db_name]["otp_codes"].find_one({"email": email}) is None


# ==============================================================================
# 3. FastAPI Route Integration Tests (/api/v1/otp/send & /api/v1/otp/verify)
# ==============================================================================

@patch("app.routes.otp.send_otp_email")
@patch("app.routes.otp.save_otp_record")
def test_api_send_otp_success(mock_save, mock_send_email):
    """Verify POST /api/v1/otp/send returns HTTP 200, dispatches email, and NEVER exposes OTP."""
    mock_save.return_value = {"email": "api_user@example.com"}
    mock_send_email.return_value = True

    response = client.post("/api/v1/otp/send", json={"email": "api_user@example.com"})

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["email"] == "api_user@example.com"
    assert "message" in data
    assert "dev_otp" not in data  # CRITICAL: dev_otp must never be present
    assert "otp" not in data
    assert "[DEV MODE]" not in data["message"]
    assert data["expires_in_minutes"] == settings.otp_expire_minutes
    assert data["cooldown_seconds"] == settings.otp_resend_cooldown_seconds
    mock_send_email.assert_called_once()


@patch("app.routes.otp.save_otp_record")
def test_api_send_otp_cooldown_429(mock_save):
    """Verify POST /api/v1/otp/send returns HTTP 429 when cooldown is active."""
    mock_save.side_effect = OTPCooldownError(remaining_seconds=35)

    response = client.post("/api/v1/otp/send", json={"email": "cooldown_api@example.com"})

    assert response.status_code == 429
    data = response.json()
    assert "35 seconds" in data["detail"]


@patch("app.routes.otp.save_otp_record")
def test_api_send_otp_database_unconfigured_503(mock_save):
    """Verify POST /api/v1/otp/send returns HTTP 503 when MONGODB_URI is missing."""
    mock_save.side_effect = ValueError("MONGODB_URI is not set")

    response = client.post("/api/v1/otp/send", json={"email": "nodb@example.com"})

    assert response.status_code == 503
    data = response.json()
    assert "Database service is not configured" in data["detail"]


@patch("app.routes.otp.save_otp_record")
def test_api_send_otp_database_timeout_503(mock_save):
    """Verify POST /api/v1/otp/send returns HTTP 503 with Atlas guidance on connection timeout."""
    mock_save.side_effect = ServerSelectionTimeoutError("No replica set members found")

    response = client.post("/api/v1/otp/send", json={"email": "timeout@example.com"})

    assert response.status_code == 503
    data = response.json()
    assert "timed out" in data["detail"].lower()
    assert "network access" in data["detail"].lower()


@patch("app.routes.otp.invalidate_otp_record")
@patch("app.routes.otp.send_otp_email")
@patch("app.routes.otp.save_otp_record")
def test_api_send_otp_email_failure_rolls_back(mock_save, mock_send_email, mock_invalidate):
    """Verify POST /api/v1/otp/send rolls back OTP record and returns 502 if SMTP fails."""
    mock_save.return_value = {"email": "smtp_fail@example.com"}
    mock_send_email.side_effect = RuntimeError("SMTP connection failed")

    response = client.post("/api/v1/otp/send", json={"email": "smtp_fail@example.com"})

    assert response.status_code == 502
    assert "Failed to deliver OTP email" in response.json()["detail"]
    assert "dev_otp" not in response.json()
    # Verify rollback was called
    mock_invalidate.assert_called_once_with(email="smtp_fail@example.com")


@patch("app.routes.otp.invalidate_otp_record")
@patch("app.routes.otp.send_otp_email")
@patch("app.routes.otp.save_otp_record")
def test_api_send_otp_unconfigured_smtp_returns_503_and_rolls_back(
    mock_save, mock_send_email, mock_invalidate
):
    """Verify unconfigured SMTP raises 503, invalidates record, and does NOT fallback to dev mode."""
    mock_save.return_value = {"email": "nosmtp@example.com"}
    mock_send_email.side_effect = ValueError("SMTP credentials not configured")

    response = client.post("/api/v1/otp/send", json={"email": "nosmtp@example.com"})

    assert response.status_code == 503
    assert "Email service is unconfigured" in response.json()["detail"]
    assert "dev_otp" not in response.json()
    mock_invalidate.assert_called_once_with(email="nosmtp@example.com")


@patch("app.routes.otp.verify_stored_otp")
def test_api_verify_otp_success_200(mock_verify):
    """Verify POST /api/v1/otp/verify returns HTTP 200 on valid code."""
    mock_verify.return_value = (True, "Email OTP verification successful.")

    response = client.post(
        "/api/v1/otp/verify",
        json={"email": "verify_ok@example.com", "otp": "123456"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["email"] == "verify_ok@example.com"
    assert "successful" in data["message"].lower()


@patch("app.routes.otp.verify_stored_otp")
def test_api_verify_otp_invalid_code_400(mock_verify):
    """Verify POST /api/v1/otp/verify returns HTTP 400 with remaining attempts."""
    mock_verify.return_value = (False, "Invalid OTP code. 3 attempt(s) remaining.")

    response = client.post(
        "/api/v1/otp/verify",
        json={"email": "verify_bad@example.com", "otp": "999999"},
    )

    assert response.status_code == 400
    data = response.json()
    assert "3 attempt(s) remaining" in data["detail"]


@patch("app.routes.otp.verify_stored_otp")
def test_api_verify_otp_expired_code_400(mock_verify):
    """Verify POST /api/v1/otp/verify returns HTTP 400 when OTP has expired."""
    mock_verify.return_value = (False, "Verification OTP has expired. Please request a new code.")

    response = client.post(
        "/api/v1/otp/verify",
        json={"email": "verify_expired@example.com", "otp": "123456"},
    )

    assert response.status_code == 400
    data = response.json()
    assert "expired" in data["detail"].lower()


@patch("app.routes.otp.verify_stored_otp")
def test_api_verify_otp_already_used_code_400(mock_verify):
    """Verify POST /api/v1/otp/verify returns HTTP 400 when OTP was already used (single-use)."""
    mock_verify.return_value = (
        False,
        "No active OTP request found for this email address. Please request a new code.",
    )

    response = client.post(
        "/api/v1/otp/verify",
        json={"email": "verify_used@example.com", "otp": "123456"},
    )

    assert response.status_code == 400
    data = response.json()
    assert "no active otp request" in data["detail"].lower()


@patch("app.routes.otp.verify_stored_otp")
def test_api_verify_otp_max_attempts_exceeded_400(mock_verify):
    """Verify POST /api/v1/otp/verify returns HTTP 400 when maximum attempts are exceeded."""
    mock_verify.return_value = (
        False,
        "Maximum verification attempts exceeded. Please request a new code.",
    )

    response = client.post(
        "/api/v1/otp/verify",
        json={"email": "verify_locked@example.com", "otp": "123456"},
    )

    assert response.status_code == 400
    data = response.json()
    assert "maximum" in data["detail"].lower()


@patch("app.routes.otp.verify_stored_otp")
def test_api_verify_otp_database_error_503(mock_verify):
    """Verify POST /api/v1/otp/verify handles DB outages gracefully."""
    mock_verify.side_effect = ServerSelectionTimeoutError("Server unreachable")

    response = client.post(
        "/api/v1/otp/verify",
        json={"email": "verify_dberr@example.com", "otp": "123456"},
    )

    assert response.status_code == 503
    assert "timed out" in response.json()["detail"].lower()


# ==============================================================================
# 3b. SMTP Email Service Unit Tests
# ==============================================================================

@patch("app.services.email_service.smtplib.SMTP")
def test_send_otp_email_service_success(mock_smtp_cls):
    """Verify send_otp_email constructs valid message and executes STARTTLS & login."""
    mock_server = MagicMock()
    mock_smtp_cls.return_value.__enter__.return_value = mock_server

    with patch.object(settings, "smtp_user", "testsender@example.com"), \
         patch.object(settings, "smtp_password", "testapppass1234"), \
         patch.object(settings, "emails_from_email", "testsender@example.com"):
        result = send_otp_email("recipient@example.com", "842619")

    assert result is True
    mock_server.starttls.assert_called_once()
    mock_server.login.assert_called_once_with("testsender@example.com", "testapppass1234")
    mock_server.sendmail.assert_called_once()
    args = mock_server.sendmail.call_args[0]
    assert args[0] == "testsender@example.com"
    assert args[1] == ["recipient@example.com"]
    raw_message = args[2]
    assert "842619" in raw_message


def test_send_otp_email_service_unconfigured_raises_value_error():
    """Verify send_otp_email raises ValueError if credentials are not configured."""
    with patch.object(settings, "smtp_user", ""), \
         patch.object(settings, "smtp_password", ""), \
         patch.object(settings, "emails_from_email", ""):
        with pytest.raises(ValueError) as exc:
            send_otp_email("user@example.com", "123456")
        assert "SMTP credentials not configured" in str(exc.value)


@patch("app.services.email_service.smtplib.SMTP")
def test_send_otp_email_service_auth_failure_raises_runtime_error(mock_smtp_cls):
    """Verify SMTPAuthenticationError is sanitized and raises RuntimeError."""
    mock_server = MagicMock()
    mock_server.login.side_effect = smtplib.SMTPAuthenticationError(535, b"Authentication failed")
    mock_smtp_cls.return_value.__enter__.return_value = mock_server

    with patch.object(settings, "smtp_user", "sender@example.com"), \
         patch.object(settings, "smtp_password", "secretpassword"), \
         patch.object(settings, "emails_from_email", "sender@example.com"):
        with pytest.raises(RuntimeError) as exc:
            send_otp_email("user@example.com", "123456")
        assert "authentication failed" in str(exc.value).lower()
        assert "secretpassword" not in str(exc.value)



# ==============================================================================
# 4. MongoDB URI Sanitization & Credential Masking Tests
# ==============================================================================

def test_sanitize_mongo_uri_unencoded_special_chars():
    """Verify passwords with raw special chars (@, !, #) are safely escaped."""
    raw = "mongodb+srv://admin_user:P@ss!word#1@cluster0.abcde.mongodb.net/?retryWrites=true"
    sanitized = sanitize_mongo_uri(raw)

    assert "P%40ss%21word%231" in sanitized
    assert "@cluster0.abcde.mongodb.net" in sanitized


def test_sanitize_mongo_uri_prevents_double_encoding():
    """Verify already percent-encoded passwords do not turn into %25."""
    already_encoded = "mongodb+srv://admin_user:P%40ss%21word@cluster0.abcde.mongodb.net/?retryWrites=true"
    sanitized = sanitize_mongo_uri(already_encoded)

    assert "P%40ss%21word" in sanitized
    assert "%25" not in sanitized


def test_mask_credentials_in_logs():
    """Verify error messages with URI strings mask username and password."""
    secret_err = "Failed connection to mongodb+srv://myuser:secretpass123@cluster0.mongodb.net"
    masked = mask_credentials(secret_err)

    assert "secretpass123" not in masked
    assert "myuser" not in masked
    assert "***:***" in masked
