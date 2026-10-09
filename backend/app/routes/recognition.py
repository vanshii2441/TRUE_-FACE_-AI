"""
TRUE FACE AI — Face Recognition API Routes

Endpoints:
  - POST /api/v1/enroll     : Register a user's face embedding into FAISS
  - POST /api/v1/recognize  : Complete biometric authentication pipeline
  - GET  /api/v1/users      : List enrolled users
  - DELETE /api/v1/users/reset : Reset vector store index
"""

import json
import logging
import time
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.config import settings
from app.schemas.recognition import (
    AuditHistoryResponse,
    EnrollResponse,
    RecognizeCandidate,
    RecognizeResponse,
    UserListResponse,
)
from app.services.audit_store import get_audit_store
from app.services.decision_engine import get_decision_engine
from app.services.deepfake_detector import get_deepfake_detector
from app.services.face_detector import get_face_detector
from app.services.face_embedding import get_face_embedder
from app.services.image_utils import (
    ImageValidationError,
    assess_face_quality,
    load_image_from_bytes,
)
from app.services.liveness_detector import get_liveness_detector
from app.services.vector_store import get_vector_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Face Recognition"])


@router.post(
    "/enroll",
    response_model=EnrollResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Enroll User Face",
    description="Detect face, verify quality, liveness & deepfake authenticity, extract 512d ArcFace embedding, and index into FAISS 1:N database.",
)
async def enroll_face(
    user_id: str = Form(..., description="Unique user string identifier"),
    name: str = Form(..., description="Full display name of user"),
    email: str | None = Form(None, description="Optional user email address"),
    file: UploadFile = File(..., description="Image file containing a single face"),
    extra_metadata: str | None = Form(None, description="Optional JSON string of additional user metadata"),
) -> EnrollResponse:
    t_start = time.perf_counter()
    logger.info("Enrollment initiated for user_id='%s', name='%s', email='%s', filename='%s'", user_id, name, email or "", file.filename)

    # Check for duplicate user_id enrollment
    vector_store = get_vector_store()
    existing = vector_store.get_user_by_id(user_id)
    if existing:
        logger.warning("Enrollment rejected: User ID '%s' is already registered.", user_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User ID '{user_id}' is already enrolled. Please use a unique User ID or delete the existing user first.",
        )

    # Validate uploaded file
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file selected for upload.",
        )

    image_bytes = await file.read()

    try:
        image_bgr = load_image_from_bytes(image_bytes)
    except ImageValidationError as e:
        logger.warning("Enrollment image validation failed for user %s: %s", user_id, e)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # 1. Face Detection
    t_det_start = time.perf_counter()
    detector = get_face_detector()
    detections = detector.detect_and_crop(image_bgr)
    t_det_end = time.perf_counter()
    detection_ms = (t_det_end - t_det_start) * 1000.0
    logger.info("Enrollment face detection for user %s found %d face(s) (%.2fms)", user_id, len(detections), detection_ms)

    if len(detections) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No face detected in image. Enrollment requires an image with exactly 1 clear face.",
        )

    if len(detections) > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Multiple faces ({len(detections)}) detected. Enrollment requires an image with exactly 1 face.",
        )

    face_crop = detections[0]["crop"]
    face_conf = detections[0]["confidence"]

    # 2. Face Quality Assessment
    t_qual_start = time.perf_counter()
    quality_res = assess_face_quality(
        image_bgr=image_bgr,
        crop_bgr=face_crop,
        blur_threshold=settings.blur_threshold,
        min_size=settings.min_face_size,
    )
    t_qual_end = time.perf_counter()
    quality_ms = (t_qual_end - t_qual_start) * 1000.0
    logger.info("Enrollment quality assessment for user %s: score=%.2f, passed=%s (%.2fms)", user_id, quality_res["quality_score"], quality_res["is_quality_passed"], quality_ms)

    if settings.enable_quality_check and not quality_res["is_quality_passed"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Enrollment rejected due to low image quality: {quality_res['reason']}",
        )

    # 3. Passive Anti-Spoofing Liveness Analysis
    t_liv_start = time.perf_counter()
    liveness_detector = get_liveness_detector()
    liveness_res = liveness_detector.predict(face_crop)
    t_liv_end = time.perf_counter()
    liveness_ms = (t_liv_end - t_liv_start) * 1000.0
    logger.info("Enrollment liveness score for user %s: %.4f (is_live=%s, %.2fms)", user_id, liveness_res["liveness_score"], liveness_res["is_live"], liveness_ms)

    if settings.enable_liveness_check and liveness_res.get("liveness_status") == "UNAVAILABLE":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Liveness detection model is unavailable (checkpoint missing). Enrollment cannot proceed.",
        )

    if settings.enable_liveness_check and not liveness_res["is_live"]:
        logger.warning(
            "Enrollment rejected due to spoof detection for user %s (Liveness score: %.4f)",
            user_id,
            liveness_res["liveness_score"],
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Presentation attack detected! Enrollment requires a live face. "
                f"Liveness score: {liveness_res['liveness_score']:.2f} (Threshold: {liveness_res['threshold']:.2f})"
            ),
        )

    # 4. Deepfake Detection Analysis
    t_df_start = time.perf_counter()
    deepfake_detector = get_deepfake_detector()
    deepfake_res = deepfake_detector.predict(face_crop)
    t_df_end = time.perf_counter()
    deepfake_ms = (t_df_end - t_df_start) * 1000.0
    logger.info("Enrollment deepfake prob for user %s: %.4f (is_deepfake=%s, %.2fms)", user_id, deepfake_res["deepfake_probability"], deepfake_res["is_deepfake"], deepfake_ms)

    if settings.enable_deepfake_check and deepfake_res.get("deepfake_status") == "UNAVAILABLE":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Deepfake detection model is unavailable (checkpoint missing). Enrollment cannot proceed.",
        )

    if settings.enable_deepfake_check and deepfake_res["is_deepfake"]:
        logger.warning(
            "Enrollment rejected due to deepfake detection for user %s (Probability: %.4f)",
            user_id,
            deepfake_res["deepfake_probability"],
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Synthetic deepfake face detected! Enrollment requires an authentic face image. "
                f"Deepfake probability: {deepfake_res['deepfake_probability']:.2f} (Threshold: {deepfake_res['threshold']:.2f})"
            ),
        )

    # 5. Face Embedding
    t_emb_start = time.perf_counter()
    embedder = get_face_embedder()
    try:
        embedding_vec = embedder.generate_embedding(face_crop)
    except Exception as e:
        logger.error("Embedding extraction failed during enrollment: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate face embedding: {e}",
        )
    t_emb_end = time.perf_counter()
    embedding_ms = (t_emb_end - t_emb_start) * 1000.0

    # Parse extra metadata if provided
    meta_dict: dict[str, Any] = {}
    if extra_metadata:
        try:
            meta_dict = json.loads(extra_metadata)
        except Exception:
            meta_dict = {"raw_metadata": extra_metadata}
    if email:
        meta_dict["email"] = email.strip()

    # 6. Vector Database Indexing
    t_idx_start = time.perf_counter()
    vector_store = get_vector_store()
    try:
        faiss_id = vector_store.add_face(
            user_id=user_id,
            name=name,
            embedding=embedding_vec,
            extra_metadata=meta_dict,
        )
    except Exception as e:
        logger.error("FAISS indexing failed during enrollment: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store face vector: {e}",
        )
    t_idx_end = time.perf_counter()
    indexing_ms = (t_idx_end - t_idx_start) * 1000.0

    t_total_end = time.perf_counter()
    total_ms = (t_total_end - t_start) * 1000.0
    logger.info("Enrollment SUCCESS for user_id='%s' (faiss_id=%d, total_time=%.2fms)", user_id, faiss_id, total_ms)

    user_records = vector_store.get_user_by_id(user_id)
    enrolled_at = user_records[-1]["enrolled_at"] if user_records else ""

    return EnrollResponse(
        user_id=user_id,
        name=name,
        faiss_id=faiss_id,
        enrolled_at=enrolled_at,
        status="SUCCESS",
        face_confidence=face_conf,
        liveness_score=liveness_res["liveness_score"],
        is_live=liveness_res["is_live"],
        liveness_status=liveness_res["liveness_status"],
        deepfake_probability=deepfake_res["deepfake_probability"],
        is_deepfake=deepfake_res["is_deepfake"],
        deepfake_status=deepfake_res["deepfake_status"],
        timing_ms={
            "detection_ms": round(detection_ms, 2),
            "quality_ms": round(quality_ms, 2),
            "liveness_ms": round(liveness_ms, 2),
            "deepfake_ms": round(deepfake_ms, 2),
            "embedding_ms": round(embedding_ms, 2),
            "indexing_ms": round(indexing_ms, 2),
            "total_ms": round(total_ms, 2),
        },
    )


