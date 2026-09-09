"""
TRUE FACE AI — Liveness & Anti-Spoofing Unit & Integration Tests

Tests LivenessNet model inference, preprocessing, probability scoring,
threshold gating, and FastAPI route liveness integration.
"""

import os
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.services.liveness_detector import (
    LivenessDetector,
    LivenessDetectorError,
    get_liveness_detector,
)


@pytest.fixture
def sample_face_crop() -> np.ndarray:
    """Create a dummy BGR face crop array (128x128x3)."""
    return np.full((128, 128, 3), fill_value=180, dtype=np.uint8)


@pytest.fixture
def liveness_detector_instance() -> LivenessDetector:
    """Get LivenessDetector instance."""
    return get_liveness_detector()


def test_liveness_detector_initialization(liveness_detector_instance):
    """Test LivenessDetector singleton initialization."""
    assert liveness_detector_instance is not None
    assert liveness_detector_instance.threshold == settings.liveness_threshold
    assert liveness_detector_instance.input_size == settings.liveness_input_size


def test_liveness_preprocess(liveness_detector_instance, sample_face_crop):
    """Test face crop image preprocessing for model tensor."""
    tensor = liveness_detector_instance.preprocess(sample_face_crop)
    assert tensor.shape == (1, 3, settings.liveness_input_size, settings.liveness_input_size)
    assert tensor.dtype == np.float32 or str(tensor.dtype).startswith("torch.float")


def test_liveness_predict_keys(liveness_detector_instance, sample_face_crop):
    """Test that predict returns all expected output keys."""
    res = liveness_detector_instance.predict(sample_face_crop)
    assert "liveness_score" in res
    assert "spoof_score" in res
    assert "is_live" in res
    assert "liveness_status" in res
    assert "threshold" in res
    assert 0.0 <= res["liveness_score"] <= 1.0
    assert 0.0 <= res["spoof_score"] <= 1.0
    assert res["liveness_status"] in {"REAL", "SPOOF"}


def test_liveness_empty_crop_raises_error(liveness_detector_instance):
    """Test that passing an empty crop raises LivenessDetectorError."""
    empty_crop = np.array([], dtype=np.uint8)
    with pytest.raises(LivenessDetectorError):
        liveness_detector_instance.predict(empty_crop)


def test_api_recognize_includes_liveness():
    """Test that POST /api/v1/recognize response includes liveness metrics."""
    client = TestClient(app)

    # Generate synthetic image byte array
    import cv2
    img = np.full((200, 200, 3), 128, dtype=np.uint8)
    _, img_encoded = cv2.imencode(".jpg", img)
    img_bytes = img_encoded.tobytes()

    response = client.post(
        "/api/v1/recognize",
        files={"file": ("query.jpg", img_bytes, "image/jpeg")},
    )
    assert response.status_code == 200
    data = response.json()

    assert "liveness_score" in data
    assert "is_live" in data
    assert "liveness_status" in data
    assert "timing_ms" in data
    assert "liveness_ms" in data["timing_ms"]
