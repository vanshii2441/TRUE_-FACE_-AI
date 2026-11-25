import json
import os
import re
from pathlib import Path
from typing import Optional

from flask import Flask, jsonify, render_template, request

from backend.db import Database
from backend.pipeline import Pipeline
from backend.utils import ImageError, decode_data_url, decode_image
from config import Config


NAME_RE = re.compile(r"^[\w .,'-]{2,60}$", re.UNICODE)
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def create_app(overrides: Optional[dict] = None) -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    if overrides:
        app.config.update(overrides)

    for key in ("INSTANCE_DIR", "DATA_DIR", "MODELS_DIR"):
        app.config[key] = Path(app.config[key])

    cfg = _ConfigView(app.config)
    cfg.INSTANCE_DIR.mkdir(parents=True, exist_ok=True)

    db = Database(cfg.INSTANCE_DIR / "trueface.db")
    pipeline = Pipeline(cfg, db)

    app.extensions["trueface"] = {
        "db": db,
        "pipeline": pipeline
    }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def read_images(max_count: int):
        """Accept images as JSON data URLs or multipart files."""
        side = app.config["MAX_IMAGE_SIDE"]
        images = []

        if request.files:
            files = request.files.getlist("images") + request.files.getlist("image")

            for f in files[:max_count]:
                images.append(decode_image(f.read(), side))

        else:
            body = request.get_json(silent=True) or {}
            items = body.get("images") or (
                [body["image"]] if body.get("image") else []
            )

            for item in items[:max_count]:
                images.append(decode_data_url(item, side))

        if not images:
            raise ImageError("No image was sent.")

        return images

    def form_value(key: str) -> str:
        if request.is_json:
            return str(
                (request.get_json(silent=True) or {}).get(key, "") or ""
            ).strip()

        return str(request.form.get(key, "") or "").strip()

    # ------------------------------------------------------------------
    # Pages
    # ------------------------------------------------------------------

    @app.get("/")
    def home():
        return render_template("index.html", page="home")

    @app.get("/verify")
    def verify_page():
        return render_template("verify.html", page="verify")

    @app.get("/register")
    def register_page():
        return render_template(
            "register.html",
            page="register",
            min_images=app.config["MIN_ENROLL_IMAGES"]
        )

    @app.get("/users")
    def users_page():
        return render_template("users.html", page="users")

    @app.get("/dashboard")
    def dashboard_page():
        return render_template("dashboard.html", page="dashboard")

    # New monitoring pages

    @app.get("/audit-logs")
    def audit_logs_page():
        return render_template("audit_logs.html", page="audit-logs")

    @app.get("/threat-monitor")
    def threat_monitor_page():
        return render_template("threat_monitor.html", page="threat-monitor")

    @app.get("/model-analytics")
    def model_analytics_page():
        return render_template("model_analytics.html", page="model-analytics")

    @app.get("/system-status")
    def system_status_page():
        return render_template("system_status.html", page="system-status")

    # ------------------------------------------------------------------
    # API
    # ------------------------------------------------------------------

    @app.get("/api/health")
    def health():
        ok = pipeline.models_ready()

        return jsonify({
            "status": "ok" if ok else "degraded",
            "models": {
                "facecheck": pipeline.face_check.loaded,
                "liveness": pipeline.liveness.loaded,
                "deepfake": pipeline.deepfake.loaded
            },
            "detector": "lbp-cascade",
            "recognizer": "lbph",
            "users": db.count_users(),
            "enforce_liveness": cfg.ENFORCE_LIVENESS,
            "enforce_deepfake": cfg.ENFORCE_DEEPFAKE
        }), 200 if ok else 503

    @app.post("/api/verify")
    def api_verify():
        if not pipeline.models_ready():
            return jsonify(
                error="Models are not trained. Run: python scripts/train_all.py"
            ), 503

        img = read_images(1)[0]
        return jsonify(pipeline.verify(img))

    @app.post("/api/enroll")
    def api_enroll():
        name = form_value("name")
        email = form_value("email")
        dept = form_value("department")

        if not NAME_RE.match(name):
            return jsonify(
                error="Enter a name of 2 to 60 characters."
            ), 400

        if email and not EMAIL_RE.match(email):
            return jsonify(
                error="Enter a valid email address or leave it blank."
            ), 400

        if len(dept) > 60:
            return jsonify(
                error="Department must be 60 characters or fewer."
            ), 400

        images = read_images(app.config["MAX_ENROLL_IMAGES"])
        crops, problems = pipeline.enroll_crops(images)

        need = app.config["MIN_ENROLL_IMAGES"]

        if len(crops) < need:
            return jsonify(
                error=f"{len(crops)} usable photo(s). At least {need} are needed.",
                problems=problems
            ), 422

        user_id = db.add_user(name, email or None, dept or None, len(crops))
        pipeline.recognizer.save_samples(user_id, crops)

        db.log(
            "enroll",
            decision="enrolled",
            user_id=user_id,
            user_name=name
        )

        return jsonify(
            user=db.get_user(user_id),
            problems=problems
        ), 201

    @app.get("/api/users")
    def api_users():
        return jsonify(users=db.list_users())

    @app.delete("/api/users/<int:user_id>")
    def api_delete_user(user_id):
        user = db.get_user(user_id)

        if not user:
            return jsonify(error="That user does not exist."), 404

        db.delete_user(user_id)
        pipeline.recognizer.delete_user(user_id)

        db.log(
            "delete",
            decision="deleted",
            user_id=user_id,
            user_name=user["name"]
        )

        return jsonify(deleted=user_id)

    @app.get("/api/stats")
    def api_stats():
        metrics_path = cfg.MODELS_DIR / "metrics.json"

        metrics = (
            json.loads(metrics_path.read_text())
            if metrics_path.exists()
            else None
        )

        return jsonify(
            stats=db.stats(),
            users=db.count_users(),
            logs=db.recent_logs(15),
            metrics=metrics,
            thresholds={
                "liveness": cfg.LIVENESS_THRESHOLD,
                "deepfake": cfg.DEEPFAKE_THRESHOLD,
                "recognition_distance": cfg.RECOGNITION_MAX_DISTANCE
            },
            enforce={
                "liveness": cfg.ENFORCE_LIVENESS,
                "deepfake": cfg.ENFORCE_DEEPFAKE
            }
        )

    # New audit logs API

    @app.get("/api/logs")
    def api_logs():
        return jsonify(logs=db.recent_logs(100))

    # ------------------------------------------------------------------
    # Error handlers
    # ------------------------------------------------------------------

    @app.errorhandler(ImageError)
    def image_error(err):
        return jsonify(error=str(err)), 400

    @app.errorhandler(413)
    def too_large(_):
        return jsonify(
            error="The upload is too large. Keep it under 12 MB."
        ), 413

    @app.errorhandler(404)
    def not_found(_):
        if request.path.startswith("/api/"):
            return jsonify(error="Not found."), 404

        return render_template("404.html", page=""), 404

    @app.errorhandler(Exception)
    def unexpected(err):
        from werkzeug.exceptions import HTTPException

        if isinstance(err, HTTPException):
            return jsonify(error=err.description), err.code

        app.logger.exception("Unhandled error")

        return jsonify(
            error="Something went wrong on the server. Try again."
        ), 500

    # ------------------------------------------------------------------
    # Security headers
    # ------------------------------------------------------------------

    @app.after_request
    def security_headers(resp):
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("X-Frame-Options", "DENY")
        resp.headers.setdefault("Referrer-Policy", "same-origin")
        resp.headers.setdefault(
            "Permissions-Policy",
            "camera=(self), microphone=()"
        )

        if request.path.startswith("/api/"):
            resp.headers["Cache-Control"] = "no-store"

        return resp

    return app


class _ConfigView:
    """Attribute access over Flask's config mapping."""

    def __init__(self, mapping):
        self._m = mapping

    def __getattr__(self, name):
        try:
            value = self._m[name]
        except KeyError as exc:
            raise AttributeError(name) from exc

        return value


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))

    create_app().run(
        host=os.environ.get("HOST", "127.0.0.1"),
        port=port,
        debug=os.environ.get("FLASK_DEBUG") == "1"
    )
