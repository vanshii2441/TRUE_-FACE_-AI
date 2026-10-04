"""
MongoDB Atlas Connection Verification Script

Performs a ping command against MongoDB Atlas to verify backend connectivity.
Logs only status results (SUCCESS or FAILED) without printing passwords or credentials.
"""

import sys
from pathlib import Path

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.services.database import test_connection

def main():
    print("Testing connection to MongoDB Atlas...")
    res = test_connection()
    if res["status"] == "SUCCESS":
        print("MongoDB Atlas Connection: SUCCESS")
        print("Ping: SUCCESS")
        sys.exit(0)
    else:
        print("MongoDB Atlas Connection: FAILED")
        print(f"Reason: {res['error']}")
        sys.exit(1)

if __name__ == "__main__":
    main()
