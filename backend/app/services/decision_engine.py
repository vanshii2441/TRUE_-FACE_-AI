"""
TRUE FACE AI — Centralized Authentication Decision Engine

Combines:
  - Face Detection & Count
  - Face Quality & Sharpness (Blur)
  - Passive Anti-Spoofing Liveness Score
  - Deepfake Synthetic Detection Score
  - Vector Store 1:N Identity Similarity Score

Produces explainable, deterministic authentication decisions with human-readable explanations.
All threshold parameters are fully configurable via app settings.
"""

import logging
from typing import Any
from pydantic import BaseModel, Field

from app.config import settings

logger = logging.getLogger(__name__)


class DecisionOutcome(BaseModel):
    """Encapsulates the final decision and explanatory diagnostics."""

    final_decision: str = Field(
        ...,
        description=(
            "Final pipeline decision: 'AUTHENTICATED', 'NO_FACE', 'MULTIPLE_FACES', "
            "'POOR_QUALITY', 'LIVENESS_FAILED', 'DEEPFAKE_SUSPECTED', 'EMPTY_DATABASE', "
            "'UNKNOWN_PERSON', or 'SYSTEM_ERROR'"
        ),
    )
    status: str = Field(..., description="Decision status string (matches final_decision)")
    is_authenticated: bool = Field(..., description="True if identity is fully verified")
    identity: str | None = Field(default=None, description="Verified display name or user ID")
    explanation: str = Field(..., description="Detailed, explainable decision message for UI/audit logs")
    reasons: list[str] = Field(default_factory=list, description="List of decision justification reasons")
    quality_score: float = Field(default=1.0, description="Evaluated face image quality score (0.0 - 1.0)")
    blur_score: float = Field(default=100.0, description="Laplacian variance sharpness score")
    is_quality_passed: bool = Field(default=True, description="True if image quality met thresholds")
    similarity_score: float = Field(default=0.0, description="Highest cosine similarity score among database faces")
    liveness_score: float = Field(default=1.0, description="Liveness probability (0.0 to 1.0)")
    deepfake_probability: float = Field(default=0.0, description="Deepfake probability (0.0 to 1.0)")


