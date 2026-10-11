"""
TRUE FACE AI — MongoDB Atlas Database Connection Service

Manages PyMongo MongoClient initialization using credentials loaded securely
from application settings/environment. Credentials and passwords are NEVER hardcoded or printed.
Provides connection pooling, URI credential sanitation, and index verification.
"""

import logging
import os
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus, unquote

import certifi
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.database import Database
from pymongo.errors import (
    ConfigurationError,
    ConnectionFailure,
    OperationFailure,
    ServerSelectionTimeoutError,
)
from pymongo.server_api import ServerApi

from app.config import settings

logger = logging.getLogger(__name__)

# Load local environment if present (support both backend/.env and root .env)
backend_dir = Path(__file__).resolve().parent.parent.parent
for potential_env in [backend_dir / ".env", backend_dir.parent / ".env"]:
    if potential_env.exists():
        load_dotenv(dotenv_path=potential_env)

# Cached singleton client instance for connection pooling
_mongo_client: MongoClient | None = None


def mask_credentials(text: str) -> str:
    """Mask credentials and sensitive URI components in error and log strings."""
    if not text:
        return ""
    masked = str(text)
    if "://" in masked and "@" in masked:
        try:
            scheme, remainder = masked.split("://", 1)
            creds, host_part = remainder.rsplit("@", 1)
            masked = f"{scheme}://***:***@{host_part}"
        except Exception:
            masked = "[CREDENTIALS_MASKED]"
    return masked


def sanitize_mongo_uri(raw_uri: str) -> str:
    """
    Sanitize MongoDB connection URI for RFC 3986 compliance without double-encoding.

    Handles passwords with special characters (e.g. @, #, $, %) safely by
    unquoting first before quote_plus.
    """
    uri = raw_uri.strip()
    if "://" not in uri:
        return uri

    scheme, rest = uri.split("://", 1)
    if "@" not in rest:
        return uri

    # In standard connection strings, user credentials precede the host separator '@'
    credentials, host_section = rest.rsplit("@", 1)
    if ":" in credentials:
        user, password = credentials.split(":", 1)
        encoded_user = quote_plus(unquote(user))
        encoded_password = quote_plus(unquote(password))
        return f"{scheme}://{encoded_user}:{encoded_password}@{host_section}"

    return uri


def get_mongo_uri() -> str:
    """
    Retrieve and sanitize MongoDB connection URI from settings or environment variables.
    Raises ValueError if MONGODB_URI is not configured.
    """
    uri = settings.mongodb_uri or os.getenv("MONGODB_URI", "")
    if not uri or not uri.strip():
        raise ValueError(
            "MONGODB_URI is not set. Please configure MONGODB_URI in your environment or backend/.env file."
        )
    return sanitize_mongo_uri(uri)


def get_mongo_client(force_new: bool = False) -> MongoClient:
    """
    Initialize and return a thread-safe PyMongo MongoClient instance.
    Uses connection pooling via a singleton client unless force_new is True.
    """
    global _mongo_client
    if not force_new and _mongo_client is not None:
        return _mongo_client

    uri = get_mongo_uri()
    try:
        client = MongoClient(
            uri,
            server_api=ServerApi("1"),
            tlsCAFile=certifi.where(),
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            maxPoolSize=50,
            minPoolSize=1,
            retryWrites=True,
        )
    except Exception as e:
        safe_msg = mask_credentials(str(e))
        logger.error("Failed to initialize PyMongo client: %s", safe_msg)
        raise

    if not force_new:
        _mongo_client = client
    return client


def close_mongo_client() -> None:
    """Cleanly close the active singleton PyMongo client instance."""
    global _mongo_client
    if _mongo_client is not None:
        try:
            _mongo_client.close()
            logger.info("MongoDB client connection closed cleanly.")
        except Exception as e:
            logger.warning("Error closing MongoDB client: %s", e)
        finally:
            _mongo_client = None


def get_database(db_name: str | None = None) -> Database:
    """Retrieve the PyMongo Database handle for the application."""
    client = get_mongo_client()
    target_db = db_name or settings.mongodb_db_name
    return client[target_db]


def ensure_db_indexes(client: MongoClient | None = None) -> dict[str, Any]:
    """
    Verify and create required database indexes for TRUE FACE AI collections.
    Includes fast lookup on email and automatic TTL expiration for OTP codes.
    """
    db_client = client or get_mongo_client()
    db = db_client[settings.mongodb_db_name]
    otp_col = db["otp_codes"]

    # 1. Lookup index on email
    otp_col.create_index([("email", 1)], name="idx_otp_email")

    # 2. TTL index on expires_at: documents expire when current UTC time >= expires_at
    otp_col.create_index(
        [("expires_at", 1)],
        expireAfterSeconds=0,
        name="idx_otp_expires_at_ttl",
    )

    return {"status": "SUCCESS", "indexes": ["idx_otp_email", "idx_otp_expires_at_ttl"]}


def test_connection(client: MongoClient | None = None) -> dict[str, Any]:
    """
    Ping the MongoDB cluster to verify connectivity and return safe diagnostic details.
    Guarantees no credentials or passwords are leaked in error responses.
    """
    should_close = False
    try:
        if client is None:
            client = get_mongo_client(force_new=True)
            should_close = True

        res = client.admin.command("ping")
        return {
            "status": "SUCCESS",
            "message": "MongoDB cluster ping successful.",
            "ping": res,
        }
    except ValueError as ve:
        return {
            "status": "FAILED",
            "error_type": "ConfigurationMissing",
            "error": str(ve),
        }
    except ServerSelectionTimeoutError as te:
        return {
            "status": "FAILED",
            "error_type": "ServerSelectionTimeout",
            "error": (
                "MongoDB connection timed out. Ensure database host is reachable and your IP address "
                "is whitelisted in MongoDB Atlas Network Access (e.g. 0.0.0.0/0 for development)."
            ),
        }
    except OperationFailure as ofe:
        return {
            "status": "FAILED",
            "error_type": "AuthenticationFailed",
            "error": "MongoDB authentication failed. Please verify database username and password.",
        }
    except ConfigurationError as ce:
        return {
            "status": "FAILED",
            "error_type": "ConfigurationError",
            "error": f"Invalid MongoDB connection configuration: {mask_credentials(str(ce))}",
        }
    except Exception as e:
        safe_err = mask_credentials(str(e))
        return {
            "status": "FAILED",
            "error_type": type(e).__name__,
            "error": f"MongoDB connection error: {safe_err}",
        }
    finally:
        if should_close and client is not None:
            try:
                client.close()
            except Exception:
                pass


if __name__ == "__main__":
    result = test_connection()
    if result["status"] == "SUCCESS":
        print("MongoDB connection: SUCCESS")
    else:
        print(f"MongoDB connection: FAILED [{result.get('error_type', 'UNKNOWN')}] - {result.get('error')}")
