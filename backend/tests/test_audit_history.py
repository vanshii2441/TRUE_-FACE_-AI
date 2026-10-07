"""
TRUE FACE AI — Unit & Integration Tests for Verification Audit History
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.audit_store import AuditStore

client = TestClient(app)


@pytest.fixture
def tmp_audit_store(tmp_path):
    log_file = tmp_path / "audit_history.json"
    return AuditStore(storage_path=str(log_file))


def test_audit_store_log_and_retrieve(tmp_audit_store):
    tmp_audit_store.log_verification(
        final_decision="AUTHENTICATED",
        is_authenticated=True,
        identity="Alice",
        user_id="USR001",
        similarity_score=0.92,
        liveness_score=0.98,
        liveness_status="REAL",
        deepfake_probability=0.01,
        deepfake_status="REAL",
        quality_score=0.99,
        explanation="Authenticated successfully",
    )

    history = tmp_audit_store.get_history()
    assert len(history) == 1
    assert history[0]["identity"] == "Alice"
    assert history[0]["final_decision"] == "AUTHENTICATED"
    assert history[0]["is_authenticated"] is True


def test_audit_history_api_endpoints():
    # Fetch history via REST API
    res = client.get("/api/v1/history")
    assert res.status_code == 200
    data = res.json()
    assert "total_logs" in data
    assert "history" in data
    assert isinstance(data["history"], list)
