import base64
import sys
from pathlib import Path

import cv2
import numpy as np
import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app import create_app  # noqa: E402


def data_url(img: np.ndarray) -> str:
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return "data:image/jpeg;base64," + base64.b64encode(buf).decode()


@pytest.fixture(scope="session")
def portrait():
    """A real face photograph (scikit-image sample image) in BGR."""
    from skimage import data
    return cv2.cvtColor(data.astronaut(), cv2.COLOR_RGB2BGR)


@pytest.fixture()
def app(tmp_path):
    return create_app({"TESTING": True, "INSTANCE_DIR": tmp_path})


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def vary():
    rng = np.random.default_rng(11)

    def _vary(img):
        h, w = img.shape[:2]
        out = img.astype(np.float32) * rng.uniform(0.85, 1.15) + rng.uniform(-15, 15)
        m = cv2.getRotationMatrix2D((w / 2, h / 2), rng.uniform(-4, 4), rng.uniform(0.96, 1.04))
        out = cv2.warpAffine(out, m, (w, h), borderMode=cv2.BORDER_REFLECT)
        return np.clip(out + rng.normal(0, 2, out.shape), 0, 255).astype(np.uint8)

    return _vary


@pytest.fixture()
def enrolled(client, portrait, vary):
    res = client.post("/api/enroll", json={
        "name": "Eileen Collins", "email": "eileen@example.org", "department": "Flight",
        "images": [data_url(vary(portrait)) for _ in range(4)]})
    assert res.status_code == 201, res.json
    return res.json["user"]
