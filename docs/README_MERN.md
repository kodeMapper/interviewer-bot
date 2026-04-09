# AI Smart Interviewer - MERN Stack Migration

## Live Application

- Production frontend: https://www.skillwise.live
- Backend/API host: https://username-skillwise.hf.space

## Architecture Overview

This project has been migrated from a Python CLI application to a modern MERN stack.
**The ML/DL code stays in Python - the ml-service is just a wrapper!**

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (React)                       │
│                          Port: 3000                         │
│  Web Speech API + Socket.io + Setup/Interview/Report pages  │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP/WebSocket
┌───────────────────────────▼─────────────────────────────────┐
│                   Server (Express.js)                       │
│                         Port: 5001                          │
│  Interview flow, resume APIs, report merge, proctor proxy   │
└───────────────┬─────────────────────────────┬───────────────┘
                │ HTTP                        │ HTTP
┌───────────────▼───────────────┐   ┌─────────▼───────────────┐
│     ML Service (FastAPI)      │   │ Proctoring (FastAPI)    │
│           Port: 8000          │   │       Port: 5000        │
│ Intent + Answer evaluation API │   │ Camera alerts + artifacts│
└───────────────┬───────────────┘   └─────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────┐
│                        MongoDB                              │
│                         Sessions/Data                       │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites
- Node.js >= 18.0.0
- Python >= 3.10
- MongoDB (local or Atlas)
- npm or yarn

### 1. Install Dependencies

```bash
# Install all dependencies
npm run install:all

# Or manually:
cd server && npm install
cd ../client && npm install
cd ../ml-service && pip install -r requirements.txt
```

### 2. Configure Environment

**Server (.env):**
```bash
cd server
cp .env.example .env
# Edit .env with your MongoDB URI, ports, etc.
```

**ML Service (.env):**
```bash
cd ml-service
# Edit .env if needed
```

### 3. Seed the Database

```bash
cd server
npm run seed
```

### 4. Start All Services

Open 4 terminals:

**Terminal 1 - ML Service:**
```bash
cd ml-service
uvicorn main:app --reload --port 8000
```

**Terminal 2 - Proctoring Service:**
```bash
cd proctoring_fastapi
python server.py
```

**Terminal 3 - Backend Server:**
```bash
cd server
npm run dev
```

**Terminal 4 - Frontend Client:**
```bash
cd client
npm run dev
```

### 5. Access the Application

- Frontend: http://localhost:3000
- Production: https://www.skillwise.live
- Backend API: http://localhost:5001/api
- Backend Health: http://localhost:5001/health
- Proctoring Docs: http://localhost:5000/docs
- ML Service Docs: http://localhost:8000/docs
- **Swagger Documentation API Guide**: See [docs/swagger-user-guide.md](docs/swagger-user-guide.md)

## Interview Flow

1. **Select Skills** → Choose topics (Java, Python, React, etc.)
2. **Upload Resume** (optional) → AI generates personalized questions
3. **Start Interview** → Voice interaction begins
4. **Answer Questions** → Speak naturally, get instant feedback
5. **View Report** → Detailed performance analysis

## Interview States

| State | Description |
|-------|-------------|
| INTRO | Welcome and setup |
| RESUME_WARMUP | 3 easy questions from resume |
| RESUME_DEEP_DIVE | 5 detailed resume questions |
| DEEP_DIVE | 6 questions per selected topic |
| MIX_ROUND | 5 random questions from all topics |
| FINISHED | Report generation |

## API Endpoints

### Interview
- `POST /api/interview/start` - Create new session
- `GET /api/interview/session/:id` - Get session details
- `POST /api/interview/session/:id/end` - End session
- `GET /api/interview/session/:id/report` - Get report

### Resume
- `POST /api/resume/upload` - Upload and parse resume
- `GET /api/resume/:id/data` - Get extracted resume data
- `GET /api/resume/:id/questions` - Get AI-generated questions

### Questions
- `GET /api/questions/topic/:topic` - Get questions by topic
- `GET /api/questions/search` - Search questions
- `GET /api/questions/stats` - Question statistics

### Sessions
- `GET /api/session` - List all sessions
- `GET /api/session/stats/summary` - Get statistics
- `DELETE /api/session/:id` - Delete session

### Proctoring Proxy
- `GET /api/proctoring/status`
- `POST /api/proctoring/start`
- `POST /api/proctoring/stop`
- `POST /api/proctoring/process_frame`
- `GET /api/proctoring/download/csv`
- `GET /api/proctoring/download/video`
- `GET /api/proctoring/download/package`

## WebSocket Events

### Client → Server
- `join-session` - Join interview room
- `start-interview` - Begin interview
- `next-question` - Request next question
- `submit-answer` - Submit answer
- `request-hint` - Get hint

### Server → Client
- `session-joined` - Confirmation
- `interview-message` - System messages
- `question` - New question
- `answer-result` - Evaluation result
- `progress` - Progress update
- `interview-complete` - Interview finished

## Tech Stack

### Frontend (NEW - React)
- React 18 + Vite
- TailwindCSS + Framer Motion
- Socket.io-client
- Web Speech API (browser STT/TTS)
- Recharts (data visualization)

### Backend (NEW - Express.js)
- Express.js
- Socket.io
- Mongoose (MongoDB)
- Multer (file uploads)

### Proctoring Service (FastAPI)
- FastAPI + OpenCV + PyTorch
- Camera status and alert engine
- Report assets (CSV/video/package)

### ML/Deep Learning (UNCHANGED - Python)
**⚠️ The ML/DL code remains in the ORIGINAL Python implementation!**

The `ml-service/` is just a FastAPI **wrapper** that imports and uses the existing code from `backend/`:

- `backend/ml/models/intent_classifier.py` - **Original** IntentClassifier (PyTorch MLP)
- `backend/ml/training/intent_predictor.py` - **Original** IntentPredictor class
- `backend/core/answer_evaluator.py` - **Original** AnswerEvaluator (Cosine Similarity)
- `backend/ml/models/saved/intent_model.pth` - **Original** trained model weights

**The deep learning logic was NOT rewritten. The ml-service simply exposes the original Python code via REST API.**

## What Was Migrated vs What Stayed

| Component | Status | Notes |
|-----------|--------|-------|
| Interview Controller | ✅ Migrated | Python → Node.js (interview.service.js) |
| Question Bank | ✅ Migrated | Python dict → MongoDB collection |
| Resume Parser | ✅ Migrated | Python → Node.js (resume.service.js) |
| Gemini Integration | ✅ Migrated | Python → Node.js (@google/generative-ai) |
| CLI Interface | ✅ Replaced | Terminal → React SPA |
| Windows TTS | ✅ Replaced | pywin32 → Web Speech API |
| Whisper STT | ✅ Replaced | Server-side → Web Speech API (browser) |
| **IntentClassifier (MLP)** | ❌ NOT migrated | **Uses original Python code** |
| **IntentPredictor** | ❌ NOT migrated | **Uses original Python code** |
| **AnswerEvaluator** | ❌ NOT migrated | **Uses original Python code** |
| **Trained Model (.pth)** | ❌ NOT migrated | **Uses original trained weights** |

## Migration from Python

The original Python application used:
- ❌ Whisper (server-side STT) → ✅ Web Speech API (browser)
- ❌ Windows SAPI (TTS) → ✅ Web Speech API (browser)
- ❌ CLI interface → ✅ React SPA
- ❌ In-memory storage → ✅ MongoDB

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Submit pull request

## License

MIT License
