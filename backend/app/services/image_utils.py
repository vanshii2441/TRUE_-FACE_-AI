"""
TRUE FACE AI — Image Utilities

Helper functions for loading, validating, drawing on, and cropping images.
All image operations use OpenCV (BGR) internally and convert as needed.
"""

import logging
from pathlib import Path
from typing import Any

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


def assess_face_quality(
    image_bgr: np.ndarray,
    crop_bgr: np.ndarray | None = None,
    blur_threshold: float = 30.0,
    min_size: int = 40,
) -> dict[str, Any]:
    """
    Evaluate face image quality metrics including blur (Laplacian variance),
    crop resolution, and brightness levels.

    Args:
        image_bgr: Full image array (BGR format).
        crop_bgr: Cropped face image array (BGR format). If None, image_bgr is evaluated.
        blur_threshold: Minimum Laplacian variance score for image sharpness.
        min_size: Minimum width and height of face crop in pixels.

    Returns:
        dict containing:
            - is_quality_passed (bool)
            - quality_score (float 0.0-1.0)
            - blur_score (float)
            - is_blurry (bool)
            - brightness (float)
            - width (int)
            - height (int)
            - reason (str)
    """
    target = crop_bgr if (crop_bgr is not None and crop_bgr.size > 0) else image_bgr
    if target is None or target.size == 0:
        return {
            "is_quality_passed": False,
            "quality_score": 0.0,
            "blur_score": 0.0,
            "is_blurry": True,
            "brightness": 0.0,
            "width": 0,
            "height": 0,
            "reason": "Empty image crop provided for quality check.",
        }

    h, w = target.shape[:2]
    gray = cv2.cvtColor(target, cv2.COLOR_BGR2GRAY)

    # Blur detection via Laplacian variance
    blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    is_blurry = blur_score < blur_threshold

    # Brightness (mean pixel value)
    brightness = float(np.mean(gray))
    is_extreme_lighting = brightness < 15.0 or brightness > 245.0

    # Dimension check
    is_too_small = (w < min_size) or (h < min_size)

    reasons = []
    if is_blurry:
        reasons.append(
            f"Image is too blurry (blur score {blur_score:.1f} < threshold {blur_threshold:.1f})"
        )
    if is_too_small:
        reasons.append(
            f"Face resolution ({w}x{h}px) is below minimum ({min_size}x{min_size}px)"
        )
    if is_extreme_lighting:
        reasons.append(f"Suboptimal illumination (brightness level: {brightness:.1f})")

    is_passed = (not is_blurry) and (not is_too_small) and (not is_extreme_lighting)

    # Heuristic quality score between 0.0 and 1.0
    norm_blur = min(1.0, blur_score / 150.0)
    norm_size = min(1.0, min(w, h) / 120.0)
    norm_light = 1.0 - (abs(brightness - 128.0) / 128.0)
    quality_score = round(max(0.0, min(1.0, norm_blur * 0.5 + norm_size * 0.3 + norm_light * 0.2)), 4)

    return {
        "is_quality_passed": is_passed,
        "quality_score": quality_score,
        "blur_score": round(blur_score, 2),
        "is_blurry": is_blurry,
        "brightness": round(brightness, 2),
        "width": w,
        "height": h,
        "reason": "; ".join(reasons) if reasons else "Face image passed quality verification.",
    }

