"""
TRUE FACE AI — Deepfake Detection Unit & Integration Tests

Tests DeepfakeNet PyTorch model forward pass, DeepfakeDetector preprocessing,
prediction outputs, threshold gating, and error handling.
"""

import numpy as np
import pytest
import torch

from app.config import settings
from app.models.deepfake_net import DeepfakeNet
from app.services.deepfake_detector import (
    DeepfakeDetector,
    DeepfakeDetectorError,
    get_deepfake_detector,
)


@pytest.fixture
def sample_face_crop() -> np.ndarray:
    """Create a dummy BGR face crop array (128x128x3)."""
    return np.full((128, 128, 3), fill_value=200, dtype=np.uint8)


@pytest.fixture
def deepfake_detector_instance() -> DeepfakeDetector:
    """Get DeepfakeDetector singleton instance."""
    return get_deepfake_detector()


def test_deepfake_net_architecture():
    """Test PyTorch DeepfakeNet forward pass and output shapes."""
    model = DeepfakeNet(num_classes=2)
    model.eval()
    dummy_input = torch.randn(2, 3, 128, 128)
    logits = model(dummy_input)
    assert logits.shape == (2, 2)

    probs = model.predict_proba(dummy_input)
    assert probs.shape == (2, 2)
    assert torch.allclose(probs.sum(dim=1), torch.ones(2), atol=1e-5)


def test_deepfake_detector_initialization(deepfake_detector_instance):
    """Test DeepfakeDetector singleton initialization and settings."""
    assert deepfake_detector_instance is not None
    assert deepfake_detector_instance.threshold == settings.deepfake_threshold
    assert deepfake_detector_instance.input_size == settings.deepfake_input_size


def test_deepfake_preprocess(deepfake_detector_instance, sample_face_crop):
    """Test image preprocessing to PyTorch tensor format."""
    tensor = deepfake_detector_instance.preprocess(sample_face_crop)
    assert tensor.shape == (1, 3, settings.deepfake_input_size, settings.deepfake_input_size)
    assert tensor.dtype == torch.float32


def test_deepfake_predict_keys(deepfake_detector_instance, sample_face_crop):
    """Test that predict returns all expected output dictionary keys."""
    res = deepfake_detector_instance.predict(sample_face_crop)
    assert "deepfake_probability" in res
    assert "real_probability" in res
    assert "is_deepfake" in res
    assert "deepfake_status" in res
    assert "threshold" in res
    assert "weights_loaded" in res

    assert 0.0 <= res["deepfake_probability"] <= 1.0
    assert 0.0 <= res["real_probability"] <= 1.0
    assert res["deepfake_status"] in {"REAL", "DEEPFAKE"}
    assert isinstance(res["is_deepfake"], bool)


def test_deepfake_empty_crop_raises_error(deepfake_detector_instance):
    """Test that passing an empty face crop raises DeepfakeDetectorError."""
    empty_crop = np.array([], dtype=np.uint8)
    with pytest.raises(DeepfakeDetectorError):
        deepfake_detector_instance.predict(empty_crop)
