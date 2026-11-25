#!/usr/bin/env bash
# One-command local start (Linux/macOS): sets up a venv, trains if needed, runs the app.
set -e
cd "$(dirname "$0")"
[ -d venv ] || python3 -m venv venv
. venv/bin/activate
pip install -q -r requirements.txt
[ -d data/real ] || python scripts/build_dataset.py
[ -f models/liveness.joblib ] || python scripts/train_all.py
python app.py
