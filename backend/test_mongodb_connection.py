import sys
from pathlib import Path
from datetime import datetime, timezone

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))


from app.services.database import get_mongo_client


def main():
    client = None
    document_id = None

    try:
        print("\n=== MongoDB CRUD Test ===\n")

        # 1. CONNECT
        print("1. Connecting to MongoDB Atlas...")
        client = get_mongo_client()

        client.admin.command("ping")
        print("   Connection: SUCCESS")
        print("   Ping: SUCCESS\n")

        # Use your existing database
        db = client["TRUE_FACE_AI"]

        # Use a dedicated temporary test collection
        collection = db["connection_test"]

        # 2. INSERT
        print("2. Testing INSERT...")

        test_document = {
            "test_type": "mongodb_connection_test",
            "message": "Temporary MongoDB CRUD test",
            "created_at": datetime.now(timezone.utc),
        }

        result = collection.insert_one(test_document)
        document_id = result.inserted_id

        print(f"   Insert: SUCCESS")
        print(f"   Document ID: {document_id}\n")

        # 3. READ
        print("3. Testing READ...")

        found_document = collection.find_one(
            {"_id": document_id}
        )

        if found_document:
            print("   Read: SUCCESS")
            print(f"   Document found: {found_document}\n")
        else:
            raise Exception("Inserted document could not be read.")

        # 4. DELETE
        print("4. Testing DELETE...")

        delete_result = collection.delete_one(
            {"_id": document_id}
        )

        if delete_result.deleted_count == 1:
            print("   Delete: SUCCESS\n")
        else:
            raise Exception("Test document could not be deleted.")

        # 5. VERIFY DELETE
        print("5. Verifying DELETE...")

        deleted_check = collection.find_one(
            {"_id": document_id}
        )

        if deleted_check is None:
            print("   Delete verification: SUCCESS\n")
        else:
            raise Exception("Document still exists after deletion.")

        print("================================")
        print("MongoDB CRUD TEST: PASSED")
        print("================================")

        sys.exit(0)

    except Exception as e:
        print("\n================================")
        print("MongoDB CRUD TEST: FAILED")
        print("================================")
        print(f"Reason: {e}")

        # Cleanup if something failed after insertion
        if client is not None and document_id is not None:
            try:
                client["TRUE_FACE_AI"]["connection_test"].delete_one(
                    {"_id": document_id}
                )
                print("Temporary test document cleaned up.")
            except Exception:
                pass

        sys.exit(1)

    finally:
        if client is not None:
            client.close()


if __name__ == "__main__":
    main()