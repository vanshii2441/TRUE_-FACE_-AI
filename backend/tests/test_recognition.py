"""
TRUE FACE AI — Unit & Integration Tests for Face Embedding and Recognition

Tests:
  - FaceEmbedder (vector shape, 512 dimension, L2 normalization)
  - VectorStore (FAISS index, adding faces, search, top-k, thresholding, save/load, reset)
  - API Endpoints: POST /api/v1/enroll, POST /api/v1/recognize, GET /api/v1/users, DELETE /api/v1/users/reset
"""

import os
import shutil
import tempfile
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.face_detector import FaceDetector, get_face_detector
from app.services.face_embedding import FaceEmbedder, get_face_embedder
from app.services.vector_store import VectorStore, get_vector_store

client = TestClient(app)


# ── Helper Fixtures ───────────────────────────────────────────
@pytest.fixture(autouse=True)
def clean_vector_store():
    """Ensure vector store is reset before and after each test."""
    store = get_vector_store()
    store.reset()
    yield
    store.reset()


@pytest.fixture
def synthetic_face_bgr() -> np.ndarray:
    """Create a 160x160 synthetic face-like image (BGR)."""
    img = np.ones((160, 160, 3), dtype=np.uint8) * 200
    # Draw simple facial features so detection/embedding works
    cv2.circle(img, (50, 60), 15, (50, 50, 50), -1)  # Left eye
    cv2.circle(img, (110, 60), 15, (50, 50, 50), -1)  # Right eye
    cv2.ellipse(img, (80, 110), (30, 15), 0, 0, 180, (50, 50, 50), 3)  # Smile
    return img


@pytest.fixture
def synthetic_face_jpeg(synthetic_face_bgr: np.ndarray) -> bytes:
    """Encode synthetic face image into JPEG bytes."""
    _, encoded = cv2.imencode(".jpg", synthetic_face_bgr)
    return encoded.tobytes()


# ── Unit Tests: FaceEmbedder ──────────────────────────────────
class TestFaceEmbedder:

    def test_generate_embedding_shape_and_norm(self, synthetic_face_bgr: np.ndarray):
        embedder = get_face_embedder()
        embedding = embedder.generate_embedding(synthetic_face_bgr)

        # Dimension should be 512
        assert isinstance(embedding, np.ndarray)
        assert embedding.ndim == 1
        assert embedding.shape[0] == 512
        assert embedding.dtype == np.float32

        # L2 norm should be approximately 1.0
        norm = np.linalg.norm(embedding)
        assert pytest.approx(norm, abs=1e-4) == 1.0

    def test_extract_embedding_dict(self, synthetic_face_bgr: np.ndarray):
        embedder = get_face_embedder()
        res = embedder.extract_embedding(synthetic_face_bgr)

        assert "embedding" in res
        assert "dimension" in res
        assert res["dimension"] == 512
        assert len(res["embedding"]) == 512
        assert isinstance(res["embedding"], list)


