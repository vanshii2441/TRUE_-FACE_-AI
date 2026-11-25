"""Train the face-check, liveness and deepfake classifiers from data/.

    python scripts/train_all.py

Evaluation uses a group-aware hold-out split (all variants of one source face stay
on the same side) plus 5-fold group cross-validation, so numbers are not inflated
by near-duplicate leakage. The shipped model is then refit on all data.
Metrics are written to models/metrics.json and shown on the dashboard.
"""
import json
import sys
import time
from pathlib import Path

import cv2
import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score,
                             precision_score, recall_score, roc_auc_score)
from sklearn.model_selection import GroupKFold, GroupShuffleSplit

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend.features import extract_features  # noqa: E402
from backend.utils import normalise_face  # noqa: E402

DATA = ROOT / "data"
MODELS = ROOT / "models"

# (task, genuine folder, attack folder, description, is_synthetic)
TASKS = [
    ("facecheck", "real", "nonface",
     "Real LFW faces vs real non-face patches (both from the LFW subset)", False),
    ("liveness", "real", "spoof",
     "Real LFW faces vs SIMULATED print/screen-replay attacks of the same faces", True),
    ("deepfake", "real", "deepfake",
     "Real LFW faces vs SIMULATED face-swap / smoothing / warp manipulations", True),
]


def load_folder(folder: Path):
    feats, groups = [], []
    for p in sorted(folder.glob("*.png")) + sorted(folder.glob("*.jpg")):
        img = cv2.imread(str(p), cv2.IMREAD_GRAYSCALE)
        if img is None:
            continue
        feats.append(extract_features(normalise_face(img)))
        groups.append(p.stem.split("_")[0])
    return np.array(feats), groups


def make_model():
    return RandomForestClassifier(n_estimators=300, min_samples_leaf=2, n_jobs=2,
                                  random_state=0, class_weight="balanced")


def evaluate(X, y, groups):
    gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=0)
    tr, te = next(gss.split(X, y, groups))
    model = make_model().fit(X[tr], y[tr])
    proba = model.predict_proba(X[te])[:, 1]
    pred = (proba >= 0.5).astype(int)
    tn, fp, fn, tp = confusion_matrix(y[te], pred, labels=[0, 1]).ravel()
    cv = []
    for a, b in GroupKFold(n_splits=5).split(X, y, groups):
        m = make_model().fit(X[a], y[a])
        cv.append(accuracy_score(y[b], m.predict(X[b])))
    return {
        "n_train": int(len(tr)), "n_test": int(len(te)),
        "accuracy": round(accuracy_score(y[te], pred), 4),
        "precision": round(precision_score(y[te], pred), 4),
        "recall": round(recall_score(y[te], pred), 4),
        "f1": round(f1_score(y[te], pred), 4),
        "roc_auc": round(roc_auc_score(y[te], proba), 4),
        "far": round(fp / max(1, fp + tn), 4),   # attacks wrongly accepted
        "frr": round(fn / max(1, fn + tp), 4),   # genuine wrongly rejected
        "confusion": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
        "cv_accuracy_mean": round(float(np.mean(cv)), 4),
        "cv_accuracy_std": round(float(np.std(cv)), 4),
    }


def main():
    MODELS.mkdir(exist_ok=True)
    metrics = {"trained_at": time.strftime("%Y-%m-%d %H:%M:%S"), "tasks": {}}
    cache = {}
    for task, good, bad, desc, synthetic in TASKS:
        for folder in (good, bad):
            if folder not in cache:
                cache[folder] = load_folder(DATA / folder)
        Xg, gg = cache[good]
        Xb, gb = cache[bad]
        if not len(Xg) or not len(Xb):
            raise SystemExit(f"data/{good} or data/{bad} is empty. Run scripts/build_dataset.py first.")
        X = np.vstack([Xg, Xb])
        y = np.array([1] * len(Xg) + [0] * len(Xb))
        groups = gg + gb
        print(f"[{task}] {len(Xg)} genuine + {len(Xb)} attack samples")
        result = evaluate(X, y, groups)
        result.update({"description": desc, "synthetic_attacks": synthetic,
                       "n_genuine": int(len(Xg)), "n_attack": int(len(Xb))})
        final = make_model().fit(X, y)
        joblib.dump(final, MODELS / f"{task}.joblib", compress=3)
        metrics["tasks"][task] = result
        print(f"[{task}] holdout acc={result['accuracy']} auc={result['roc_auc']} "
              f"far={result['far']} frr={result['frr']} cv={result['cv_accuracy_mean']}"
              f"±{result['cv_accuracy_std']}")
    (MODELS / "metrics.json").write_text(json.dumps(metrics, indent=2))
    print("Saved models and metrics to", MODELS)


if __name__ == "__main__":
    main()