@router.post(
    "/recognize",
    response_model=RecognizeResponse,
    status_code=status.HTTP_200_OK,
    summary="Recognize & Authenticate Face",
    description=(
        "Complete end-to-end face authentication pipeline: "
        "Image Input -> Face Detection -> Quality Check -> Liveness Detection -> "
        "Deepfake Detection -> Face Embedding -> FAISS 1:N Recognition -> Centralized Decision Engine"
    ),
)
async def recognize_face(
    file: UploadFile = File(..., description="Query image file containing face"),
    top_k: int | None = Form(None, description="Number of top candidate matches to return"),
    threshold: float | None = Form(None, description="Cosine similarity score threshold (0.0 - 1.0)"),
) -> RecognizeResponse:
    t_start = time.perf_counter()
    logger.info("Verification started for filename='%s'", file.filename or "unknown")

    use_top_k = top_k if top_k is not None else settings.top_k
    use_threshold = threshold if threshold is not None else settings.face_match_threshold

    decision_engine = get_decision_engine()
    timing_ms: dict[str, float] = {}

    # Validate image file presence
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file selected for upload.",
        )

    # Read image bytes
    try:
        image_bytes = await file.read()
        image_bgr = load_image_from_bytes(image_bytes)
    except ImageValidationError as e:
        logger.warning("Verification image validation failed: %s", e)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("Error loading image for verification: %s", e, exc_info=True)
        t_total_end = time.perf_counter()
        total_ms = (t_total_end - t_start) * 1000.0
        outcome = decision_engine.evaluate(
            detected_faces_count=0,
            system_error=f"Corrupted or invalid image input: {e}",
        )
        return _build_recognize_response(outcome, threshold=use_threshold, timing={"total_ms": round(total_ms, 2)})

    # 1. Face Detection Stage
    t_det_start = time.perf_counter()
    detector = get_face_detector()
    try:
        detections = detector.detect_and_crop(image_bgr)
    except Exception as e:
        logger.error("Face detection exception: %s", e, exc_info=True)
        t_total_end = time.perf_counter()
        total_ms = (t_total_end - t_start) * 1000.0
        outcome = decision_engine.evaluate(
            detected_faces_count=0,
            system_error=f"Face detection engine error: {e}",
        )
        return _build_recognize_response(outcome, threshold=use_threshold, timing={"total_ms": round(total_ms, 2)})

    t_det_end = time.perf_counter()
    timing_ms["detection_ms"] = round((t_det_end - t_det_start) * 1000.0, 2)
    detected_count = len(detections)
    logger.info("Face detection complete: %d face(s) found in %.2fms", detected_count, timing_ms["detection_ms"])

    # Early exit if 0 or multiple faces detected
    if detected_count != 1:
        t_total_end = time.perf_counter()
        timing_ms["total_ms"] = round((t_total_end - t_start) * 1000.0, 2)
        outcome = decision_engine.evaluate(detected_faces_count=detected_count)
        return _build_recognize_response(
            outcome,
            threshold=use_threshold,
            timing=timing_ms,
            detected_count=detected_count,
        )

    primary_crop = detections[0]["crop"]

    # 2. Face Quality Assessment Stage
    t_qual_start = time.perf_counter()
    quality_res = assess_face_quality(
        image_bgr=image_bgr,
        crop_bgr=primary_crop,
        blur_threshold=settings.blur_threshold,
        min_size=settings.min_face_size,
    )
    t_qual_end = time.perf_counter()
    timing_ms["quality_ms"] = round((t_qual_end - t_qual_start) * 1000.0, 2)
    logger.info(
        "Quality check complete: score=%.2f, blur_score=%.1f, passed=%s in %.2fms",
        quality_res["quality_score"],
        quality_res["blur_score"],
        quality_res["is_quality_passed"],
        timing_ms["quality_ms"],
    )

    if settings.enable_quality_check and not quality_res["is_quality_passed"]:
        t_total_end = time.perf_counter()
        timing_ms["total_ms"] = round((t_total_end - t_start) * 1000.0, 2)
        outcome = decision_engine.evaluate(
            detected_faces_count=1,
            quality_res=quality_res,
        )
        return _build_recognize_response(
            outcome,
            threshold=use_threshold,
            timing=timing_ms,
            detected_count=1,
        )

    # 3. Liveness Anti-Spoofing Detection Stage
    t_liv_start = time.perf_counter()
    liveness_detector = get_liveness_detector()
    try:
        liveness_res = liveness_detector.predict(primary_crop)
    except Exception as e:
        logger.error("Liveness detector error: %s", e, exc_info=True)
        t_total_end = time.perf_counter()
        timing_ms["total_ms"] = round((t_total_end - t_start) * 1000.0, 2)
        outcome = decision_engine.evaluate(
            detected_faces_count=1,
            quality_res=quality_res,
            system_error=f"Liveness detection failure: {e}",
        )
        return _build_recognize_response(
            outcome,
            threshold=use_threshold,
            timing=timing_ms,
            detected_count=1,
        )

    t_liv_end = time.perf_counter()
    timing_ms["liveness_ms"] = round((t_liv_end - t_liv_start) * 1000.0, 2)
    logger.info(
        "Liveness check complete: score=%.4f (is_live=%s) in %.2fms",
        liveness_res["liveness_score"],
        liveness_res["is_live"],
        timing_ms["liveness_ms"],
    )

    if settings.enable_liveness_check and not liveness_res["is_live"]:
        t_total_end = time.perf_counter()
        timing_ms["total_ms"] = round((t_total_end - t_start) * 1000.0, 2)
        outcome = decision_engine.evaluate(
            detected_faces_count=1,
            quality_res=quality_res,
            liveness_res=liveness_res,
        )
        return _build_recognize_response(
            outcome,
            threshold=use_threshold,
            timing=timing_ms,
            detected_count=1,
        )

    # 4. Deepfake Synthetic Detection Stage
    t_df_start = time.perf_counter()
    deepfake_detector = get_deepfake_detector()
    try:
        deepfake_res = deepfake_detector.predict(primary_crop)
    except Exception as e:
        logger.error("Deepfake detector error: %s", e, exc_info=True)
        t_total_end = time.perf_counter()
        timing_ms["total_ms"] = round((t_total_end - t_start) * 1000.0, 2)
        outcome = decision_engine.evaluate(
            detected_faces_count=1,
            quality_res=quality_res,
            liveness_res=liveness_res,
            system_error=f"Deepfake detection failure: {e}",
        )
        return _build_recognize_response(
            outcome,
            threshold=use_threshold,
            timing=timing_ms,
            detected_count=1,
        )

    t_df_end = time.perf_counter()
    timing_ms["deepfake_ms"] = round((t_df_end - t_df_start) * 1000.0, 2)
    logger.info(
        "Deepfake check complete: prob=%.4f (is_deepfake=%s) in %.2fms",
        deepfake_res["deepfake_probability"],
        deepfake_res["is_deepfake"],
        timing_ms["deepfake_ms"],
    )

    if settings.enable_deepfake_check and deepfake_res["is_deepfake"]:
        t_total_end = time.perf_counter()
        timing_ms["total_ms"] = round((t_total_end - t_start) * 1000.0, 2)
        outcome = decision_engine.evaluate(
            detected_faces_count=1,
            quality_res=quality_res,
            liveness_res=liveness_res,
            deepfake_res=deepfake_res,
        )
        return _build_recognize_response(
            outcome,
            threshold=use_threshold,
            timing=timing_ms,
            detected_count=1,
        )

    # 5. Face Embedding Generation Stage
    t_emb_start = time.perf_counter()
    embedder = get_face_embedder()
    try:
        query_vec = embedder.generate_embedding(primary_crop)
    except Exception as e:
        logger.error("Embedding generation error: %s", e, exc_info=True)
        t_total_end = time.perf_counter()
        timing_ms["total_ms"] = round((t_total_end - t_start) * 1000.0, 2)
        outcome = decision_engine.evaluate(
            detected_faces_count=1,
            quality_res=quality_res,
            liveness_res=liveness_res,
            deepfake_res=deepfake_res,
            system_error=f"Embedding extraction failure: {e}",
        )
        return _build_recognize_response(
            outcome,
            threshold=use_threshold,
            timing=timing_ms,
            detected_count=1,
        )

    t_emb_end = time.perf_counter()
    timing_ms["embedding_ms"] = round((t_emb_end - t_emb_start) * 1000.0, 2)
    logger.info("Face embedding extraction complete in %.2fms", timing_ms["embedding_ms"])

    # 6. FAISS 1:N Vector Search Stage
    t_srch_start = time.perf_counter()
    vector_store = get_vector_store()
    total_enrolled = vector_store.count()

    try:
        raw_candidates = vector_store.search(
            query_embedding=query_vec,
            top_k=use_top_k,
            threshold=use_threshold,
        )
    except Exception as e:
        logger.error("FAISS vector search error: %s", e, exc_info=True)
        t_total_end = time.perf_counter()
        timing_ms["total_ms"] = round((t_total_end - t_start) * 1000.0, 2)
        outcome = decision_engine.evaluate(
            detected_faces_count=1,
            quality_res=quality_res,
            liveness_res=liveness_res,
            deepfake_res=deepfake_res,
            total_enrolled=total_enrolled,
            system_error=f"Vector database search failure: {e}",
        )
        return _build_recognize_response(
            outcome,
            threshold=use_threshold,
            timing=timing_ms,
            detected_count=1,
        )

    t_srch_end = time.perf_counter()
    timing_ms["search_ms"] = round((t_srch_end - t_srch_start) * 1000.0, 2)
    top_candidates = [RecognizeCandidate(**cand) for cand in raw_candidates]

    best_sim = top_candidates[0].similarity if top_candidates else 0.0
    matched_cand = top_candidates[0] if (top_candidates and top_candidates[0].is_match) else None

    logger.info(
        "FAISS search complete: %d candidates returned, best_sim=%.4f (matched=%s) in %.2fms",
        len(top_candidates),
        best_sim,
        matched_cand.user_id if matched_cand else "None",
        timing_ms["search_ms"],
    )

    t_total_end = time.perf_counter()
    timing_ms["total_ms"] = round((t_total_end - t_start) * 1000.0, 2)

    # 7. Final Centralized Decision Evaluation
    outcome = decision_engine.evaluate(
        detected_faces_count=1,
        quality_res=quality_res,
        liveness_res=liveness_res,
        deepfake_res=deepfake_res,
        match_candidate=matched_cand,
        best_similarity=best_sim,
        total_enrolled=total_enrolled,
    )

    logger.info(
        "Verification decision complete: status=%s, identity=%s, total_ms=%.2f",
        outcome.final_decision,
        outcome.identity,
        timing_ms["total_ms"],
    )

    return _build_recognize_response(
        outcome,
        threshold=use_threshold,
        timing=timing_ms,
        detected_count=1,
        matched_candidate=matched_cand,
        top_candidates=top_candidates,
        liveness_status=liveness_res.get("liveness_status", "REAL"),
        deepfake_status=deepfake_res.get("deepfake_status", "REAL"),
    )