# ── Unit Tests: VectorStore ───────────────────────────────────
class TestVectorStore:

    def test_add_and_search(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            idx_path = os.path.join(tmpdir, "test_index.bin")
            meta_path = os.path.join(tmpdir, "test_meta.json")

            store = VectorStore(dimension=512, index_path=idx_path, metadata_path=meta_path, auto_load=False)
            assert store.count() == 0

            # Generate random normalized 512d vector
            v1 = np.random.randn(512).astype(np.float32)
            v1 /= np.linalg.norm(v1)

            faiss_id = store.add_face("USR001", "Alice", v1)
            assert faiss_id == 0
            assert store.count() == 1

            # Search with identical vector (should give similarity ~ 1.0)
            matches = store.search(v1, top_k=5, threshold=0.5)
            assert len(matches) == 1
            assert matches[0]["user_id"] == "USR001"
            assert matches[0]["name"] == "Alice"
            assert matches[0]["is_match"] is True
            assert pytest.approx(matches[0]["similarity"], abs=1e-3) == 1.0

    def test_persistence_save_and_load(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            idx_path = os.path.join(tmpdir, "persist_index.bin")
            meta_path = os.path.join(tmpdir, "persist_meta.json")

            store1 = VectorStore(dimension=512, index_path=idx_path, metadata_path=meta_path, auto_load=False)
            v1 = np.random.randn(512).astype(np.float32)
            v1 /= np.linalg.norm(v1)
            store1.add_face("USR002", "Bob", v1)
            assert store1.count() == 1

            # Create store2 pointing to same files (auto_load=True)
            store2 = VectorStore(dimension=512, index_path=idx_path, metadata_path=meta_path, auto_load=True)
            assert store2.count() == 1

            users = store2.get_all_users()
            assert len(users) == 1
            assert users[0]["user_id"] == "USR002"
            assert users[0]["name"] == "Bob"

    def test_empty_search(self):
        store = VectorStore(dimension=512, auto_load=False)
        v = np.random.randn(512).astype(np.float32)
        results = store.search(v)
        assert results == []


# ── Integration Tests: API Endpoints ─────────────────────────
class TestRecognitionEndpoints:

    def test_health_check_includes_enrolled_count(self):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert "enrolled_faces" in data
        assert data["enrolled_faces"] == 0

    def test_enroll_and_recognize_flow(self, synthetic_face_bgr: np.ndarray, synthetic_face_jpeg: bytes):
        mock_detection = [{
            "bbox": [10, 10, 150, 150],
            "confidence": 0.995,
            "crop": synthetic_face_bgr,
        }]

        from unittest.mock import patch
        with patch.object(FaceDetector, "detect_and_crop", return_value=mock_detection):
            # 1. Enroll user
            files = {"file": ("alice.jpg", synthetic_face_jpeg, "image/jpeg")}
            data = {"user_id": "USR001", "name": "Alice Smith"}

            enroll_resp = client.post("/api/v1/enroll", data=data, files=files)
            assert enroll_resp.status_code == 201, enroll_resp.text
            enroll_data = enroll_resp.json()

            assert enroll_data["user_id"] == "USR001"
            assert enroll_data["name"] == "Alice Smith"
            assert enroll_data["status"] == "SUCCESS"
            assert "faiss_id" in enroll_data
            assert "timing_ms" in enroll_data
            assert "detection_ms" in enroll_data["timing_ms"]

            # 2. List users
            users_resp = client.get("/api/v1/users")
            assert users_resp.status_code == 200
            users_data = users_resp.json()
            assert users_data["total_enrolled"] == 1
            assert users_data["users"][0]["user_id"] == "USR001"

            # 3. Recognize user with same image
            rec_files = {"file": ("query.jpg", synthetic_face_jpeg, "image/jpeg")}
            rec_resp = client.post("/api/v1/recognize", files=rec_files)
            assert rec_resp.status_code == 200, rec_resp.text
            rec_data = rec_resp.json()

            assert rec_data["status"] == "MATCH"
            assert rec_data["is_authenticated"] is True
            assert rec_data["matched_user"]["user_id"] == "USR001"
            assert rec_data["matched_user"]["name"] == "Alice Smith"
            assert rec_data["best_similarity"] >= 0.60
            assert rec_data["detected_faces_count"] == 1

            # 4. Reset DB
            reset_resp = client.delete("/api/v1/users/reset")
            assert reset_resp.status_code == 200

            # Verify DB empty
            users_resp2 = client.get("/api/v1/users")
            assert users_resp2.json()["total_enrolled"] == 0

    def test_enroll_no_face_returns_400(self):
        # Blank black image with no faces
        blank_bgr = np.zeros((300, 300, 3), dtype=np.uint8)
        _, encoded = cv2.imencode(".jpg", blank_bgr)

        files = {"file": ("blank.jpg", encoded.tobytes(), "image/jpeg")}
        data = {"user_id": "USR999", "name": "No Face User"}

        resp = client.post("/api/v1/enroll", data=data, files=files)
        assert resp.status_code == 400
        assert "No face detected" in resp.json()["detail"]

    def test_recognize_no_face_returns_no_face_status(self):
        blank_bgr = np.zeros((300, 300, 3), dtype=np.uint8)
        _, encoded = cv2.imencode(".jpg", blank_bgr)

        files = {"file": ("blank.jpg", encoded.tobytes(), "image/jpeg")}
        resp = client.post("/api/v1/recognize", files=files)

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "NO_FACE_DETECTED"
        assert data["is_authenticated"] is False
        assert data["matched_user"] is None
        assert data["detected_faces_count"] == 0
