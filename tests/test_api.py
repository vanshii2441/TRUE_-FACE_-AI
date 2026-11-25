import io

import cv2
import numpy as np
import pytest

from conftest import data_url


# ------------------------------------------------------------------ pages
@pytest.mark.parametrize("path", ["/", "/verify", "/register", "/users", "/dashboard"])
def test_pages_render(client, path):
    res = client.get(path)
    assert res.status_code == 200
    assert b"TRUE FACE AI" in res.data
    assert b'name="viewport"' in res.data          # responsive meta tag


def test_unknown_page_is_404_html(client):
    res = client.get("/nope")
    assert res.status_code == 404
    assert b"does not exist" in res.data


def test_unknown_api_is_404_json(client):
    res = client.get("/api/nope")
    assert res.status_code == 404 and "error" in res.json


def test_static_assets_served(client):
    for p in ("css/style.css", "js/common.js", "js/camera.js", "js/verify.js",
              "js/register.js", "js/users.js", "js/dashboard.js", "img/favicon.svg"):
        assert client.get(f"/static/{p}").status_code == 200, p


def test_security_headers(client):
    res = client.get("/")
    assert res.headers["X-Content-Type-Options"] == "nosniff"
    assert res.headers["X-Frame-Options"] == "DENY"
    assert "camera=(self)" in res.headers["Permissions-Policy"]


