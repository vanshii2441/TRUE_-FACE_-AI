"""
TRUE FACE AI — Deepfake Detection Service

Provides inference service for DeepfakeNet PyTorch model to detect
AI-generated, manipulated, or synthetic faces.
"""

import logging
import os
from typing import Any, Optional

import cv2
import numpy as np
import torch

from app.config import settings
from app.models.deepfake_net import DeepfakeNet

logger = logging.getLogger(__name__)


class DeepfakeDetectorError(Exception):
    """Base exception for deepfake detection errors."""
    pass


class DeepfakeDetector:
    """
    Face Deepfake & Synthetic Image Detection Service.

    Uses DeepfakeNet CNN to classify face crops as genuine (REAL)
    or AI-generated / manipulated (DEEPFAKE).
    """

    def __init__(
        self,
        model_path: Optional[str] = None,
        threshold: Optional[float] = None,
        input_size: Optional[int] = None,
        device: Optional[str] = None,
    ) -> None:
        self.model_path = model_path if model_path is not None else settings.deepfake_model_path
        self.threshold = threshold if threshold is not None else settings.deepfake_threshold
        self.input_size = input_size if input_size is not None else settings.deepfake_input_size

        if device:
            self.device = torch.device(device)
        else:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        logger.info("Initializing DeepfakeDetector on device: %s", self.device)
        self.model = DeepfakeNet(num_classes=2).to(self.device)
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
            return "Pre-trained DeepfakeNet CNN weights loaded successfully."
        return f"Model weights checkpoint not found at '{self.model_path}'. Operating in initialized architecture mode."

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
                    self.model.load_state_dict(checkpoint)
                else:
                    self.model.load_state_dict(checkpoint)
                self.model.eval()
                self.is_weights_loaded = True
                logger.info("Successfully loaded DeepfakeNet weights from %s", self.model_path)
                return True
            except Exception as e:
                logger.warning("Failed to load DeepfakeNet weights from %s: %s", self.model_path, e)
        else:
            logger.info(
                "DeepfakeNet checkpoint not found at '%s'. Operating in initialized architecture mode. "
                "For production accuracy, train or place model weights at the configured path.",
                self.model_path,
            )
        self.model.eval()
        return False

    def preprocess(self, face_crop_bgr: np.ndarray) -> torch.Tensor:
        """
        Preprocess face crop for DeepfakeNet.

        Args:
            face_crop_bgr: BGR image crop as numpy array (H, W, 3).

        Returns:
            PyTorch tensor of shape (1, 3, input_size, input_size) normalized to [0, 1].
        """
        if face_crop_bgr is None or face_crop_bgr.size == 0:
            raise DeepfakeDetectorError("Invalid empty face crop provided for deepfake evaluation.")

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
        Predict deepfake probability and classification for a face crop.

        Args:
            face_crop_bgr: BGR face image crop.

        Returns:
            Dictionary containing deepfake evaluation results.
        """
        if face_crop_bgr is None or face_crop_bgr.size == 0:
            raise DeepfakeDetectorError("Invalid empty face crop provided for deepfake evaluation.")

        if not self.is_weights_loaded:
            logger.warning("DeepfakeDetector: Model weights checkpoint not loaded. Returning UNAVAILABLE result.")
            return {
                "deepfake_probability": 0.0,
                "real_probability": 0.0,
                "is_deepfake": False,
                "deepfake_status": "UNAVAILABLE",
                "threshold": self.threshold,
                "weights_loaded": False,
                "reason": f"Model weights checkpoint not found at '{self.model_path}'.",
            }

        tensor = self.preprocess(face_crop_bgr)

        with torch.no_grad():
            probs = self.model.predict_proba(tensor)[0]
            real_prob = float(probs[0].item())
            fake_prob = float(probs[1].item())

        is_deepfake = fake_prob >= self.threshold
        status = "DEEPFAKE" if is_deepfake else "REAL"

        return {
            "deepfake_probability": round(fake_prob, 4),
            "real_probability": round(real_prob, 4),
            "is_deepfake": is_deepfake,
            "deepfake_status": status,
            "threshold": self.threshold,
            "weights_loaded": True,
        }


# Singleton instance
_deepfake_detector_instance: Optional[DeepfakeDetector] = None


def get_deepfake_detector() -> DeepfakeDetector:
    """Get or create singleton DeepfakeDetector instance."""
    global _deepfake_detector_instance
    if _deepfake_detector_instance is None:
        _deepfake_detector_instance = DeepfakeDetector()
    return _deepfake_detector_instance
