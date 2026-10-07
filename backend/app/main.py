"""
TRUE FACE AI — FastAPI Application Entry Point

Configures the FastAPI app with CORS, routers, and a health check endpoint.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routes.detection import router as detection_router
from app.routes.recognition import router as recognition_router
from app.services.deepfake_detector import get_deepfake_detector
from app.services.face_detector import get_face_detector
from app.services.face_embedding import get_face_embedder
from app.services.liveness_detector import get_liveness_detector
from app.services.vector_store import get_vector_store

# ── Logging setup ──────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s │ %(levelname)-8s │ %(name)s │ %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ── Lifespan: pre-load models at startup ──────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load MTCNN, InceptionResnetV1, LivenessNet, DeepfakeNet, and FAISS index at startup."""
    logger.info("Starting %s v%s", settings.app_name, settings.app_version)
    logger.info("Loading face detection model...")
    get_face_detector()
    logger.info("Loading face embedding model...")
    get_face_embedder()
    logger.info("Loading passive liveness anti-spoofing model...")
    get_liveness_detector()
    logger.info("Loading deepfake detection model...")
    get_deepfake_detector()
    logger.info("Loading FAISS vector store...")
    get_vector_store()
    logger.info("All AI models and vector store ready.")
    yield
    logger.info("Shutting down %s.", settings.app_name)


# ── FastAPI app ────────────────────────────────────────────────
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Enterprise-grade facial recognition & anti-spoofing API. "
        "Implements MTCNN face detection, InceptionResnetV1 ArcFace embedding, and FAISS 1:N recognition."
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

# ── Exception Handlers ─────────────────────────────────────────
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.warning("HTTP %d error on %s: %s", exc.status_code, request.url.path, exc.detail)
    detail_payload = exc.detail if isinstance(exc.detail, (dict, list)) else str(exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "HTTP Exception",
            "status_code": exc.status_code,
            "detail": detail_payload,
            "path": request.url.path,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning("Validation error on %s: %s", request.url.path, exc.errors())
    return JSONResponse(
        status_code=422,
        content={
            "error": "Request Validation Error",
            "status_code": 422,
            "detail": exc.errors(),
            "path": request.url.path,
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception on %s: %s", request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "status_code": 500,
            "detail": "An internal server error occurred while processing the request.",
            "path": request.url.path,
        },
    )


# ── Routers ────────────────────────────────────────────────────
app.include_router(detection_router)
app.include_router(recognition_router)


# ── Health check ───────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health_check() -> dict:
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.app_version,
        "enrolled_faces": get_vector_store().count(),
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
            "enroll_face": "POST /api/v1/enroll",
            "recognize_face": "POST /api/v1/recognize",
            "list_users": "GET /api/v1/users",
            "reset_db": "DELETE /api/v1/users/reset",
        },
    }
