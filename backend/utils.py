"""Image helpers shared by the API, the detectors and the training scripts."""
import base64
import re

import cv2
import numpy as np

FACE_SIZE = 64        # model input size (pixels)
LOWRES = 25           # the bundled LFW subset is 25x25; inference mimics that chain
_DATA_URL = re.compile(r"^data:image/[a-zA-Z0-9.+-]+;base64,")


class ImageError(ValueError):
    """Raised when an uploaded image cannot be used."""


def decode_image(raw: bytes, max_side: int = 960) -> np.ndarray:
    """Decode JPEG/PNG/WebP bytes to a BGR uint8 array, downscaling very large images."""
    if not raw:
        raise ImageError("The image is empty.")
    arr = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ImageError("The file is not a readable image. Use JPEG, PNG or WebP.")
    h, w = img.shape[:2]
    if min(h, w) < 48:
        raise ImageError("The image is too small. Use at least 48 px on the short side.")
    scale = max_side / max(h, w)
    if scale < 1:
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return img


def decode_data_url(data_url: str, max_side: int = 960) -> np.ndarray:
    if not isinstance(data_url, str) or not data_url:
        raise ImageError("No image was sent.")
    payload = _DATA_URL.sub("", data_url, count=1)
    try:
        raw = base64.b64decode(payload, validate=False)
    except Exception as exc:  # noqa: BLE001
        raise ImageError("The image data is not valid base64.") from exc
    return decode_image(raw, max_side)


def to_gray(img: np.ndarray) -> np.ndarray:
    if img.ndim == 2:
        return img
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)


def normalise_face(crop: np.ndarray) -> np.ndarray:
    """Turn any face crop into the 64x64 grayscale form the models were trained on.

    Training images are 25x25 LFW faces upsampled to 64x64, so webcam crops go through
    the same resolution chain (down to 25, up to 64). This keeps live input in the
    same domain as the training data.
    """
    gray = to_gray(crop)
    small = cv2.resize(gray, (LOWRES, LOWRES), interpolation=cv2.INTER_AREA)
    return cv2.resize(small, (FACE_SIZE, FACE_SIZE), interpolation=cv2.INTER_CUBIC)


def recognition_patch(crop: np.ndarray, size: int = 100) -> np.ndarray:
    """Equalised grayscale patch used by the recogniser."""
    gray = to_gray(crop)
    gray = cv2.resize(gray, (size, size), interpolation=cv2.INTER_AREA)
    return cv2.equalizeHist(gray)
