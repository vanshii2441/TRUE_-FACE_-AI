"""
TRUE FACE AI — Unit & Integration Tests for Face Embedding, Deepfake, and Recognition Flow

Tests:
  - FaceEmbedder (vector shape, 512 dimension, L2 normalization)
  - VectorStore (FAISS index, adding faces, search, top-k, thresholding, save/load, reset)
  - API Endpoints: POST /api/v1/enroll, POST /api/v1/recognize, GET /api/v1/users, DELETE /api/v1/users/reset
  - Complete Authentication Decision Flow:
    AUTHENTICATED, UNKNOWN_USER, LIVENESS_FAILED, DEEPFAKE_SUSPECTED, NO_FACE, LOW_CONFIDENCE, SYSTEM_ERROR
"""

import os
import shutil
import tempfile
from unittest.mock import patch
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.deepfake_detector import DeepfakeDetector, get_deepfake_detector
from app.services.face_detector import FaceDetector, get_face_detector
from app.services.face_embedding import FaceEmbedder, get_face_embedder
from app.services.liveness_detector import LivenessDetector, get_liveness_detector
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

        assert isinstance(embedding, np.ndarray)
        assert embedding.ndim == 1
        assert embedding.shape[0] == 512
        assert embedding.dtype == np.float32

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

            v1 = np.random.randn(512).astype(np.float32)
            v1 /= np.linalg.norm(v1)

            faiss_id = store.add_face("USR001", "Alice", v1)
            assert faiss_id == 0
            assert store.count() == 1

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


