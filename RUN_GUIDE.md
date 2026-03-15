# Interviewer Bot - MERN Migration Run Guide

This guide provides step-by-step instructions to set up and run the migrated MERN application.

## 🏗️ Architecture Overview

The system has been migrated to a modern web stack while preserving the original Deep Learning core:

1.  **Frontend**: React (Vite) for the user interface.
2.  **Backend**: Express.js (Node.js) for business logic and socket management.
3.  **ML Wrapper**: FastAPI (Python) service that wraps your *existing* Deep Learning code.

> **Important**: The original ML Logic in `backend/` and `core/` is **NOT** rewritten. The `ml-service` simply imports and exposes it as an HTTP API.

## 🔌 Port Summary

| Service | Port | Local URL | Description |
| :--- | :--- | :--- | :--- |
| **Frontend** | `3000` | `http://localhost:3000` | The user interface |
| **Backend Server** | `5001` | `http://localhost:5001` | API & WebSocket Server |
| **ML Service** | `8000` | `http://localhost:8000` | Python Wrapper |
| **MongoDB** | `27017` | `mongodb://localhost:27017/interviewer_bot` | Database |

> ⚠️ **Note**: Port 5000 is often used by Windows system services. The backend defaults to **5001** to avoid conflicts.

---

## 🚀 Setup & Installation

You need to set up three separate parts. Open a terminal in the root project directory.

### 1. ML Service (Python)

This service requires the original dependencies plus FastAPI.

```powershell
cd ml-service
# Create virtual environment
python -m venv venv

# Activate (Windows)
.\venv\Scripts\activate

# Install dependencies (includes FastAPI + original ML libs)
pip install -r requirements.txt
```

### 2. Backend Server (Node.js)

```powershell
cd server
npm install
```

### 3. Frontend Client (React)

```powershell
cd client
npm install
```

---

## ▶️ Running the Application

You must run these services in **3 separate terminal windows** simultaneously.

### Terminal 1: Start ML Service

```powershell
cd ml-service
.\venv\Scripts\activate
uvicorn main:app --reload --port 8000
```

### Terminal 2: Start Backend Server

```powershell
cd server
npm run dev
```

### Terminal 3: Start Frontend Client

```powershell
cd client
npm run dev
```

---

## ⚠️ Important Configurations

### Environment Variables

**Server (`server/.env`)**
 Ensure these point to the correct services:
```env
PORT=5001
MONGO_URI=mongodb://localhost:27017/interviewer_bot
ML_SERVICE_URL=http://localhost:8000
CLIENT_URL=http://localhost:3000
```

**Client (`client/.env`)**
```env
VITE_API_URL=http://localhost:5001
```

### Common Issues

1.  **ModuleNotFoundError in ML Service**:
    *   The `ml-service/main.py` uses `sys.path.append("..")` to find `backend.core`. Ensure you run uvicorn from *inside* the `ml-service` folder, but the project structure remains intact relative to the parent folder.

2.  **Port Conflicts**:
    *   If port 3000 or 5001 is taken, update the respective `.env` file and `vite.config.js`.

3.  **Data Persistence**:
    *   Ensure MongoDB is running locally before starting the server (or use MongoDB Atlas cloud).

4.  **Microphone Not Working**:
    *   Ensure you're using Chrome/Edge (Firefox has limited Web Speech API support).
    *   Grant microphone permissions when prompted.
    *   The mic button is only enabled after a question is loaded.

---

## 🎯 Skills & Topics

### Fixed ML Topics (7)
The custom PyTorch MLP classifier detects these 7 topics from your introduction:
- Java, Python, JavaScript, React, SQL, Machine Learning, Deep Learning

### Dynamic Resume Skills (Unlimited)
When you upload a resume, Gemini/GPT generates questions for **any skill** found:
- Technologies mentioned in projects
- Frameworks from work experience
- Domain-specific knowledge

The system blends both sources seamlessly.

---

## 📋 Interview Flow

1. **INTRO** → Select skills + optional resume upload
2. **RESUME_WARMUP** → 3 easy questions from resume (if uploaded)
3. **RESUME_DEEP_DIVE** → 15-20 personalized resume questions
4. **DEEP_DIVE** → 5 questions per selected skill
5. **MIX_ROUND** → 5 rapid-fire mixed questions
6. **FINISHED** → Score report generated
