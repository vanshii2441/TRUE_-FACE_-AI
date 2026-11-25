"""Identity matching with OpenCV's LBPH recogniser over enrolled face samples.

Enrolled samples live in <instance>/faces/<user_id>/<n>.png as 100x100 equalised
grayscale patches. The recogniser is rebuilt lazily whenever users change.
"""
import shutil
import threading
from pathlib import Path

import cv2
import numpy as np

from .utils import recognition_patch


class Recognizer:
    def __init__(self, faces_dir: Path, max_distance: float):
        self.faces_dir = Path(faces_dir)
        self.faces_dir.mkdir(parents=True, exist_ok=True)
        self.max_distance = max_distance
        self._model = None
        self._lock = threading.Lock()

    # ---- enrolment ---------------------------------------------------------
    def save_samples(self, user_id: int, crops) -> int:
        folder = self.faces_dir / str(user_id)
        folder.mkdir(parents=True, exist_ok=True)
        for i, crop in enumerate(crops):
            patch = recognition_patch(crop)
            cv2.imwrite(str(folder / f"{i}.png"), patch)
            cv2.imwrite(str(folder / f"{i}_flip.png"), cv2.flip(patch, 1))
        self.invalidate()
        return len(crops)

    def delete_user(self, user_id: int):
        shutil.rmtree(self.faces_dir / str(user_id), ignore_errors=True)
        self.invalidate()

    def invalidate(self):
        with self._lock:
            self._model = None

    # ---- matching ----------------------------------------------------------
    def _build(self):
        images, labels = [], []
        for folder in sorted(self.faces_dir.iterdir()):
            if not folder.is_dir() or not folder.name.isdigit():
                continue
            for p in sorted(folder.glob("*.png")):
                img = cv2.imread(str(p), cv2.IMREAD_GRAYSCALE)
                if img is not None:
                    images.append(img)
                    labels.append(int(folder.name))
        if not images:
            return None
        model = cv2.face.LBPHFaceRecognizer_create(radius=1, neighbors=8, grid_x=8, grid_y=8)
        model.train(images, np.array(labels, dtype=np.int32))
        return model

    def match(self, crop: np.ndarray):
        """Return (user_id, distance) of the closest enrolled face, or (None, None)."""
        with self._lock:
            if self._model is None:
                self._model = self._build()
            model = self._model
        if model is None:
            return None, None
        label, distance = model.predict(recognition_patch(crop))
        if label < 0:
            return None, None
        return int(label), float(distance)

    def is_match(self, distance) -> bool:
        return distance is not None and distance <= self.max_distance

    def score_percent(self, distance) -> int:
        """Map an LBPH distance to a 0-100 display score (100 = identical)."""
        if distance is None:
            return 0
        return int(round(max(0.0, min(1.0, 1 - distance / (2 * self.max_distance))) * 100))