# ------------------------------------------------------------------ health
def test_health_reports_models(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    body = res.json
    assert body["status"] == "ok"
    assert all(body["models"].values())


# --------------------------------------------------------------- enrolment
def test_enroll_requires_valid_name(client, portrait):
    res = client.post("/api/enroll", json={"name": "x", "images": [data_url(portrait)] * 3})
    assert res.status_code == 400


def test_enroll_rejects_bad_email(client, portrait):
    res = client.post("/api/enroll", json={"name": "Valid Name", "email": "nope",
                                           "images": [data_url(portrait)] * 3})
    assert res.status_code == 400


def test_enroll_needs_minimum_photos(client, portrait):
    res = client.post("/api/enroll", json={"name": "Valid Name", "images": [data_url(portrait)] * 2})
    assert res.status_code == 422
    assert "At least 3" in res.json["error"]


def test_enroll_without_face_gives_reasons(client):
    blank = np.full((300, 300, 3), 128, np.uint8)
    res = client.post("/api/enroll", json={"name": "Valid Name", "images": [data_url(blank)] * 3})
    assert res.status_code == 422
    assert len(res.json["problems"]) == 3


def test_enroll_and_list_and_delete(client, enrolled):
    users = client.get("/api/users").json["users"]
    assert [u["name"] for u in users] == ["Eileen Collins"]
    assert users[0]["samples"] == 4
    assert client.delete(f"/api/users/{enrolled['id']}").status_code == 200
    assert client.get("/api/users").json["users"] == []
    assert client.delete(f"/api/users/{enrolled['id']}").status_code == 404


def test_enroll_via_multipart_upload(client, portrait, vary):
    files = [(io.BytesIO(cv2.imencode(".jpg", vary(portrait))[1].tobytes()), f"p{i}.jpg") for i in range(3)]
    res = client.post("/api/enroll", data={"name": "Upload User", "images": files},
                      content_type="multipart/form-data")
    assert res.status_code == 201


def test_names_are_returned_as_data_not_markup(client, portrait, vary):
    res = client.post("/api/enroll", json={"name": "Ann <b>Lee</b>", "images": [data_url(vary(portrait))] * 3})
    assert res.status_code == 400       # angle brackets are not allowed in names


# ------------------------------------------------------------ verification
def test_verify_registered_person(client, enrolled, portrait, vary):
    res = client.post("/api/verify", json={"image": data_url(vary(portrait))}).json
    assert res["decision"] == "verified"
    assert res["identity"]["name"] == "Eileen Collins"
    assert [s["id"] for s in res["steps"]] == ["detect", "facecheck", "liveness", "deepfake", "identity"]
    assert res["latency_ms"] < 5000


def test_verify_with_no_registered_users(client, portrait):
    res = client.post("/api/verify", json={"image": data_url(portrait)}).json
    assert res["decision"] == "unknown"
    assert "enrolled" in res["steps"][-1]["detail"]


def test_verify_blank_image_has_no_face(client):
    res = client.post("/api/verify", json={"image": data_url(np.full((300, 300, 3), 128, np.uint8))}).json
    assert res["decision"] == "no_face"


def test_verify_rejects_print_like_photo(client, enrolled, portrait):
    flat = (portrait.astype(np.float32) - 128) * 0.6 + 150
    flat = np.clip(cv2.GaussianBlur(flat, (0, 0), 2), 0, 255).astype(np.uint8)
    res = client.post("/api/verify", json={"image": data_url(flat)}).json
    assert res["decision"] == "rejected_spoof"


def test_verify_rejects_screen_like_photo(client, enrolled, portrait):
    h, w = portrait.shape[:2]
    yy, xx = np.indices((h, w))
    scr = 255 * (portrait.astype(np.float32) / 255) ** 0.7
    scr += (np.sin(0.6 * xx + 0.4 * yy) * 10)[..., None]
    scr[::3] *= 0.9
    scr += (np.clip(1 - np.abs((xx + yy) / (h + w) - 0.5) * 3, 0, 1) * 60)[..., None]
    scr = np.clip(cv2.GaussianBlur(scr, (0, 0), 1.5), 0, 255).astype(np.uint8)
    res = client.post("/api/verify", json={"image": data_url(scr)}).json
    assert res["decision"] == "rejected_spoof"


def test_verify_does_not_accept_unregistered_faces(client, enrolled):
    lfw = np.load("backend/assets/lfw_subset.npy")[:100]
    accepted = 0
    for i in range(0, 100, 10):
        big = cv2.resize((lfw[i] * 255).astype(np.uint8), (220, 220), interpolation=cv2.INTER_CUBIC)
        canvas = np.full((400, 400), 120, np.uint8)
        canvas[90:310, 90:310] = big
        res = client.post("/api/verify", json={"image": data_url(cv2.cvtColor(canvas, cv2.COLOR_GRAY2BGR))}).json
        accepted += res["decision"] == "verified"
    assert accepted == 0


def test_verify_after_delete_no_longer_matches(client, enrolled, portrait, vary):
    client.delete(f"/api/users/{enrolled['id']}")
    res = client.post("/api/verify", json={"image": data_url(vary(portrait))}).json
    assert res["decision"] == "unknown"


# ---------------------------------------------------------- input handling
@pytest.mark.parametrize("payload", [{}, {"image": ""}, {"image": "data:image/png;base64,AAAA"},
                                      {"image": "not an image"}])
def test_verify_bad_input_returns_clear_400(client, payload):
    res = client.post("/api/verify", json=payload)
    assert res.status_code == 400
    assert res.json["error"]


def test_verify_rejects_tiny_image(client):
    res = client.post("/api/verify", json={"image": data_url(np.zeros((20, 20, 3), np.uint8))})
    assert res.status_code == 400 and "too small" in res.json["error"]


def test_oversized_body_is_413(client):
    res = client.post("/api/verify", data=b"0" * (13 * 1024 * 1024), content_type="application/octet-stream")
    assert res.status_code == 413


# ---------------------------------------------------------------- dashboard
def test_stats_reflect_activity(client, enrolled, portrait, vary):
    client.post("/api/verify", json={"image": data_url(vary(portrait))})
    client.post("/api/verify", json={"image": data_url(np.full((300, 300, 3), 128, np.uint8))})
    body = client.get("/api/stats").json
    assert body["users"] == 1
    assert body["stats"]["total_verifications"] == 2
    assert body["stats"]["by_decision"]["verified"] == 1
    assert body["stats"]["by_decision"]["no_face"] == 1
    assert len(body["stats"]["per_day"]) == 7
    assert body["metrics"]["tasks"]["liveness"]["accuracy"] > 0.8
    assert any(log["event"] == "enroll" for log in body["logs"])
