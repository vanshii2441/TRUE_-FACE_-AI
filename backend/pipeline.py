"""The verification pipeline: detect -> face check -> liveness -> deepfake -> identity."""
import time

import numpy as np

from .classifier import DeepfakeDetector, FaceCheck, LivenessDetector
from .face_detector import FaceDetector
from .recognizer import Recognizer

CROP_EXPAND = 1.3  # the training faces include a little hair/background around the face box


def _step(step_id, label, status, detail, score=None):
    return {"id": step_id, "label": label, "status": status, "detail": detail,
            "score": None if score is None else round(float(score), 4)}


class Pipeline:
    def __init__(self, cfg, db):
        self.cfg = cfg
        self.db = db
        self.detector = FaceDetector()
        self.face_check = FaceCheck(cfg.MODELS_DIR)
        self.liveness = LivenessDetector(cfg.MODELS_DIR)
        self.deepfake = DeepfakeDetector(cfg.MODELS_DIR)
        self.recognizer = Recognizer(cfg.INSTANCE_DIR / "faces", cfg.RECOGNITION_MAX_DISTANCE)

    # ---- helpers -----------------------------------------------------------
    def models_ready(self) -> bool:
        return all(m.loaded for m in (self.face_check, self.liveness, self.deepfake))

    def locate(self, img: np.ndarray):
        """Find the main face. Returns (box, crop) or (None, None)."""
        boxes = self.detector.detect(img)
        if not boxes:
            return None, None
        box = boxes[0]
        return box, self.detector.crop(img, box, CROP_EXPAND)

    # ---- enrolment ---------------------------------------------------------
    def enroll_crops(self, images):
        """Validate enrolment photos. Returns (crops, problems)."""
        crops, problems = [], []
        for i, img in enumerate(images, start=1):
            box, crop = self.locate(img)
            if crop is None:
                problems.append(f"Photo {i}: no face found. Face the camera in good light.")
                continue
            if self.face_check.loaded and self.face_check.score(crop) < self.cfg.FACE_CHECK_THRESHOLD:
                problems.append(f"Photo {i}: the detected region does not look like a face.")
                continue
            crops.append(crop)
        return crops, problems

    # ---- verification ------------------------------------------------------
    def verify(self, img: np.ndarray) -> dict:
        t0 = time.perf_counter()
        cfg, steps = self.cfg, []
        result = {"decision": None, "identity": None, "face_box": None, "steps": steps}

        box, crop = self.locate(img)
        if crop is None:
            steps.append(_step("detect", "Face detection", "fail",
                               "No face found. Centre your face in the oval and add light."))
            result["decision"] = "no_face"
            return self._finish(result, t0)
        h, w = img.shape[:2]
        result["face_box"] = {"x": box[0] / w, "y": box[1] / h, "w": box[2] / w, "h": box[3] / h}
        steps.append(_step("detect", "Face detection", "pass", "One face located."))

        fc = self.face_check.score(crop)
        if fc < cfg.FACE_CHECK_THRESHOLD:
            steps.append(_step("facecheck", "Face check", "fail",
                               "The detected region does not look like a face.", fc))
            result["decision"] = "no_face"
            return self._finish(result, t0)
        steps.append(_step("facecheck", "Face check", "pass", "Region confirmed as a face.", fc))

        live = self.liveness.score(crop)
        result["liveness"] = live
        if live >= cfg.LIVENESS_THRESHOLD:
            steps.append(_step("liveness", "Liveness", "pass",
                               "Looks like a live person, not a photo or screen.", live))
        else:
            status = "fail" if cfg.ENFORCE_LIVENESS else "warn"
            steps.append(_step("liveness", "Liveness", status,
                               "Looks like a printed photo or screen replay.", live))
            if cfg.ENFORCE_LIVENESS:
                result["decision"] = "rejected_spoof"
                return self._finish(result, t0)

        fake = self.deepfake.score(crop)
        result["deepfake"] = fake
        if fake >= cfg.DEEPFAKE_THRESHOLD:
            steps.append(_step("deepfake", "Deepfake screen", "pass",
                               "No manipulation signs found (advisory).", fake))
        else:
            status = "fail" if cfg.ENFORCE_DEEPFAKE else "warn"
            suffix = "" if cfg.ENFORCE_DEEPFAKE else " This check is advisory and did not block the result."
            steps.append(_step("deepfake", "Deepfake screen", status,
                               "Possible manipulation detected." + suffix, fake))
            if cfg.ENFORCE_DEEPFAKE:
                result["decision"] = "rejected_deepfake"
                return self._finish(result, t0)

        user_id, distance = self.recognizer.match(crop)
        result["distance"] = distance
        if user_id is None:
            steps.append(_step("identity", "Identity match", "fail",
                               "No identities are enrolled yet. Register a user first."))
            result["decision"] = "unknown"
            return self._finish(result, t0)
        pct = self.recognizer.score_percent(distance)
        if not self.recognizer.is_match(distance):
            steps.append(_step("identity", "Identity match", "fail",
                               "This face does not match any registered user.", pct / 100))
            result["decision"] = "unknown"
            return self._finish(result, t0)
        user = self.db.get_user(user_id)
        if user is None:  # samples on disk without a database row
            result["decision"] = "unknown"
            steps.append(_step("identity", "Identity match", "fail", "Matched user no longer exists."))
            return self._finish(result, t0)
        steps.append(_step("identity", "Identity match", "pass",
                           f"Matched {user['name']}.", pct / 100))
        result["identity"] = {"id": user["id"], "name": user["name"],
                              "department": user["department"], "match_percent": pct}
        result["decision"] = "verified"
        return self._finish(result, t0)

    def _finish(self, result: dict, t0: float) -> dict:
        latency = int((time.perf_counter() - t0) * 1000)
        result["latency_ms"] = latency
        ident = result.get("identity") or {}
        self.db.log("verify", decision=result["decision"], user_id=ident.get("id"),
                    user_name=ident.get("name"), liveness=result.get("liveness"),
                    deepfake=result.get("deepfake"), distance=result.get("distance"),
                    latency_ms=latency)
        return result
