"""
TRUE FACE AI — Face Embedding Service

Generates normalized facial embedding vectors using InceptionResnetV1 from facenet-pytorch.
Produces 512-dimensional L2-normalized vectors suitable for cosine similarity matching
and FAISS inner-product vector indexing.
"""

import logging
from typing import Any

import numpy as np
import torch
from facenet_pytorch import InceptionResnetV1
from PIL import Image

from app.config import settings
from app.services.image_utils import (
    ImageValidationError,
    bgr_to_rgb,
    rgb_to_pil,
    validate_image_dimensions,
)

logger = logging.getLogger(__name__)


class FaceEmbeddingError(Exception):
    """Raised when face embedding generation fails."""
    pass


class FaceEmbedder:
    """
    Face embedding service backed by InceptionResnetV1 (pretrained on vggface2).

    Usage:
        embedder = FaceEmbedder()
        embedding_vec = embedder.generate_embedding(cropped_face_bgr)
        # Returns 512-d L2-normalized float32 numpy array
    """

    def __init__(
        self,
        pretrained: str | None = None,
        device: str | None = None,
    ) -> None:
        """
        Initialize the embedding model.

        Args:
            pretrained: Weights to load ('vggface2' or 'casia-webface').
                Defaults to settings.embedding_model_name.
            device: Torch device ('cpu' or 'cuda'). Auto-detected if None.
        """
        self.pretrained = pretrained or settings.embedding_model_name

        if device is None:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = torch.device(device)

        logger.info(
            "Initializing InceptionResnetV1 embedding model (pretrained=%s, device=%s)",
            self.pretrained,
            self.device,
        )

        try:
            self._model = InceptionResnetV1(
                pretrained=self.pretrained,
                classify=False,
                device=self.device,
            ).eval()
        except Exception as e:
            logger.error("Failed to load InceptionResnetV1 model: %s", e, exc_info=True)
            raise FaceEmbeddingError(f"Model initialization failed: {e}") from e

        logger.info("InceptionResnetV1 embedding model initialized successfully.")

    @property
    def is_loaded(self) -> bool:
        """Returns True if InceptionResnetV1 model is initialized."""
        return self._model is not None

    def preprocess_face(self, face_bgr: np.ndarray) -> torch.Tensor:
        """
        Preprocess face image for InceptionResnetV1 model.
        Resizes to 160x160 and normalizes to [-1, 1] range.

        Args:
            face_bgr: Cropped face BGR image.

        Returns:
            Torch tensor of shape (1, 3, 160, 160)
        """
        if face_bgr is None or face_bgr.size == 0:
            raise ImageValidationError("Invalid face image: empty or None.")

        # Ensure correct channels
        if len(face_bgr.shape) != 3 or face_bgr.shape[2] != 3:
            raise ImageValidationError(
                f"Expected 3-channel (BGR) image crop, got shape {face_bgr.shape}."
            )

        validate_image_dimensions(face_bgr)

        # BGR -> RGB -> PIL
        face_rgb = bgr_to_rgb(face_bgr)
        face_pil = rgb_to_pil(face_rgb)

        # Resize to 160x160 as required by InceptionResnetV1
        face_pil = face_pil.resize((160, 160), Image.Resampling.BILINEAR)

        # Convert to numpy array float32 in range [0, 1]
        img_np = np.float32(face_pil) / 255.0

        # Standard Fixed Normalization for facenet: (x - 0.5) / 0.5 -> [-1, 1]
        img_np = (img_np - 0.5) / 0.5

        # Transpose HWC (160, 160, 3) -> CHW (3, 160, 160)
        img_np = np.transpose(img_np, (2, 0, 1))

        # Add batch dimension -> (1, 3, 160, 160)
        tensor = torch.tensor(img_np, dtype=torch.float32).unsqueeze(0).to(self.device)
        return tensor

    def generate_embedding(self, face_bgr: np.ndarray) -> np.ndarray:
        """
        Generate an L2-normalized 512-d feature vector from a face crop.

        Args:
            face_bgr: Cropped face image as OpenCV BGR numpy array.

        Returns:
            1D float32 numpy array of shape (512,), L2-normalized.

        Raises:
            ImageValidationError: If face crop is invalid.
            FaceEmbeddingError: If model inference fails.
        """
        input_tensor = self.preprocess_face(face_bgr)

        try:
            with torch.no_grad():
                embedding_tensor = self._model(input_tensor)
        except Exception as e:
            logger.error("Inference failed in embedding model: %s", e, exc_info=True)
            raise FaceEmbeddingError(f"Embedding inference failed: {e}") from e

        # Convert tensor to 1D float32 numpy array
        vec = embedding_tensor.squeeze(0).cpu().numpy().astype(np.float32)

        # Apply L2 normalization: v / ||v||_2
        norm = np.linalg.norm(vec)
        if norm > 1e-10:
            vec = vec / norm
        else:
            logger.warning("Zero-norm embedding vector encountered.")

        return vec

    def extract_embedding(self, face_bgr: np.ndarray) -> dict[str, Any]:
        """
        Generate embedding and return as clean dict response.

        Args:
            face_bgr: Cropped face image BGR.

        Returns:
            Dict containing:
                - 'embedding': list[float]
                - 'dimension': int (512)
        """
        vec = self.generate_embedding(face_bgr)
        return {
            "embedding": vec.tolist(),
            "dimension": int(vec.shape[0]),
        }


# ──────────────────────────────────────────────
# Module-level singleton for reuse across app
# ──────────────────────────────────────────────
_embedder_instance: FaceEmbedder | None = None


def get_face_embedder() -> FaceEmbedder:
    """
    Get or create the singleton FaceEmbedder instance.
    Avoids re-loading model weights on every request.
    """
    global _embedder_instance
    if _embedder_instance is None:
        _embedder_instance = FaceEmbedder()
    return _embedder_instance
