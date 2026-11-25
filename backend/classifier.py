"""Thin wrappers that load a trained scikit-learn model and score a face crop."""
from pathlib import Path

import joblib
import numpy as np

from .features import extract_features
from .utils import normalise_face


class FaceClassifier:
    """Scores how likely a face crop is *genuine* (1.0 = genuine, 0.0 = attack)."""

    task = "base"

    def __init__(self, models_dir: Path):
        self.path = Path(models_dir) / f"{self.task}.joblib"
        self.model = None
        self.error = None
        if self.path.exists():
            try:
                self.model = joblib.load(self.path)
            except Exception as exc:  # noqa: BLE001 - e.g. saved with another scikit-learn version
                self.error = f"{type(exc).__name__}: {exc}"
                print(f"[trueface] Could not load {self.path.name} ({self.error}). "
                      "Retrain with: python scripts/train_all.py")

    @property
    def loaded(self) -> bool:
        return self.model is not None

    def score(self, face_crop: np.ndarray) -> float:
        if self.model is None:
            raise RuntimeError(f"Model '{self.task}' is not trained. Run: python scripts/train_all.py")
        feats = extract_features(normalise_face(face_crop))[None, :]
        return float(self.model.predict_proba(feats)[0, 1])


class FaceCheck(FaceClassifier):
    """Confirms a detected region really is a face (cuts cascade false positives)."""
    task = "facecheck"


class LivenessDetector(FaceClassifier):
    """Presentation-attack detection: real live face vs printed photo / screen replay."""
    task = "liveness"


class DeepfakeDetector(FaceClassifier):
    """Manipulation detection: untouched face vs swapped / smoothed / warped face."""
    task = "deepfake"
