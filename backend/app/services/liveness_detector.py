"""
TRUE FACE AI — Passive Liveness Detection Service

Provides inference service for LivenessNet PyTorch model to detect
presentation attacks (printed photos, video replays, screen captures).
"""

import logging
import os
from typing import Any, Optional

import cv2
import numpy as np
import torch

from app.config import settings
from app.models.liveness_net import LivenessNet

logger = logging.getLogger(__name__)


class LivenessDetectorError(Exception):
    """Base exception for liveness detection errors."""
    pass


class LivenessDetector:
    """
    Passive anti-spoofing liveness classification service.

    Uses lightweight LivenessNet CNN to classify face crops as genuine (REAL)
    or presentation attacks (SPOOF).
    """

    def __init__(
        self,
        model_path: Optional[str] = None,
        threshold: Optional[float] = None,
        input_size: Optional[int] = None,
        device: Optional[str] = None,
    ) -> None:
        self.model_path = model_path if model_path is not None else settings.liveness_model_path
        self.threshold = threshold if threshold is not None else settings.liveness_threshold
        self.input_size = input_size if input_size is not None else settings.liveness_input_size

        if device:
            self.device = torch.device(device)
        else:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        logger.info("Initializing LivenessDetector on device: %s", self.device)
        self.model = LivenessNet(num_classes=2).to(self.device)
        self.is_weights_loaded = False
        self.load_weights()

    @property
    def is_loaded(self) -> bool:
        """Returns True only if weights were loaded from disk checkpoint."""
        return self.is_weights_loaded

    @property
    def load_reason(self) -> str:
        """Returns human readable status reason for model readiness."""
        if self.is_weights_loaded:
            return "Pre-trained LivenessNet CNN weights loaded successfully."
        return f"Model weights checkpoint not found at '{self.model_path}'. Operating in uninitialized fallback mode."

    def load_weights(self) -> bool:
        """
        Load model weights from checkpoint path if available.
        """
        if os.path.exists(self.model_path):
            try:
                checkpoint = torch.load(self.model_path, map_location=self.device)
                if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
                    self.model.load_state_dict(checkpoint["model_state_dict"])
                elif isinstance(checkpoint, dict) and not any(k.startswith("block") for k in checkpoint.keys()):
                    # Fallback dict structure
                    self.model.load_state_dict(checkpoint)
                else:
                    self.model.load_state_dict(checkpoint)
                self.model.eval()
                self.is_weights_loaded = True
                logger.info("Successfully loaded LivenessNet weights from %s", self.model_path)
                return True
            except Exception as e:
                logger.warning("Failed to load LivenessNet weights from %s: %s", self.model_path, e)
        else:
            logger.info(
                "LivenessNet checkpoint not found at '%s'. Using uninitialized fallback mode.",
                self.model_path,
            )
        self.model.eval()
        return False

    def preprocess(self, face_crop_bgr: np.ndarray) -> torch.Tensor:
        """
        Preprocess face crop for LivenessNet.

        Args:
            face_crop_bgr: BGR image crop as numpy array (H, W, 3).

        Returns:
            PyTorch tensor of shape (1, 3, input_size, input_size) normalized to [0, 1].
        """
        if face_crop_bgr is None or face_crop_bgr.size == 0:
            raise LivenessDetectorError("Invalid empty face crop provided for liveness evaluation.")

        # BGR to RGB
        face_rgb = cv2.cvtColor(face_crop_bgr, cv2.COLOR_BGR2RGB)

        # Resize to input_size x input_size
        resized = cv2.resize(face_rgb, (self.input_size, self.input_size), interpolation=cv2.INTER_AREA)

        # Normalize to [0.0, 1.0] and rearrange dimensions to (3, H, W)
        tensor = torch.from_numpy(resized).permute(2, 0, 1).float() / 255.0

        # Add batch dimension -> (1, 3, H, W)
        tensor = tensor.unsqueeze(0)
        return tensor.to(self.device)

    def predict(self, face_crop_bgr: np.ndarray) -> dict[str, Any]:
        """
        Predict liveness score and classification for a face crop.

        Args:
            face_crop_bgr: BGR face image crop.

        Returns:
            Dictionary containing liveness evaluation results.
        """
        if face_crop_bgr is None or face_crop_bgr.size == 0:
            raise LivenessDetectorError("Invalid empty face crop provided for liveness evaluation.")

        if not self.is_weights_loaded:
            logger.warning("LivenessDetector: Model weights checkpoint not loaded. Returning UNAVAILABLE result.")
            return {
                "liveness_score": 0.0,
                "spoof_score": 1.0,
                "is_live": False,
                "liveness_status": "UNAVAILABLE",
                "threshold": self.threshold,
                "weights_loaded": False,
                "reason": f"Model weights checkpoint not found at '{self.model_path}'.",
            }

        tensor = self.preprocess(face_crop_bgr)

        with torch.no_grad():
            probs = self.model.predict_proba(tensor)[0]
            real_prob = float(probs[0].item())
            spoof_prob = float(probs[1].item())

        is_live = real_prob >= self.threshold
        status = "REAL" if is_live else "SPOOF"

        return {
            "liveness_score": round(real_prob, 4),
            "spoof_score": round(spoof_prob, 4),
            "is_live": is_live,
            "liveness_status": status,
            "threshold": self.threshold,
            "weights_loaded": True,
        }


# Singleton instance
_liveness_detector_instance: Optional[LivenessDetector] = None


def get_liveness_detector() -> LivenessDetector:
    """Get or create singleton LivenessDetector instance."""
    global _liveness_detector_instance
    if _liveness_detector_instance is None:
        _liveness_detector_instance = LivenessDetector()
    return _liveness_detector_instance
