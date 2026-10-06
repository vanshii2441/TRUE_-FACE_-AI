import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent

if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.services.database import get_mongo_client


def main():
    client = None

    try:
        print("\n===== MongoDB UPDATE TEST =====\n")

        # Connect
        print("1. Connecting to MongoDB...")
        client = get_mongo_client()
        client.admin.command("ping")
        print("   Connection: SUCCESS\n")

        db = client["TRUE_FACE_AI"]
        collection = db["test"]

        # Find our sample document
        print("2. Finding sample document...")

        document = collection.find_one({
            "email": "testuser@example.com"
        })

        if not document:
            print("   Sample document not found.")
            return

        print("   Document found: SUCCESS")
        print(f"   Current data: {document}\n")

        # Update
        print("3. Updating sample document...")

        result = collection.update_one(
            {"email": "testuser@example.com"},
            {
                "$set": {
                    "name": "Vaishnavi Test User",
                    "email": "vaishnavi.test@example.com",
                    "status": "active",
                    "updated_from": "FastAPI Backend"
                }
            }
        )

        if result.modified_count == 1:
            print("   UPDATE: SUCCESS\n")
        else:
            print("   UPDATE: NO CHANGE\n")

        # Read again
        print("4. Reading updated document...")

        updated_document = collection.find_one({
            "email": "vaishnavi.test@example.com"
        })

        if updated_document:
            print("   UPDATED DATA:")
            print(f"   {updated_document}\n")
        else:
            print("   Updated document not found.")
            return

        print("======================================")
        print("MongoDB UPDATE TEST: PASSED")
        print("======================================")
        print("\nNow check MongoDB Atlas.")
        print("TRUE_FACE_AI → test\n")

    except Exception as e:
        print("\n======================================")
        print("MongoDB UPDATE TEST: FAILED")
        print("======================================")
        print("Error:", e)

    finally:
        if client:
            client.close()


if __name__ == "__main__":
    main()