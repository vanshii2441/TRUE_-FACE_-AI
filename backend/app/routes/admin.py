"""
TRUE FACE AI — Admin, Analytics, Health & Security Control Routes
"""

import logging
from typing import Any
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.config import settings
from app.schemas.admin import (
    AdminLoginRequest,
    AdminLoginResponse,
    AnalyticsOverviewResponse,
    DetailedHealthResponse,
    PaginatedAuditLogsResponse,
    ThresholdConfigModel,
)
from app.services.audit_store import get_audit_store
from app.services.auth import generate_admin_token, require_admin
from app.services.deepfake_detector import get_deepfake_detector
from app.services.evaluation import BenchmarkEvaluationReport, run_benchmark_evaluation
from app.services.face_detector import get_face_detector
from app.services.face_embedding import get_face_embedder
from app.services.liveness_detector import get_liveness_detector
from app.services.vector_store import get_vector_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Admin & Analytics"])


@router.post(
    "/admin/login",
    response_model=AdminLoginResponse,
    summary="Admin Login",
    description="Authenticate administrator credentials and receive signed Bearer access token.",
)
async def admin_login(body: AdminLoginRequest) -> AdminLoginResponse:
    if body.username != settings.admin_username or body.password != settings.admin_password:
        logger.warning("Failed admin login attempt for username '%s'", body.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid administrator credentials.",
        )

    token = generate_admin_token(body.username)
    logger.info("Admin user '%s' logged in successfully.", body.username)
    return AdminLoginResponse(
        access_token=token,
        token_type="bearer",
        username=body.username,
        status="SUCCESS",
    )


@router.get(
    "/analytics/overview",
    response_model=AnalyticsOverviewResponse,
    summary="Get Verification Analytics Overview",
    description="Retrieve real-time aggregated metrics computed from FAISS database and verification audit logs.",
)
async def get_analytics_overview() -> AnalyticsOverviewResponse:
    vector_store = get_vector_store()
    audit_store = get_audit_store()

    enrolled_count = vector_store.count()
    logs = audit_store.get_history(limit=500)

    total_attempts = len(logs)
    successful = sum(1 for log in logs if log.get("is_authenticated") is True)
    failed = total_attempts - successful

    unknown = sum(1 for log in logs if log.get("final_decision") == "UNKNOWN_PERSON")
    liveness_failed = sum(1 for log in logs if log.get("final_decision") == "LIVENESS_FAILED" or log.get("liveness_status") == "SPOOF")
    deepfake_suspected = sum(
        1 for log in logs if log.get("final_decision") == "DEEPFAKE_SUSPECTED" or log.get("deepfake_status") == "DEEPFAKE"
    )

    times = [
        log.get("timing_ms", {}).get("total_ms", 0.0)
        for log in logs
        if isinstance(log.get("timing_ms"), dict) and log.get("timing_ms", {}).get("total_ms")
    ]
    avg_time = round(sum(times) / len(times), 2) if times else 0.0
    success_rate = round((successful / total_attempts) * 100, 1) if total_attempts > 0 else 0.0

    return AnalyticsOverviewResponse(
        total_enrolled_users=enrolled_count,
        active_users=enrolled_count,
        total_verifications=total_attempts,
        successful_verifications=successful,
        failed_verifications=failed,
        unknown_user_attempts=unknown,
        liveness_failures=liveness_failed,
        deepfake_suspected_attempts=deepfake_suspected,
        avg_verification_time_ms=avg_time,
        success_rate_percent=success_rate,
    )


@router.get(
    "/analytics/evaluation",
    response_model=BenchmarkEvaluationReport,
    summary="Get Accuracy & Evaluation Metrics",
    description="Retrieve evaluation metrics (FAR, FRR, accuracy) calculated on validated benchmark dataset.",
)
async def get_evaluation_metrics(
    dataset_path: str | None = Query(None, description="Path to benchmark dataset")
) -> BenchmarkEvaluationReport:
    return run_benchmark_evaluation(dataset_path=dataset_path)


