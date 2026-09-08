"""
TRUE FACE AI — Face Detection API Route

POST /api/v1/detect-face
Accepts an uploaded image and returns detected faces with bounding boxes.
"""

import logging

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas.detection import DetectionResponse, ErrorResponse, FaceBox
from app.services.face_detector import (
    FaceDetectionError,
    get_face_detector,
)
from app.services.image_utils import (
    ImageValidationError,
    load_image_from_bytes,
    validate_image_dimensions,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Face Detection"])


@router.post(
    "/detect-face",
    response_model=DetectionResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid image or input"},
        422: {"model": ErrorResponse, "description": "Validation error"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
    summary="Detect faces in an uploaded image",
    description=(
        "Upload an image file (JPEG, PNG, BMP, WebP) and receive a list of "
        "detected faces with bounding box coordinates and confidence scores."
    ),
)
async def detect_face(
    file: UploadFile = File(
        ...,
        description="Image file to detect faces in (JPEG, PNG, BMP, or WebP)",
    ),
) -> DetectionResponse:
    """
    Detect faces in an uploaded image.

    Returns bounding boxes and confidence scores for each detected face.
    Faces below the configured confidence threshold are filtered out.
    """
    # Validate content type
    allowed_types = {
        "image/jpeg",
        "image/png",
        "image/bmp",
        "image/webp",
        "image/jpg",
    }
    if file.content_type and file.content_type not in allowed_types:
        logger.warning("Rejected upload with content type: %s", file.content_type)
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error="Invalid file type",
                detail=f"Expected an image file, got '{file.content_type}'. "
                f"Accepted types: JPEG, PNG, BMP, WebP.",
            ).model_dump(),
        )

    # Read image bytes
    try:
        image_bytes = await file.read()
    except Exception as e:
        logger.error("Failed to read uploaded file: %s", e)
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error="Failed to read uploaded file",
                detail=str(e),
            ).model_dump(),
        )

    # Load and validate image
    try:
        image = load_image_from_bytes(image_bytes)
        validate_image_dimensions(image)
    except ImageValidationError as e:
        logger.warning("Image validation failed: %s", e)
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error="Image validation failed",
                detail=str(e),
            ).model_dump(),
        )

    # Detect faces
    try:
        detector = get_face_detector()
        detections = detector.detect(image)
    except ImageValidationError as e:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error="Image validation failed",
                detail=str(e),
            ).model_dump(),
        )
    except FaceDetectionError as e:
        logger.error("Face detection error: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(
                error="Face detection failed",
                detail=str(e),
            ).model_dump(),
        )

    # Build response
    h, w = image.shape[:2]
    faces = [
        FaceBox(bbox=det["bbox"], confidence=det["confidence"])
        for det in detections
    ]

    response = DetectionResponse(
        success=True,
        faces_detected=len(faces),
        faces=faces,
        image_width=w,
        image_height=h,
    )

    logger.info(
        "Detection complete: %d face(s) in %dx%d image",
        len(faces),
        w,
        h,
    )

    return response
