# SkillWise Platform — Run Guide (Unified Services)

This platform requires four separate services to be running simultaneously.

| Service | Protocol | Host | Port | Health Check |
|---------|----------|------|------|--------------|
| **ML Service** | REST | 127.0.0.1 | 8000 | `/health` |
| **Proctoring** | REST | 127.0.0.1 | 5000 | `/status` |
| **Backend** | REST/WS | 127.0.0.1 | 5001 | `/health` |
| **Frontend** | HTTP | 127.0.0.1 | 3000 | `-` |

---

## 🛠️ Combined Setup Script (One-Time)

Run these snippets in order to ensure environments and dependencies are ready.

### 1. ML Service (Intent Classifier)
```powershell
cd ml-service; python -m venv venv; .\venv\Scripts\Activate.ps1; pip install -r requirements.txt
```

### 2. Proctoring Service (Gaze/Face Detection)
```powershell
cd proctoring_fastapi; python -m venv venv; .\venv\Scripts\Activate.ps1; pip install -r requirements.txt
```

### 3. Backend (Express API)
```powershell
cd server; npm install
```

### 4. Frontend (Vite UI)
```powershell
cd client; npm install
```

---

## 🚀 Launch Sequence (Terminal Breakdown)

Open **four** terminals and run each service in this specific order:

### Terminal A: [ML Service]
```powershell
cd ml-service; .\venv\Scripts\Activate.ps1; uvicorn main:app --port 8000
```

### Terminal B: [Proctoring]
```powershell
cd proctoring_fastapi; .\venv\Scripts\Activate.ps1; python server.py
```

### Terminal C: [Backend Gateway]
```powershell
cd server; npm run dev
```

### Terminal D: [Frontend UI]
```powershell
cd client; npm run dev
```

---

## 🔍 Health & Connectivity Checks (Post-Launch)

Run these PowerShell commands to confirm everything is connected:

```powershell
# 1. Check ML Service
(Invoke-RestMethod http://127.0.0.1:8000/health).status
# 2. Check Proctoring
(Invoke-RestMethod http://127.0.0.1:5000/status).status
# 3. Check Backend
(Invoke-RestMethod http://127.0.0.1:5001/health).status
```

---

## ⚠️ Troubleshooting & Port Conflicts

### Force Close Hanging Processes
If a port is already in use, run these commands:
- **Port 5001 (Node):** `npx kill-port 5001`
- **Port 5000 (Proctor):** `npx kill-port 5000`
- **Port 8000 (Python):** `npx kill-port 8000`
- **Port 3000 (Vite):** `npx kill-port 3000`

### Environment Variables
- `server/.env` must contain `GEMINI_API_KEY`, `MONGODB_URI`, `ML_SERVICE_URL`, and `PROCTORING_SERVICE_URL`.
- `client/.env` must contain `VITE_API_URL=http://localhost:5001`.

---

## 📋 Note on Camera Usage
The **Proctoring Service** takes exclusive control of your webcam using OpenCV. Ensure no other apps (Zoom, Teams) are using the camera before launching the interview.
