"""
TRUE FACE AI — Admin, Analytics, Health & Config Schemas
"""

from typing import Any
from pydantic import BaseModel, Field


class AdminLoginRequest(BaseModel):
    """Admin login request schema."""
    username: str = Field(..., description="Admin username")
    password: str = Field(..., description="Admin password")


class AdminLoginResponse(BaseModel):
    """Admin login response schema."""
    access_token: str = Field(..., description="Signed bearer token")
    token_type: str = Field(default="bearer", description="Token type")
    username: str = Field(..., description="Authenticated admin username")
    status: str = Field(default="SUCCESS", description="Login status")


class AnalyticsOverviewResponse(BaseModel):
    """Aggregated verification analytics metrics schema."""
    total_enrolled_users: int = Field(..., description="Total enrolled users in vector store")
    active_users: int = Field(..., description="Number of active enrolled users")
    total_verifications: int = Field(..., description="Total verification attempts recorded")
    successful_verifications: int = Field(..., description="Total successful authentications")
    failed_verifications: int = Field(..., description="Total failed verification attempts")
    unknown_user_attempts: int = Field(..., description="Total attempts resulting in unknown user")
    liveness_failures: int = Field(..., description="Total presentation attack liveness failures")
    deepfake_suspected_attempts: int = Field(..., description="Total synthetic deepfake attempts flagged")
    avg_verification_time_ms: float = Field(..., description="Average verification processing time in ms")
    success_rate_percent: float = Field(..., description="Percentage of successful authentications")


class PaginatedAuditLogsResponse(BaseModel):
    """Paginated audit logs schema."""
    total_count: int = Field(..., description="Total matching audit log entries")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Page size limit")
    total_pages: int = Field(..., description="Total pages count")
    items: list[dict[str, Any]] = Field(..., description="List of audit log items")


class DetailedHealthResponse(BaseModel):
    """Comprehensive system health and model status schema."""
    status: str = Field(..., description="Overall system health status ('ONLINE', 'DEGRADED', 'OFFLINE')")
    service: str = Field(..., description="Application name")
    version: str = Field(..., description="Application version")
    api_status: str = Field(default="ONLINE", description="API web server status")
    database_status: str = Field(..., description="FAISS vector store status")
    enrolled_faces_count: int = Field(..., description="Total enrolled face vectors")
    face_detection_model_status: str = Field(..., description="MTCNN detector status")
    face_embedding_model_status: str = Field(..., description="InceptionResnetV1 model status")
    liveness_model_status: str = Field(..., description="LivenessNet model status")
    deepfake_model_status: str = Field(..., description="DeepfakeNet model status")


class ThresholdConfigModel(BaseModel):
    """Configurable system thresholds schema."""
    face_match_threshold: float = Field(..., ge=0.0, le=1.0, description="Cosine similarity cutoff")
    liveness_threshold: float = Field(..., ge=0.0, le=1.0, description="Liveness cutoff")
    deepfake_threshold: float = Field(..., ge=0.0, le=1.0, description="Deepfake cutoff")
    blur_threshold: float = Field(..., ge=0.0, description="Laplacian blur cutoff")
    min_face_size: int = Field(..., gt=0, description="Min face dimension")