def _build_recognize_response(
    outcome: Any,
    threshold: float,
    timing: dict[str, float],
    detected_count: int = 0,
    matched_candidate: RecognizeCandidate | None = None,
    top_candidates: list[RecognizeCandidate] | None = None,
    liveness_status: str = "REAL",
    deepfake_status: str = "REAL",
) -> RecognizeResponse:
    """Helper to convert DecisionOutcome into RecognizeResponse schema."""
    full_timing = {
        "detection_ms": 0.0,
        "quality_ms": 0.0,
        "liveness_ms": 0.0,
        "deepfake_ms": 0.0,
        "embedding_ms": 0.0,
        "search_ms": 0.0,
        "total_ms": 0.0,
    }
    full_timing.update(timing)

    # Record attempt into persistent audit store
    try:
        audit_store = get_audit_store()
        audit_store.log_verification(
            final_decision=outcome.final_decision,
            is_authenticated=outcome.is_authenticated,
            identity=outcome.identity,
            user_id=matched_candidate.user_id if matched_candidate else None,
            similarity_score=outcome.similarity_score,
            liveness_score=outcome.liveness_score,
            liveness_status=liveness_status,
            deepfake_probability=outcome.deepfake_probability,
            deepfake_status=deepfake_status,
            quality_score=outcome.quality_score,
            explanation=outcome.explanation,
            timing_ms=full_timing,
        )
    except Exception as e:
        logger.error("Failed to log audit history: %s", e, exc_info=True)

    return RecognizeResponse(
        identity=outcome.identity,
        similarity_score=outcome.similarity_score,
        liveness_score=outcome.liveness_score,
        deepfake_probability=outcome.deepfake_probability,
        final_decision=outcome.final_decision,
        explanation=outcome.explanation,
        reasons=outcome.reasons,
        quality_score=outcome.quality_score,
        blur_score=outcome.blur_score,
        is_quality_passed=outcome.is_quality_passed,
        total_processing_time=full_timing.get("total_ms", 0.0),
        status=outcome.status,
        is_authenticated=outcome.is_authenticated,
        matched_user=matched_candidate,
        best_similarity=outcome.similarity_score,
        threshold=threshold,
        is_live=outcome.liveness_score >= settings.liveness_threshold,
        liveness_status=liveness_status,
        is_deepfake=outcome.deepfake_probability >= settings.deepfake_threshold,
        deepfake_status=deepfake_status,
        top_candidates=top_candidates or [],
        detected_faces_count=detected_count,
        timing_ms=full_timing,
    )


