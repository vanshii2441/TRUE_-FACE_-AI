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
    EnrollResponse,
    RecognizeCandidate,
    RecognizeResponse,
    UserListResponse,
)
from app.services.deepfake_detector import get_deepfake_detector
from app.services.face_detector import get_face_detector
from app.services.face_embedding import get_face_embedder
from app.services.image_utils import (
    ImageValidationError,
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
    description="Detect face, verify liveness & deepfake authenticity, extract 512d ArcFace embedding, and index into FAISS 1:N database.",
)
async def enroll_face(
    user_id: str = Form(..., description="Unique user string identifier"),
    name: str = Form(..., description="Full display name of user"),
    file: UploadFile = File(..., description="Image file containing a single face"),
    extra_metadata: str | None = Form(None, description="Optional JSON string of additional user metadata"),
) -> EnrollResponse:
    t_start = time.perf_counter()

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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # 1. Face Detection
    t_det_start = time.perf_counter()
    detector = get_face_detector()
    detections = detector.detect_and_crop(image_bgr)
    t_det_end = time.perf_counter()
    detection_ms = (t_det_end - t_det_start) * 1000.0

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

    # 2. Passive Anti-Spoofing Liveness Analysis
    t_liv_start = time.perf_counter()
    liveness_detector = get_liveness_detector()
    liveness_res = liveness_detector.predict(face_crop)
    t_liv_end = time.perf_counter()
    liveness_ms = (t_liv_end - t_liv_start) * 1000.0

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

    # 3. Deepfake Detection Analysis
    t_df_start = time.perf_counter()
    deepfake_detector = get_deepfake_detector()
    deepfake_res = deepfake_detector.predict(face_crop)
    t_df_end = time.perf_counter()
    deepfake_ms = (t_df_end - t_df_start) * 1000.0

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

    # 4. Face Embedding
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

    # 5. Vector Database Indexing
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
        "Complete face authentication pipeline: "
        "Face Detection -> Liveness Detection -> Deepfake Detection -> Face Embedding -> FAISS 1:N Recognition -> Final Decision"
    ),
)
async def recognize_face(
    file: UploadFile = File(..., description="Query image file containing face"),
    top_k: int | None = Form(None, description="Number of top candidate matches to return"),
    threshold: float | None = Form(None, description="Cosine similarity score threshold (0.0 - 1.0)"),
) -> RecognizeResponse:
    t_start = time.perf_counter()

    use_top_k = top_k if top_k is not None else settings.top_k
    use_threshold = threshold if threshold is not None else settings.face_match_threshold

    # Validate image file
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file selected for upload.",
        )

    image_bytes = await file.read()

    try:
        image_bgr = load_image_from_bytes(image_bytes)
    except ImageValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("System error reading uploaded image: %s", e, exc_info=True)
        t_total_end = time.perf_counter()
        total_ms = (t_total_end - t_start) * 1000.0
        return RecognizeResponse(
            identity=None,
            similarity_score=0.0,
            liveness_score=0.0,
            deepfake_probability=0.0,
            final_decision="SYSTEM_ERROR",
            total_processing_time=round(total_ms, 2),
            status="SYSTEM_ERROR",
            is_authenticated=False,
            matched_user=None,
            best_similarity=0.0,
            threshold=use_threshold,
            is_live=False,
            liveness_status="UNKNOWN",
            is_deepfake=False,
            deepfake_status="UNKNOWN",
            top_candidates=[],
            detected_faces_count=0,
            timing_ms={"total_ms": round(total_ms, 2)},
        )

    # 1. Face Detection
    t_det_start = time.perf_counter()
    detector = get_face_detector()
    try:
        detections = detector.detect_and_crop(image_bgr)
    except Exception as e:
        logger.error("Face detection system failure: %s", e, exc_info=True)
        t_total_end = time.perf_counter()
        total_ms = (t_total_end - t_start) * 1000.0
        return RecognizeResponse(
            identity=None,
            similarity_score=0.0,
            liveness_score=0.0,
            deepfake_probability=0.0,
            final_decision="SYSTEM_ERROR",
            total_processing_time=round(total_ms, 2),
            status="SYSTEM_ERROR",
            is_authenticated=False,
            matched_user=None,
            best_similarity=0.0,
            threshold=use_threshold,
            is_live=False,
            liveness_status="UNKNOWN",
            is_deepfake=False,
            deepfake_status="UNKNOWN",
            top_candidates=[],
            detected_faces_count=0,
            timing_ms={"total_ms": round(total_ms, 2)},
        )

    t_det_end = time.perf_counter()
    detection_ms = (t_det_end - t_det_start) * 1000.0
    detected_count = len(detections)

    if detected_count == 0:
        t_total_end = time.perf_counter()
        total_ms = (t_total_end - t_start) * 1000.0
        return RecognizeResponse(
            identity=None,
            similarity_score=0.0,
            liveness_score=0.0,
            deepfake_probability=0.0,
            final_decision="NO_FACE",
            total_processing_time=round(total_ms, 2),
            status="NO_FACE",
            is_authenticated=False,
            matched_user=None,
            best_similarity=0.0,
            threshold=use_threshold,
            is_live=False,
            liveness_status="UNKNOWN",
            is_deepfake=False,
            deepfake_status="UNKNOWN",
            top_candidates=[],
            detected_faces_count=0,
            timing_ms={
                "detection_ms": round(detection_ms, 2),
                "liveness_ms": 0.0,
                "deepfake_ms": 0.0,
                "embedding_ms": 0.0,
                "search_ms": 0.0,
                "total_ms": round(total_ms, 2),
            },
        )

    primary_detection = detections[0]
    face_confidence = primary_detection.get("confidence", 1.0)

    # Check for LOW_CONFIDENCE or multiple faces
    if detected_count > 1 or face_confidence < settings.detection_confidence_threshold:
        t_total_end = time.perf_counter()
        total_ms = (t_total_end - t_start) * 1000.0
        return RecognizeResponse(
            identity=None,
            similarity_score=0.0,
            liveness_score=0.0,
            deepfake_probability=0.0,
            final_decision="LOW_CONFIDENCE",
            total_processing_time=round(total_ms, 2),
            status="LOW_CONFIDENCE",
            is_authenticated=False,
            matched_user=None,
            best_similarity=0.0,
            threshold=use_threshold,
            is_live=False,
            liveness_status="UNKNOWN",
            is_deepfake=False,
            deepfake_status="UNKNOWN",
            top_candidates=[],
            detected_faces_count=detected_count,
            timing_ms={
                "detection_ms": round(detection_ms, 2),
                "liveness_ms": 0.0,
                "deepfake_ms": 0.0,
                "embedding_ms": 0.0,
                "search_ms": 0.0,
                "total_ms": round(total_ms, 2),
            },
        )

    primary_face_crop = primary_detection["crop"]

    # 2. Passive Anti-Spoofing Liveness Analysis
    t_liv_start = time.perf_counter()
    liveness_detector = get_liveness_detector()
    try:
        liveness_res = liveness_detector.predict(primary_face_crop)
    except Exception as e:
        logger.error("Liveness detector error: %s", e, exc_info=True)
        t_total_end = time.perf_counter()
        total_ms = (t_total_end - t_start) * 1000.0
        return RecognizeResponse(
            identity=None,
            similarity_score=0.0,
            liveness_score=0.0,
            deepfake_probability=0.0,
            final_decision="SYSTEM_ERROR",
            total_processing_time=round(total_ms, 2),
            status="SYSTEM_ERROR",
            is_authenticated=False,
            matched_user=None,
            best_similarity=0.0,
            threshold=use_threshold,
            is_live=False,
            liveness_status="ERROR",
            is_deepfake=False,
            deepfake_status="UNKNOWN",
            top_candidates=[],
            detected_faces_count=detected_count,
            timing_ms={
                "detection_ms": round(detection_ms, 2),
                "liveness_ms": 0.0,
                "total_ms": round(total_ms, 2),
            },
        )
    t_liv_end = time.perf_counter()
    liveness_ms = (t_liv_end - t_liv_start) * 1000.0

    if settings.enable_liveness_check and not liveness_res["is_live"]:
        t_total_end = time.perf_counter()
        total_ms = (t_total_end - t_start) * 1000.0
        logger.warning(
            "Recognition authentication blocked by anti-spoofing engine (Liveness score: %.4f)",
            liveness_res["liveness_score"],
        )
        return RecognizeResponse(
            identity=None,
            similarity_score=0.0,
            liveness_score=liveness_res["liveness_score"],
            deepfake_probability=0.0,
            final_decision="LIVENESS_FAILED",
            total_processing_time=round(total_ms, 2),
            status="LIVENESS_FAILED",
            is_authenticated=False,
            matched_user=None,
            best_similarity=0.0,
            threshold=use_threshold,
            is_live=False,
            liveness_status="SPOOF",
            is_deepfake=False,
            deepfake_status="UNKNOWN",
            top_candidates=[],
            detected_faces_count=detected_count,
            timing_ms={
                "detection_ms": round(detection_ms, 2),
                "liveness_ms": round(liveness_ms, 2),
                "deepfake_ms": 0.0,
                "embedding_ms": 0.0,
                "search_ms": 0.0,
                "total_ms": round(total_ms, 2),
            },
        )

    # 3. Deepfake Detection Analysis
    t_df_start = time.perf_counter()
    deepfake_detector = get_deepfake_detector()
    try:
        deepfake_res = deepfake_detector.predict(primary_face_crop)
    except Exception as e:
        logger.error("Deepfake detector error: %s", e, exc_info=True)
        t_total_end = time.perf_counter()
        total_ms = (t_total_end - t_start) * 1000.0
        return RecognizeResponse(
            identity=None,
            similarity_score=0.0,
            liveness_score=liveness_res["liveness_score"],
            deepfake_probability=0.0,
            final_decision="SYSTEM_ERROR",
            total_processing_time=round(total_ms, 2),
            status="SYSTEM_ERROR",
            is_authenticated=False,
            matched_user=None,
            best_similarity=0.0,
            threshold=use_threshold,
            is_live=True,
            liveness_status=liveness_res["liveness_status"],
            is_deepfake=False,
            deepfake_status="ERROR",
            top_candidates=[],
            detected_faces_count=detected_count,
            timing_ms={
                "detection_ms": round(detection_ms, 2),
                "liveness_ms": round(liveness_ms, 2),
                "deepfake_ms": 0.0,
                "total_ms": round(total_ms, 2),
            },
        )
    t_df_end = time.perf_counter()
    deepfake_ms = (t_df_end - t_df_start) * 1000.0

    if settings.enable_deepfake_check and deepfake_res["is_deepfake"]:
        t_total_end = time.perf_counter()
        total_ms = (t_total_end - t_start) * 1000.0
        logger.warning(
            "Recognition authentication blocked by deepfake detection engine (Probability: %.4f)",
            deepfake_res["deepfake_probability"],
        )
        return RecognizeResponse(
            identity=None,
            similarity_score=0.0,
            liveness_score=liveness_res["liveness_score"],
            deepfake_probability=deepfake_res["deepfake_probability"],
            final_decision="DEEPFAKE_SUSPECTED",
            total_processing_time=round(total_ms, 2),
            status="DEEPFAKE_SUSPECTED",
            is_authenticated=False,
            matched_user=None,
            best_similarity=0.0,
            threshold=use_threshold,
            is_live=liveness_res["is_live"],
            liveness_status=liveness_res["liveness_status"],
            is_deepfake=True,
            deepfake_status=deepfake_res["deepfake_status"],
            top_candidates=[],
            detected_faces_count=detected_count,
            timing_ms={
                "detection_ms": round(detection_ms, 2),
                "liveness_ms": round(liveness_ms, 2),
                "deepfake_ms": round(deepfake_ms, 2),
                "embedding_ms": 0.0,
                "search_ms": 0.0,
                "total_ms": round(total_ms, 2),
            },
        )

    # 4. Face Embedding
    t_emb_start = time.perf_counter()
    embedder = get_face_embedder()
    try:
        query_vec = embedder.generate_embedding(primary_face_crop)
    except Exception as e:
        logger.error("Embedding extraction failed during recognition: %s", e, exc_info=True)
        t_total_end = time.perf_counter()
        total_ms = (t_total_end - t_start) * 1000.0
        return RecognizeResponse(
            identity=None,
            similarity_score=0.0,
            liveness_score=liveness_res["liveness_score"],
            deepfake_probability=deepfake_res["deepfake_probability"],
            final_decision="SYSTEM_ERROR",
            total_processing_time=round(total_ms, 2),
            status="SYSTEM_ERROR",
            is_authenticated=False,
            matched_user=None,
            best_similarity=0.0,
            threshold=use_threshold,
            is_live=liveness_res["is_live"],
            liveness_status=liveness_res["liveness_status"],
            is_deepfake=deepfake_res["is_deepfake"],
            deepfake_status=deepfake_res["deepfake_status"],
            top_candidates=[],
            detected_faces_count=detected_count,
            timing_ms={
                "detection_ms": round(detection_ms, 2),
                "liveness_ms": round(liveness_ms, 2),
                "deepfake_ms": round(deepfake_ms, 2),
                "embedding_ms": 0.0,
                "total_ms": round(total_ms, 2),
            },
        )
    t_emb_end = time.perf_counter()
    embedding_ms = (t_emb_end - t_emb_start) * 1000.0

    # 5. FAISS 1:N Vector Search
    t_srch_start = time.perf_counter()
    vector_store = get_vector_store()
    try:
        raw_candidates = vector_store.search(
            query_embedding=query_vec,
            top_k=use_top_k,
            threshold=use_threshold,
        )
    except Exception as e:
        logger.error("FAISS vector search failed: %s", e, exc_info=True)
        t_total_end = time.perf_counter()
        total_ms = (t_total_end - t_start) * 1000.0
        return RecognizeResponse(
            identity=None,
            similarity_score=0.0,
            liveness_score=liveness_res["liveness_score"],
            deepfake_probability=deepfake_res["deepfake_probability"],
            final_decision="SYSTEM_ERROR",
            total_processing_time=round(total_ms, 2),
            status="SYSTEM_ERROR",
            is_authenticated=False,
            matched_user=None,
            best_similarity=0.0,
            threshold=use_threshold,
            is_live=liveness_res["is_live"],
            liveness_status=liveness_res["liveness_status"],
            is_deepfake=deepfake_res["is_deepfake"],
            deepfake_status=deepfake_res["deepfake_status"],
            top_candidates=[],
            detected_faces_count=detected_count,
            timing_ms={
                "detection_ms": round(detection_ms, 2),
                "liveness_ms": round(liveness_ms, 2),
                "deepfake_ms": round(deepfake_ms, 2),
                "embedding_ms": round(embedding_ms, 2),
                "search_ms": 0.0,
                "total_ms": round(total_ms, 2),
            },
        )
    t_srch_end = time.perf_counter()
    search_ms = (t_srch_end - t_srch_start) * 1000.0

    t_total_end = time.perf_counter()
    total_ms = (t_total_end - t_start) * 1000.0

    top_candidates = [RecognizeCandidate(**cand) for cand in raw_candidates]

    best_sim = top_candidates[0].similarity if top_candidates else 0.0
    matched_candidate = top_candidates[0] if (top_candidates and top_candidates[0].is_match) else None

    # Determine final decision
    if matched_candidate is not None:
        final_decision = "AUTHENTICATED"
        is_auth = True
        identity = matched_candidate.name
    else:
        final_decision = "UNKNOWN_USER"
        is_auth = False
        identity = None

    return RecognizeResponse(
        identity=identity,
        similarity_score=round(best_sim, 4),
        liveness_score=liveness_res["liveness_score"],
        deepfake_probability=deepfake_res["deepfake_probability"],
        final_decision=final_decision,
        total_processing_time=round(total_ms, 2),
        status=final_decision,
        is_authenticated=is_auth,
        matched_user=matched_candidate,
        best_similarity=round(best_sim, 4),
        threshold=use_threshold,
        is_live=liveness_res["is_live"],
        liveness_status=liveness_res["liveness_status"],
        is_deepfake=deepfake_res["is_deepfake"],
        deepfake_status=deepfake_res["deepfake_status"],
        top_candidates=top_candidates,
        detected_faces_count=detected_count,
        timing_ms={
            "detection_ms": round(detection_ms, 2),
            "liveness_ms": round(liveness_ms, 2),
            "deepfake_ms": round(deepfake_ms, 2),
            "embedding_ms": round(embedding_ms, 2),
            "search_ms": round(search_ms, 2),
            "total_ms": round(total_ms, 2),
        },
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
