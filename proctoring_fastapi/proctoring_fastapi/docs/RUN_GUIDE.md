# Run Guide — AI Smart Interviewer

> Updated: 2026-02-08

---

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | >= 18.0.0 | `node -v` |
| Python | >= 3.10 | `python --version` |
| MongoDB | Running (local or Atlas) | `mongosh --eval "db.version()"` or use Atlas cloud |
| npm | >= 9.0 | `npm -v` |
| Chrome/Edge | Latest | Required for Web Speech API |

---

## Architecture

```
┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
│   Frontend (React)   │────▶│  Backend (Express)   │────▶│  ML Service (FastAPI)│
│   Port: 3000         │ WS  │  Port: 5001          │REST │  Port: 8000          │
│   client/            │+REST│  server/              │     │  ml-service/         │
└──────────────────────┘     └─────────┬────────────┘     └─────────┬────────────┘
                                       │                            │
                              ┌────────▼────────┐         ┌────────▼────────┐
                              │    MongoDB      │         │   backend/      │
                              │    Port: 27017  │         │   (Python ML)   │
                              └─────────────────┘         └─────────────────┘

┌──────────────────────┐
│  Proctoring (Flask)  │  ← Standalone, optional
│  Port: 5000          │
│  proctoring/         │
└──────────────────────┘
```

---

## 1. ML Service Setup (Python)

The ML Service wraps the original Python deep learning code via FastAPI.

```powershell
# Navigate to ml-service
cd ml-service

# Create virtual environment (first time only)
python -m venv venv

# Activate (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Start the service
uvicorn main:app --reload --port 8000
```

**Verify:** Open http://localhost:8000/docs or:
```powershell
curl http://localhost:8000/health
# Expected: {"status":"ok","intent_predictor":true,"answer_evaluator":true}
```

> **Note:** First startup downloads the `all-MiniLM-L6-v2` model (~80MB). Subsequent starts are instant.

---

## 2. Backend Server Setup (Node.js)

```powershell
# Navigate to server
cd server

# Install dependencies (first time only)
npm install

# Configure environment
# Edit server/.env — ensure these are set:
#   PORT=5001
#   MONGODB_URI=mongodb+srv://...  (or mongodb://localhost:27017/interviewer_bot)
#   ML_SERVICE_URL=http://localhost:8000
#   GEMINI_API_KEY=your_key_here
#   CLIENT_URL=http://localhost:3000

# Seed the question bank (first time only)
npm run seed

# Start the server
npm run dev
```

**Verify:**
```powershell
curl http://localhost:5001/health
# Expected: {"status":"ok","timestamp":"...","environment":"development","uptime":...}
```

---

## 3. Frontend Client Setup (React)

```powershell
# Navigate to client
cd client

# Install dependencies (first time only)
npm install

# Configure environment
# Edit client/.env:
#   VITE_API_URL=http://localhost:5001

# Start the dev server
npm run dev
```

**Verify:** Open http://localhost:3000 in Chrome or Edge.

---

## 4. Proctoring Setup (Optional — Flask)

The proctoring system is standalone and runs separately.

```powershell
# Navigate to proctoring
cd proctoring

# Create virtual environment (first time only)
python -m venv venv

# Activate
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Start the Flask server
python server.py
```

**Verify:** Open http://localhost:5000 for the proctoring dashboard.

> **Note:** Requires a webcam. Grant camera permissions when prompted.

---

## 5. Start Everything (Quick)

Open **3 terminal windows** (4 if using proctoring):

| Terminal | Command | Working Dir |
|----------|---------|-------------|
| 1 — ML | `cd ml-service; .\venv\Scripts\Activate.ps1; uvicorn main:app --reload --port 8000` | `ml-service/` |
| 2 — Server | `cd server; npm run dev` | `server/` |
| 3 — Client | `cd client; npm run dev` | `client/` |
| 4 — Proctoring *(optional)* | `cd proctoring; .\venv\Scripts\Activate.ps1; python server.py` | `proctoring/` |

Or use the smoke-check script:
```powershell
.\scripts\smoke-check.ps1
```

---

## 6. Environment Variables Reference

### server/.env
```env
PORT=5001
NODE_ENV=development
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/interviewer-bot
CLIENT_URL=http://localhost:3000
ML_SERVICE_URL=http://localhost:8000
GEMINI_API_KEY=AIzaSy...
GEMINI_API_KEYS="key1, key2, key3"       # Optional: key rotation pool
SESSION_SECRET=your_secret_here
```

### client/.env
```env
VITE_API_URL=http://localhost:5001
```

### ml-service (config.py defaults)
```env
PORT=8000       # optional override
HOST=0.0.0.0   # optional override
```

---

## 7. Common Issues

| Problem | Solution |
|---------|----------|
| `ECONNREFUSED` on port 5001 | Server not running. Start it with `npm run dev` in `server/` |
| `ECONNREFUSED` on port 8000 | ML service not running. Start uvicorn in `ml-service/` |
| `ModuleNotFoundError: No module named 'ml'` | Run uvicorn from **inside** `ml-service/` directory (it uses relative path `../backend`) |
| NumPy binary incompatibility | Use the `ml-service/venv/` venv, NOT the root `venv/` |
| Microphone not working | Use Chrome/Edge. Grant mic permissions. Localhost only (HTTPS required for remote). |
| MongoDB connection error | Check `MONGODB_URI` in `server/.env`. Ensure MongoDB is running or Atlas URI is correct. |
| Gemini question generation fails | Check `GEMINI_API_KEY` in `server/.env`. Free tier has rate limits. |
| Port 5000 already in use (proctoring) | Windows may use 5000 for system services. Change Flask port in `proctoring/server.py`. |

---

## 8. Interview Flow

1. **Home** → Select skills (Java, Python, etc.) + optionally upload resume
2. **Interview** → Voice Q&A with adaptive questions
3. **Report** → Performance breakdown by topic
4. **Dashboard** → Historical session data

### States:
`INTRO → RESUME_WARMUP → RESUME_DEEP_DIVE → DEEP_DIVE → MIX_ROUND → FINISHED`
