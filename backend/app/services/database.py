"""
MongoDB Atlas Connection Service

Manages PyMongo MongoClient initialization using credentials loaded securely
from backend/.env. Credentials and passwords are NEVER hardcoded or printed.
"""

import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.server_api import ServerApi

# Set up logging
logger = logging.getLogger(__name__)

# Ensure environment variables are loaded from backend/.env
backend_dir = Path(__file__).resolve().parent.parent.parent
env_path = backend_dir / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)


from urllib.parse import quote_plus

def get_mongo_uri() -> str:
    """Retrieve and sanitize MongoDB connection URI from environment variables."""
    uri = os.getenv("MONGODB_URI")
    if not uri:
        raise ValueError("MONGODB_URI is not set in backend/.env file.")
    uri = uri.strip()
    
    # Check if URI contains unescaped special characters in credentials
    # Standard format: mongodb://user:pass@host or mongodb+srv://user:pass@host
    if "://" in uri:
        scheme, rest = uri.split("://", 1)
        if "@" in rest:
            # The actual host section begins at the last '@'
            credentials, host_section = rest.rsplit("@", 1)
            if ":" in credentials:
                user, password = credentials.split(":", 1)
                # Escaping user and password for RFC 3986 compliance
                encoded_user = quote_plus(user)
                encoded_password = quote_plus(password)
                uri = f"{scheme}://{encoded_user}:{encoded_password}@{host_section}"

    return uri



import certifi

def get_mongo_client() -> MongoClient:
    """
    Initialize and return a PyMongo MongoClient instance.
    Uses server API version 1 and certifi SSL certificates for MongoDB Atlas stability.
    """
    uri = get_mongo_uri()
    client = MongoClient(
        uri,
        server_api=ServerApi("1"),
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=10000,
        connectTimeoutMS=10000,
    )
    return client



def test_connection() -> dict:
    """
    Ping the MongoDB Atlas database cluster to verify connectivity.
    Returns status info WITHOUT exposing credentials.
    """
    try:
        client = get_mongo_client()
        # The ping command is cheap and does not require auth write privileges
        res = client.admin.command("ping")
        client.close()
        return {"status": "SUCCESS", "ping": res}
    except Exception as e:
        # Sanitize error message to prevent accidental password exposure in error text
        err_msg = str(e)
        if "@" in err_msg:
            # Mask potential URI string in error traceback
            parts = err_msg.split("@")
            err_msg = f"...@{parts[-1]}"
        return {"status": "FAILED", "error": err_msg}
    
if __name__ == "__main__":
    result = test_connection()
    if result["status"] == "SUCCESS":
        print("MongoDB Atlas connection: SUCCESS")
    else:
        print(f"MongoDB Atlas connection: FAILED ({result['error']})")
