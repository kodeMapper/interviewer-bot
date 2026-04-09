# Service Inventory

> Generated: 2026-02-08 | Branch: `integration/agent-2026-02-08T19-53-02`
> 2026-04 Update: Proctoring is now FastAPI-based and integrated through Express adapter routes.

---

## Top-Level Folder Map

| Folder | Purpose | Status |
|--------|---------|--------|
| `client/` | React + Vite frontend SPA (MERN) | **Active** — port 3000 |
| `server/` | Express.js + Socket.io backend (MERN) | **Active** — port 5001 |
| `ml-service/` | FastAPI wrapper over original Python ML code | **Active** — port 8000 |
| `backend/` | **Original** Python ML/DL code (IntentClassifier, AnswerEvaluator, ResumeParser) | **Active** — imported by `ml-service/` at runtime |
| `proctoring_fastapi/` | FastAPI-based eye-tracking proctoring system (PyTorch CNN + OpenCV) | **Active** — port 5000 |
| `frontend/` | Legacy vanilla HTML/CSS/JS frontend (pre-MERN) | **Historical** — not part of current run guide |
| `tests/` | Legacy Python test suite for the CLI interview bot | **Legacy** — not wired to MERN |
| `venv/` | Root-level Python virtual environment (legacy CLI bot) | **Legacy** — separate venvs exist per service |
| `docs/` | Documentation (created by this integration pass) | **New** |
| `scripts/` | Helper scripts (created by this integration pass) | **New** |

---

## Services

### 1. Client (React Frontend)

| Property | Value |
|----------|-------|
| **Path** | `client/` |
| **Entrypoint** | `npm run dev` → Vite dev server |
| **Port** | 3000 |
| **Dependencies** | `client/package.json` (React 18, Vite 5, Socket.io-client, TailwindCSS, Framer Motion, Recharts) |
| **Env file** | `client/.env` → `VITE_API_URL=http://localhost:5001/api` |
| **Build** | `npm run build` → `client/dist/` |
| **Key Pages** | Home, Interview (voice), Report, Dashboard |
| **External APIs** | Connects to server via REST + WebSocket |

### 2. Server (Express.js Backend)

| Property | Value |
|----------|-------|
| **Path** | `server/` |
| **Entrypoint** | `npm run dev` → nodemon server.js |
| **Port** | 5001 |
| **Dependencies** | `server/package.json` (Express, Socket.io, Mongoose, Multer, @google/generative-ai, pdf-parse, mammoth) |
| **Env file** | `server/.env` → MONGODB_URI, ML_SERVICE_URL, GEMINI_API_KEY, etc. |
| **Database** | MongoDB (Atlas or local 27017) |
| **Route prefixes** | `/api/interview`, `/api/questions`, `/api/resume`, `/api/session`, `/health` |
| **Upstream deps** | Calls ml-service at `POST /evaluate` for answer scoring |

### 3. ML Service (FastAPI Wrapper)

| Property | Value |
|----------|-------|
| **Path** | `ml-service/` |
| **Entrypoint** | `uvicorn main:app --port 8000` |
| **Port** | 8000 |
| **Dependencies** | `ml-service/requirements.txt` (FastAPI, uvicorn, sentence-transformers, torch, numpy) |
| **Own venv** | `ml-service/venv/` (Python 3.12, numpy 2.4.2, torch 2.10.0) |
| **Runtime imports** | `backend/ml/training/intent_predictor.py`, `backend/core/answer_evaluator.py` |
| **Endpoints** | `/health`, `POST /evaluate`, `POST /predict-intent`, `POST /predict`, `/model-info` |
| **Model files** | `backend/ml/models/saved/intent_model.pth` |

### 4. Backend (Original Python ML Code)

| Property | Value |
|----------|-------|
| **Path** | `backend/` |
| **Role** | Library — imported by `ml-service/main.py` via `sys.path` manipulation |
| **Key modules** | `ml/models/intent_classifier.py` (PyTorch MLP 384→128→64→7), `ml/training/intent_predictor.py` (SentenceTransformer embeddings), `core/answer_evaluator.py` (cosine similarity scorer), `resume/` (PDF/DOCX extraction, Gemini question gen) |
| **Trained assets** | `ml/models/saved/intent_model.pth`, `ml/data/interview_intents.json` |
| **Dependencies** | Listed in root `requirements.txt` |

### 5. Proctoring (FastAPI + PyTorch CNN)

| Property | Value |
|----------|-------|
| **Path** | `proctoring_fastapi/` |
| **Entrypoint** | `python server.py` (FastAPI app) |
| **Port** | 5000 |
| **Dependencies** | FastAPI, uvicorn, OpenCV, PyTorch, dlib, mediapipe (`proctoring_fastapi/requirements.txt`) |
| **Endpoints** | `/`, `/start`, `/stop`, `/status`, `/cameras`, `/set_camera/<n>`, `/video_feed`, `/frame` |
| **Model files** | `eye_cnn_final.pth`, `pretrained_eye_cnn.pth` |
| **Frontend** | Serves own `index.html` + `style.css` (standalone dashboard) |
| **Integration** | **Integrated** through `server/src/adapters/proctoringAdapter.js` and `/api/proctoring/*` routes |

---

## Duplicated / Overlapping Functionality

| Area | Location A | Location B | Notes |
|------|-----------|-----------|-------|
| Resume parsing | `backend/resume/` (Python — extractor.py, parser.py) | `server/src/services/resume.service.js` (Node.js — pdf-parse, mammoth) | **REVIEW**: Server has its own Node.js resume parser. The Python version in `backend/resume/` is no longer called by the MERN flow. |
| Question generation (Gemini) | `backend/resume/question_generator.py` (Python) | `server/src/services/resume.service.js` → `generateQuestionsFromFile()` (Node.js @google/generative-ai) | **REVIEW**: Server calls Gemini directly via Node SDK. Python Gemini client is unused in MERN. |
| Question bank | `backend/core/question_bank.py` (Python dict) | MongoDB `questions` collection (seeded via `server/scripts/seedQuestions.js`) | **REVIEW**: Data was migrated to MongoDB. Python dict is only used by legacy CLI bot. |
| Frontend | `frontend/` (vanilla HTML/JS) | `client/` (React SPA) | **SAFE TO REMOVE**: `frontend/` is the legacy pre-MERN UI. |
| TTS/STT | `backend/core/interview_controller.py` (Whisper + pywin32) | `client/src/hooks/useSpeechSynthesis.js` + `useSpeechRecognition.js` (Web Speech API) | **REVIEW**: Legacy CLI uses server-side Whisper; MERN uses browser Web Speech API. |
| Root `venv/` | Root `venv/` (legacy CLI deps) | `ml-service/venv/` (FastAPI deps) | **REVIEW**: Two separate venvs. Root venv has numpy version conflicts. |

---

## Environment Files Summary

| Service | File | Key Variables |
|---------|------|---------------|
| Root | `.env` | Historical/optional for legacy flows (current web app uses `server/.env`) |
| Server | `server/.env` | `PORT`, `MONGODB_URI`, `CLIENT_URL`, `ML_SERVICE_URL`, `GEMINI_API_KEY`, `GEMINI_API_KEYS`, `SESSION_SECRET` |
| Client | `client/.env` | `VITE_API_URL` |
| ML Service | (none — uses `config.py` defaults) | `PORT`, `HOST` (via dotenv) |
| Proctoring | (none) | No env file — hardcoded settings |
