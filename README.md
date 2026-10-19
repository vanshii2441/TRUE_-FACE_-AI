# 🛡️ TRUE FACE AI

### Enterprise-Grade Facial Recognition & Anti-Spoofing Platform

A facial recognition and security platform designed to support biometric identity verification, facial liveness detection, and CNN-based deepfake detection.

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License" />
  <img src="https://img.shields.io/badge/Python-3.9%2B-green.svg" alt="Python 3.9+" />
  <img src="https://img.shields.io/badge/Status-Active%20Development-orange.svg" alt="Active Development" />
</p>

---

## 📌 Overview

TRUE FACE AI is an intelligent security platform combining facial recognition, liveness analysis, and deep-learning-based detection techniques.

The application is built around a React frontend, Python backend, and machine-learning components. Its goal is to support identity enrollment, camera-based verification, spoof detection, and security monitoring through a modular architecture.

## ✨ Key Features

### 🏠 Home & Landing Page
- Interactive landing page introducing the platform.
- Feature cards and navigation to the main modules.
- Clear calls to action for accessing verification features.

### 📷 Live Camera & Face Positioning
- Live camera interface for facial verification.
- Oval face-positioning guide to help align the face.
- Capture preview before proceeding with verification.

### 👥 Registered Users — Identity Database
- Interface for viewing registered identities.
- User cards and identity information.
- Empty-state interface when no identities are enrolled.
- Integration with the existing user-management API.

### 📊 Security Dashboard
- Dashboard analytics and system-health information.
- Security activity indicators.
- Scroll navigation to the analytics section.

### 🛡️ Facial Liveness Detection
- Existing PyTorch CNN liveness model.
- Image preprocessing and model inference.
- Real-face versus spoof classification.
- Threshold-based presentation-attack detection.

### 🔍 CNN-Based Deepfake Detection
- CNN-based deepfake detection development.
- PyTorch model architecture and inference workflow.
- Training and evaluation workflow.
- Planned integration with the broader verification pipeline.

### 🔐 Facial Recognition
- Designed to match facial inputs against registered identities.
- Supports the intended biometric verification workflow.

*Feature availability depends on the current implementation and integration status. Planned functionality should not be considered production-ready.*

## 🧠 Deep Learning Architecture

### 1. Facial Liveness Detection

The existing liveness implementation includes:

- `liveness_net.py` — CNN model architecture.
- `liveness_detector.py` — model loading, preprocessing, inference, and threshold-based decisions.
- `train_liveness.py` — model training and evaluation workflow.

The liveness model uses a **128 × 128 pixel** input size and two output classes:

| Class | Description |
|---|---|
| `0` | Real face |
| `1` | Spoof face |

The detector converts the image into the expected color format, resizes and normalizes it, and uses the model output to determine whether the input meets the configured liveness threshold.

### 2. CNN-Based Deepfake Detection

TRUE FACE AI uses a **PyTorch CNN (DeepfakeNet)** as the intended deepfake detection model, replacing the earlier Vision Transformer (ViT) description.

The deepfake detection workflow is designed to include:

1. Dataset preparation and image preprocessing.
2. CNN model training.
3. Evaluation using suitable test data and classification metrics.
4. Loading trained model weights for inference.
5. Integration of detection results into the security workflow.

Model training, evaluation, and end-to-end integration should be marked complete only after they have been verified against the current source code.

## 🧪 Testing & Validation

**Backend test result: PASSED (86/86)**

The reported backend test run includes:

- **Tests passed:** 86/86
- **Warnings:** 1

The test count refers to the reported backend test suite. It does not represent model accuracy or independently establish that all CNN, deepfake detection, and end-to-end workflows have been validated.

Testing should cover API behavior, authentication, liveness decisions, model loading, error handling, and frontend-backend integration.

## 🏗️ Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, JavaScript, HTML5, CSS3 |
| Backend | Python |
| Deep Learning | PyTorch, CNN |
| Computer Vision | OpenCV |
| API Communication | Frontend service layer and backend APIs |
| Version Control | Git and GitHub |

## 📂 Project Structure

```text
TRUE-FACE-AI-GIT/
├── secureface-ai/
│   └── src/
│       ├── pages/
│       ├── components/
│       └── services/
├── backend/
│   ├── liveness_net.py
│   ├── liveness_detector.py
│   └── train_liveness.py
├── models/
├── data/
├── README.md
└── LICENSE
```

*This is an illustrative structure. Preserve the actual folder locations in your repository and include the deepfake model files at their real paths.*

## 🚀 Getting Started

### Prerequisites

- Python 3.9 or later
- Node.js and npm
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/vanshii2441/TRUE_-FACE_-AI.git
cd TRUE_-FACE_-AI
```

### 2. Start the Frontend

```bash
cd secureface-ai
npm install
npm run dev
```

Open the local URL displayed by Vite.

### 3. Start the Backend

Open a separate terminal and navigate to the backend directory:

```bash
cd backend
python -m venv venv
```

Activate the virtual environment on Windows:

```cmd
venv\Scripts\activate
```

Install the dependencies using the backend's actual requirements file:

```bash
pip install -r requirements.txt
```

Start the backend using the application's configured entry point.

Ensure that required environment variables, dependencies, model weights, and backend configuration are set before running the application.

## 📈 Development Status

| Module | Status |
|---|---|
| Home / Landing Page | Implemented |
| Registered Users Interface | Implemented |
| Dashboard Analytics UI | Implemented |
| Live Camera Positioning Guide | Implemented |
| Capture Preview | Implemented |
| Liveness CNN | Existing implementation |
| CNN Training & Evaluation | Further validation required |
| CNN-Based Deepfake Detection | Implementation and integration to be verified |
| Facial Recognition Integration | Pending verification |
| Security Audit Log | Planned |
| End-to-End Pipeline Testing | Ongoing |

Update the status of each module when the corresponding work has been implemented and verified.

## 🔒 Security Considerations

- Protect biometric data and restrict access to authorized users.
- Store secrets and credentials in environment variables.
- Validate inputs and handle camera, API, and model-loading failures safely.
- Evaluate false acceptance and false rejection rates.
- Test liveness and deepfake detection against representative datasets.
- Do not treat model predictions as a guarantee against every spoofing or manipulation attack.

## 👩‍💻 Project Team

Developed collaboratively by:

- **Mahi Srivastava**
- **Vanshika Agrawal**
- **Vaishnavi Singh Rajpoot**

## 📜 License

This project is licensed under the MIT License. See the `LICENSE` file for details.

---

<p align="center">
  <strong>TRUE FACE AI</strong><br />
  Intelligent Identity Verification · CNN-Based Detection · Security Analytics
</p>
