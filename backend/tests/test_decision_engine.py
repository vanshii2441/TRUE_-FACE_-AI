"""
TRUE FACE AI — Comprehensive Unit Tests for Authentication Decision Engine

Tests all edge cases and decision pathways:
  1. Authenticated match
  2. No face detected
  3. Multiple faces detected
  4. Poor quality / blurry image
  5. Liveness spoof failure
  6. Deepfake synthetic face suspected
  7. Empty FAISS face database
  8. Unknown / low similarity person
  9. Internal system error
  10. Custom threshold configuration overrides
"""

import pytest
from app.config import Settings
from app.services.decision_engine import (
    AuthenticationDecisionEngine,
    DecisionOutcome,
    get_decision_engine,
)


@pytest.fixture
def custom_engine():
    """Create a decision engine with custom tight thresholds."""
    cfg = Settings(
        face_match_threshold=0.80,
        liveness_threshold=0.85,
        deepfake_threshold=0.40,
        blur_threshold=50.0,
        min_face_size=50,
        enable_quality_check=True,
        enable_liveness_check=True,
        enable_deepfake_check=True,
    )
    return AuthenticationDecisionEngine(custom_settings=cfg)


def test_decision_authenticated():
    engine = get_decision_engine()
    quality = {"is_quality_passed": True, "quality_score": 0.95, "blur_score": 120.0}
    liveness = {"is_live": True, "liveness_score": 0.98, "threshold": 0.70}
    deepfake = {"is_deepfake": False, "deepfake_probability": 0.02, "threshold": 0.50}
    matched = {"user_id": "USR001", "name": "Alice Smith"}

    outcome = engine.evaluate(
        detected_faces_count=1,
        quality_res=quality,
        liveness_res=liveness,
        deepfake_res=deepfake,
        match_candidate=matched,
        best_similarity=0.92,
        total_enrolled=10,
    )

    assert isinstance(outcome, DecisionOutcome)
    assert outcome.final_decision == "AUTHENTICATED"
    assert outcome.is_authenticated is True
    assert outcome.identity == "Alice Smith"
    assert "Alice Smith" in outcome.explanation
    assert outcome.similarity_score == 0.92
    assert outcome.liveness_score == 0.98
    assert outcome.deepfake_probability == 0.02


def test_decision_no_face():
    engine = get_decision_engine()
    outcome = engine.evaluate(detected_faces_count=0)

    assert outcome.final_decision == "NO_FACE"
    assert outcome.is_authenticated is False
    assert outcome.identity is None
    assert "No human face was detected" in outcome.explanation


def test_decision_multiple_faces():
    engine = get_decision_engine()
    outcome = engine.evaluate(detected_faces_count=3)

    assert outcome.final_decision == "MULTIPLE_FACES"
    assert outcome.is_authenticated is False
    assert "Multiple faces (3) were detected" in outcome.explanation


def test_decision_poor_quality():
    engine = get_decision_engine()
    quality = {
        "is_quality_passed": False,
        "quality_score": 0.20,
        "blur_score": 12.5,
        "reason": "Image is too blurry (blur score 12.5 < threshold 30.0)",
    }

    outcome = engine.evaluate(
        detected_faces_count=1,
        quality_res=quality,
    )

    assert outcome.final_decision == "POOR_QUALITY"
    assert outcome.is_authenticated is False
    assert outcome.is_quality_passed is False
    assert "too blurry" in outcome.explanation


def test_decision_liveness_failed():
    engine = get_decision_engine()
    quality = {"is_quality_passed": True, "quality_score": 0.90, "blur_score": 100.0}
    liveness = {"is_live": False, "liveness_score": 0.35, "threshold": 0.70}

    outcome = engine.evaluate(
        detected_faces_count=1,
        quality_res=quality,
        liveness_res=liveness,
    )

    assert outcome.final_decision == "LIVENESS_FAILED"
    assert outcome.is_authenticated is False
    assert "liveness score (35.0%)" in outcome.explanation


def test_decision_deepfake_suspected():
    engine = get_decision_engine()
    quality = {"is_quality_passed": True, "quality_score": 0.90, "blur_score": 100.0}
    liveness = {"is_live": True, "liveness_score": 0.95, "threshold": 0.70}
    deepfake = {"is_deepfake": True, "deepfake_probability": 0.88, "threshold": 0.50}

    outcome = engine.evaluate(
        detected_faces_count=1,
        quality_res=quality,
        liveness_res=liveness,
        deepfake_res=deepfake,
    )

    assert outcome.final_decision == "DEEPFAKE_SUSPECTED"
    assert outcome.is_authenticated is False
    assert "deepfake probability (88.0%)" in outcome.explanation


def test_decision_empty_database():
    engine = get_decision_engine()
    quality = {"is_quality_passed": True, "quality_score": 0.90, "blur_score": 100.0}
    liveness = {"is_live": True, "liveness_score": 0.95, "threshold": 0.70}
    deepfake = {"is_deepfake": False, "deepfake_probability": 0.05, "threshold": 0.50}

    outcome = engine.evaluate(
        detected_faces_count=1,
        quality_res=quality,
        liveness_res=liveness,
        deepfake_res=deepfake,
        total_enrolled=0,
    )

    assert outcome.final_decision == "EMPTY_DATABASE"
    assert outcome.is_authenticated is False
    assert "No users are currently enrolled" in outcome.explanation


def test_decision_unknown_person():
    engine = get_decision_engine()
    quality = {"is_quality_passed": True, "quality_score": 0.90, "blur_score": 100.0}
    liveness = {"is_live": True, "liveness_score": 0.95, "threshold": 0.70}
    deepfake = {"is_deepfake": False, "deepfake_probability": 0.05, "threshold": 0.50}
    candidate = {"user_id": "USR002", "name": "Bob Vance"}

    # Similarity 0.45 is below default 0.60 threshold
    outcome = engine.evaluate(
        detected_faces_count=1,
        quality_res=quality,
        liveness_res=liveness,
        deepfake_res=deepfake,
        match_candidate=candidate,
        best_similarity=0.45,
        total_enrolled=5,
    )

    assert outcome.final_decision == "UNKNOWN_PERSON"
    assert outcome.is_authenticated is False
    assert outcome.identity is None
    assert "Face similarity (45.0%) was below required match threshold" in outcome.explanation


def test_decision_system_error():
    engine = get_decision_engine()
    outcome = engine.evaluate(
        detected_faces_count=1,
        system_error="Failed to connect to GPU worker process",
    )

    assert outcome.final_decision == "SYSTEM_ERROR"
    assert outcome.is_authenticated is False
    assert "system error" in outcome.explanation


def test_custom_thresholds_override(custom_engine):
    quality = {"is_quality_passed": True, "quality_score": 0.95, "blur_score": 120.0}
    liveness = {"is_live": True, "liveness_score": 0.82, "threshold": 0.85}
    matched = {"user_id": "USR001", "name": "Alice"}

    # Liveness score 0.82 fails tight threshold 0.85
    outcome = custom_engine.evaluate(
        detected_faces_count=1,
        quality_res=quality,
        liveness_res=liveness,
        match_candidate=matched,
        best_similarity=0.90,
        total_enrolled=5,
    )

    assert outcome.final_decision == "LIVENESS_FAILED"
    assert outcome.is_authenticated is False
