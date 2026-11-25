"""Central configuration. Every value can be overridden with an environment variable."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent


def _float(name, default):
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        return float(default)


def _bool(name, default):
    return os.environ.get(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


class Config:
    BASE_DIR = BASE_DIR
    INSTANCE_DIR = Path(os.environ.get("TRUEFACE_INSTANCE_DIR", BASE_DIR / "instance"))
    DATA_DIR = Path(os.environ.get("TRUEFACE_DATA_DIR", BASE_DIR / "data"))
    MODELS_DIR = Path(os.environ.get("TRUEFACE_MODELS_DIR", BASE_DIR / "models"))

    SECRET_KEY = os.environ.get("SECRET_KEY", "change-me-in-production")
    MAX_CONTENT_LENGTH = 12 * 1024 * 1024  # 12 MB per request
    MAX_IMAGE_SIDE = 960                   # larger uploads are downscaled
    MAX_ENROLL_IMAGES = 8
    MIN_ENROLL_IMAGES = 3

    # Decision thresholds (probability that the face is real / not manipulated)
    LIVENESS_THRESHOLD = _float("LIVENESS_THRESHOLD", 0.50)
    DEEPFAKE_THRESHOLD = _float("DEEPFAKE_THRESHOLD", 0.50)
    FACE_CHECK_THRESHOLD = _float("FACE_CHECK_THRESHOLD", 0.50)
    # LBPH distance: lower = more similar. Tuned in scripts/calibrate_recognition.py
    RECOGNITION_MAX_DISTANCE = _float("RECOGNITION_MAX_DISTANCE", 75)

    # Liveness blocks a verification when it fails. The deepfake model is only ~65%
    # accurate on the bundled 25x25 data, so by default it is advisory (shown, not blocking).
    # Set ENFORCE_DEEPFAKE=true once it is retrained on higher-resolution real data.
    ENFORCE_LIVENESS = _bool("ENFORCE_LIVENESS", True)
    ENFORCE_DEEPFAKE = _bool("ENFORCE_DEEPFAKE", False)

    TESTING = False
