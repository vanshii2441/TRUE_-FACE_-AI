"""
TRUE FACE AI — Face Recognition API Schemas

Pydantic models for face enrollment, 1:N recognition, candidates, and API responses.
"""

from typing import Any
from pydantic import BaseModel, Field


class EnrollResponse(BaseModel):
    """Response returned after enrolling a face image."""

    user_id: str = Field(..., description="Unique string identifier for the user")
    name: str = Field(..., description="User's display name")
    faiss_id: int = Field(..., description="Assigned internal FAISS index vector ID")
    enrolled_at: str = Field(..., description="ISO 8601 timestamp of enrollment")
    status: str = Field(default="SUCCESS", description="Enrollment status indicator")
    face_confidence: float = Field(..., description="Detection confidence score for enrolled face")
    liveness_score: float = Field(default=1.0, description="Liveness confidence score (0.0 to 1.0)")
    is_live: bool = Field(default=True, description="True if face passed liveness anti-spoofing check")
    liveness_status: str = Field(default="REAL", description="Liveness evaluation status ('REAL' or 'SPOOF')")
    timing_ms: dict[str, float] = Field(
        default_factory=dict,
        description="Execution latency breakdown in milliseconds",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "user_id": "USR001",
                "name": "Alice Smith",
                "faiss_id": 0,
                "enrolled_at": "2026-09-08T12:00:00+00:00",
                "status": "SUCCESS",
                "face_confidence": 0.9985,
                "liveness_score": 0.985,
                "is_live": True,
                "liveness_status": "REAL",
                "timing_ms": {
                    "detection_ms": 45.2,
                    "liveness_ms": 12.4,
                    "embedding_ms": 32.1,
                    "indexing_ms": 1.5,
                    "total_ms": 91.2,
                },
            }
        }
    }


class RecognizeCandidate(BaseModel):
    """Details of a candidate match from 1:N vector search."""

    user_id: str = Field(..., description="Matched user ID")
    name: str = Field(..., description="Matched user name")
    similarity: float = Field(..., description="Cosine similarity score (0.0 to 1.0)")
    is_match: bool = Field(..., description="True if similarity >= threshold")
    faiss_id: int = Field(..., description="FAISS vector ID")
    enrolled_at: str = Field(default="", description="Enrollment timestamp")
    extra_metadata: dict[str, Any] = Field(default_factory=dict, description="Additional user details")


class RecognizeResponse(BaseModel):
    """Response returned after performing 1:N face recognition search."""

    status: str = Field(
        ...,
        description="Recognition outcome status: 'MATCH', 'NO_MATCH', 'SPOOF_DETECTED', 'NO_FACE_DETECTED', or 'MULTIPLE_FACES_DETECTED'",
    )
    is_authenticated: bool = Field(
        ...,
        description="True if a valid candidate matched above threshold and passed liveness check",
    )
    matched_user: RecognizeCandidate | None = Field(
        default=None,
        description="Top matching candidate if status is 'MATCH', else None",
    )
    best_similarity: float = Field(
        default=0.0,
        description="Highest cosine similarity score among search candidates",
    )
    threshold: float = Field(
        ...,
        description="Cosine similarity decision threshold used for matching",
    )
    liveness_score: float = Field(
        default=1.0,
        description="Probability that the presentation is a live genuine face (0.0 to 1.0)",
    )
    is_live: bool = Field(
        default=True,
        description="True if face passed passive anti-spoofing check",
    )
    liveness_status: str = Field(
        default="REAL",
        description="Anti-spoofing classification status ('REAL' or 'SPOOF')",
    )
    top_candidates: list[RecognizeCandidate] = Field(
        default_factory=list,
        description="List of top K nearest face candidates from FAISS index",
    )
    detected_faces_count: int = Field(
        ...,
        description="Number of faces detected in query image",
    )
    timing_ms: dict[str, float] = Field(
        default_factory=dict,
        description="Detailed execution time breakdown in milliseconds",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "status": "MATCH",
                "is_authenticated": True,
                "matched_user": {
                    "user_id": "USR001",
                    "name": "Alice Smith",
                    "similarity": 0.8954,
                    "is_match": True,
                    "faiss_id": 0,
                    "enrolled_at": "2026-09-08T12:00:00+00:00",
                    "extra_metadata": {},
                },
                "best_similarity": 0.8954,
                "threshold": 0.60,
                "top_candidates": [
                    {
                        "user_id": "USR001",
                        "name": "Alice Smith",
                        "similarity": 0.8954,
                        "is_match": True,
                        "faiss_id": 0,
                        "enrolled_at": "2026-09-08T12:00:00+00:00",
                        "extra_metadata": {},
                    }
                ],
                "detected_faces_count": 1,
                "timing_ms": {
                    "detection_ms": 42.1,
                    "embedding_ms": 28.4,
                    "search_ms": 0.8,
                    "total_ms": 71.3,
                },
            }
        }
    }


class UserListResponse(BaseModel):
    """Response model listing all enrolled users."""

    total_enrolled: int = Field(..., description="Total enrolled face vectors in index")
    users: list[dict[str, Any]] = Field(..., description="List of user records")
