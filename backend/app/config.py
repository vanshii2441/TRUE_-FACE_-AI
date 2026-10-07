"""
TRUE FACE AI — Application Configuration

Loads settings from environment variables with sensible defaults.
Uses Pydantic BaseSettings for validation and type coercion.
"""

from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # --- App ---
    app_name: str = Field(default="TRUE FACE AI", description="Application name")
    app_version: str = Field(default="0.1.0", description="Current version")
    debug: bool = Field(default=False, description="Enable debug mode")

    # --- Server ---
    host: str = Field(default="0.0.0.0", description="Server host")
    port: int = Field(default=8000, description="Server port")

    # --- Face Detection ---
    detection_confidence_threshold: float = Field(
        default=0.90,
        ge=0.0,
        le=1.0,
        description="Minimum confidence to accept a detected face",
    )
    max_image_size_mb: float = Field(
        default=10.0,
        gt=0.0,
        description="Maximum allowed upload image size in MB",
    )
    max_image_dimension: int = Field(
        default=4096,
        gt=0,
        description="Maximum allowed image width or height in pixels",
    )

    # --- Face Quality Check ---
    enable_quality_check: bool = Field(
        default=True,
        description="Toggle face image quality assessment gating",
    )
    blur_threshold: float = Field(
        default=30.0,
        ge=0.0,
        description="Minimum Laplacian variance required for face blur check",
    )
    min_face_size: int = Field(
        default=40,
        gt=0,
        description="Minimum face crop width and height in pixels",
    )

    # --- CORS ---
    cors_origins: list[str] = Field(
        default=["http://localhost:5173", "http://localhost:3000"],
        description="Allowed CORS origins",
    )

    # --- Face Recognition & Vector DB ---
    face_match_threshold: float = Field(
        default=0.60,
        ge=0.0,
        le=1.0,
        description="Cosine similarity threshold for face match decision",
    )
    top_k: int = Field(
        default=5,
        gt=0,
        description="Number of top candidates to return during recognition search",
    )
    faiss_index_path: str = Field(
        default="data/faiss/index.bin",
        description="Path to saved FAISS binary index file",
    )
    faiss_metadata_path: str = Field(
        default="data/faiss/metadata.json",
        description="Path to saved vector metadata JSON file",
    )
    embedding_model_name: str = Field(
        default="vggface2",
        description="Pretrained model weights for InceptionResnetV1 (vggface2 or casia-webface)",
    )

    # --- Liveness Detection ---
    liveness_threshold: float = Field(
        default=0.70,
        ge=0.0,
        le=1.0,
        description="Minimum probability threshold for classifying a face crop as REAL live face (calibrate on validation data)",
    )
    liveness_model_path: str = Field(
        default="models/liveness/best_model.pth",
        description="Path to saved PyTorch CNN liveness model checkpoint",
    )
    liveness_input_size: int = Field(
        default=128,
        gt=0,
        description="Input square dimension (pixels) expected by the liveness CNN model",
    )
    enable_liveness_check: bool = Field(
        default=True,
        description="Toggle liveness anti-spoofing gating during face recognition",
    )

    # --- Deepfake Detection ---
    deepfake_threshold: float = Field(
        default=0.50,
        ge=0.0,
        le=1.0,
        description="Minimum probability threshold for classifying a face crop as DEEPFAKE (synthetic/AI generated)",
    )
    deepfake_model_path: str = Field(
        default="models/deepfake/best_model.pth",
        description="Path to saved PyTorch CNN deepfake model checkpoint",
    )
    deepfake_input_size: int = Field(
        default=128,
        gt=0,
        description="Input square dimension (pixels) expected by the deepfake CNN model",
    )
    enable_deepfake_check: bool = Field(
        default=True,
        description="Toggle deepfake synthetic face detection gating during face recognition",
    )

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
    }


# Singleton settings instance
settings = Settings()
