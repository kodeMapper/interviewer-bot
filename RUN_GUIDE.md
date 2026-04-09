# SkillWise Platform - Run Guide (Current Implementation)

This guide is for the current project setup in this repository.
It uses 4 services running at the same time.

| Service | Host | Port | Why it is needed | Health/Docs |
|---|---|---:|---|---|
| Frontend (React + Vite) | 127.0.0.1 | 3000 | UI for setup, interview, report | http://127.0.0.1:3000 |
| Backend (Express + Socket.io) | 127.0.0.1 | 5001 | Main API, session flow, report merge | http://127.0.0.1:5001/health and http://127.0.0.1:5001/api/docs |
| Proctoring (FastAPI) | 127.0.0.1 | 5000 | Camera checks and proctoring artifacts | http://127.0.0.1:5000/status and http://127.0.0.1:5000/docs |
| ML Service (FastAPI) | 127.0.0.1 | 8000 | Intent + answer scoring APIs | http://127.0.0.1:8000/health and http://127.0.0.1:8000/docs |

---

## 1) Prerequisites

Install these first:

- Node.js 18+
- Python 3.10+
- MongoDB Atlas connection string
- Gemini API key (one key is enough to start)

---

## 2) One-Time Setup

Run once per machine.

### A) Backend dependencies

```powershell
cd server
npm install
```

### B) Frontend dependencies

```powershell
cd client
npm install
```

### C) ML service venv + dependencies

```powershell
cd ml-service
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### D) Proctoring venv + dependencies

```powershell
cd proctoring_fastapi
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

---

## 3) Environment Variables

Create these files:

- `server/.env`
- `client/.env`

### `server/.env`

```env
PORT=5001
NODE_ENV=development
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/<db>
CLIENT_URL=http://localhost:3000
ML_SERVICE_URL=http://127.0.0.1:8000
PROCTOR_URL=http://127.0.0.1:5000

# Gemini key options (use any one format)
GEMINI_API_KEY=your-key
# GEMINI_API_KEYS=key1,key2,key3
# GEMINIAPIKEY1=key1
# GEMINIAPIKEY2=key2
# GEMINIAPIKEY3=key3
```

### `client/.env`

```env
VITE_API_URL=http://localhost:5001/api
VITE_PROCTOR_FRAME_INTERVAL_MS=500
```

Notes:

- `VITE_API_URL` can also be `http://localhost:5001` (frontend auto-appends `/api` if needed).
- `500` ms means about 2 fps proctoring frame upload.

---

## 4) Start All Services (4 Terminals)

Start in this order.

### Terminal 1 - ML Service

```powershell
cd ml-service
.\venv\Scripts\Activate.ps1
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Terminal 2 - Proctoring

```powershell
cd proctoring_fastapi
.\venv\Scripts\Activate.ps1
python server.py
```

### Terminal 3 - Backend

```powershell
cd server
npm run dev
```

### Terminal 4 - Frontend

```powershell
cd client
npm run dev
```

Open: http://127.0.0.1:3000

---

## 5) Quick Health Check

Run in any PowerShell terminal:

```powershell
(Invoke-RestMethod http://127.0.0.1:8000/health).status
(Invoke-RestMethod http://127.0.0.1:5000/status).status
(Invoke-RestMethod http://127.0.0.1:5001/health).status
```

Expected:

- ML service: `ok`
- Backend: `ok`
- Proctoring status: usually `SAFE`/`ALERT` style runtime response

---

## 6) Local Smoke Test Flow

1. Open frontend at http://127.0.0.1:3000
2. Go to setup and complete pre-check.
3. Start interview.
4. Answer a few questions.
5. End interview.
6. Open report page and test these downloads:
	- Session Recording
	- Integrity Logs
	- Violation Package

If downloads fail, check `VITE_API_URL` first.

---

## 7) Troubleshooting

### Port already in use

```powershell
npx kill-port 3000
npx kill-port 5000
npx kill-port 5001
npx kill-port 8000
```

### Camera does not start

- Close apps using camera (Zoom, Teams, Meet, OBS).
- Check browser camera permission.
- Retry setup page once.

### Mic unstable

- Check browser mic permission and input device.
- Close apps using microphone.
- Use Chrome for best Web Speech behavior.

### Session not created on deployed frontend

- Make sure `VITE_API_URL` is set in Vercel and redeploy after change.
- Make sure backend CORS `CLIENT_URL/CLIENTURL` matches the exact frontend URL.

---

## 8) Deployment Sync Reminder (Important)

If frontend is on Vercel and backend is on Hugging Face Space:

- Vercel updates automatically from GitHub.
- Hugging Face Space does not auto-pull GitHub.

So after GitHub push, also push to HF remote:

```powershell
git push huggingface integration-version:main
```

Restarting Space alone does not fetch new GitHub code.

---

## 9) Optional: Single-Container Hugging Face Run

This repository includes:

- `Dockerfile`
- `start.sh`

Container flow:

1. Starts ML service (8000)
2. Starts proctoring service (5000)
3. Starts Express on Space `PORT` (usually 7860)

Make sure Space secrets are set (`MONGODB_URI`, Gemini key(s), `CLIENT_URL/CLIENTURL`).
