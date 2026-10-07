"""
TRUE FACE AI — System Health Event Store
Maintains an in-memory audit log of system health events and model status changes.
"""

import threading
from datetime import datetime, timezone
from typing import Any


class HealthEventStore:
    """In-memory ring buffer of system health and model events."""

    def __init__(self, max_events: int = 50) -> None:
        self.max_events = max_events
        self._events: list[dict[str, Any]] = []
        self._lock = threading.RLock()

        # Seed initial system startup events
        self.add_event(
            severity="info",
            component="system",
            message="TRUE FACE AI backend service initialized",
            details="FastAPI, FAISS index, and PyTorch model pipeline ready",
        )

    def add_event(self, severity: str, component: str, message: str, details: str | None = None) -> dict[str, Any]:
        """
        Record a health event.

        Args:
            severity: "info", "success", "warning", or "error"
            component: "api", "faiss", "face_detection", "face_embedding", "liveness", "deepfake", "system"
            message: Short event description
            details: Additional context
        """
        with self._lock:
            event = {
                "id": len(self._events) + 1,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "severity": severity,
                "component": component,
                "message": message,
                "details": details or "",
            }
            self._events.insert(0, event)
            if len(self._events) > self.max_events:
                self._events = self._events[:self.max_events]
            return event

    def get_events(self, limit: int = 20) -> list[dict[str, Any]]:
        """Retrieve recent health events."""
        with self._lock:
            return list(self._events[:limit])


# Singleton instance
_health_event_store_instance: HealthEventStore | None = None


def get_health_event_store() -> HealthEventStore:
    """Get or create singleton HealthEventStore instance."""
    global _health_event_store_instance
    if _health_event_store_instance is None:
        _health_event_store_instance = HealthEventStore()
    return _health_event_store_instance