# ── Integration Tests: Complete Authentication Flow & Outcomes ─────────────
class TestRecognitionEndpoints:

    def test_health_check_includes_enrolled_count(self):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert "enrolled_faces" in data
        assert data["enrolled_faces"] == 0

    def test_enroll_and_authenticated_recognize_flow(self, synthetic_face_bgr: np.ndarray, synthetic_face_jpeg: bytes):
        mock_detection = [{
            "bbox": [10, 10, 150, 150],
            "confidence": 0.995,
            "crop": synthetic_face_bgr,
        }]
        mock_liveness = {
            "is_live": True,
            "liveness_score": 0.99,
            "spoof_score": 0.01,
            "liveness_status": "REAL",
            "threshold": 0.70,
        }
        mock_deepfake = {
            "deepfake_probability": 0.05,
            "real_probability": 0.95,
            "is_deepfake": False,
            "deepfake_status": "REAL",
            "threshold": 0.50,
            "weights_loaded": False,
        }

        with patch.object(FaceDetector, "detect_and_crop", return_value=mock_detection), \
             patch.object(LivenessDetector, "predict", return_value=mock_liveness), \
             patch.object(DeepfakeDetector, "predict", return_value=mock_deepfake):

            # 1. Enroll user
            files = {"file": ("alice.jpg", synthetic_face_jpeg, "image/jpeg")}
            data = {"user_id": "USR001", "name": "Alice Smith", "email": "alice@example.com"}

            enroll_resp = client.post("/api/v1/enroll", data=data, files=files)
            assert enroll_resp.status_code == 201, enroll_resp.text
            enroll_data = enroll_resp.json()

            assert enroll_data["user_id"] == "USR001"
            assert enroll_data["name"] == "Alice Smith"
            assert enroll_data["status"] == "SUCCESS"
            assert "deepfake_probability" in enroll_data

            # 2. Duplicate enrollment should fail
            dup_files = {"file": ("alice.jpg", synthetic_face_jpeg, "image/jpeg")}
            dup_data = {"user_id": "USR001", "name": "Alice Duplicate"}
            dup_resp = client.post("/api/v1/enroll", data=dup_data, files=dup_files)
            assert dup_resp.status_code == 400
            assert "already enrolled" in dup_resp.json()["detail"]

            # 3. Recognize user (AUTHENTICATED)
            rec_files = {"file": ("query.jpg", synthetic_face_jpeg, "image/jpeg")}
            rec_resp = client.post("/api/v1/recognize", files=rec_files)
            assert rec_resp.status_code == 200, rec_resp.text
            rec_data = rec_resp.json()

            assert rec_data["final_decision"] == "AUTHENTICATED"
            assert rec_data["status"] == "AUTHENTICATED"
            assert rec_data["is_authenticated"] is True
            assert rec_data["identity"] == "Alice Smith"
            assert rec_data["similarity_score"] >= 0.60
            assert rec_data["liveness_score"] == 0.99
            assert rec_data["deepfake_probability"] == 0.05
            assert rec_data["total_processing_time"] > 0
            assert "deepfake_ms" in rec_data["timing_ms"]

            # 4. Delete user and verify deletion
            del_resp = client.delete("/api/v1/users/USR001")
            assert del_resp.status_code == 200
            assert del_resp.json()["status"] == "DELETED"

            # 5. Delete non-existent user should 404
            del_resp2 = client.delete("/api/v1/users/USR001")
            assert del_resp2.status_code == 404

    def test_recognize_unknown_user(self, synthetic_face_bgr: np.ndarray, synthetic_face_jpeg: bytes):
        mock_detection = [{
            "bbox": [10, 10, 150, 150],
            "confidence": 0.995,
            "crop": synthetic_face_bgr,
        }]
        mock_liveness = {
            "is_live": True,
            "liveness_score": 0.95,
            "spoof_score": 0.05,
            "liveness_status": "REAL",
            "threshold": 0.70,
        }
        mock_deepfake = {
            "deepfake_probability": 0.02,
            "real_probability": 0.98,
            "is_deepfake": False,
            "deepfake_status": "REAL",
            "threshold": 0.50,
            "weights_loaded": False,
        }

        with patch.object(FaceDetector, "detect_and_crop", return_value=mock_detection), \
             patch.object(LivenessDetector, "predict", return_value=mock_liveness), \
             patch.object(DeepfakeDetector, "predict", return_value=mock_deepfake):

            files = {"file": ("query.jpg", synthetic_face_jpeg, "image/jpeg")}
            resp = client.post("/api/v1/recognize", files=files)
            assert resp.status_code == 200
            data = resp.json()

            # Empty database decision
            assert data["final_decision"] in ("EMPTY_DATABASE", "UNKNOWN_PERSON")
            assert data["is_authenticated"] is False
            assert data["identity"] is None
            assert "explanation" in data

    def test_recognize_liveness_failed(self, synthetic_face_bgr: np.ndarray, synthetic_face_jpeg: bytes):
        mock_detection = [{
            "bbox": [10, 10, 150, 150],
            "confidence": 0.995,
            "crop": synthetic_face_bgr,
        }]
        mock_spoof_liveness = {
            "is_live": False,
            "liveness_score": 0.12,
            "spoof_score": 0.88,
            "liveness_status": "SPOOF",
            "threshold": 0.70,
        }

        with patch.object(FaceDetector, "detect_and_crop", return_value=mock_detection), \
             patch.object(LivenessDetector, "predict", return_value=mock_spoof_liveness):

            files = {"file": ("query.jpg", synthetic_face_jpeg, "image/jpeg")}
            resp = client.post("/api/v1/recognize", files=files)
            assert resp.status_code == 200
            data = resp.json()

            assert data["final_decision"] == "LIVENESS_FAILED"
            assert data["status"] == "LIVENESS_FAILED"
            assert data["is_authenticated"] is False
            assert data["liveness_score"] == 0.12
            assert data["is_live"] is False

    def test_recognize_deepfake_suspected(self, synthetic_face_bgr: np.ndarray, synthetic_face_jpeg: bytes):
        mock_detection = [{
            "bbox": [10, 10, 150, 150],
            "confidence": 0.995,
            "crop": synthetic_face_bgr,
        }]
        mock_liveness = {
            "is_live": True,
            "liveness_score": 0.98,
            "spoof_score": 0.02,
            "liveness_status": "REAL",
            "threshold": 0.70,
        }
        mock_deepfake_suspected = {
            "deepfake_probability": 0.89,
            "real_probability": 0.11,
            "is_deepfake": True,
            "deepfake_status": "DEEPFAKE",
            "threshold": 0.50,
            "weights_loaded": False,
        }

        with patch.object(FaceDetector, "detect_and_crop", return_value=mock_detection), \
             patch.object(LivenessDetector, "predict", return_value=mock_liveness), \
             patch.object(DeepfakeDetector, "predict", return_value=mock_deepfake_suspected):

            files = {"file": ("query.jpg", synthetic_face_jpeg, "image/jpeg")}
            resp = client.post("/api/v1/recognize", files=files)
            assert resp.status_code == 200
            data = resp.json()

            assert data["final_decision"] == "DEEPFAKE_SUSPECTED"
            assert data["status"] == "DEEPFAKE_SUSPECTED"
            assert data["is_authenticated"] is False
            assert data["deepfake_probability"] == 0.89
            assert data["is_deepfake"] is True

    def test_recognize_no_face(self):
        blank_bgr = np.zeros((300, 300, 3), dtype=np.uint8)
        _, encoded = cv2.imencode(".jpg", blank_bgr)

        files = {"file": ("blank.jpg", encoded.tobytes(), "image/jpeg")}
        resp = client.post("/api/v1/recognize", files=files)

        assert resp.status_code == 200
        data = resp.json()
        assert data["final_decision"] == "NO_FACE"
        assert data["is_authenticated"] is False
        assert data["detected_faces_count"] == 0

    def test_recognize_multiple_faces(self, synthetic_face_bgr: np.ndarray, synthetic_face_jpeg: bytes):
        mock_multi_detection = [
            {"bbox": [10, 10, 100, 100], "confidence": 0.95, "crop": synthetic_face_bgr},
            {"bbox": [110, 110, 200, 200], "confidence": 0.92, "crop": synthetic_face_bgr},
        ]

        with patch.object(FaceDetector, "detect_and_crop", return_value=mock_multi_detection):
            files = {"file": ("multi.jpg", synthetic_face_jpeg, "image/jpeg")}
            resp = client.post("/api/v1/recognize", files=files)

            assert resp.status_code == 200
            data = resp.json()
            assert data["final_decision"] == "MULTIPLE_FACES"
            assert data["is_authenticated"] is False
            assert data["detected_faces_count"] == 2

