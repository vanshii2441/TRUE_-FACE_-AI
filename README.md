# TRUE FACE AI

A Flask web app that checks a face is **live** before matching it to a registered identity.
Each photo goes through detection, a face check, a liveness check, a deepfake screen and an identity match.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg) ![Python 3.9+](https://img.shields.io/badge/Python-3.9%2B-green.svg)

> **Read this first.** This is a learning project, not a certified security product.
> The training data is 100 real faces at 25 x 25 pixels (LFW subset). Print, screen-replay and deepfake
> samples are **simulated** from those faces because no spoof dataset could be downloaded when this was built.
> See [Limits and honest numbers](#limits-and-honest-numbers) before relying on any result.

## Quick start

```bash
# Linux / macOS
./run.sh

# Windows
run.bat
```

Or step by step:

```bash
python -m venv venv
source venv/bin/activate            # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py                       # open http://127.0.0.1:5000
```

The dataset (`data/`) and trained models (`models/`) are already included. To rebuild them:

```bash
python scripts/build_dataset.py     # regenerates data/ from the bundled real LFW faces
python scripts/train_all.py         # trains and writes models/*.joblib and models/metrics.json
```

If you install a different scikit-learn version than the one the models were saved with, the app reports the
model as "Missing" on the dashboard. Run `python scripts/train_all.py` (about 20 seconds) to fix it.

The camera needs `https://` or `localhost`. On other hosts use **Upload a photo**.

## Pages

| Page | What it does |
|---|---|
| `/` | Landing page explaining the five-step check |
| `/verify` | Camera with an oval guide, capture preview, then verification with per-step results |
| `/register` | Add a person with 3 to 8 photos (camera or upload) |
| `/users` | Search registered users, remove a person and their face samples |
| `/dashboard` | Outcomes, 7-day activity, model test metrics, system health, thresholds, audit log |

The layout is responsive from phone width up, has a keyboard-friendly focus style and respects reduced motion.

## How a check works

1. **Detect**: LBP cascade (bundled `backend/assets/lbpcascade_frontalface_opencv.xml`, loaded with scikit-image).
2. **Face check**: classifier rejects regions that are not faces.
3. **Liveness**: random forest on texture, contrast, glare and frequency features. Blocks the check by default.
4. **Deepfake screen**: random forest on local-consistency features. Advisory by default (see limits).
5. **Identity**: OpenCV LBPH recogniser over enrolled samples. Lower distance means a closer match.

Photos are processed in memory. Enrolment keeps small 100 x 100 grayscale face patches in `instance/faces/`;
the audit log stores scores and outcomes, never images.

## API

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/api/health` | | 200 when all models load, 503 otherwise |
| POST | `/api/verify` | `{"image": "data:image/jpeg;base64,..."}` or multipart `image` | Returns `decision`, `steps`, `identity`, `latency_ms` |
| POST | `/api/enroll` | `{"name", "email?", "department?", "images": [...]}` or multipart | 201 on success, 422 if fewer than 3 usable photos |
| GET | `/api/users` | | |
| DELETE | `/api/users/<id>` | | Also deletes stored face samples |
| GET | `/api/stats` | | Dashboard data |

`decision` is one of `verified`, `unknown`, `rejected_spoof`, `rejected_deepfake`, `no_face`.

## Configuration (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `LIVENESS_THRESHOLD` | `0.50` | Minimum liveness score to pass |
| `DEEPFAKE_THRESHOLD` | `0.50` | Minimum deepfake-screen score to pass |
| `FACE_CHECK_THRESHOLD` | `0.50` | Minimum face-check score |
| `RECOGNITION_MAX_DISTANCE` | `75` | Maximum LBPH distance for a match |
| `ENFORCE_LIVENESS` | `true` | A failed liveness check rejects the photo |
| `ENFORCE_DEEPFAKE` | `false` | Set `true` to let the deepfake screen reject photos |
| `SECRET_KEY` | placeholder | Set a real value in production |
| `TRUEFACE_INSTANCE_DIR` | `./instance` | Where the database and face samples live |
| `PORT`, `HOST` | `5000`, `127.0.0.1` | For `python app.py` |

## Deploy

```bash
# Production server (Linux/macOS)
gunicorn "app:create_app()" --bind 0.0.0.0:8000 --workers 2 --timeout 60

# Windows
waitress-serve --port=8000 --call app:create_app

# Docker (retrains the models at build time)
docker build -t trueface-ai .
docker run -p 8000:8000 -v trueface-data:/app/instance -e SECRET_KEY=change-me trueface-ai
```

A `Procfile` is included for Heroku-style platforms. Serve over HTTPS so browsers allow camera access.
The app has **no login**. Put it behind authentication before exposing it, because it stores biometric patches.

## Tests

```bash
python -m pytest
```

The suite covers pages, headers, enrolment, verification (including print-like and screen-like inputs and
unregistered faces), input validation, the dashboard API, the feature extractor, the detector, the synthetic
generators and minimum model quality.

## Limits and honest numbers

Hold-out results from `models/metrics.json` (split by source face, so no near-duplicate leakage):

| Model | Data | Accuracy | AUC | False accept | False reject |
|---|---|---|---|---|---|
| Face check | Real faces vs real non-face patches | 100% | 100% | 0% | 0% |
| Liveness | Real faces vs **simulated** print/screen attacks | 88% | 96% | 12.5% | 11.3% |
| Deepfake screen | Real faces vs **simulated** swap/smooth/warp | 58% (65% 5-fold CV) | 67% | 44% | 40% |

- The face-check "real data" is easy: the non-face patches are mostly flat gradients.
- The liveness score measures how well the model finds *the simulator's* artefacts. Real attack footage will behave differently.
- The deepfake screen is only modestly better than chance at 25 x 25 pixels, so it does not block by default.
- Recognition was calibrated with one enrolled person and the 100 LFW faces as impostors
  (`python scripts/calibrate_recognition.py`). That is not an identity benchmark. Measure false accept and
  false reject on your own people before trusting the match threshold.
- The original README mentioned PyTorch CNNs. They are **not** used here; the models are scikit-learn classifiers
  on hand-built image features, because PyTorch could not be installed when this was built.

### Making it production-grade

1. Put real data in `data/real`, `data/spoof` and `data/deepfake` (and `data/nonface`). Use 64 x 64 PNGs; keep one
   source person's files under the same prefix before the first underscore, for example `p012_a.png`, so the
   trainer keeps them on one side of the split.
2. Run `python scripts/train_all.py` and check `models/metrics.json`.
3. Set `ENFORCE_DEEPFAKE=true` only once the deepfake numbers justify it.
4. Replace the recogniser with a modern face-embedding model and add authentication, rate limiting and HTTPS.

## Project structure

```text
trueface-ai/
├── app.py                  Flask app (pages + JSON API)
├── config.py               Settings and thresholds
├── backend/
│   ├── face_detector.py    LBP cascade detector
│   ├── features.py         Image features for the classifiers
│   ├── classifier.py       Face-check, liveness and deepfake model wrappers
│   ├── recognizer.py       LBPH identity matching
│   ├── pipeline.py         Five-step verification flow
│   ├── db.py               SQLite users and audit log
│   ├── synth.py            Simulated spoof / deepfake generators
│   ├── utils.py            Image decoding and normalisation
│   └── assets/             Cascade XML and the real LFW subset (lfw_subset.npy)
├── data/                   real/ nonface/ spoof/ deepfake/ (64 x 64 PNGs)
├── models/                 Trained models and metrics.json
├── scripts/                build_dataset.py, train_all.py, calibrate_recognition.py
├── templates/ static/      Responsive frontend (no external CDNs or fonts)
├── tests/                  pytest suite
├── Dockerfile  Procfile  requirements.txt  run.sh  run.bat
└── instance/               Database and face samples (created at runtime)
```

## Dataset credit

Real faces come from the Labeled Faces in the Wild (LFW) subset bundled with scikit-image
(100 faces and 100 non-face patches, 25 x 25 grayscale). Spoof and deepfake images are generated from them by `backend/synth.py`.

## Team

Mahi Srivastava, Vanshika Agrawal and Vaishnavi Singh Rajpoot.

## Licence

MIT. See `LICENSE`.
