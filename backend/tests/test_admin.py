"""
TRUE FACE AI — Unit & Integration Tests for Admin, Analytics, Health & Threshold Config
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_admin_login_success():
    res = client.post(
        "/api/v1/admin/login",
        json={"username": "admin", "password": "admin123"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["username"] == "admin"


def test_admin_login_failure():
    res = client.post(
        "/api/v1/admin/login",
        json={"username": "admin", "password": "wrong_password"},
    )
    assert res.status_code == 401


def test_analytics_overview():
    res = client.get("/api/v1/analytics/overview")
    assert res.status_code == 200
    data = res.json()
    assert "total_enrolled_users" in data
    assert "total_verifications" in data
    assert "success_rate_percent" in data


def test_detailed_health_endpoint():
    res = client.get("/api/v1/health/detailed")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] in ["ONLINE", "DEGRADED", "OFFLINE"]
    assert "face_detection_model_status" in data
    assert "liveness_model_status" in data
    assert "deepfake_model_status" in data


def test_threshold_config_get_and_put():
    # Login as admin to get token
    login_res = client.post(
        "/api/v1/admin/login",
        json={"username": "admin", "password": "admin123"},
    )
    token = login_res.json()["access_token"]

    # GET thresholds
    get_res = client.get("/api/v1/config/thresholds")
    assert get_res.status_code == 200
    data = get_res.json()
    assert "face_match_threshold" in data

    # PUT thresholds with admin token
    put_res = client.put(
        "/api/v1/config/thresholds",
        json={
            "face_match_threshold": 0.65,
            "liveness_threshold": 0.75,
            "deepfake_threshold": 0.55,
            "blur_threshold": 35.0,
            "min_face_size": 45,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert put_res.status_code == 200
    updated = put_res.json()
    assert updated["face_match_threshold"] == 0.65
    assert updated["liveness_threshold"] == 0.75

    # Restore default threshold values for other tests
    client.put(
        "/api/v1/config/thresholds",
        json={
            "face_match_threshold": 0.60,
            "liveness_threshold": 0.70,
            "deepfake_threshold": 0.50,
            "blur_threshold": 30.0,
            "min_face_size": 40,
        },
        headers={"Authorization": f"Bearer {token}"},
    )



def test_threshold_config_put_unauthorized():
    put_res = client.put(
        "/api/v1/config/thresholds",
        json={
            "face_match_threshold": 0.65,
            "liveness_threshold": 0.75,
            "deepfake_threshold": 0.55,
            "blur_threshold": 35.0,
            "min_face_size": 45,
        },
    )
    assert put_res.status_code == 401
