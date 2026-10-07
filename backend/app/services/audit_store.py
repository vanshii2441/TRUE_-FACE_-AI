"""
TRUE FACE AI — Persistent Audit History Store Service

Stores and manages verification attempt audit logs in JSON storage.
Retains audit records containing timestamps, decisions, user matches,
liveness scores, and deepfake analysis for security auditing.
"""

import json
import logging
import os
import threading
import uuid
from datetime import datetime, timezone
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)

AUDIT_HISTORY_PATH = "data/audit_history.json"



class AuditStore:
    """
    Thread-safe persistent audit log store for verification history.
    """

    def __init__(self, storage_path: str | None = None) -> None:
        self.storage_path = storage_path or AUDIT_HISTORY_PATH
        self._lock = threading.RLock()
        self._logs: list[dict[str, Any]] = []
        self.load()

    def load(self) -> None:
        """Load persistent logs from JSON storage."""
        with self._lock:
            if os.path.exists(self.storage_path):
                try:
                    with open(self.storage_path, "r", encoding="utf-8") as f:
                        self._logs = json.load(f)
                    logger.info("AuditStore loaded %d records from %s", len(self._logs), self.storage_path)
                except Exception as e:
                    logger.error("Failed to load audit logs: %s", e, exc_info=True)
                    self._logs = []
            else:
                self._logs = []

    def save(self) -> None:
        """Save logs to disk."""
        with self._lock:
            try:
                os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
                with open(self.storage_path, "w", encoding="utf-8") as f:
                    json.dump(self._logs, f, indent=2)
            except Exception as e:
                logger.error("Failed to save audit history: %s", e, exc_info=True)

    def log_verification(
        self,
        final_decision: str,
        is_authenticated: bool,
        identity: str | None,
        user_id: str | None,
        similarity_score: float,
        liveness_score: float,
        liveness_status: str,
        deepfake_probability: float,
        deepfake_status: str,
        quality_score: float,
        explanation: str,
        timing_ms: dict[str, float] | None = None,
    ) -> dict[str, Any]:
        """
        Record a verification attempt into the audit log.
        """
        record = {
            "id": str(uuid.uuid4())[:8],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "final_decision": final_decision,
            "status": final_decision,
            "is_authenticated": is_authenticated,
            "identity": identity or "Unauthenticated",
            "user_id": user_id,
            "similarity_score": round(similarity_score, 4),
            "liveness_score": round(liveness_score, 4),
            "liveness_status": liveness_status,
            "deepfake_probability": round(deepfake_probability, 4),
            "deepfake_status": deepfake_status,
            "quality_score": round(quality_score, 4),
            "explanation": explanation,
            "timing_ms": timing_ms or {},
        }

        with self._lock:
            self._logs.insert(0, record)  # Newest first
            # Keep max 500 audit records
            if len(self._logs) > 500:
                self._logs = self._logs[:500]
            self.save()

        logger.info("AuditStore recorded verification attempt ID %s (decision: %s)", record["id"], final_decision)
        return record

    def get_history(self, limit: int = 50) -> list[dict[str, Any]]:
        """Retrieve recent audit logs."""
        with self._lock:
            return self._logs[:limit]

    def clear_history(self) -> None:
        """Clear all audit history."""
        with self._lock:
            self._logs = []
            if os.path.exists(self.storage_path):
                try:
                    os.remove(self.storage_path)
                except OSError:
                    pass
            logger.info("AuditStore cleared all records.")


_audit_store_instance: AuditStore | None = None


def get_audit_store() -> AuditStore:
    """Get singleton AuditStore instance."""
    global _audit_store_instance
    if _audit_store_instance is None:
        _audit_store_instance = AuditStore()
    return _audit_store_instance
