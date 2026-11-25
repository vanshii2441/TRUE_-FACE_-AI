@echo off
REM One-command local start (Windows).
cd /d "%~dp0"
if not exist venv python -m venv venv
call venv\Scripts\activate
pip install -q -r requirements.txt
if not exist data\real python scripts\build_dataset.py
if not exist models\liveness.joblib python scripts\train_all.py
python app.py
