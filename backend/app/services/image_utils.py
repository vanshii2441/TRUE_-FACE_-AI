"""
TRUE FACE AI — Image Utilities

Helper functions for loading, validating, drawing on, and cropping images.
All image operations use OpenCV (BGR) internally and convert as needed.
"""

import logging
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from app.config import settings

logger = logging.getLogger(__name__)


class ImageValidationError(Exception):
    """Raised when an image fails validation checks."""
    pass


def load_image_from_bytes(image_bytes: bytes) -> np.ndarray:
    """
    Decode raw bytes into an OpenCV BGR image array.

    Args:
        image_bytes: Raw image file bytes.

    Returns:
        numpy array in BGR format (OpenCV convention).

    Raises:
        ImageValidationError: If bytes cannot be decoded as an image.
    """
    if not image_bytes:
        raise ImageValidationError("Empty image data received.")

    # Check file size
    size_mb = len(image_bytes) / (1024 * 1024)
    if size_mb > settings.max_image_size_mb:
        raise ImageValidationError(
            f"Image size ({size_mb:.1f} MB) exceeds maximum "
            f"allowed size ({settings.max_image_size_mb} MB)."
        )

    # Decode image bytes
    np_arr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if image is None:
        raise ImageValidationError(
            "Failed to decode image. Ensure the file is a valid "
            "image format (JPEG, PNG, BMP, WebP)."
        )

    return image


def load_image_from_path(image_path: str | Path) -> np.ndarray:
    """
    Load an image from a file path.

    Args:
        image_path: Path to the image file.

    Returns:
        numpy array in BGR format.

    Raises:
        ImageValidationError: If the file doesn't exist or can't be read.
    """
    path = Path(image_path)
    if not path.exists():
        raise ImageValidationError(f"Image file not found: {path}")
    if not path.is_file():
        raise ImageValidationError(f"Path is not a file: {path}")

    image_bytes = path.read_bytes()
    return load_image_from_bytes(image_bytes)


def validate_image_dimensions(image: np.ndarray) -> None:
    """
    Validate that image dimensions are within acceptable limits.

    Args:
        image: OpenCV BGR image array.

    Raises:
        ImageValidationError: If dimensions exceed the configured maximum.
    """
    h, w = image.shape[:2]
    max_dim = settings.max_image_dimension

    if h > max_dim or w > max_dim:
        raise ImageValidationError(
            f"Image dimensions ({w}x{h}) exceed the maximum "
            f"allowed dimension ({max_dim}px)."
        )

    if h < 20 or w < 20:
        raise ImageValidationError(
            f"Image dimensions ({w}x{h}) are too small for face detection. "
            "Minimum size is 20x20 pixels."
        )


def bgr_to_rgb(image: np.ndarray) -> np.ndarray:
    """Convert an OpenCV BGR image to RGB format (for MTCNN)."""
    return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)


def rgb_to_pil(image_rgb: np.ndarray) -> Image.Image:
    """Convert an RGB numpy array to a PIL Image."""
    return Image.fromarray(image_rgb)


def draw_bounding_boxes(
    image: np.ndarray,
    faces: list[dict],
    color: tuple[int, int, int] = (0, 255, 0),
    thickness: int = 2,
) -> np.ndarray:
    """
    Draw bounding boxes and confidence labels on a copy of the image.

    Args:
        image: OpenCV BGR image array.
        faces: List of dicts with 'bbox' [x1,y1,x2,y2] and 'confidence' keys.
        color: BGR color for the bounding box (default: green).
        thickness: Line thickness in pixels.

    Returns:
        Copy of the image with bounding boxes drawn.
    """
    annotated = image.copy()

    for i, face in enumerate(faces):
        x1, y1, x2, y2 = face["bbox"]
        confidence = face["confidence"]

        # Draw bounding box
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, thickness)

        # Draw confidence label
        label = f"Face {i + 1}: {confidence:.2f}"
        label_size, baseline = cv2.getTextSize(
            label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1
        )

        # Background rectangle for label
        label_y = max(y1 - 10, label_size[1] + 5)
        cv2.rectangle(
            annotated,
            (x1, label_y - label_size[1] - 5),
            (x1 + label_size[0] + 5, label_y + baseline),
            color,
            cv2.FILLED,
        )

        # Label text (black on colored background)
        cv2.putText(
            annotated,
            label,
            (x1 + 2, label_y - 2),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (0, 0, 0),
            1,
            cv2.LINE_AA,
        )

    return annotated


def crop_face(
    image: np.ndarray,
    bbox: list[int],
    padding: float = 0.1,
) -> np.ndarray:
    """
    Crop a face region from the image with optional padding.

    Args:
        image: OpenCV BGR image array.
        bbox: Bounding box [x1, y1, x2, y2].
        padding: Fractional padding to add around the face (0.1 = 10%).

    Returns:
        Cropped face region as numpy array.
    """
    h, w = image.shape[:2]
    x1, y1, x2, y2 = bbox

    # Calculate padding in pixels
    face_w = x2 - x1
    face_h = y2 - y1
    pad_x = int(face_w * padding)
    pad_y = int(face_h * padding)

    # Apply padding with bounds checking
    x1 = max(0, x1 - pad_x)
    y1 = max(0, y1 - pad_y)
    x2 = min(w, x2 + pad_x)
    y2 = min(h, y2 + pad_y)

    return image[y1:y2, x1:x2].copy()


def save_image(image: np.ndarray, output_path: str | Path) -> Path:
    """
    Save an OpenCV image to disk.

    Args:
        image: OpenCV BGR image array.
        output_path: Destination file path.

    Returns:
        Path to the saved file.
    """
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(path), image)
    logger.info("Image saved to %s", path)
    return path
