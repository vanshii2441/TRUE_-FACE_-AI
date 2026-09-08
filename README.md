<div align="center">

# 🛡️ TRUE FACE AI

### Enterprise-Grade Facial Recognition & Anti-Spoofing Platform

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.9+-green.svg)](https://python.org)
[![Status](https://img.shields.io/badge/Status-Active%20Development-brightgreen.svg)]()

*High-speed 1:N biometric searching with multi-layered liveness detection — authenticating real users across multi-million user databases while blocking physical and digital spoofing in real time.*

</div>

---

## 📋 Table of Contents

- [Current Implementation Status](#-current-implementation-status)
- [Problem Statement](#-problem-statement)
- [Core Solution](#-core-solution)
- [Key Objectives](#-key-objectives)
- [Architecture Overview](#-architecture-overview)
- [Getting Started](#-getting-started)
- [API Documentation](#-api-documentation)
- [Expected Business Impact](#-expected-business-impact)
- [Tech Stack](#-tech-stack)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🚦 Current Implementation Status

| Module | Status | Details |
|--------|--------|---------|
| **React Frontend Dashboard** | ✅ IMPLEMENTED | Vite + React 18 with full UI (Dashboard, Register, Authenticate, Users, Threat Monitor) |
| **FastAPI Backend** | ✅ IMPLEMENTED | Python backend with health check, CORS, and structured API |
| **Face Detection (MTCNN)** | ✅ IMPLEMENTED | Detects faces, returns bounding boxes + confidence, crops faces |
| **Face Detection API** | ✅ IMPLEMENTED | `POST /api/v1/detect-face` — accepts image upload, returns JSON |
| **Unit Tests** | ✅ IMPLEMENTED | 16 tests covering image utils, detector service, and API endpoint |
| **Face Embedding (ArcFace)** | ❌ NOT IMPLEMENTED YET | Planned — 512d embedding extraction |
| **Liveness Detection (CNN)** | ❌ NOT IMPLEMENTED YET | Planned — passive anti-spoofing |
| **Deepfake Detection (ViT)** | ❌ NOT IMPLEMENTED YET | Planned — Vision Transformer |
| **FAISS 1:N Search** | ❌ NOT IMPLEMENTED YET | Planned — vector similarity search |
| **Authentication Engine** | ❌ NOT IMPLEMENTED YET | Planned — decision engine combining all modules |
| **Sub-500ms Pipeline** | ❌ NOT VERIFIED | Will be benchmarked when full pipeline is built |

> **Note:** Only features marked ✅ are actually implemented and tested in this codebase.

---

## 🔍 Problem Statement

Modern access control systems, banking infrastructure, and digital identity platforms are increasingly vulnerable to sophisticated biometric fraud, deepfake attacks, and scalability bottlenecks.

| Challenge | Description |
|-----------|-------------|
| **🎭 Presentation & Deepfake Attacks** | Traditional face recognition models can be easily tricked by printed photos, digital video replays, 3D silicone masks, or generative AI deepfakes — exposing financial systems and secure facilities to severe security breaches. |
| **⏱️ Large-Scale Latency & Accuracy Trade-Offs** | Searching and matching a single face against millions of enrolled user profiles in real time often leads to high latency or high false-positive rates using standard database architectures. |
| **🌦️ Environmental & Hardware Instability** | Harsh lighting conditions, low-resolution cameras, off-angle facial positions, and aging features frequently cause authentications to fail for legitimate users. |

---

## 🧠 Core Solution

An **enterprise-grade facial recognition and anti-spoofing platform** that combines high-speed **1:N biometric searching** with **multi-layered liveness detection**.

By integrating:
- **Deep Feature Embeddings** — for robust facial representation
- **CNN-based Liveness Verification** — passive anti-spoofing analysis
- **Vision Transformer (ViT) Deepfake Detection** — synthetic media identification

The system instantly authenticates real users across multi-million user databases while blocking physical and digital spoofing attempts in real time.

---

## 🎯 Key Objectives

### 1. Deliver High-Speed Biometric Matching
> Utilize deep facial embeddings to enable ultra-fast, highly accurate **1:N identity searching** across databases containing **millions of records**.

### 2. Prevent Multi-Modal Spoofing & Deepfakes
> Combine CNN-based passive liveness analysis and Vision Transformers to instantly detect **physical spoofs** (photos, screens, 3D masks) and **synthetic digital media** (AI deepfakes).

### 3. Ensure Environmental Resilience
> Maintain low **False Acceptance Rates (FAR)** and **False Rejection Rates (FRR)** under poor lighting, varied camera angles, and partial facial occlusions.

### 4. Enable Sub-Second Processing
> Execute complete facial capture, liveness verification, vector database matching, and access approval in **under 500 milliseconds**.

### 5. Support Enterprise Integration
> Provide flexible **APIs and SDKs** to integrate into:
> - 🏧 Cardless ATMs
> - 🚪 Physical security turnstiles
> - 📱 Mobile banking applications
> - 🔐 Multi-factor authentication (MFA) pipelines

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        TRUE FACE AI                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐    │
│  │  Face Capture │──▶│  Liveness    │──▶│  Deepfake        │    │
│  │  & Detection  │   │  Detection   │   │  Detection (ViT) │    │
│  │  ✅ DONE      │   │  (CNN)       │   │                  │    │
│  └──────────────┘   └──────────────┘   └────────┬─────────┘    │
│                                                  │              │
│                                                  ▼              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐    │
│  │  Access      │◀──│  1:N Vector  │◀──│  Deep Feature    │    │
│  │  Decision    │   │  Search      │   │  Embedding       │    │
│  │  Engine      │   │  (FAISS)     │   │  Extraction      │    │
│  └──────────────┘   └──────────────┘   └──────────────────┘    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  APIs & SDKs  │  Admin Dashboard  │  Monitoring & Analytics    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.9+
- Node.js 18+ (for the frontend)
- CUDA-compatible GPU (recommended, not required)

### Backend Setup

```bash
# Clone the repository
git clone https://github.com/vanshii2441/TRUE_-FACE_-AI.git
cd TRUE_-FACE_-AI

# Create virtual environment
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Copy environment config (optional — defaults work out of the box)
copy .env.example .env
```

### Run the Face Detection API

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at:
- **Swagger UI**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health
- **Face Detection**: `POST http://localhost:8000/api/v1/detect-face`

### Test the API with curl

```bash
# Detect faces in an image
curl -X POST http://localhost:8000/api/v1/detect-face \
  -F "file=@path/to/photo.jpg"
```

Example response:
```json
{
  "success": true,
  "faces_detected": 1,
  "faces": [
    {
      "bbox": [120, 85, 320, 340],
      "confidence": 0.9987
    }
  ],
  "image_width": 640,
  "image_height": 480
}
```

### Run the CLI Demo

```bash
cd backend
python test_face_detection_demo.py --image path/to/photo.jpg
```

This will detect faces and save an annotated image with bounding boxes.

### Run Tests

```bash
cd backend
pytest tests/ -v
```

### Frontend Setup

```bash
cd secureface-ai
npm install
npm run dev
```

The React dashboard will be available at http://localhost:5173.

---

## 📡 API Documentation

### `POST /api/v1/detect-face`

Detect faces in an uploaded image.

**Request:** `multipart/form-data` with a `file` field containing the image.

**Accepted formats:** JPEG, PNG, BMP, WebP

**Response (200):**
```json
{
  "success": true,
  "faces_detected": 1,
  "faces": [
    {
      "bbox": [x1, y1, x2, y2],
      "confidence": 0.98
    }
  ],
  "image_width": 640,
  "image_height": 480
}
```

**Error Response (400):**
```json
{
  "detail": {
    "success": false,
    "error": "Image validation failed",
    "detail": "Failed to decode image..."
  }
}
```

### `GET /health`
Returns system health status.

### `GET /`
Returns API info and available endpoints.

---

## 📈 Expected Business Impact

<table>
  <tr>
    <td align="center">🔒<br><b>Near-Zero Biometric Fraud</b></td>
    <td>Eliminates identity theft and unauthorized access caused by stolen photos, video replays, and AI-generated deepfakes.</td>
  </tr>
  <tr>
    <td align="center">💳<br><b>Frictionless Cardless Transactions</b></td>
    <td>Enables fast, secure, cardless/passwordless user authentication for banking ATMs, corporate doors, and transit gates.</td>
  </tr>
  <tr>
    <td align="center">⚡<br><b>Sub-Second Throughput</b></td>
    <td>Reduces authentication processing times down to <b>&lt; 500ms</b>, eliminating queues at high-traffic security checkpoints.</td>
  </tr>
  <tr>
    <td align="center">🏢<br><b>Massive Enterprise Scalability</b></td>
    <td>Handles million-scale identity databases efficiently with low computational cost and high vector search speeds.</td>
  </tr>
</table>

---

## 🛠️ Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Face Detection & Embedding** | MTCNN (facenet-pytorch) ✅ / RetinaFace, ArcFace / FaceNet |
| **Liveness Detection** | CNN-based passive liveness models |
| **Deepfake Detection** | Vision Transformer (ViT) |
| **Vector Search** | FAISS / Milvus |
| **Backend** | Python, FastAPI ✅ |
| **Frontend** | React 18, Vite ✅ |
| **Database** | PostgreSQL, Redis |
| **Deployment** | Docker, Kubernetes |
| **Monitoring** | Prometheus, Grafana |

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting a pull request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ by [vanshii2441](https://github.com/vanshii2441)**

</div>
