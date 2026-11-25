"""Tests for the feature extractor, synthetic generators and the trained models."""
import json
from pathlib import Path

import cv2
import numpy as np
import pytest

from backend import synth
from backend.classifier import DeepfakeDetector, FaceCheck, LivenessDetector
from backend.face_detector import FaceDetector
from backend.features import extract_features
from backend.utils import (FACE_SIZE, ImageError, decode_data_url, decode_image,
                           normalise_face, recognition_patch)

ROOT = Path(__file__).resolve().parent.parent
MODELS = ROOT / "models"


@pytest.fixture(scope="module")
def faces():
    raw = np.load(ROOT / "backend" / "assets" / "lfw_subset.npy")[:100]   # first 100 are real faces
    return [cv2.resize((a * 255).astype(np.uint8), (64, 64), interpolation=cv2.INTER_CUBIC) for a in raw]


# ---------------------------------------------------------------- utils
def test_normalise_face_shape_and_dtype():
    out = normalise_face(np.random.randint(0, 255, (180, 150, 3), dtype=np.uint8))
    assert out.shape == (FACE_SIZE, FACE_SIZE) and out.dtype == np.uint8


def test_recognition_patch_is_100px_gray():
    assert recognition_patch(np.zeros((80, 90, 3), np.uint8)).shape == (100, 100)


def test_decode_rejects_garbage():
    with pytest.raises(ImageError):
        decode_image(b"definitely not an image")
    with pytest.raises(ImageError):
        decode_data_url("")


def test_decode_downscales_large_images():
    ok, buf = cv2.imencode(".png", np.zeros((2000, 3000, 3), np.uint8))
    img = decode_image(buf.tobytes(), max_side=960)
    assert max(img.shape[:2]) == 960


# ------------------------------------------------------------- features
def test_feature_vector_is_stable_length_and_finite(faces):
    a, b = extract_features(faces[0]), extract_features(faces[1])
    assert a.shape == b.shape and a.ndim == 1 and a.size > 150
    assert np.isfinite(a).all()


def test_features_are_deterministic(faces):
    assert np.array_equal(extract_features(faces[5]), extract_features(faces[5]))


# ------------------------------------------------------------- detector
def test_detector_finds_portrait_face(portrait):
    boxes = FaceDetector().detect(portrait)
    assert len(boxes) == 1
    x, y, w, h = boxes[0]
    assert 120 < x < 230 and 20 < y < 120 and 70 < w < 140   # around the astronaut's face


def test_detector_finds_nothing_in_noise():
    noise = np.random.default_rng(0).integers(0, 255, (300, 300, 3), dtype=np.uint8)
    assert FaceDetector().detect(noise) == []


def test_crop_is_clamped_to_image(portrait):
    crop = FaceDetector.crop(portrait, (0, 0, 50, 50), expand=2.0)
    assert crop.shape[0] > 0 and crop.shape[1] > 0


# ------------------------------------------------------------ generators
def test_generators_keep_shape_and_dtype(faces):
    rng = np.random.default_rng(0)
    for out in (synth.augment_real(faces[0], rng), synth.simulate_print(faces[0], rng),
                synth.simulate_screen(faces[0], rng), synth.simulate_deepfake(faces[0], faces[1], rng)):
        assert out.shape == (64, 64) and out.dtype == np.uint8


def test_generators_actually_change_the_image(faces):
    rng = np.random.default_rng(1)
    assert not np.array_equal(synth.simulate_spoof(faces[0], rng), faces[0])
    assert not np.array_equal(synth.simulate_deepfake(faces[0], faces[1], rng), faces[0])


# --------------------------------------------------------- trained models
def test_models_exist_and_load():
    for cls in (FaceCheck, LivenessDetector, DeepfakeDetector):
        assert cls(MODELS).loaded, cls.task


def test_metrics_file_documents_synthetic_attacks():
    m = json.loads((MODELS / "metrics.json").read_text())["tasks"]
    assert m["facecheck"]["synthetic_attacks"] is False
    assert m["liveness"]["synthetic_attacks"] is True
    assert m["deepfake"]["synthetic_attacks"] is True


def test_facecheck_separates_faces_from_non_faces(faces):
    fc = FaceCheck(MODELS)
    raw = np.load(ROOT / "backend" / "assets" / "lfw_subset.npy")
    nonfaces = [cv2.resize((a * 255).astype(np.uint8), (64, 64), interpolation=cv2.INTER_CUBIC) for a in raw[100:]]
    face_scores = np.array([fc.score(f) for f in faces])
    non_scores = np.array([fc.score(n) for n in nonfaces])
    assert (face_scores > 0.5).mean() > 0.95
    assert (non_scores < 0.5).mean() > 0.95


def test_liveness_on_fresh_simulated_attacks(faces):
    """Fresh random seed (not the training seed): real vs simulated spoofs."""
    live = LivenessDetector(MODELS)
    rng = np.random.default_rng(12345)
    real = np.array([live.score(synth.augment_real(f, rng)) for f in faces])
    spoof = np.array([live.score(synth.augment_real(synth.simulate_spoof(f, rng), rng)) for f in faces])
    # The faces were seen in training (different variants), so this checks the pipeline, not generalisation;
    # held-out numbers live in models/metrics.json.
    assert (real >= 0.5).mean() > 0.75
    assert (spoof < 0.5).mean() > 0.75


def test_heldout_metrics_meet_minimums():
    m = json.loads((MODELS / "metrics.json").read_text())["tasks"]
    assert m["facecheck"]["accuracy"] >= 0.95
    assert m["liveness"]["accuracy"] >= 0.80 and m["liveness"]["roc_auc"] >= 0.90
    # Deepfake model is documented as weak; it must still beat chance.
    assert m["deepfake"]["roc_auc"] > 0.55
