FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
# Retrain at build time so the saved models always match the installed scikit-learn.
RUN python scripts/build_dataset.py && python scripts/train_all.py
EXPOSE 8000
VOLUME ["/app/instance"]
CMD ["gunicorn", "app:create_app()", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "60"]
