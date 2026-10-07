"""
TRUE FACE AI — Face Detection Service

Uses MTCNN (from facenet-pytorch) for face detection.
Detects faces in images, returns bounding boxes with confidence scores,
and supports face cropping.

MTCNN is chosen for the MVP because:
  - Lightweight and pip-installable via facenet-pytorch
  - Good accuracy on frontal and near-frontal faces
  - Returns bounding boxes + landmarks + confidence in one pass
  - Can be swapped for RetinaFace later in optimization phase
"""

import logging
from typing import Any

import numpy as np
import torch
from facenet_pytorch import MTCNN
from PIL import Image

from app.config import settings
from app.services.image_utils import (
    ImageValidationError,
    bgr_to_rgb,
    crop_face,
    rgb_to_pil,
    validate_image_dimensions,
)

logger = logging.getLogger(__name__)


class FaceDetectionError(Exception):
    """Raised when face detection encounters an unrecoverable error."""
    pass


class FaceDetector:
    """
    Face detection service backed by MTCNN.

    Usage:
        detector = FaceDetector()
        results = detector.detect(image_bgr)
    """

    def __init__(
        self,
        confidence_threshold: float | None = None,
        device: str | None = None,
    ) -> None:
        """
        Initialize the MTCNN face detector.

        Args:
            confidence_threshold: Minimum confidence to accept a detection.
                Defaults to settings.detection_confidence_threshold.
            device: Torch device ('cpu' or 'cuda'). Auto-detected if None.
        """
        self.confidence_threshold = (
            confidence_threshold
            if confidence_threshold is not None
            else settings.detection_confidence_threshold
        )

        # Auto-detect device
        if device is None:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = torch.device(device)

        logger.info(
            "Initializing MTCNN face detector (device=%s, threshold=%.2f)",
            self.device,
            self.confidence_threshold,
        )

        self._mtcnn = MTCNN(
            keep_all=True,
            device=self.device,
            min_face_size=20,
            thresholds=[0.6, 0.7, 0.7],  # P-Net, R-Net, O-Net thresholds
            post_process=False,
        )

        logger.info("MTCNN face detector initialized successfully.")

    @property
    def is_loaded(self) -> bool:
        """Returns True if MTCNN model is initialized."""
        return self._mtcnn is not None

    def detect(self, image_bgr: np.ndarray) -> list[dict[str, Any]]:
        """
        Detect all faces in an image.

        Args:
            image_bgr: OpenCV BGR image as numpy array.

        Returns:
            List of dicts, each containing:
                - 'bbox': [x1, y1, x2, y2] (int pixel coordinates)
                - 'confidence': float (0.0 to 1.0)

            Only faces above the confidence threshold are returned.
            Returns an empty list if no faces are detected.

        Raises:
            ImageValidationError: If the image is invalid.
            FaceDetectionError: If MTCNN fails unexpectedly.
        """
        # Validate input
        if image_bgr is None or image_bgr.size == 0:
            raise ImageValidationError("Invalid image: empty or None.")

        if len(image_bgr.shape) != 3 or image_bgr.shape[2] != 3:
            raise ImageValidationError(
                "Invalid image: expected a 3-channel (BGR) image, "
                f"got shape {image_bgr.shape}."
            )

        validate_image_dimensions(image_bgr)

        # Convert BGR → RGB → PIL for MTCNN
        image_rgb = bgr_to_rgb(image_bgr)
        image_pil = rgb_to_pil(image_rgb)

        try:
            boxes, confidences = self._mtcnn.detect(image_pil)
        except Exception as e:
            logger.error("MTCNN detection failed: %s", e, exc_info=True)
            raise FaceDetectionError(f"Face detection failed: {e}") from e

        # No faces detected
        if boxes is None or confidences is None:
            logger.info("No faces detected in image.")
            return []

        # Filter by confidence threshold and build results
        results: list[dict[str, Any]] = []
        for bbox, conf in zip(boxes, confidences):
            if conf is None or conf < self.confidence_threshold:
                logger.debug(
                    "Skipping low-confidence detection (%.3f < %.3f)",
                    conf if conf is not None else 0.0,
                    self.confidence_threshold,
                )
                continue

            # Convert to integer pixel coordinates
            x1, y1, x2, y2 = [int(round(c)) for c in bbox]

            # Clamp to image boundaries
            h, w = image_bgr.shape[:2]
            x1 = max(0, x1)
            y1 = max(0, y1)
            x2 = min(w, x2)
            y2 = min(h, y2)

            # Skip degenerate boxes
            if x2 <= x1 or y2 <= y1:
                logger.debug("Skipping degenerate bounding box: [%d,%d,%d,%d]", x1, y1, x2, y2)
                continue

            results.append({
                "bbox": [x1, y1, x2, y2],
                "confidence": round(float(conf), 4),
            })

        logger.info(
            "Detected %d face(s) above threshold (%.2f) out of %d raw detections.",
            len(results),
            self.confidence_threshold,
            len(boxes),
        )

        # Sort by confidence descending
        results.sort(key=lambda f: f["confidence"], reverse=True)

        return results

    def detect_and_crop(
        self,
        image_bgr: np.ndarray,
        padding: float = 0.1,
    ) -> list[dict[str, Any]]:
        """
        Detect faces and return results with cropped face images.

        Args:
            image_bgr: OpenCV BGR image as numpy array.
            padding: Fractional padding around the face crop (0.1 = 10%).

        Returns:
            List of dicts, each containing:
                - 'bbox': [x1, y1, x2, y2]
                - 'confidence': float
                - 'crop': numpy array of the cropped face (BGR)
        """
        detections = self.detect(image_bgr)

        for det in detections:
            det["crop"] = crop_face(image_bgr, det["bbox"], padding=padding)

        return detections


# ──────────────────────────────────────────────
# Module-level singleton for reuse across the app
# ──────────────────────────────────────────────
_detector_instance: FaceDetector | None = None


def get_face_detector() -> FaceDetector:
    """
    Get or create the singleton FaceDetector instance.

    This avoids re-loading the MTCNN model on every request.
    """
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = FaceDetector()
    return _detector_instance
