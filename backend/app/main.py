"""
TRUE FACE AI — FastAPI Application Entry Point

Configures the FastAPI app with CORS, routers, and a health check endpoint.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes.detection import router as detection_router
from app.services.face_detector import get_face_detector

# ── Logging setup ──────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s │ %(levelname)-8s │ %(name)s │ %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ── Lifespan: pre-load the face detector at startup ───────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the MTCNN model once at startup so the first request isn't slow."""
    logger.info("Starting %s v%s", settings.app_name, settings.app_version)
    logger.info("Loading face detection model...")
    get_face_detector()  # warm up the singleton
    logger.info("Face detection model ready.")
    yield
    logger.info("Shutting down %s.", settings.app_name)


# ── FastAPI app ────────────────────────────────────────────────
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Enterprise-grade facial recognition & anti-spoofing API. "
        "Currently implements face detection via MTCNN."
    ),
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────
app.include_router(detection_router)


# ── Health check ───────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health_check() -> dict:
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.app_version,
    }


@app.get("/", tags=["System"])
async def root() -> dict:
    """Root endpoint with API info."""
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "health": "/health",
        "endpoints": {
            "detect_face": "POST /api/v1/detect-face",
        },
    }
