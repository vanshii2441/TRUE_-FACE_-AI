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

    # --- CORS ---
    cors_origins: list[str] = Field(
        default=["http://localhost:5173", "http://localhost:3000"],
        description="Allowed CORS origins",
    )

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
    }


# Singleton settings instance
settings = Settings()
