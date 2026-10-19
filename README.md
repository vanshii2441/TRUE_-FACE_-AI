# 🛡️ TRUE FACE AI

### Enterprise-Grade Facial Recognition & Anti-Spoofing Platform

A face-recognition security platform designed to support identity verification, biometric matching, and presentation-attack detection through facial liveness analysis.

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License" />
  <img src="https://img.shields.io/badge/Python-3.9%2B-green.svg" alt="Python 3.9+" />
  <img src="https://img.shields.io/badge/Status-Active%20Development-orange.svg" alt="Active Development" />
</p>

---

## 📌 Overview

TRUE FACE AI aims to provide a secure facial recognition and anti-spoofing solution by combining face-based identity verification with liveness detection.

The platform is being developed with a modular architecture, connecting a React-based frontend with a Python backend and machine-learning components.

The project focuses on identifying registered individuals, detecting potential spoofing attempts, and providing an interface for monitoring identity verification activity.

## ✨ Key Features

- **Facial Recognition:** Designed for matching facial identities against registered users.
- **Anti-Spoofing:** Supports facial liveness analysis to help distinguish real faces from presentation attacks.
- **Live Camera Interface:** Includes a face-positioning guide and capture preview to assist users during camera-based verification.
- **Registered Users:** Provides an identity database interface for viewing enrolled users and related information.
- **Security Dashboard:** Includes analytics and system-health information for monitoring platform activity.
- **Modular Architecture:** Separates frontend, backend, and machine-learning components for easier development and maintenance.

## 🧠 Machine Learning & CNN Development

The project includes a CNN-based liveness-detection component intended to classify facial inputs as real or spoof.

The existing model implementation uses a 128 × 128 input size and two output classes:

| Class | Meaning |
|---|---|
| `0` | Real face |
| `1` | Spoof face |

The liveness pipeline includes image preprocessing, model loading, prediction, and threshold-based decision-making.

**Current development focus:** CNN model validation, training and evaluation, and reliable integration with the existing authentication workflow.

Model performance must be measured using appropriate evaluation metrics and representative test data before the CNN component can be considered complete.

## 🏗️ Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, JavaScript, HTML, CSS |
| Backend | Python |
| Machine Learning | PyTorch, CNN |
| Computer Vision | OpenCV |
| Data Management | Existing backend data layer; database integration maintained separately |
| Development Tools | Git, GitHub, npm, Python virtual environments |

*The stack reflects the project's current implementation and development direction; individual components may evolve during integration.*

## 📂 Project Structure

```text
TRUE-FACE-AI/
├── secureface-ai/          # React frontend
│   └── src/
│       ├── pages/           # Application pages
│       ├── components/      # Reusable UI components
│       └── services/        # API communication
├── backend/                # Python backend
├── models/                 # Machine-learning models
├── data/                   # Model training and evaluation data
└── README.md               # Project documentation
```

*Exact folders and filenames may vary with the current repository structure.*

## 🚀 Getting Started

### Prerequisites

- Python 3.9 or later
- Node.js and npm
- Git

### 1. Clone the repository

```bash
git clone https://github.com/vanshii2441/TRUE_-FACE_-AI.git
cd TRUE_-FACE_-AI
```

### 2. Start the frontend

Open a terminal in the frontend directory:

```bash
cd secureface-ai
npm install
npm run dev
```

Open the local URL printed by Vite in your terminal.

### 3. Start the backend

Open a separate terminal in the backend directory:

```bash
cd backend
python -m venv venv
```

Activate the virtual environment on Windows:

```bash
venv\Scripts\activate
```

Install the dependencies listed in the backend's `requirements.txt`, if present:

```bash
pip install -r requirements.txt
```

Start the backend using the repository's actual application entry point and configuration.

**Note:** The backend startup command, environment variables, and dependency installation instructions should match the files currently present in the repository.

## 📊 Development Status

| Module | Status |
|---|---|
| Home / Landing Page | Implemented |
| Registered Users Interface | Implemented |
| Dashboard Analytics Interface | Implemented |
| Live Camera Positioning Guide | Implemented |
| Capture Preview | Implemented |
| CNN Liveness Model | Existing implementation; further development and validation pending |
| CNN Training and Evaluation | Pending validation |
| End-to-End CNN Integration | Pending |
| Audit Log | Planned |
| Deepfake Detection | Planned |
| Final Pipeline Testing | Planned |

*Status refers to the development work tracked for this project and should be updated as each feature is verified.*

## 🔐 Security Considerations

- Protect biometric information and restrict access to authorized users.
- Store credentials and API secrets in environment variables rather than committing them to source control.
- Validate input and handle camera, model-loading, and backend errors safely.
- Evaluate false acceptance and false rejection rates before relying on the system for real-world identity verification.
- Treat liveness detection as a security layer, not a guarantee against every possible spoofing attack.

## 👥 Project Team

Developed collaboratively by:

- **Mahi Srivastava**
- **Vanshika Agrawal**
- **Vaishnavi Singh Rajpoot**

## 📜 License

This project is licensed under the MIT License. See the `LICENSE` file for details.

---

<p align="center">
  <strong>TRUE FACE AI</strong><br />
  Intelligent Identity Verification · Facial Liveness · Security Analytics
</p>