@router.get(
    "/users",
    response_model=UserListResponse,
    summary="List Enrolled Users",
    description="Retrieve list of all users currently enrolled in the FAISS vector database.",
)
async def list_users() -> UserListResponse:
    vector_store = get_vector_store()
    all_users = vector_store.get_all_users()
    return UserListResponse(
        total_enrolled=vector_store.count(),
        users=all_users,
    )


@router.delete(
    "/users/reset",
    summary="Reset Vector Store Database",
    description="Wipe all vectors and metadata from FAISS index and disk storage.",
)
async def reset_vector_store() -> dict[str, str]:
    vector_store = get_vector_store()
    vector_store.reset()
    return {"message": "Vector store database reset successfully.", "status": "CLEARED"}


@router.delete(
    "/users/{user_id}",
    summary="Delete Enrolled User",
    description="Remove user identity records from FAISS vector store metadata.",
)
async def delete_user(user_id: str) -> dict[str, Any]:
    vector_store = get_vector_store()
    count_removed = vector_store.delete_user(user_id)
    if count_removed == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User ID '{user_id}' not found in database.",
        )
    return {
        "message": f"User '{user_id}' successfully deleted.",
        "user_id": user_id,
        "removed_records": count_removed,
        "status": "DELETED",
    }


@router.get(
    "/history",
    response_model=AuditHistoryResponse,
    summary="Get Verification History",
    description="Retrieve recent biometric face verification attempt audit logs.",
)
async def get_verification_history(limit: int = 50) -> AuditHistoryResponse:
    audit_store = get_audit_store()
    logs = audit_store.get_history(limit=limit)
    return AuditHistoryResponse(
        total_logs=len(logs),
        history=logs,
    )


@router.delete(
    "/history/clear",
    summary="Clear Verification History",
    description="Clear all biometric verification audit history logs.",
)
async def clear_verification_history() -> dict[str, str]:
    audit_store = get_audit_store()
    audit_store.clear_history()
    return {"message": "Verification history cleared.", "status": "CLEARED"}

