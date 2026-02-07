# MERN Stack Migration Roadmap
## AI Smart Interviewer & Proctoring System

**Document Version:** 1.0  
**Created:** January 31, 2026  
**Purpose:** Complete migration plan from Python/Flask to MERN stack (MongoDB, Express.js, React, Node.js)

---

## 📋 Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture Analysis](#2-current-architecture-analysis)
3. [Target MERN Architecture](#3-target-mern-architecture)
4. [File-to-File Migration Mapping](#4-file-to-file-migration-mapping)
5. [Phase 1: Backend Infrastructure Setup](#5-phase-1-backend-infrastructure-setup)
6. [Phase 2: ML Model Integration Strategy](#6-phase-2-ml-model-integration-strategy)
7. [Phase 3: Core Logic Migration](#7-phase-3-core-logic-migration)
8. [Phase 4: Resume Module Migration](#8-phase-4-resume-module-migration)
9. [Phase 5: React Frontend Development](#9-phase-5-react-frontend-development)
10. [Phase 6: Real-time Communication (WebSocket)](#10-phase-6-real-time-communication-websocket)
11. [Phase 7: Testing & Validation](#11-phase-7-testing--validation)
12. [Phase 8: Deployment](#12-phase-8-deployment)
13. [Critical Dependencies & Decisions](#13-critical-dependencies--decisions)
14. [Risk Assessment & Mitigation](#14-risk-assessment--mitigation)
15. [Implementation Checklist](#15-implementation-checklist)

---

## 1. Executive Summary

### Current Stack
| Layer | Technology |
|-------|------------|
| **Backend** | Python (command-line application, no Flask server) |
| **ML/AI** | PyTorch (custom MLP), Sentence-Transformers, Whisper STT |
| **TTS** | Windows SAPI (pywin32) |
| **Resume Processing** | PyMuPDF, python-docx, Google Gemini API |
| **Frontend** | Static HTML/CSS/JS (minimal, calls Flask endpoints - currently empty) |

### Target Stack
| Layer | Technology |
|-------|------------|
| **Backend** | Node.js + Express.js |
| **Database** | MongoDB + Mongoose |
| **ML/AI** | Python microservice (PyTorch kept for inference) or ONNX.js |
| **Real-time** | Socket.io (WebSocket) |
| **Frontend** | React.js with hooks |
| **Audio** | Web Audio API + WebSocket streaming |
| **TTS** | Web Speech API (browser-native) |

### Key Challenges
1. **ML Model Preservation**: The custom IntentClassifier (PyTorch MLP) must work in the new stack
2. **Zero-Latency Architecture**: Must maintain the async interview flow
3. **Windows TTS Dependency**: Replace pywin32 with browser-based Web Speech API
4. **Whisper STT**: Move to server-side or use Web Speech API for recognition
5. **Real-time Streaming**: Audio capture → processing → response must be seamless

---

## 2. Current Architecture Analysis

### 2.1 Directory Structure Overview

```
interviewer-bot/
├── backend/
│   ├── __init__.py
│   ├── core/                          # 🔴 CRITICAL - Main interview logic
│   │   ├── __init__.py
│   │   ├── answer_evaluator.py        # Semantic similarity scoring
│   │   ├── interview_controller.py    # Main interview engine (1040 lines)
│   │   └── question_bank.py           # Question repository + keyword index
│   ├── ml/                            # 🔴 CRITICAL - ML models
│   │   ├── __init__.py
│   │   ├── data/
│   │   │   ├── data_loader.py         # Dataset handling
│   │   │   ├── interview_intents.json # Training data
│   │   │   └── processed/             # Preprocessed numpy arrays
│   │   ├── models/
│   │   │   ├── intent_classifier.py   # PyTorch MLP model definition
│   │   │   └── saved/
│   │   │       └── intent_model.pth   # Trained model weights
│   │   └── training/
│   │       ├── intent_predictor.py    # Inference wrapper
│   │       └── train_intent_model.py  # Training script
│   ├── resume/                        # 🟡 MODERATE - Resume processing
│   │   ├── __init__.py
│   │   ├── extractor.py               # PDF/DOCX text extraction
│   │   ├── parser.py                  # Section detection
│   │   ├── gpt_client.py              # Wrapper for Gemini
│   │   ├── gemini_client.py           # Google Gemini API
│   │   ├── question_generator.py      # GPT prompt engineering
│   │   └── resume_question_bank.py    # Thread-safe question queue
│   └── utils/
│       └── __init__.py
├── frontend/                          # 🟢 REPLACE - Minimal current frontend
│   ├── index.html                     # Empty
│   ├── script.js                      # Just 2 fetch calls
│   └── style.css                      # Basic styling
├── tests/                             # 🟡 MODERATE - Testing framework
│   ├── __init__.py
│   ├── mock_interview_controller.py   # Mock interview simulation
│   └── scenarios.py                   # Test scenarios
├── test_runner.py                     # Test execution
├── requirements.txt                   # Python dependencies
└── README.md                          # Documentation
```

### 2.2 Core Components Analysis

#### A. Interview Controller (`interview_controller.py`) - 1040 Lines
**Responsibilities:**
- Interview state machine (INTRO → RESUME_WARMUP → DEEP_DIVE → MIX_ROUND → FINISHED)
- Audio recording via `sounddevice`
- Speech-to-Text via Whisper
- Text-to-Speech via Windows SAPI
- Background processing with `ThreadPoolExecutor`
- Keyword detection and counter-questioning
- Report generation

**Migration Strategy:** Split into multiple Express routes + Socket.io handlers

#### B. Intent Predictor (`intent_predictor.py`)
**Responsibilities:**
- Load trained PyTorch model
- Encode text using SentenceTransformer
- Predict topic probabilities

**Migration Strategy:** Keep as Python microservice or convert to ONNX

#### C. Answer Evaluator (`answer_evaluator.py`)
**Responsibilities:**
- Semantic similarity using SentenceTransformer
- Score answers (0-100)

**Migration Strategy:** Keep as Python microservice (shares embedding model with intent predictor)

#### D. Question Bank (`question_bank.py`)
**Responsibilities:**
- Store 170+ questions across 7 topics
- Keyword index for counter-questioning
- Question retrieval by topic/keyword

**Migration Strategy:** Convert to MongoDB collection

#### E. Resume Module (`resume/*.py`)
**Responsibilities:**
- Extract text from PDF/DOCX
- Parse into sections (education, experience, skills, etc.)
- Generate questions via Gemini API
- Thread-safe priority queue

**Migration Strategy:** Node.js services with pdf-parse, mammoth.js

---

## 3. Target MERN Architecture

### 3.1 High-Level Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              MERN ARCHITECTURE                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         REACT FRONTEND                                  │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐  │ │
│  │  │  Interview  │  │   Resume    │  │   Report    │  │   Dashboard   │  │ │
│  │  │    Page     │  │   Upload    │  │    View     │  │     Page      │  │ │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └───────────────┘  │ │
│  │         │                │                │                            │ │
│  │  ┌──────┴────────────────┴────────────────┴─────────────────────────┐  │ │
│  │  │                    React Context / Redux                          │  │ │
│  │  │          (Interview State, User Session, Audio Control)           │  │ │
│  │  └────────────────────────────┬─────────────────────────────────────┘  │ │
│  │                               │                                        │ │
│  │  ┌────────────────────────────┴─────────────────────────────────────┐  │ │
│  │  │              Custom Hooks (useAudio, useWebSocket, useSpeech)     │  │ │
│  │  └────────────────────────────┬─────────────────────────────────────┘  │ │
│  └───────────────────────────────│─────────────────────────────────────────┘ │
│                                  │                                           │
│                     WebSocket (Socket.io) + REST API                         │
│                                  │                                           │
│  ┌───────────────────────────────│─────────────────────────────────────────┐ │
│  │                    EXPRESS.JS BACKEND                                   │ │
│  │  ┌─────────────┐  ┌──────────────────┐  ┌────────────────────────────┐  │ │
│  │  │   REST API  │  │  Socket.io Hub   │  │    Background Workers      │  │ │
│  │  │   Routes    │  │  (Real-time      │  │  (Answer processing,       │  │ │
│  │  │             │  │   Interview)     │  │   Resume generation)       │  │ │
│  │  └──────┬──────┘  └────────┬─────────┘  └──────────────┬─────────────┘  │ │
│  │         │                  │                           │                │ │
│  │  ┌──────┴──────────────────┴───────────────────────────┴─────────────┐  │ │
│  │  │                      SERVICE LAYER                                │  │ │
│  │  │  ┌──────────────┐  ┌────────────────┐  ┌────────────────────────┐ │  │ │
│  │  │  │ Interview    │  │    Question    │  │      Resume            │ │  │ │
│  │  │  │ Service      │  │    Service     │  │      Service           │ │  │ │
│  │  │  └──────────────┘  └────────────────┘  └────────────────────────┘ │  │ │
│  │  └───────────────────────────┬───────────────────────────────────────┘  │ │
│  │                              │                                          │ │
│  │  ┌───────────────────────────┴───────────────────────────────────────┐  │ │
│  │  │                      DATA ACCESS LAYER                            │  │ │
│  │  │  ┌────────────────────────────────────────────────────────────┐   │  │ │
│  │  │  │                    MongoDB (Mongoose)                      │   │  │ │
│  │  │  │  Questions │ Sessions │ Reports │ Users │ ResumeQuestions  │   │  │ │
│  │  │  └────────────────────────────────────────────────────────────┘   │  │ │
│  │  └───────────────────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────│───────────────────────────────────────────┘ │
│                                 │                                            │
│                    HTTP/gRPC Communication                                   │
│                                 │                                            │
│  ┌──────────────────────────────│──────────────────────────────────────────┐ │
│  │              PYTHON ML MICROSERVICE (Optional)                          │ │
│  │  ┌────────────────────────────────────────────────────────────────────┐ │ │
│  │  │   Intent Classifier (PyTorch)  │  Answer Evaluator (SBERT)         │ │ │
│  │  │   Whisper STT (for accuracy)   │  Model Inference API             │ │ │
│  │  └────────────────────────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 New Directory Structure

```
interviewer-bot/
├── client/                            # React Frontend
│   ├── public/
│   │   ├── index.html
│   │   └── favicon.ico
│   ├── src/
│   │   ├── components/
│   │   │   ├── Interview/
│   │   │   │   ├── InterviewPage.jsx
│   │   │   │   ├── InterviewControls.jsx
│   │   │   │   ├── QuestionDisplay.jsx
│   │   │   │   ├── TranscriptPanel.jsx
│   │   │   │   └── AudioRecorder.jsx
│   │   │   ├── Resume/
│   │   │   │   ├── ResumeUpload.jsx
│   │   │   │   └── ResumePreview.jsx
│   │   │   ├── Report/
│   │   │   │   ├── ReportView.jsx
│   │   │   │   └── ScoreCard.jsx
│   │   │   └── shared/
│   │   │       ├── Navbar.jsx
│   │   │       ├── Loading.jsx
│   │   │       └── ErrorBoundary.jsx
│   │   ├── hooks/
│   │   │   ├── useAudioRecorder.js
│   │   │   ├── useWebSocket.js
│   │   │   ├── useSpeechSynthesis.js
│   │   │   └── useInterview.js
│   │   ├── context/
│   │   │   ├── InterviewContext.jsx
│   │   │   └── AuthContext.jsx
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   └── socket.js
│   │   ├── utils/
│   │   │   └── helpers.js
│   │   ├── App.jsx
│   │   ├── index.js
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
│
├── server/                            # Express.js Backend
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js            # MongoDB connection
│   │   │   ├── environment.js         # Environment variables
│   │   │   └── socket.js              # Socket.io config
│   │   ├── models/                    # Mongoose schemas
│   │   │   ├── Question.js
│   │   │   ├── Session.js
│   │   │   ├── Report.js
│   │   │   ├── User.js
│   │   │   └── ResumeQuestion.js
│   │   ├── routes/
│   │   │   ├── interview.routes.js
│   │   │   ├── question.routes.js
│   │   │   ├── resume.routes.js
│   │   │   └── report.routes.js
│   │   ├── controllers/
│   │   │   ├── interview.controller.js
│   │   │   ├── question.controller.js
│   │   │   ├── resume.controller.js
│   │   │   └── report.controller.js
│   │   ├── services/
│   │   │   ├── interview.service.js   # Interview state machine
│   │   │   ├── question.service.js    # Question retrieval + keyword index
│   │   │   ├── resume.service.js      # Resume extraction & parsing
│   │   │   ├── gemini.service.js      # Gemini API client
│   │   │   ├── ml.service.js          # ML inference (calls Python or ONNX)
│   │   │   └── speech.service.js      # STT integration
│   │   ├── socket/
│   │   │   ├── interviewHandler.js    # WebSocket interview logic
│   │   │   └── events.js              # Event definitions
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   ├── errorHandler.js
│   │   │   └── validation.js
│   │   ├── utils/
│   │   │   ├── helpers.js
│   │   │   └── constants.js
│   │   └── app.js                     # Express app setup
│   ├── package.json
│   └── server.js                      # Entry point
│
├── ml-service/                        # Python ML Microservice (Optional)
│   ├── app.py                         # FastAPI server
│   ├── models/
│   │   ├── intent_classifier.py       # Same as current
│   │   └── saved/
│   │       └── intent_model.pth       # Trained model
│   ├── services/
│   │   ├── intent_predictor.py        # Inference
│   │   └── answer_evaluator.py        # Similarity scoring
│   ├── requirements.txt
│   └── Dockerfile
│
├── scripts/                           # Migration scripts
│   ├── seed-questions.js              # Seed MongoDB with questions
│   ├── migrate-data.js                # Data migration utilities
│   └── export-onnx.py                 # Convert PyTorch to ONNX
│
├── docker-compose.yml                 # Container orchestration
├── package.json                       # Root workspace config
└── README.md
```

---

## 4. File-to-File Migration Mapping

### 4.1 Backend Core Logic

| Source File (Python) | Target File (Node.js) | Migration Notes |
|---------------------|----------------------|-----------------|
| `backend/core/interview_controller.py` | `server/src/services/interview.service.js` + `server/src/socket/interviewHandler.js` | Split into service + WebSocket handler. State machine logic preserved. |
| `backend/core/question_bank.py` | `server/src/models/Question.js` + `server/src/services/question.service.js` | Questions → MongoDB collection. Keyword index → MongoDB text index or in-memory. |
| `backend/core/answer_evaluator.py` | `ml-service/services/answer_evaluator.py` OR `server/src/services/ml.service.js` (using ONNX) | Keep in Python microservice for accuracy, or use ONNX.js |

### 4.2 ML Module

| Source File (Python) | Target File | Migration Notes |
|---------------------|-------------|-----------------|
| `backend/ml/models/intent_classifier.py` | `ml-service/models/intent_classifier.py` | Keep as-is in Python microservice |
| `backend/ml/models/saved/intent_model.pth` | `ml-service/models/saved/intent_model.pth` OR `server/src/models/ml/intent_model.onnx` | Option A: Keep PyTorch. Option B: Export to ONNX |
| `backend/ml/training/intent_predictor.py` | `ml-service/services/intent_predictor.py` + FastAPI endpoint | Expose as REST API |
| `backend/ml/training/train_intent_model.py` | `ml-service/training/train_intent_model.py` | Keep for retraining (not needed at runtime) |
| `backend/ml/data/data_loader.py` | `ml-service/data/data_loader.py` | Keep for retraining |
| `backend/ml/data/interview_intents.json` | `server/scripts/interview_intents.json` → MongoDB seed | Convert to seed script |

### 4.3 Resume Module

| Source File (Python) | Target File (Node.js) | Migration Notes |
|---------------------|----------------------|-----------------|
| `backend/resume/extractor.py` | `server/src/services/resume.service.js` | Use `pdf-parse` for PDF, `mammoth` for DOCX |
| `backend/resume/parser.py` | `server/src/services/resumeParser.service.js` | Port regex patterns to JavaScript |
| `backend/resume/gemini_client.py` | `server/src/services/gemini.service.js` | Use `@google/generative-ai` npm package |
| `backend/resume/gpt_client.py` | `server/src/services/gemini.service.js` | Merge with gemini.service.js |
| `backend/resume/question_generator.py` | `server/src/services/questionGenerator.service.js` | Port prompts and logic |
| `backend/resume/resume_question_bank.py` | `server/src/services/resumeQuestionBank.service.js` | Use MongoDB + Bull queue for background processing |

### 4.4 Frontend

| Source File | Target File(s) | Migration Notes |
|------------|----------------|-----------------|
| `frontend/index.html` | `client/public/index.html` + `client/src/App.jsx` | Complete rewrite in React |
| `frontend/script.js` | `client/src/services/api.js` + `client/src/services/socket.js` | API client + WebSocket client |
| `frontend/style.css` | `client/src/index.css` + component styles | Modern CSS/Tailwind |

### 4.5 Tests

| Source File (Python) | Target File (Node.js) | Migration Notes |
|---------------------|----------------------|-----------------|
| `tests/mock_interview_controller.py` | `server/__tests__/interview.test.js` | Jest tests |
| `tests/scenarios.py` | `server/__tests__/fixtures/scenarios.js` | Test fixtures |
| `test_runner.py` | `npm test` | Use Jest/Mocha |

---

## 5. Phase 1: Backend Infrastructure Setup

### 5.1 Initialize Node.js Project

```bash
# Create server directory
mkdir server
cd server
npm init -y

# Install core dependencies
npm install express mongoose dotenv cors helmet morgan socket.io

# Install development dependencies
npm install -D nodemon jest supertest

# Install additional utilities
npm install multer pdf-parse mammoth uuid
npm install @google/generative-ai  # Gemini API
npm install bull redis              # Background job queue (optional)
```

### 5.2 Create Base Express Server

**File: `server/src/app.js`**
```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes (to be added)
app.use('/api/interview', require('./routes/interview.routes'));
app.use('/api/questions', require('./routes/question.routes'));
app.use('/api/resume', require('./routes/resume.routes'));
app.use('/api/reports', require('./routes/report.routes'));

// Socket.io handlers
require('./socket/interviewHandler')(io);

module.exports = { app, httpServer, io };
```

### 5.3 MongoDB Connection

**File: `server/src/config/database.js`**
```javascript
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
```

### 5.4 Environment Variables

**File: `server/.env`**
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/interviewer-bot
CLIENT_URL=http://localhost:3000
GEMINI_API_KEY=your_gemini_api_key_here
ML_SERVICE_URL=http://localhost:8000  # Python ML microservice
NODE_ENV=development
```

---

## 6. Phase 2: ML Model Integration Strategy

### ⚠️ IMPORTANT: ML/DL Code Stays in Python

**The deep learning code is NOT migrated to JavaScript.**  

The `ml-service/` is a **thin FastAPI wrapper** that:
1. **Imports the ORIGINAL Python code** from `backend/`
2. **Exposes it via REST API** for the Node.js server to call

### Original Python Code (UNCHANGED)

| File | Class | Purpose |
|------|-------|---------|
| `backend/ml/models/intent_classifier.py` | `IntentClassifier` | PyTorch MLP model definition |
| `backend/ml/training/intent_predictor.py` | `IntentPredictor` | Inference wrapper with embedding |
| `backend/core/answer_evaluator.py` | `AnswerEvaluator` | Cosine similarity scoring |
| `backend/ml/models/saved/intent_model.pth` | - | Trained model weights |

### ML Service (Wrapper Only)

**File: `ml-service/main.py`**
```python
from fastapi import FastAPI
import sys, os

# Add backend directory to import ORIGINAL code
BACKEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend")
sys.path.insert(0, BACKEND_DIR)

# Import ORIGINAL implementations (NOT reimplemented!)
from ml.training.intent_predictor import IntentPredictor
from core.answer_evaluator import AnswerEvaluator

app = FastAPI()

# Load ORIGINAL classes
predictor = IntentPredictor()  # Uses original IntentClassifier
evaluator = AnswerEvaluator()  # Uses original SentenceTransformer

@app.post("/predict")
async def predict_intent(request: PredictRequest):
    # Calls ORIGINAL predictor.predict_with_scores()
    predictions = predictor.predict_with_scores(request.text, request.threshold)
    return {"predictions": predictions}

@app.post("/evaluate")
async def evaluate_answer(request: EvaluateRequest):
    # Calls ORIGINAL evaluator.evaluate()
    score, is_correct = evaluator.evaluate(request.user_answer, request.expected_answer)
    return {"score": score, "is_correct": is_correct}
```

### Why Keep Python for ML?

1. **Model Accuracy**: The trained `intent_model.pth` works with PyTorch
2. **SentenceTransformer**: The embedding model requires the Python library
3. **No Retraining**: Using the original code means no need to retrain
4. **Proven Logic**: The evaluation algorithm is tested and working

### Option B: ONNX.js (NOT Recommended)

Converting to ONNX would require:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    return {"status": "healthy", "models_loaded": True}
```

**File: `ml-service/requirements.txt`**
```
fastapi>=0.100.0
uvicorn>=0.22.0
torch>=2.2.2
sentence-transformers>=2.6.0
numpy>=1.26.4
```

### Option B: ONNX.js (Alternative - Browser/Node Compatible)

Convert PyTorch model to ONNX for JavaScript inference.

**File: `scripts/export-onnx.py`**
```python
import torch
import numpy as np
from backend.ml.models.intent_classifier import IntentClassifier

# Load model
checkpoint = torch.load('backend/ml/models/saved/intent_model.pth')
model = IntentClassifier()
model.load_state_dict(checkpoint['model_state_dict'])
model.eval()

# Create dummy input
dummy_input = torch.randn(1, 384)  # Batch size 1, embedding dim 384

# Export to ONNX
torch.onnx.export(
    model,
    dummy_input,
    'server/src/models/ml/intent_model.onnx',
    input_names=['embedding'],
    output_names=['logits'],
    dynamic_axes={'embedding': {0: 'batch_size'}, 'logits': {0: 'batch_size'}}
)
print("✅ Model exported to ONNX")
```

---

## 7. Phase 3: Core Logic Migration

### 7.1 Question Model (MongoDB)

**File: `server/src/models/Question.js`**
```javascript
const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  topic: {
    type: String,
    required: true,
    enum: ['Java', 'Python', 'JavaScript', 'React', 'SQL', 'Machine_Learning', 'Deep_Learning'],
    index: true
  },
  question: {
    type: String,
    required: true
  },
  expectedAnswer: {
    type: String,
    required: true
  },
  keywords: [{
    type: String,
    index: true
  }],
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  timesAsked: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Text index for keyword search
questionSchema.index({ question: 'text', keywords: 'text' });

module.exports = mongoose.model('Question', questionSchema);
```

### 7.2 Interview Session Model

**File: `server/src/models/Session.js`**
```javascript
const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
  questionText: String,
  topic: String,
  userAnswer: String,
  expectedAnswer: String,
  score: Number,
  timestamp: { type: Date, default: Date.now }
});

const sessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  state: {
    type: String,
    enum: ['INTRO', 'RESUME_WARMUP', 'RESUME_DEEP_DIVE', 'DEEP_DIVE', 'MIX_ROUND', 'FINISHED'],
    default: 'INTRO'
  },
  skillsDetected: [String],
  skillsQueue: [String],
  currentTopic: String,
  questionsAsked: { type: Number, default: 0 },
  askedQuestionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
  answers: [answerSchema],
  resumePath: String,
  resumeSummary: String,
  resumeQuestionsAsked: { type: Number, default: 0 },
  startedAt: { type: Date, default: Date.now },
  endedAt: Date,
  finalScore: Number
}, {
  timestamps: true
});

module.exports = mongoose.model('Session', sessionSchema);
```

### 7.3 Question Service

**File: `server/src/services/question.service.js`**
```javascript
const Question = require('../models/Question');

// In-memory keyword index (built on startup)
let KEYWORD_INDEX = {};

const COMMON_IGNORE_WORDS = new Set([
  'the', 'is', 'a', 'an', 'and', 'or', 'in', 'on', 'of', 'to', 'with', 'what', 'how',
  'why', 'describe', 'explain', 'scenario', 'difference', 'between', 'use', 'using',
  'does', 'do', 'you', 'your', 'my', 'i', 'it', 'that', 'this', 'for', 'are', 'have', 'has'
]);

/**
 * Build keyword index from database
 */
async function buildKeywordIndex() {
  const questions = await Question.find({});
  KEYWORD_INDEX = {};

  for (const q of questions) {
    const words = q.question.toLowerCase()
      .replace(/[?.,]/g, '')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !COMMON_IGNORE_WORDS.has(w));

    for (const word of words) {
      if (!KEYWORD_INDEX[word]) {
        KEYWORD_INDEX[word] = [];
      }
      KEYWORD_INDEX[word].push({
        topic: q.topic,
        questionId: q._id,
        question: q.question,
        expectedAnswer: q.expectedAnswer
      });
    }
  }

  console.log(`✅ Keyword index built with ${Object.keys(KEYWORD_INDEX).length} keywords`);
}

/**
 * Get a unique question for a topic
 */
async function getUniqueQuestion(topic, excludeIds = []) {
  const question = await Question.findOne({
    topic,
    _id: { $nin: excludeIds }
  });

  return question;
}

/**
 * Get question by keyword (for counter-questioning)
 */
function getQuestionByKeyword(keyword, currentTopic = null, allowedTopics = []) {
  keyword = keyword.toLowerCase();
  
  if (!KEYWORD_INDEX[keyword]) {
    return null;
  }

  let matches = KEYWORD_INDEX[keyword];

  // Filter by allowed topics
  if (allowedTopics.length > 0) {
    matches = matches.filter(m => allowedTopics.includes(m.topic));
  }

  if (matches.length === 0) return null;

  // Prioritize current topic
  if (currentTopic) {
    const topicMatches = matches.filter(m => m.topic === currentTopic);
    if (topicMatches.length > 0) {
      return topicMatches[Math.floor(Math.random() * topicMatches.length)];
    }
  }

  return matches[Math.floor(Math.random() * matches.length)];
}

/**
 * Get all questions for a topic
 */
async function getAllQuestions(topic) {
  return Question.find({ topic });
}

module.exports = {
  buildKeywordIndex,
  getUniqueQuestion,
  getQuestionByKeyword,
  getAllQuestions,
  KEYWORD_INDEX
};
```

### 7.4 Interview Service (State Machine)

**File: `server/src/services/interview.service.js`**
```javascript
const Session = require('../models/Session');
const questionService = require('./question.service');
const mlService = require('./ml.service');
const resumeService = require('./resume.service');

const QUESTIONS_PER_TOPIC = 5;
const MAX_WARMUP_QUESTIONS = 3;

const STOP_PHRASES = ['stop interview', 'terminate', 'end session', 'abort'];
const SKIP_PHRASES = ["don't know", 'skip', 'no idea', 'pass', 'next question'];

class InterviewService {
  constructor(sessionId, io, socketId) {
    this.sessionId = sessionId;
    this.io = io;
    this.socketId = socketId;
    this.session = null;
    this.contextKeywords = [];
    this.usedKeywords = new Set();
    this.isRunning = false;
  }

  async initialize(resumePath = null) {
    // Create or load session
    this.session = await Session.create({
      state: 'INTRO',
      resumePath,
      skillsQueue: [],
      skillsDetected: [],
      currentTopic: '',
      questionsAsked: 0,
      askedQuestionIds: [],
      answers: []
    });

    this.isRunning = true;
    return this.session;
  }

  async processIntroduction(transcribedText) {
    // Use ML service to predict topics
    const predictions = await mlService.predictIntent(transcribedText, 0.3);
    
    const detectedSkills = predictions.top_topics || [];
    if (detectedSkills.length === 0) {
      detectedSkills.push('Java'); // Fallback
    }

    // Update session
    this.session.skillsDetected = detectedSkills;
    this.session.skillsQueue = [...detectedSkills];
    
    if (this.session.resumePath) {
      this.session.state = 'RESUME_WARMUP';
    } else {
      this.session.state = 'DEEP_DIVE';
      this.session.currentTopic = this.session.skillsQueue.shift() || 'Java';
    }

    await this.session.save();
    return { skills: detectedSkills, state: this.session.state };
  }

  async getNextQuestion() {
    const state = this.session.state;

    if (state === 'RESUME_DEEP_DIVE') {
      return this.getResumeQuestion();
    }

    // Check for counter-question opportunity
    if (this.contextKeywords.length > 0) {
      const keyword = this.contextKeywords.shift();
      if (!this.usedKeywords.has(keyword)) {
        const keywordQ = questionService.getQuestionByKeyword(
          keyword,
          this.session.currentTopic,
          this.session.skillsDetected
        );
        if (keywordQ) {
          this.usedKeywords.add(keyword);
          return {
            question: keywordQ.question,
            expectedAnswer: keywordQ.expectedAnswer,
            topic: keywordQ.topic,
            isCounterQuestion: true,
            keyword
          };
        }
      }
    }

    // Get regular question
    const topic = state === 'MIX_ROUND'
      ? this.session.skillsDetected[Math.floor(Math.random() * this.session.skillsDetected.length)]
      : this.session.currentTopic;

    const question = await questionService.getUniqueQuestion(
      topic,
      this.session.askedQuestionIds
    );

    if (!question) {
      // Topic exhausted
      return this.handleTopicExhausted();
    }

    this.session.askedQuestionIds.push(question._id);
    await this.session.save();

    return {
      questionId: question._id,
      question: question.question,
      expectedAnswer: question.expectedAnswer,
      topic: question.topic,
      isCounterQuestion: false
    };
  }

  async processAnswer(questionData, userAnswer) {
    // Check for stop/skip signals
    const lowerAnswer = userAnswer.toLowerCase();
    
    for (const phrase of STOP_PHRASES) {
      if (lowerAnswer.includes(phrase)) {
        return { action: 'STOP', message: 'Interview terminated by user' };
      }
    }

    for (const phrase of SKIP_PHRASES) {
      if (lowerAnswer.includes(phrase)) {
        return { action: 'SKIP', message: 'Question skipped' };
      }
    }

    // Evaluate answer
    const evaluation = await mlService.evaluateAnswer(userAnswer, questionData.expectedAnswer);

    // Extract keywords for counter-questioning
    const keywords = this.extractKeywords(userAnswer);
    this.contextKeywords.push(...keywords);

    // Record answer
    this.session.answers.push({
      questionId: questionData.questionId,
      questionText: questionData.question,
      topic: questionData.topic,
      userAnswer,
      expectedAnswer: questionData.expectedAnswer,
      score: evaluation.score
    });

    this.session.questionsAsked += 1;
    await this.session.save();

    // Check state transitions
    return this.checkStateTransition(evaluation);
  }

  extractKeywords(text) {
    const words = text.toLowerCase().split(/\s+/);
    const keywords = [];
    
    for (const word of words) {
      if (questionService.KEYWORD_INDEX[word] && word.length >= 3) {
        keywords.push(word);
      }
    }

    return keywords.slice(0, 2); // Max 2 keywords
  }

  async checkStateTransition(evaluation) {
    const state = this.session.state;

    if (state === 'DEEP_DIVE' && this.session.questionsAsked >= QUESTIONS_PER_TOPIC) {
      if (this.session.skillsQueue.length > 0) {
        this.session.currentTopic = this.session.skillsQueue.shift();
        this.session.questionsAsked = 0;
        await this.session.save();
        return { action: 'NEXT_TOPIC', topic: this.session.currentTopic, ...evaluation };
      } else {
        this.session.state = 'MIX_ROUND';
        this.session.questionsAsked = 0;
        await this.session.save();
        return { action: 'MIX_ROUND', ...evaluation };
      }
    }

    if (state === 'MIX_ROUND' && this.session.questionsAsked >= 5) {
      return { action: 'FINISH', ...evaluation };
    }

    return { action: 'CONTINUE', ...evaluation };
  }

  async generateReport() {
    this.session.state = 'FINISHED';
    this.session.endedAt = new Date();
    
    const totalScore = this.session.answers.reduce((sum, a) => sum + a.score, 0);
    this.session.finalScore = this.session.answers.length > 0
      ? Math.round(totalScore / this.session.answers.length)
      : 0;

    await this.session.save();

    return {
      sessionId: this.session._id,
      finalScore: this.session.finalScore,
      answers: this.session.answers,
      skillsDetected: this.session.skillsDetected,
      resumeSummary: this.session.resumeSummary,
      duration: this.session.endedAt - this.session.startedAt
    };
  }
}

module.exports = InterviewService;
```

### 7.5 ML Service (Calls Python Microservice)

**File: `server/src/services/ml.service.js`**
```javascript
const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

/**
 * Predict topic intents from text
 */
async function predictIntent(text, threshold = 0.5) {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/predict`, {
      text,
      threshold
    });
    return response.data;
  } catch (error) {
    console.error('ML Service error:', error.message);
    // Fallback: return empty predictions
    return { predictions: [], top_topics: ['General'] };
  }
}

/**
 * Evaluate user answer against expected answer
 */
async function evaluateAnswer(userAnswer, expectedAnswer) {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/evaluate`, {
      user_answer: userAnswer,
      expected_answer: expectedAnswer
    });
    return response.data;
  } catch (error) {
    console.error('ML Service error:', error.message);
    // Fallback: basic length-based scoring
    const score = Math.min(100, Math.max(0, userAnswer.length * 2));
    return { score, is_correct: score >= 50 };
  }
}

/**
 * Health check for ML service
 */
async function healthCheck() {
  try {
    const response = await axios.get(`${ML_SERVICE_URL}/health`);
    return response.data;
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}

module.exports = {
  predictIntent,
  evaluateAnswer,
  healthCheck
};
```

---

## 8. Phase 4: Resume Module Migration

### 8.1 Resume Service

**File: `server/src/services/resume.service.js`**
```javascript
const fs = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

// Section patterns (ported from Python)
const SECTION_PATTERNS = {
  education: /^\s*(education|academic\s*background|academic\s*qualifications?|degrees?|schooling)\s*:?\s*$/i,
  experience: /^\s*(work\s*experience|professional\s*experience|employment(\s*history)?|work\s*history|career|experience)\s*:?\s*$/i,
  internships: /^\s*(internships?|training|industrial\s*training|summer\s*training)\s*:?\s*$/i,
  projects: /^\s*(projects?|personal\s*projects?|academic\s*projects?|portfolio|key\s*projects?)\s*:?\s*$/i,
  skills: /^\s*(skills?|technical\s*skills?|technologies?|tools?|proficienc(y|ies)|expertise|competenc(y|ies)|tech\s*stack)\s*:?\s*$/i,
  certifications: /^\s*(certifications?|certificates?|credentials?|licenses?|professional\s*development)\s*:?\s*$/i,
  achievements: /^\s*(achievements?|awards?|honors?|recognitions?|accomplishments?)\s*:?\s*$/i,
  leadership: /^\s*(leadership|extracurricular|activities|volunteer(ing)?|positions?\s*of\s*responsibility|roles?)\s*:?\s*$/i,
};

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_PATTERN = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;

const COMMON_SKILLS = [
  'python', 'java', 'javascript', 'typescript', 'c++', 'c#', 'ruby', 'go', 'rust',
  'react', 'angular', 'vue', 'node.js', 'express', 'django', 'flask', 'spring',
  'mysql', 'postgresql', 'mongodb', 'redis', 'sql', 'nosql',
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'git', 'linux',
  'machine learning', 'deep learning', 'tensorflow', 'pytorch',
  'html', 'css', 'rest api', 'graphql', 'microservices'
];

/**
 * Extract text from resume file
 */
async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = await fs.readFile(filePath);

  if (ext === '.pdf') {
    const data = await pdfParse(buffer);
    return { text: data.text, method: 'pdf_direct', confidence: 0.9 };
  }

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value, method: 'docx', confidence: 0.9 };
  }

  if (ext === '.txt') {
    return { text: buffer.toString('utf-8'), method: 'txt', confidence: 1.0 };
  }

  throw new Error(`Unsupported file format: ${ext}`);
}

/**
 * Parse extracted text into sections
 */
function parseResume(rawText) {
  const result = {
    rawText,
    name: null,
    email: null,
    phone: null,
    education: [],
    experience: [],
    internships: [],
    projects: [],
    skills: [],
    certifications: [],
    achievements: [],
    leadership: [],
  };

  // Extract contact info
  const emailMatch = rawText.match(EMAIL_PATTERN);
  if (emailMatch) result.email = emailMatch[0];

  const phoneMatch = rawText.match(PHONE_PATTERN);
  if (phoneMatch) result.phone = phoneMatch[0];

  // Extract name (first non-empty line without email)
  const lines = rawText.split('\n');
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim();
    if (trimmed && trimmed.length < 50 && !EMAIL_PATTERN.test(trimmed)) {
      if (!/\d/.test(trimmed)) {
        result.name = trimmed;
        break;
      }
    }
  }

  // Split into sections
  const sections = splitIntoSections(rawText);
  
  for (const [sectionName, content] of Object.entries(sections)) {
    if (sectionName === 'skills') {
      result.skills = extractSkills(content, rawText);
    } else if (result[sectionName] !== undefined) {
      result[sectionName] = [{ content: content.trim() }];
    }
  }

  // Extract skills from full text if not found in section
  if (result.skills.length === 0) {
    result.skills = extractSkills('', rawText);
  }

  // Calculate question capacity
  result.questionCapacity = calculateQuestionCapacity(result);
  result.isThinResume = result.questionCapacity < 8;

  return result;
}

function splitIntoSections(text) {
  const sections = {};
  const lines = text.split('\n');
  
  let currentSection = 'header';
  let currentContent = [];

  for (const line of lines) {
    let sectionFound = null;

    for (const [name, pattern] of Object.entries(SECTION_PATTERNS)) {
      if (pattern.test(line.trim())) {
        sectionFound = name;
        break;
      }
    }

    if (sectionFound) {
      if (currentContent.length > 0) {
        sections[currentSection] = currentContent.join('\n');
      }
      currentSection = sectionFound;
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentContent.length > 0) {
    sections[currentSection] = currentContent.join('\n');
  }

  return sections;
}

function extractSkills(sectionContent, fullText) {
  const textToSearch = (sectionContent + ' ' + fullText).toLowerCase();
  const foundSkills = [];

  for (const skill of COMMON_SKILLS) {
    if (textToSearch.includes(skill.toLowerCase())) {
      foundSkills.push(skill);
    }
  }

  return [...new Set(foundSkills)]; // Remove duplicates
}

function calculateQuestionCapacity(parsedResume) {
  let capacity = 0;
  capacity += parsedResume.skills.length * 2;
  capacity += parsedResume.projects.length * 3;
  capacity += parsedResume.experience.length * 3;
  capacity += parsedResume.internships.length * 2;
  capacity += parsedResume.education.length * 1;
  return Math.min(capacity, 25); // Cap at 25
}

module.exports = {
  extractText,
  parseResume
};
```

### 8.2 Gemini Service

**File: `server/src/services/gemini.service.js`**
```javascript
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const path = require('path');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `You are a senior technical interviewer with 15+ years at FAANG companies.
You conduct interviews like a REAL human - conversational, curious, and deeply probing.

YOUR INTERVIEWING STYLE:
1. You DON'T ask robotic, one-line questions
2. You GO DEEP on each topic
3. You CONNECT questions naturally
4. You sound like a curious colleague, NOT a checklist reader
5. You CHALLENGE the candidate respectfully

FORBIDDEN PATTERNS:
❌ "Tell me about your roles and responsibilities"
❌ "Describe your experience with X"
❌ Generic questions that could apply to ANY resume

REQUIRED PATTERNS:
✅ Reference EXACT project names, company names, tech stack from resume
✅ Ask "Why did you choose [specific tech] over [alternative]?"
✅ Ask scenario-based questions

OUTPUT: Valid JSON only.`;

/**
 * Generate interview questions from resume
 */
async function generateQuestionsFromResume(parsedResume, numQuestions = 20) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `${SYSTEM_PROMPT}

Based on this resume data, generate ${numQuestions} interview questions:

NAME: ${parsedResume.name || 'Unknown'}
SKILLS: ${parsedResume.skills.join(', ')}
EXPERIENCE: ${parsedResume.experience.map(e => e.content).join('\n')}
PROJECTS: ${parsedResume.projects.map(p => p.content).join('\n')}
EDUCATION: ${parsedResume.education.map(e => e.content).join('\n')}

Return JSON format:
{
  "summary": "1-2 sentence candidate profile",
  "questions": [
    {
      "question": "Full question text",
      "type": "deep_dive|tradeoff|scaling|retrospective|behavioral",
      "difficulty": "easy|medium|hard",
      "expected_answer": "Key points",
      "section": "experience|projects|skills|education",
      "keywords": ["keyword1", "keyword2"]
    }
  ]
}`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Invalid JSON response');
  } catch (error) {
    console.error('Gemini error:', error.message);
    throw error;
  }
}

/**
 * Generate questions from direct PDF upload
 */
async function generateQuestionsFromFile(filePath, parsedResume, numQuestions = 20) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Read file as base64
  const fileBuffer = await fs.readFile(filePath);
  const base64Data = fileBuffer.toString('base64');
  const mimeType = path.extname(filePath) === '.pdf' ? 'application/pdf' : 'application/octet-stream';

  const prompt = `${SYSTEM_PROMPT}

Read this resume file and generate ${numQuestions} personalized interview questions.

Return JSON format:
{
  "summary": "1-2 sentence candidate profile",
  "questions": [
    {
      "question": "Full question text",
      "type": "deep_dive|tradeoff|scaling|retrospective|behavioral",
      "difficulty": "easy|medium|hard",
      "expected_answer": "Key points",
      "section": "experience|projects|skills|education",
      "keywords": ["keyword1", "keyword2"]
    }
  ]
}`;

  try {
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: base64Data
        }
      },
      prompt
    ]);
    
    const response = result.response.text();
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Invalid JSON response');
  } catch (error) {
    console.error('Gemini file upload error:', error.message);
    // Fallback to text-based generation
    return generateQuestionsFromResume(parsedResume, numQuestions);
  }
}

module.exports = {
  generateQuestionsFromResume,
  generateQuestionsFromFile
};
```

---

## 9. Phase 5: React Frontend Development

### 9.1 Initialize React Project

```bash
# Create React app with Vite
npm create vite@latest client -- --template react
cd client
npm install

# Install dependencies
npm install axios socket.io-client react-router-dom
npm install @headlessui/react @heroicons/react  # UI components
npm install react-dropzone                       # File upload
npm install tailwindcss postcss autoprefixer     # Styling
npx tailwindcss init -p
```

### 9.2 Main App Structure

**File: `client/src/App.jsx`**
```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { InterviewProvider } from './context/InterviewContext';
import Navbar from './components/shared/Navbar';
import Dashboard from './components/Dashboard/Dashboard';
import InterviewPage from './components/Interview/InterviewPage';
import ReportView from './components/Report/ReportView';

function App() {
  return (
    <BrowserRouter>
      <InterviewProvider>
        <div className="min-h-screen bg-gray-100">
          <Navbar />
          <main className="container mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/interview" element={<InterviewPage />} />
              <Route path="/report/:sessionId" element={<ReportView />} />
            </Routes>
          </main>
        </div>
      </InterviewProvider>
    </BrowserRouter>
  );
}

export default App;
```

### 9.3 Interview Context

**File: `client/src/context/InterviewContext.jsx`**
```jsx
import { createContext, useContext, useReducer, useEffect } from 'react';
import { io } from 'socket.io-client';

const InterviewContext = createContext();

const initialState = {
  session: null,
  state: 'IDLE', // IDLE, INTRO, INTERVIEWING, FINISHED
  currentQuestion: null,
  transcript: [],
  isRecording: false,
  isListening: false,
  isSpeaking: false,
  skills: [],
  score: null,
  socket: null,
};

function interviewReducer(state, action) {
  switch (action.type) {
    case 'SET_SOCKET':
      return { ...state, socket: action.payload };
    case 'START_SESSION':
      return { ...state, session: action.payload, state: 'INTRO' };
    case 'SET_STATE':
      return { ...state, state: action.payload };
    case 'SET_QUESTION':
      return { ...state, currentQuestion: action.payload };
    case 'ADD_TRANSCRIPT':
      return { ...state, transcript: [...state.transcript, action.payload] };
    case 'SET_RECORDING':
      return { ...state, isRecording: action.payload };
    case 'SET_LISTENING':
      return { ...state, isListening: action.payload };
    case 'SET_SPEAKING':
      return { ...state, isSpeaking: action.payload };
    case 'SET_SKILLS':
      return { ...state, skills: action.payload };
    case 'FINISH':
      return { ...state, state: 'FINISHED', score: action.payload };
    case 'RESET':
      return { ...initialState, socket: state.socket };
    default:
      return state;
  }
}

export function InterviewProvider({ children }) {
  const [state, dispatch] = useReducer(interviewReducer, initialState);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');
    
    socket.on('connect', () => {
      console.log('Connected to server');
      dispatch({ type: 'SET_SOCKET', payload: socket });
    });

    socket.on('question', (data) => {
      dispatch({ type: 'SET_QUESTION', payload: data });
      dispatch({ type: 'ADD_TRANSCRIPT', payload: { type: 'question', ...data } });
    });

    socket.on('evaluation', (data) => {
      dispatch({ type: 'ADD_TRANSCRIPT', payload: { type: 'evaluation', ...data } });
    });

    socket.on('state_change', (data) => {
      dispatch({ type: 'SET_STATE', payload: data.state });
      if (data.skills) {
        dispatch({ type: 'SET_SKILLS', payload: data.skills });
      }
    });

    socket.on('interview_complete', (data) => {
      dispatch({ type: 'FINISH', payload: data });
    });

    return () => socket.disconnect();
  }, []);

  return (
    <InterviewContext.Provider value={{ state, dispatch }}>
      {children}
    </InterviewContext.Provider>
  );
}

export function useInterview() {
  const context = useContext(InterviewContext);
  if (!context) {
    throw new Error('useInterview must be used within InterviewProvider');
  }
  return context;
}
```

### 9.4 Audio Recorder Hook

**File: `client/src/hooks/useAudioRecorder.js`**
```javascript
import { useState, useRef, useCallback } from 'react';

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const getAudioBase64 = useCallback(async () => {
    if (!audioBlob) return null;
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(audioBlob);
    });
  }, [audioBlob]);

  return {
    isRecording,
    audioBlob,
    startRecording,
    stopRecording,
    getAudioBase64
  };
}
```

### 9.5 Speech Synthesis Hook

**File: `client/src/hooks/useSpeechSynthesis.js`**
```javascript
import { useState, useCallback, useEffect } from 'react';

export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices();
      setVoices(availableVoices);
      
      // Try to find an Indian English voice
      const indianVoice = availableVoices.find(v => 
        v.lang.includes('en-IN') || v.name.includes('India')
      );
      setSelectedVoice(indianVoice || availableVoices[0]);
    };

    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const speak = useCallback((text) => {
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        resolve();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        resolve();
      };

      speechSynthesis.speak(utterance);
    });
  }, [selectedVoice]);

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return {
    isSpeaking,
    voices,
    selectedVoice,
    setSelectedVoice,
    speak,
    stop
  };
}
```

### 9.6 Interview Page Component

**File: `client/src/components/Interview/InterviewPage.jsx`**
```jsx
import { useState, useEffect } from 'react';
import { useInterview } from '../../context/InterviewContext';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import ResumeUpload from '../Resume/ResumeUpload';
import QuestionDisplay from './QuestionDisplay';
import TranscriptPanel from './TranscriptPanel';
import InterviewControls from './InterviewControls';

export default function InterviewPage() {
  const { state, dispatch } = useInterview();
  const { isRecording, startRecording, stopRecording, getAudioBase64 } = useAudioRecorder();
  const { isSpeaking, speak } = useSpeechSynthesis();
  const [resumeFile, setResumeFile] = useState(null);

  const handleStartInterview = async () => {
    if (!state.socket) return;

    // Upload resume if provided
    let resumePath = null;
    if (resumeFile) {
      const formData = new FormData();
      formData.append('resume', resumeFile);
      
      const response = await fetch('/api/resume/upload', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      resumePath = data.path;
    }

    // Start interview session
    state.socket.emit('start_interview', { resumePath });
    dispatch({ type: 'SET_STATE', payload: 'INTRO' });

    // Speak greeting
    await speak('Hello. I am your AI Interviewer. Please introduce yourself and list your technical skills.');
  };

  const handleRecordAnswer = async () => {
    if (isRecording) {
      stopRecording();
      const audioBase64 = await getAudioBase64();
      
      // Send audio to server for transcription
      state.socket.emit('submit_answer', {
        audio: audioBase64,
        questionId: state.currentQuestion?.questionId
      });
    } else {
      startRecording();
    }
  };

  const handleStopInterview = () => {
    state.socket.emit('stop_interview');
  };

  // Speak new questions automatically
  useEffect(() => {
    if (state.currentQuestion && !isSpeaking) {
      speak(state.currentQuestion.question);
    }
  }, [state.currentQuestion]);

  if (state.state === 'IDLE') {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">AI Smart Interviewer</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Upload Resume (Optional)</h2>
          <ResumeUpload onFileSelect={setResumeFile} />
        </div>

        <button
          onClick={handleStartInterview}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700"
        >
          Start Interview
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <QuestionDisplay
          question={state.currentQuestion}
          isSpeaking={isSpeaking}
        />
        
        <InterviewControls
          isRecording={isRecording}
          onRecord={handleRecordAnswer}
          onStop={handleStopInterview}
          state={state.state}
        />
      </div>

      <div className="lg:col-span-1">
        <TranscriptPanel transcript={state.transcript} />
      </div>
    </div>
  );
}
```

---

## 10. Phase 6: Real-time Communication (WebSocket)

### 10.1 Socket.io Handler

**File: `server/src/socket/interviewHandler.js`**
```javascript
const InterviewService = require('../services/interview.service');
const resumeService = require('../services/resume.service');
const geminiService = require('../services/gemini.service');

// Store active interviews
const activeInterviews = new Map();

module.exports = function(io) {
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('start_interview', async (data) => {
      try {
        const { resumePath } = data;
        
        const interview = new InterviewService(null, io, socket.id);
        await interview.initialize(resumePath);
        
        activeInterviews.set(socket.id, interview);

        socket.emit('interview_started', {
          sessionId: interview.session._id,
          state: interview.session.state
        });

        // If resume provided, start background processing
        if (resumePath) {
          processResumeBackground(socket, interview, resumePath);
        }
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('submit_intro', async (data) => {
      const interview = activeInterviews.get(socket.id);
      if (!interview) return;

      try {
        const { transcribedText } = data;
        const result = await interview.processIntroduction(transcribedText);

        socket.emit('state_change', {
          state: result.state,
          skills: result.skills
        });

        // Get first question
        const question = await interview.getNextQuestion();
        socket.emit('question', question);
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('submit_answer', async (data) => {
      const interview = activeInterviews.get(socket.id);
      if (!interview) return;

      try {
        const { transcribedText, questionData } = data;
        const result = await interview.processAnswer(questionData, transcribedText);

        socket.emit('evaluation', {
          score: result.score,
          isCorrect: result.is_correct
        });

        if (result.action === 'STOP' || result.action === 'FINISH') {
          const report = await interview.generateReport();
          socket.emit('interview_complete', report);
          activeInterviews.delete(socket.id);
        } else {
          if (result.action === 'NEXT_TOPIC') {
            socket.emit('state_change', {
              state: 'DEEP_DIVE',
              topic: result.topic,
              message: `Moving on to ${result.topic}`
            });
          } else if (result.action === 'MIX_ROUND') {
            socket.emit('state_change', {
              state: 'MIX_ROUND',
              message: 'Rapid fire round'
            });
          }

          const question = await interview.getNextQuestion();
          socket.emit('question', question);
        }
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('stop_interview', async () => {
      const interview = activeInterviews.get(socket.id);
      if (!interview) return;

      const report = await interview.generateReport();
      socket.emit('interview_complete', report);
      activeInterviews.delete(socket.id);
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      activeInterviews.delete(socket.id);
    });
  });
};

async function processResumeBackground(socket, interview, resumePath) {
  try {
    // Extract and parse resume
    const { text } = await resumeService.extractText(resumePath);
    const parsedResume = resumeService.parseResume(text);

    // Generate questions
    const questionSet = await geminiService.generateQuestionsFromResume(parsedResume);

    // Store questions in interview
    interview.session.resumeSummary = questionSet.summary;
    interview.session.resumeQuestions = questionSet.questions;
    await interview.session.save();

    socket.emit('resume_processed', {
      summary: questionSet.summary,
      questionCount: questionSet.questions.length
    });
  } catch (error) {
    console.error('Resume processing error:', error);
    socket.emit('resume_error', { message: error.message });
  }
}
```

---

## 11. Phase 7: Testing & Validation

### 11.1 Backend Tests

**File: `server/__tests__/interview.test.js`**
```javascript
const request = require('supertest');
const { app } = require('../src/app');
const mongoose = require('mongoose');
const Question = require('../src/models/Question');

describe('Interview API', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGODB_URI);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('GET /api/questions/:topic', () => {
    it('should return questions for a valid topic', async () => {
      const res = await request(app)
        .get('/api/questions/Java')
        .expect(200);

      expect(res.body).toHaveProperty('questions');
      expect(Array.isArray(res.body.questions)).toBe(true);
    });

    it('should return 404 for invalid topic', async () => {
      await request(app)
        .get('/api/questions/InvalidTopic')
        .expect(404);
    });
  });
});
```

### 11.2 Frontend Tests

**File: `client/src/__tests__/InterviewPage.test.jsx`**
```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { InterviewProvider } from '../context/InterviewContext';
import InterviewPage from '../components/Interview/InterviewPage';

describe('InterviewPage', () => {
  it('renders start interview button', () => {
    render(
      <InterviewProvider>
        <InterviewPage />
      </InterviewProvider>
    );

    expect(screen.getByText('Start Interview')).toBeInTheDocument();
  });

  it('shows resume upload option', () => {
    render(
      <InterviewProvider>
        <InterviewPage />
      </InterviewProvider>
    );

    expect(screen.getByText(/Upload Resume/i)).toBeInTheDocument();
  });
});
```

---

## 12. Phase 8: Deployment

### 12.1 Docker Compose

**File: `docker-compose.yml`**
```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    environment:
      MONGO_INITDB_DATABASE: interviewer-bot

  ml-service:
    build:
      context: ./ml-service
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    volumes:
      - ./ml-service/models:/app/models
    environment:
      - MODEL_PATH=/app/models/saved/intent_model.pth

  server:
    build:
      context: ./server
      dockerfile: Dockerfile
    ports:
      - "5000:5000"
    depends_on:
      - mongodb
      - ml-service
    environment:
      - MONGODB_URI=mongodb://mongodb:27017/interviewer-bot
      - ML_SERVICE_URL=http://ml-service:8000
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - NODE_ENV=production

  client:
    build:
      context: ./client
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    depends_on:
      - server

volumes:
  mongodb_data:
```

### 12.2 ML Service Dockerfile

**File: `ml-service/Dockerfile`**
```dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Expose port
EXPOSE 8000

# Run server
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 13. Critical Dependencies & Decisions

### 13.1 Speech-to-Text Options

| Option | Pros | Cons | Recommended For |
|--------|------|------|-----------------|
| **Web Speech API** | Free, no server load | Browser support varies, less accurate | Quick prototyping |
| **Whisper (Python)** | Very accurate, offline | Requires Python service, slow | Accuracy-critical |
| **OpenAI Whisper API** | Fast, accurate | Paid, requires API key | Production |
| **Google Speech-to-Text** | Fast, accurate | Paid | Production |

**Decision:** Start with Web Speech API for client-side, with fallback to server-side Whisper for accuracy.

### 13.2 Text-to-Speech Options

| Option | Pros | Cons | Recommended For |
|--------|------|------|-----------------|
| **Web Speech API** | Free, client-side | Voice quality varies | Development |
| **Google Cloud TTS** | High quality | Paid | Production |
| **ElevenLabs** | Ultra-realistic | Expensive | Premium tier |

**Decision:** Web Speech API for MVP, upgrade to Google Cloud TTS for production.

### 13.3 ML Model Hosting

| Option | Pros | Cons | Recommended For |
|--------|------|------|-----------------|
| **Python Microservice** | Full PyTorch compatibility | Extra service to maintain | When retraining needed |
| **ONNX.js** | Single stack (JavaScript) | Limited model support | Simple inference |
| **TensorFlow.js** | Browser-compatible | Model conversion required | Edge deployment |

**Decision:** Python microservice (recommended for this project's complexity).

---

## 14. Risk Assessment & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| ML model accuracy drop after conversion | High | Medium | Keep Python microservice as fallback |
| WebSocket connection instability | High | Low | Implement reconnection logic, fallback to polling |
| Browser speech API compatibility | Medium | Medium | Polyfills + server-side fallback |
| Gemini API rate limits | Medium | Medium | Request queuing, caching |
| MongoDB performance at scale | Low | Low | Indexing, connection pooling |
| Audio latency | High | Medium | Streaming chunks instead of full audio |

---

## 15. Implementation Checklist

### Phase 1: Backend Infrastructure ⬜
- [ ] Initialize Node.js project with Express
- [ ] Set up MongoDB connection with Mongoose
- [ ] Create environment configuration
- [ ] Set up Socket.io for real-time communication
- [ ] Create basic error handling middleware

### Phase 2: ML Model Integration ⬜
- [ ] Create Python FastAPI microservice
- [ ] Port IntentClassifier inference code
- [ ] Port AnswerEvaluator inference code
- [ ] Create Docker container for ML service
- [ ] Add health check endpoints
- [ ] Test inference accuracy matches original

### Phase 3: Core Logic Migration ⬜
- [ ] Create Question MongoDB schema
- [ ] Create Session MongoDB schema
- [ ] Create seed script for question bank
- [ ] Implement QuestionService with keyword index
- [ ] Implement InterviewService state machine
- [ ] Create interview WebSocket handlers
- [ ] Test state transitions match original

### Phase 4: Resume Module Migration ⬜
- [ ] Implement resume text extraction (PDF/DOCX)
- [ ] Port resume parser regex patterns
- [ ] Implement Gemini service for question generation
- [ ] Create resume question bank service
- [ ] Add file upload endpoint
- [ ] Test question generation quality

### Phase 5: React Frontend Development ⬜
- [ ] Initialize React project with Vite
- [ ] Set up routing with React Router
- [ ] Create InterviewContext for state management
- [ ] Implement audio recorder hook
- [ ] Implement speech synthesis hook
- [ ] Create Interview page components
- [ ] Create Resume upload component
- [ ] Create Report view component
- [ ] Style with Tailwind CSS

### Phase 6: Real-time Communication ⬜
- [ ] Implement Socket.io client in React
- [ ] Handle interview events (start, question, answer, stop)
- [ ] Implement reconnection logic
- [ ] Add loading states and error handling

### Phase 7: Testing & Validation ⬜
- [ ] Write backend unit tests (Jest)
- [ ] Write frontend component tests
- [ ] Create integration tests
- [ ] Run end-to-end interview scenario tests
- [ ] Validate ML accuracy against original
- [ ] Performance testing

### Phase 8: Deployment ⬜
- [ ] Create Dockerfiles for all services
- [ ] Set up docker-compose
- [ ] Configure production environment
- [ ] Set up CI/CD pipeline
- [ ] Deploy to cloud provider
- [ ] Monitor and optimize

---

## 📝 Notes for Implementation

### Preserving Original Functionality
1. **Zero-Latency Architecture**: Maintain async question processing - don't wait for evaluation before asking next question
2. **Counter-Questioning**: Keep keyword extraction and follow-up logic
3. **Topic Guardrails**: Ensure questions stay within detected skills
4. **Adaptive Flow**: Resume warmup → Resume questions → Local questions

### Key Differences from Current Implementation
1. **No Windows TTS dependency** - Browser-based Web Speech API
2. **No local Whisper** - Options for Web Speech API or server-side
3. **MongoDB instead of in-memory** - Persistent question bank
4. **WebSocket instead of blocking loops** - Real-time bidirectional communication
5. **React instead of command-line** - Full web interface

### Backward Compatibility
- Keep the Python ML service running the same models
- Maintain the same question bank content
- Preserve the exact scoring algorithm
- Keep Gemini prompts identical for consistent question generation

---

**Document End**

*Last Updated: January 31, 2026*
*Author: GitHub Copilot*