class AuthenticationDecisionEngine:
    """
    Centralized Authentication Decision Layer for TRUE FACE AI.

    Evaluates inputs against configurable system settings and produces
    transparent, audit-ready authentication decisions.
    """

    def __init__(self, custom_settings: Any = None) -> None:
        """Initialize with default or custom settings override."""
        self.cfg = custom_settings if custom_settings is not None else settings

    def evaluate(
        self,
        detected_faces_count: int,
        quality_res: dict[str, Any] | None = None,
        liveness_res: dict[str, Any] | None = None,
        deepfake_res: dict[str, Any] | None = None,
        match_candidate: Any = None,
        best_similarity: float = 0.0,
        total_enrolled: int = 0,
        system_error: str | None = None,
    ) -> DecisionOutcome:
        """
        Evaluate full multi-layer biometric pipeline outputs.

        Args:
            detected_faces_count: Number of faces detected in image.
            quality_res: Output from assess_face_quality (optional).
            liveness_res: Output from LivenessDetector.predict (optional).
            deepfake_res: Output from DeepfakeDetector.predict (optional).
            match_candidate: Matched RecognizeCandidate or dict (optional).
            best_similarity: Top cosine similarity score.
            total_enrolled: Number of enrolled faces in FAISS index.
            system_error: Error message string if an internal error occurred.

        Returns:
            DecisionOutcome object containing decision, scores, and human-readable explanation.
        """
        # 1. System/Internal Failure Case
        if system_error:
            logger.error("Decision Engine: System error encountered: %s", system_error)
            return DecisionOutcome(
                final_decision="SYSTEM_ERROR",
                status="SYSTEM_ERROR",
                is_authenticated=False,
                identity=None,
                explanation=f"Authentication failed due to a system error: {system_error}",
                reasons=[f"Internal failure: {system_error}"],
            )

        # 2. Face Detection Count Checks
        if detected_faces_count == 0:
            logger.info("Decision Engine: No face detected in query image.")
            return DecisionOutcome(
                final_decision="NO_FACE",
                status="NO_FACE",
                is_authenticated=False,
                identity=None,
                explanation="Authentication failed: No human face was detected in the provided image.",
                reasons=["MTCNN face detector found 0 faces matching confidence requirements."],
                quality_score=0.0,
                blur_score=0.0,
                is_quality_passed=False,
            )

        if detected_faces_count > 1:
            logger.info("Decision Engine: Multiple faces (%d) detected.", detected_faces_count)
            return DecisionOutcome(
                final_decision="MULTIPLE_FACES",
                status="MULTIPLE_FACES",
                is_authenticated=False,
                identity=None,
                explanation=(
                    f"Authentication failed: Multiple faces ({detected_faces_count}) were detected. "
                    "Verification requires an image containing exactly one face."
                ),
                reasons=[f"Detected {detected_faces_count} faces in single input frame."],
                quality_score=quality_res.get("quality_score", 0.5) if quality_res else 0.5,
                blur_score=quality_res.get("blur_score", 0.0) if quality_res else 0.0,
                is_quality_passed=False,
            )

        # Extract quality metrics if present
        q_score = quality_res.get("quality_score", 1.0) if quality_res else 1.0
        b_score = quality_res.get("blur_score", 100.0) if quality_res else 100.0
        q_passed = quality_res.get("is_quality_passed", True) if quality_res else True

        # 3. Face Image Quality Check
        if self.cfg.enable_quality_check and quality_res and not q_passed:
            q_reason = quality_res.get("reason", "Face image failed quality checks.")
            logger.warning("Decision Engine: Quality check failed (%s)", q_reason)
            return DecisionOutcome(
                final_decision="POOR_QUALITY",
                status="POOR_QUALITY",
                is_authenticated=False,
                identity=None,
                explanation=f"Authentication failed because face image quality was below threshold: {q_reason}",
                reasons=[q_reason],
                quality_score=q_score,
                blur_score=b_score,
                is_quality_passed=False,
            )

        # Extract liveness metrics
        liv_score = liveness_res.get("liveness_score", 1.0) if liveness_res else 1.0
        liv_thresh = self.cfg.liveness_threshold
        is_live = (liv_score >= liv_thresh) and (liveness_res.get("is_live", True) if liveness_res else True)

        # 4. Anti-Spoofing Liveness Check
        if self.cfg.enable_liveness_check and liveness_res:
            if liveness_res.get("liveness_status") == "UNAVAILABLE":
                logger.warning("Decision Engine: Liveness model is unavailable.")
                return DecisionOutcome(
                    final_decision="MODEL_UNAVAILABLE",
                    status="MODEL_UNAVAILABLE",
                    is_authenticated=False,
                    identity=None,
                    explanation="Authentication failed: Liveness anti-spoofing model is unavailable (weights checkpoint missing).",
                    reasons=[liveness_res.get("reason", "LivenessNet model weights not loaded.")],
                    quality_score=q_score,
                    blur_score=b_score,
                    is_quality_passed=q_passed,
                    liveness_score=0.0,
                )
            if not is_live:
                logger.warning(
                    "Decision Engine: Liveness failed (Score: %.4f < Threshold: %.4f)",
                    liv_score,
                    liv_thresh,
                )
                return DecisionOutcome(
                    final_decision="LIVENESS_FAILED",
                    status="LIVENESS_FAILED",
                    is_authenticated=False,
                    identity=None,
                    explanation=(
                        f"Authentication failed because liveness score ({liv_score * 100:.1f}%) "
                        f"was below required threshold ({liv_thresh * 100:.1f}%). Presentation attack suspected."
                    ),
                    reasons=[f"Liveness anti-spoofing score {liv_score:.4f} failed cutoff threshold {liv_thresh:.4f}."],
                    quality_score=q_score,
                    blur_score=b_score,
                    is_quality_passed=q_passed,
                    liveness_score=liv_score,
                )

        # Extract deepfake metrics
        df_prob = deepfake_res.get("deepfake_probability", 0.0) if deepfake_res else 0.0
        df_thresh = self.cfg.deepfake_threshold
        is_deepfake = (df_prob >= df_thresh) or (deepfake_res.get("is_deepfake", False) if deepfake_res else False)

        # 5. Deepfake Synthetic Detection Check
        if self.cfg.enable_deepfake_check and deepfake_res:
            if deepfake_res.get("deepfake_status") == "UNAVAILABLE":
                logger.warning("Decision Engine: Deepfake model is unavailable.")
                return DecisionOutcome(
                    final_decision="MODEL_UNAVAILABLE",
                    status="MODEL_UNAVAILABLE",
                    is_authenticated=False,
                    identity=None,
                    explanation="Authentication failed: Deepfake detection model is unavailable (weights checkpoint missing).",
                    reasons=[deepfake_res.get("reason", "DeepfakeNet model weights not loaded.")],
                    quality_score=q_score,
                    blur_score=b_score,
                    is_quality_passed=q_passed,
                    liveness_score=liv_score,
                    deepfake_probability=0.0,
                )
            if is_deepfake:
                logger.warning(
                    "Decision Engine: Deepfake detected (Prob: %.4f >= Threshold: %.4f)",
                    df_prob,
                    df_thresh,
                )
                return DecisionOutcome(
                    final_decision="DEEPFAKE_SUSPECTED",
                    status="DEEPFAKE_SUSPECTED",
                    is_authenticated=False,
                    identity=None,
                    explanation=(
                        f"Authentication failed because deepfake probability ({df_prob * 100:.1f}%) "
                        f"exceeded threshold ({df_thresh * 100:.1f}%). AI synthetic face manipulation detected."
                    ),
                    reasons=[f"DeepfakeNet flagged face image with deepfake probability {df_prob:.4f} (threshold {df_thresh:.4f})."],
                    quality_score=q_score,
                    blur_score=b_score,
                    is_quality_passed=q_passed,
                    liveness_score=liv_score,
                    deepfake_probability=df_prob,
                )

        # 6. Empty Vector Store Check
        if total_enrolled == 0:
            logger.info("Decision Engine: FAISS vector database is empty.")
            return DecisionOutcome(
                final_decision="EMPTY_DATABASE",
                status="EMPTY_DATABASE",
                is_authenticated=False,
                identity=None,
                explanation="Authentication failed: No users are currently enrolled in the face database.",
                reasons=["Vector store index contains 0 registered face embeddings."],
                quality_score=q_score,
                blur_score=b_score,
                is_quality_passed=q_passed,
                liveness_score=liv_score,
                deepfake_probability=df_prob,
                similarity_score=0.0,
            )

        # Extract candidate details
        match_thresh = self.cfg.face_match_threshold
        candidate_name = None
        if match_candidate:
            if isinstance(match_candidate, dict):
                candidate_name = match_candidate.get("name")
            else:
                candidate_name = getattr(match_candidate, "name", None)

        is_match = (match_candidate is not None) and (best_similarity >= match_thresh)

        # 7. Unmatched / Unknown Person Check
        if not is_match:
            logger.info(
                "Decision Engine: Identity match failed (Best similarity: %.4f < Threshold: %.4f)",
                best_similarity,
                match_thresh,
            )
            return DecisionOutcome(
                final_decision="UNKNOWN_PERSON",
                status="UNKNOWN_PERSON",
                is_authenticated=False,
                identity=None,
                explanation=(
                    f"Authentication failed: Face similarity ({best_similarity * 100:.1f}%) "
                    f"was below required match threshold ({match_thresh * 100:.1f}%). Unrecognized person."
                ),
                reasons=[
                    f"Closest candidate similarity {best_similarity:.4f} did not reach threshold {match_thresh:.4f}."
                ],
                quality_score=q_score,
                blur_score=b_score,
                is_quality_passed=q_passed,
                liveness_score=liv_score,
                deepfake_probability=df_prob,
                similarity_score=round(best_similarity, 4),
            )

        # 8. Successful Authentication
        logger.info(
            "Decision Engine: User '%s' AUTHENTICATED (Similarity: %.4f, Liveness: %.4f, Deepfake: %.4f)",
            candidate_name,
            best_similarity,
            liv_score,
            df_prob,
        )
        return DecisionOutcome(
            final_decision="AUTHENTICATED",
            status="AUTHENTICATED",
            is_authenticated=True,
            identity=candidate_name,
            explanation=f"Authentication successful for '{candidate_name}' with {best_similarity * 100:.1f}% face similarity.",
            reasons=[
                "Verified face quality, liveness anti-spoofing, deepfake authenticity, and 1:N identity match."
            ],
            quality_score=q_score,
            blur_score=b_score,
            is_quality_passed=q_passed,
            similarity_score=round(best_similarity, 4),
            liveness_score=liv_score,
            deepfake_probability=df_prob,
        )


# Singleton instance
_decision_engine_instance: AuthenticationDecisionEngine | None = None


def get_decision_engine() -> AuthenticationDecisionEngine:
    """Get or create singleton decision engine instance."""
    global _decision_engine_instance
    if _decision_engine_instance is None:
        _decision_engine_instance = AuthenticationDecisionEngine()
    return _decision_engine_instance
