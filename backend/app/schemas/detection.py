"""
TRUE FACE AI — Pydantic Schemas for Face Detection

Request/response models for the face detection API endpoints.
"""

from pydantic import BaseModel, Field


class FaceBox(BaseModel):
    """A single detected face with bounding box and confidence."""

    bbox: list[int] = Field(
        ...,
        min_length=4,
        max_length=4,
        description="Bounding box coordinates [x1, y1, x2, y2]",
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Detection confidence score (0.0 to 1.0)",
    )


class DetectionResponse(BaseModel):
    """Successful face detection response."""

    success: bool = Field(default=True, description="Whether the request succeeded")
    faces_detected: int = Field(
        ..., ge=0, description="Number of faces detected in the image"
    )
    faces: list[FaceBox] = Field(
        default_factory=list, description="List of detected faces"
    )
    image_width: int = Field(..., description="Original image width in pixels")
    image_height: int = Field(..., description="Original image height in pixels")


class ErrorResponse(BaseModel):
    """Error response for failed requests."""

    success: bool = Field(default=False)
    error: str = Field(..., description="Human-readable error message")
    detail: str | None = Field(
        default=None, description="Additional error details for debugging"
    )
