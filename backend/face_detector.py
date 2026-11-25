"""Frontal face detection using the LBP cascade bundled with the project.

scikit-image's cascade loader is used because it reads the OpenCV LBP XML format
on every OpenCV version (OpenCV 5 dropped support for this legacy file).
"""
from pathlib import Path

import numpy as np
from skimage.feature import Cascade

from .utils import to_gray

CASCADE_PATH = Path(__file__).parent / "assets" / "lbpcascade_frontalface_opencv.xml"
DETECT_SIDE = 480  # detection runs on an image whose longest side is at most this


class FaceDetector:
    def __init__(self, cascade_path: Path = CASCADE_PATH):
        self._cascade = Cascade(str(cascade_path))

    def detect(self, img: np.ndarray):
        """Return a list of face boxes (x, y, w, h) in the coordinates of `img`, largest first."""
        gray = to_gray(img)
        h, w = gray.shape[:2]
        scale = min(1.0, DETECT_SIDE / max(h, w))
        if scale < 1.0:
            import cv2
            gray = cv2.resize(gray, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        min_side = max(24, int(min(gray.shape[:2]) * 0.12))
        found = self._cascade.detect_multi_scale(
            img=gray, scale_factor=1.15, step_ratio=1, min_size=(min_side, min_side),
            max_size=(gray.shape[1], gray.shape[0]),
        )
        boxes = []
        for f in found:
            boxes.append((int(f["c"] / scale), int(f["r"] / scale),
                          int(f["width"] / scale), int(f["height"] / scale)))
        boxes.sort(key=lambda b: b[2] * b[3], reverse=True)
        return _merge_overlaps(boxes)

    @staticmethod
    def crop(img: np.ndarray, box, expand: float = 1.0):
        """Crop a box with optional expansion around its centre (clamped to the image)."""
        x, y, w, h = box
        cx, cy = x + w / 2, y + h / 2
        w2, h2 = w * expand, h * expand
        x0, y0 = int(max(0, cx - w2 / 2)), int(max(0, cy - h2 / 2))
        x1, y1 = int(min(img.shape[1], cx + w2 / 2)), int(min(img.shape[0], cy + h2 / 2))
        return img[y0:y1, x0:x1]


def _merge_overlaps(boxes, iou_thresh: float = 0.3):
    """Keep the largest box of every overlapping cluster."""
    kept = []
    for b in boxes:
        if all(_iou(b, k) < iou_thresh for k in kept):
            kept.append(b)
    return kept


def _iou(a, b):
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    ix = max(0, min(ax + aw, bx + bw) - max(ax, bx))
    iy = max(0, min(ay + ah, by + bh) - max(ay, by))
    inter = ix * iy
    union = aw * ah + bw * bh - inter
    return inter / union if union else 0.0