@router.get(
    "/audit/logs",
    response_model=PaginatedAuditLogsResponse,
    summary="Get Paginated Audit Logs",
    description="Retrieve, search, and filter security verification audit logs.",
)
async def get_audit_logs(
    q: str | None = Query(None, description="Search term for user name, ID, or decision"),
    result_filter: str | None = Query(None, description="Filter by final decision status"),
    start_date: str | None = Query(None, description="Filter by start date (ISO string)"),
    end_date: str | None = Query(None, description="Filter by end date (ISO string)"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(15, ge=1, le=100, description="Page size limit"),
) -> PaginatedAuditLogsResponse:
    audit_store = get_audit_store()
    raw_logs = audit_store.get_history(limit=500)

    filtered = raw_logs

    # Search filter
    if q:
        query_lower = q.lower().strip()
        filtered = [
            log for log in filtered
            if query_lower in (log.get("identity") or "").lower()
            or query_lower in (log.get("user_id") or "").lower()
            or query_lower in (log.get("final_decision") or "").lower()
            or query_lower in (log.get("explanation") or "").lower()
        ]

    # Result decision filter
    if result_filter and result_filter != "ALL":
        filtered = [log for log in filtered if log.get("final_decision") == result_filter]

    # Date range filters
    if start_date:
        filtered = [log for log in filtered if log.get("timestamp", "") >= start_date]
    if end_date:
        filtered = [log for log in filtered if log.get("timestamp", "") <= end_date]

    total_count = len(filtered)
    total_pages = max(1, (total_count + page_size - 1) // page_size)

    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    page_items = filtered[start_idx:end_idx]

    return PaginatedAuditLogsResponse(
        total_count=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        items=page_items,
    )


@router.get(
    "/health/detailed",
    response_model=DetailedHealthResponse,
    summary="Get Detailed System & Model Status",
    description="Inspect real load state and readiness of all AI models, FAISS vector index, and server API.",
)
async def get_detailed_health() -> DetailedHealthResponse:
    det_status = "ONLINE"
    emb_status = "ONLINE"
    liv_status = "ONLINE"
    df_status = "ONLINE"
    db_status = "ONLINE"

    # Check detector
    try:
        det = get_face_detector()
        if not det.is_loaded:
            det_status = "MODEL_UNAVAILABLE"
    except Exception:
        det_status = "MODEL_UNAVAILABLE"

    # Check embedder
    try:
        emb = get_face_embedder()
        if not emb.is_loaded:
            emb_status = "MODEL_UNAVAILABLE"
    except Exception:
        emb_status = "MODEL_UNAVAILABLE"

    # Check liveness
    try:
        liv = get_liveness_detector()
        if not liv.is_loaded:
            liv_status = "MODEL_UNAVAILABLE"
    except Exception:
        liv_status = "MODEL_UNAVAILABLE"

    # Check deepfake
    try:
        df = get_deepfake_detector()
        if not df.is_loaded:
            df_status = "MODEL_UNAVAILABLE"
    except Exception:
        df_status = "MODEL_UNAVAILABLE"

    # Check FAISS vector store
    store = get_vector_store()
    count = store.count()

    statuses = [det_status, emb_status, liv_status, df_status, db_status]
    if all(s == "ONLINE" for s in statuses):
        overall = "ONLINE"
    elif any(s == "ONLINE" for s in statuses):
        overall = "DEGRADED"
    else:
        overall = "OFFLINE"

    return DetailedHealthResponse(
        status=overall,
        service=settings.app_name,
        version=settings.app_version,
        api_status="ONLINE",
        database_status=db_status,
        enrolled_faces_count=count,
        face_detection_model_status=det_status,
        face_embedding_model_status=emb_status,
        liveness_model_status=liv_status,
        deepfake_model_status=df_status,
    )


@router.get(
    "/config/thresholds",
    response_model=ThresholdConfigModel,
    summary="Get Configured System Thresholds",
    description="Retrieve centralized biometric verification threshold values.",
)
async def get_thresholds() -> ThresholdConfigModel:
    return ThresholdConfigModel(
        face_match_threshold=settings.face_match_threshold,
        liveness_threshold=settings.liveness_threshold,
        deepfake_threshold=settings.deepfake_threshold,
        blur_threshold=settings.blur_threshold,
        min_face_size=settings.min_face_size,
    )


@router.put(
    "/config/thresholds",
    response_model=ThresholdConfigModel,
    summary="Update Configured System Thresholds",
    description="Update centralized biometric verification threshold values (requires Admin auth).",
)
async def update_thresholds(
    body: ThresholdConfigModel,
    admin: dict[str, Any] = Depends(require_admin),
) -> ThresholdConfigModel:
    logger.info("Admin '%s' updated system thresholds.", admin.get("username"))
    settings.face_match_threshold = body.face_match_threshold
    settings.liveness_threshold = body.liveness_threshold
    settings.deepfake_threshold = body.deepfake_threshold
    settings.blur_threshold = body.blur_threshold
    settings.min_face_size = body.min_face_size

    return ThresholdConfigModel(
        face_match_threshold=settings.face_match_threshold,
        liveness_threshold=settings.liveness_threshold,
        deepfake_threshold=settings.deepfake_threshold,
        blur_threshold=settings.blur_threshold,
        min_face_size=settings.min_face_size,
    )
