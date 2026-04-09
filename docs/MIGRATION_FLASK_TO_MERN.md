# 🚀 Migration Plan: Flask → MERN Stack (SecureProctor AI)

> Status Update (April 2026): This file is a historical migration plan. The target architecture is now implemented in current project flow. For current runtime/deployment details, see `README.md`, `RUN_GUIDE.md`, and live app `https://www.skillwise.live`.

## Complete Documentation for Migrating the Proctoring Dashboard

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture Analysis](#2-current-architecture-analysis)
3. [Target Architecture (MERN)](#3-target-architecture-mern)
4. [Why MERN? — Justification](#4-why-mern--justification)
5. [Migration Strategy Overview](#5-migration-strategy-overview)
6. [Phase 1: Project Scaffolding & Setup](#phase-1-project-scaffolding--setup)
7. [Phase 2: Backend — Node.js + Express API Server](#phase-2-backend--nodejs--express-api-server)
8. [Phase 3: Python Microservice (ML Bridge)](#phase-3-python-microservice-ml-bridge)
9. [Phase 4: Frontend — React Dashboard](#phase-4-frontend--react-dashboard)
10. [Phase 5: Real-Time Communication (WebSocket)](#phase-5-real-time-communication-websocket)
11. [Phase 6: MongoDB Integration](#phase-6-mongodb-integration)
12. [Phase 7: UI/UX Enhancements](#phase-7-uiux-enhancements)
13. [Phase 8: Testing & Quality Assurance](#phase-8-testing--quality-assurance)
14. [Phase 9: Deployment & DevOps](#phase-9-deployment--devops)
15. [File-by-File Migration Map](#file-by-file-migration-map)
16. [Risk Assessment & Mitigation](#risk-assessment--mitigation)
17. [Timeline Estimate](#timeline-estimate)

---

## 1. Executive Summary

### What Are We Doing?

We are migrating the **SecureProctor AI** proctoring dashboard from a **Flask (Python)** monolithic server to a **MERN Stack** (MongoDB, Express.js, React, Node.js) architecture while **keeping all Python ML/DL model training and inference code intact**.

### What Changes?

| Component | Current (Flask) | Target (MERN) |
|-----------|----------------|----------------|
| **Web Server** | Flask (Python) | Express.js (Node.js) |
| **Frontend** | Vanilla HTML/CSS/JS | React.js (Vite) + TailwindCSS |
| **Real-Time Feed** | MJPEG over HTTP polling | WebSocket (Socket.IO) |
| **Database** | None (in-memory) | MongoDB (violation logs, sessions) |
| **ML Inference** | Direct Python import | Python microservice (FastAPI/Flask subprocess) |
| **State Management** | Global Python variables | React Context/Zustand + Server state |
| **API Style** | Flask routes returning JSON | RESTful Express API + WebSocket events |

### What Stays in Python?

- `eye_cnn_model.py` — CNN architecture (PyTorch)
- `train_pretrain.py` — Pretraining on external dataset
- `train_finetune.py` — Fine-tuning on local webcam data
- `proctor_live.py` — Camera capture + model inference loop
- `dataset_loader.py` — PyTorch Dataset class
- `collect_images.py` — Dataset collection script
- All `.pth` model weight files

---

## 2. Current Architecture Analysis

### 2.1 How the Current System Works

```
┌──────────────────────────────────────────────────────────────┐
│                   CURRENT FLASK ARCHITECTURE                  │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│   Browser (index.html + app.js + style.css)                  │
│       │                                                       │
│       │  HTTP Polling (every 800ms)                          │
│       │  GET /status → JSON {status, reason}                 │
│       │  GET /frame  → JPEG image (every 33ms)              │
│       │                                                       │
│       ▼                                                       │
│   Flask Server (server.py / app.py) — Port 5000             │
│       │                                                       │
│       ├── GET /           → Serves index.html                │
│       ├── GET /status     → Returns current_status (JSON)    │
│       ├── GET /start      → Starts proctor_thread            │
│       ├── GET /stop       → Stops proctoring                 │
│       ├── GET /cameras    → Lists available cameras          │
│       ├── GET /set_camera → Switches camera index            │
│       ├── GET /video_feed → MJPEG stream                     │
│       ├── GET /frame      → Single JPEG frame                │
│       └── GET /<path>     → Static file serving              │
│       │                                                       │
│       │  threading.Thread(target=start_proctoring)           │
│       ▼                                                       │
│   proctor_live.py (Background Thread)                        │
│       │                                                       │
│       ├── cv2.VideoCapture (camera)                          │
│       ├── Haar Cascade (face detection)                      │
│       ├── EyeCNN model (gaze classification)                 │
│       ├── Look-away timer (3.5s threshold)                   │
│       ├── winsound.Beep buzzer (Windows)                     │
│       └── Updates global: current_status, latest_frame       │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Current Files & Their Roles

| File | Role | Lines | Migrates To |
|------|------|-------|-------------|
| `server.py` | Flask HTTP server with routes | ~90 | Express.js routes |
| `app.py` | Alternate Flask server (auto-start camera) | ~55 | Express.js routes |
| `proctor_live.py` | Camera capture + ML inference + buzzer | ~160 | Python microservice (stays Python) |
| `eye_cnn_model.py` | PyTorch CNN model definition | ~30 | Stays Python (no change) |
| `index.html` | Dashboard UI (vanilla HTML) | ~250 | React components |
| `app.js` | Frontend logic (vanilla JS) | ~254 | React hooks + components |
| `style.css` | Dashboard styling | ~798 | TailwindCSS + CSS Modules |
| `train_pretrain.py` | Pretrain on external dataset | ~35 | Stays Python (no change) |
| `train_finetune.py` | Fine-tune on local data | ~38 | Stays Python (no change) |
| `dataset_loader.py` | PyTorch Dataset class | ~30 | Stays Python (no change) |
| `collect_images.py` | Webcam data capture tool | ~95 | Stays Python (no change) |

### 2.3 Current Pain Points (Why Migrate?)

1. **No component reusability** — Vanilla HTML/JS means every UI change requires editing one monolithic file
2. **HTTP polling is wasteful** — `setInterval(updateStatus, 800)` and `setInterval(refreshFrame, 33)` create ~30+ HTTP requests/second
3. **No database** — Violation logs are lost on page refresh (stored only in JS array)
4. **No session management** — Cannot review past proctoring sessions
5. **Flask serves EVERYTHING** — Static files, API, video stream all in one process
6. **No state management** — Global Python variables (`current_status`, `latest_frame`) are not thread-safe at scale
7. **Tight coupling** — ML code is directly imported into the web server

---

## 3. Target Architecture (MERN)

### 3.1 High-Level Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        TARGET MERN ARCHITECTURE                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   React Frontend (Vite) — Port 3000                                         │
│   ┌──────────────────────────────────────────────────────────┐              │
│   │  Pages:                                                   │              │
│   │  ├── Dashboard (Live feed + status + violations)         │              │
│   │  ├── History (Past sessions from MongoDB)                │              │
│   │  ├── Settings (Camera, sensitivity, alerts)              │              │
│   │  ├── Analytics (Charts, heatmaps, trends)                │              │
│   │  └── Training (Model training status/controls)           │              │
│   │                                                           │              │
│   │  State: Zustand/Context API                              │              │
│   │  Styling: TailwindCSS + Framer Motion                    │              │
│   │  Real-Time: Socket.IO Client                             │              │
│   └──────────────────────────────────────────────────────────┘              │
│       │                             │                                        │
│       │  REST API (CRUD)            │  WebSocket (Real-Time)                │
│       │  /api/sessions              │  events: frame, status, alert         │
│       │  /api/violations            │                                        │
│       │  /api/cameras               │                                        │
│       ▼                             ▼                                        │
│   Express.js + Node.js Server — Port 5000                                   │
│   ┌──────────────────────────────────────────────────────────┐              │
│   │  Middleware: CORS, Morgan, Helmet, Express-Rate-Limit    │              │
│   │  Routes:                                                  │              │
│   │  ├── /api/proctor  (start, stop, status)                 │              │
│   │  ├── /api/cameras  (list, switch)                        │              │
│   │  ├── /api/sessions (CRUD - MongoDB)                      │              │
│   │  ├── /api/violations (CRUD - MongoDB)                    │              │
│   │  └── /api/training (trigger training, status)            │              │
│   │                                                           │              │
│   │  Socket.IO Server:                                        │              │
│   │  ├── emit('frame', base64JPEG)  — every ~33ms           │              │
│   │  ├── emit('status', {status, reason})                    │              │
│   │  └── emit('alert', {violation details})                  │              │
│   └──────────────────────────────────────────────────────────┘              │
│       │                                                                      │
│       │  HTTP / Child Process / IPC                                         │
│       ▼                                                                      │
│   Python ML Microservice (FastAPI) — Port 8000                              │
│   ┌──────────────────────────────────────────────────────────┐              │
│   │  Endpoints:                                               │              │
│   │  ├── POST /start      → Start camera + inference loop    │              │
│   │  ├── POST /stop       → Stop proctoring                  │              │
│   │  ├── GET  /status     → Current detection status         │              │
│   │  ├── GET  /frame      → Latest JPEG frame                │              │
│   │  ├── GET  /cameras    → Available camera list            │              │
│   │  ├── POST /set_camera → Switch camera index              │              │
│   │  └── POST /train      → Trigger model training           │              │
│   │                                                           │              │
│   │  Internal:                                                │              │
│   │  ├── proctor_live.py  (camera + CNN inference)           │              │
│   │  ├── eye_cnn_model.py (PyTorch model)                    │              │
│   │  └── All training scripts                                │              │
│   └──────────────────────────────────────────────────────────┘              │
│       │                                                                      │
│       ▼                                                                      │
│   MongoDB — Port 27017                                                      │
│   ┌──────────────────────────────────────────────────────────┐              │
│   │  Collections:                                             │              │
│   │  ├── sessions    {startTime, endTime, cameraId, status}  │              │
│   │  ├── violations  {sessionId, timestamp, reason, frame}   │              │
│   │  ├── settings    {userId, sensitivity, alerts, camera}   │              │
│   │  └── analytics   {date, totalViolations, avgDuration}    │              │
│   └──────────────────────────────────────────────────────────┘              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Communication Flow

```
React App                 Express Server              Python Microservice
    │                          │                              │
    │── GET /api/cameras ─────►│── GET :8000/cameras ────────►│
    │◄── [0, 1, 2] ───────────│◄── [0, 1, 2] ───────────────│
    │                          │                              │
    │── POST /api/proctor/start►│── POST :8000/start ─────────►│
    │◄── {ok: true} ──────────│◄── {started: true} ──────────│
    │                          │                              │
    │                          │     (Background polling)     │
    │                          │── GET :8000/status ──────────►│
    │                          │◄── {status, reason} ─────────│
    │                          │── GET :8000/frame ───────────►│
    │                          │◄── <JPEG bytes> ─────────────│
    │                          │                              │
    │◄── WS: 'frame' (base64) │                              │
    │◄── WS: 'status' (JSON)  │                              │
    │◄── WS: 'alert' (JSON)   │                              │
    │                          │                              │
    │── POST /api/proctor/stop►│── POST :8000/stop ──────────►│
    │◄── {ok: true} ──────────│◄── {stopped: true} ──────────│
```

---

## 4. Why MERN? — Justification

### 4.1 Technical Reasons

| Aspect | Flask (Current) | MERN (Target) | Benefit |
|--------|----------------|----------------|---------|
| **Real-Time** | HTTP Polling (wasteful) | WebSocket (Socket.IO) | 90% less network overhead, instant updates |
| **UI Components** | Monolithic HTML file | React components | Reusable, testable, maintainable |
| **State** | Global Python vars | Zustand/Context + React state | Predictable, debuggable |
| **Data Persistence** | None (in-memory only) | MongoDB | Session history, violation replay, analytics |
| **Scalability** | Single-threaded GIL | Node.js event loop + async I/O | Handles 1000s of concurrent connections |
| **Ecosystem** | Limited Flask extensions | npm ecosystem (100K+ packages) | Faster development, better tooling |
| **DevX** | Manual reload | Vite HMR (Hot Module Replacement) | Instant feedback during development |

### 4.2 Academic & Professional Value

- **MERN is industry-standard** — Used at Netflix, Uber, Airbnb, Facebook
- **Demonstrates Full-Stack capability** — React frontend + Node backend + Python ML backend = "Polyglot Architecture"
- **Separation of Concerns** — Frontend, Backend, ML are independent services
- **Portfolio worthy** — Shows understanding of microservice architecture

---

## 5. Migration Strategy Overview

### The "Strangler Fig" Approach

We will NOT rewrite everything at once. Instead, we'll wrap the existing Python ML code in a microservice and build the MERN layer around it.

```
Step 1: Wrap Python ML code in FastAPI microservice (keep ALL ML code)
Step 2: Build Express.js server that proxies to Python microservice
Step 3: Build React frontend that talks to Express server
Step 4: Add MongoDB for persistence
Step 5: Add WebSocket for real-time
Step 6: Enhance UI with React ecosystem
Step 7: Remove old Flask server
```

---

## Phase 1: Project Scaffolding & Setup

### Step 1.1: Create the New Directory Structure

```
proctoring/
│
├── python-service/              ← ALL Python ML code lives here
│   ├── proctor_live.py          ← Camera + inference (EXISTING — moved)
│   ├── eye_cnn_model.py         ← CNN architecture (EXISTING — moved)
│   ├── dataset_loader.py        ← Dataset class (EXISTING — moved)
│   ├── train_pretrain.py        ← Pretraining (EXISTING — moved)
│   ├── train_finetune.py        ← Fine-tuning (EXISTING — moved)
│   ├── collect_images.py        ← Data collection (EXISTING — moved)
│   ├── ml_server.py             ← NEW: FastAPI wrapper around proctor_live.py
│   ├── eye_cnn_final.pth        ← Model weights (EXISTING — moved)
│   ├── pretrained_eye_cnn.pth   ← Pretrained weights (EXISTING — moved)
│   ├── requirements.txt         ← Python dependencies
│   └── dataset/                 ← Training data
│       ├── good/
│       └── bad/
│
├── server/                      ← Node.js Express backend
│   ├── package.json
│   ├── .env
│   ├── src/
│   │   ├── index.js             ← Entry point (Express + Socket.IO)
│   │   ├── config/
│   │   │   ├── db.js            ← MongoDB connection
│   │   │   └── env.js           ← Environment variables
│   │   ├── routes/
│   │   │   ├── proctorRoutes.js ← /api/proctor (start, stop, status)
│   │   │   ├── cameraRoutes.js  ← /api/cameras (list, switch)
│   │   │   ├── sessionRoutes.js ← /api/sessions (CRUD)
│   │   │   └── trainingRoutes.js← /api/training (trigger, status)
│   │   ├── controllers/
│   │   │   ├── proctorController.js
│   │   │   ├── cameraController.js
│   │   │   ├── sessionController.js
│   │   │   └── trainingController.js
│   │   ├── models/
│   │   │   ├── Session.js       ← Mongoose schema
│   │   │   ├── Violation.js     ← Mongoose schema
│   │   │   └── Settings.js      ← Mongoose schema
│   │   ├── services/
│   │   │   ├── pythonBridge.js   ← HTTP client to Python microservice
│   │   │   └── socketService.js  ← Socket.IO event management
│   │   └── middleware/
│   │       ├── errorHandler.js
│   │       └── logger.js
│   └── tests/
│       └── proctor.test.js
│
├── client/                       ← React frontend (Vite)
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   ├── public/
│   │   └── favicon.ico
│   └── src/
│       ├── main.jsx              ← Entry point
│       ├── App.jsx               ← Router + Layout
│       ├── index.css             ← TailwindCSS imports
│       ├── pages/
│       │   ├── Dashboard.jsx     ← Main proctoring view
│       │   ├── History.jsx       ← Past sessions
│       │   ├── Analytics.jsx     ← Charts & statistics
│       │   ├── Settings.jsx      ← Configuration
│       │   └── Training.jsx      ← Model training controls
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Sidebar.jsx
│       │   │   ├── Header.jsx
│       │   │   └── Footer.jsx
│       │   ├── dashboard/
│       │   │   ├── VideoFeed.jsx
│       │   │   ├── StatusIndicator.jsx
│       │   │   ├── StatsCards.jsx
│       │   │   ├── ViolationLog.jsx
│       │   │   ├── ActivityChart.jsx
│       │   │   └── CameraSelector.jsx
│       │   ├── history/
│       │   │   ├── SessionList.jsx
│       │   │   └── SessionDetail.jsx
│       │   ├── analytics/
│       │   │   ├── ViolationHeatmap.jsx
│       │   │   ├── TrendChart.jsx
│       │   │   └── SummaryCards.jsx
│       │   └── common/
│       │       ├── Button.jsx
│       │       ├── Card.jsx
│       │       ├── Modal.jsx
│       │       ├── Toast.jsx
│       │       ├── Badge.jsx
│       │       └── LoadingSpinner.jsx
│       ├── hooks/
│       │   ├── useSocket.js      ← Socket.IO hook
│       │   ├── useProctor.js     ← Proctoring state hook
│       │   ├── useCamera.js      ← Camera management hook
│       │   └── useSession.js     ← Session management hook
│       ├── store/
│       │   └── useStore.js       ← Zustand global store
│       ├── services/
│       │   └── api.js            ← Axios instance + API functions
│       ├── utils/
│       │   ├── formatTime.js
│       │   ├── constants.js
│       │   └── helpers.js
│       └── assets/
│           ├── logo.svg
│           └── sounds/
│               └── alert.mp3     ← Browser-based alert sound
│
└── docker-compose.yml            ← Optional: Orchestration
```

### Step 1.2: Initialize All Three Projects

**1. Python Microservice:**
```bash
cd proctoring/python-service
pip install fastapi uvicorn python-multipart
```

**2. Node.js Server:**
```bash
cd proctoring/server
npm init -y
npm install express socket.io cors mongoose dotenv helmet morgan axios
npm install -D nodemon
```

**3. React Client:**
```bash
cd proctoring/client
npm create vite@latest . -- --template react
npm install react-router-dom socket.io-client axios zustand
npm install framer-motion recharts @headlessui/react @heroicons/react
npm install -D tailwindcss @tailwindcss/vite
```

### Step 1.3: Environment Variables

**`server/.env`:**
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/secureproctor
PYTHON_SERVICE_URL=http://localhost:8000
NODE_ENV=development
```

**`client/.env`:**
```env
VITE_API_URL=http://localhost:5000
VITE_WS_URL=http://localhost:5000
```

---

## Phase 2: Backend — Node.js + Express API Server

### Step 2.1: Entry Point (`server/src/index.js`)

**Concept:** This replaces `server.py`. Express.js handles HTTP routing, Socket.IO handles real-time events, and HTTP requests are proxied to the Python microservice for anything ML-related.

**What this file does:**
- Creates an Express HTTP server
- Attaches Socket.IO for WebSocket communication
- Connects to MongoDB via Mongoose
- Registers all API routes
- Starts a polling loop that fetches frames and status from the Python microservice and broadcasts via WebSocket

```javascript
// server/src/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:3000' }
});

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/api/proctor', require('./routes/proctorRoutes'));
app.use('/api/cameras', require('./routes/cameraRoutes'));
app.use('/api/sessions', require('./routes/sessionRoutes'));

// Socket.IO: Real-time frame + status broadcasting
require('./services/socketService')(io);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

**Why Express over Flask?**
- Express is non-blocking by default (Node.js event loop)
- Native WebSocket support through Socket.IO
- Better suited for I/O-heavy tasks (proxying frames, broadcasting to many clients)
- Flask needs `threading=True` and still suffers from GIL limitations

### Step 2.2: Proctor Routes (`server/src/routes/proctorRoutes.js`)

**Concept:** These routes are the MERN equivalent of Flask's `/start`, `/stop`, `/status` endpoints. Instead of directly calling Python functions, they make HTTP requests to the Python microservice.

```javascript
// server/src/routes/proctorRoutes.js
const router = require('express').Router();
const { startProctoring, stopProctoring, getStatus } = require('../controllers/proctorController');

router.post('/start', startProctoring);   // Was: GET /start in Flask
router.post('/stop', stopProctoring);     // Was: GET /stop in Flask
router.get('/status', getStatus);         // Was: GET /status in Flask

module.exports = router;
```

**Note:** We changed from GET to POST for `/start` and `/stop` because they modify server state (RESTful best practice). Flask incorrectly used GET for state-changing operations.

### Step 2.3: Proctor Controller (`server/src/controllers/proctorController.js`)

**Concept:** Controllers contain the business logic. They call the Python microservice via HTTP and also interact with MongoDB to record sessions.

```javascript
// server/src/controllers/proctorController.js
const pythonBridge = require('../services/pythonBridge');
const Session = require('../models/Session');

exports.startProctoring = async (req, res) => {
  try {
    const result = await pythonBridge.post('/start');

    // Record new session in MongoDB
    const session = await Session.create({
      startTime: new Date(),
      status: 'active',
      cameraIndex: req.body.cameraIndex || 0
    });

    res.json({ success: true, sessionId: session._id, ...result.data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start proctoring', details: err.message });
  }
};

exports.stopProctoring = async (req, res) => {
  try {
    const result = await pythonBridge.post('/stop');

    // Close the active session
    await Session.findOneAndUpdate(
      { status: 'active' },
      { status: 'completed', endTime: new Date() },
      { sort: { startTime: -1 } }
    );

    res.json({ success: true, ...result.data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to stop proctoring', details: err.message });
  }
};

exports.getStatus = async (req, res) => {
  try {
    const result = await pythonBridge.get('/status');
    res.json(result.data);
  } catch (err) {
    res.status(500).json({ error: 'Python service unreachable' });
  }
};
```

### Step 2.4: Python Bridge Service (`server/src/services/pythonBridge.js`)

**Concept:** This is the critical bridge between Node.js and Python. It's an axios HTTP client configured to talk to the Python FastAPI microservice. This is what allows us to keep all ML code in Python while using Node.js for the web layer.

```javascript
// server/src/services/pythonBridge.js
const axios = require('axios');

const pythonBridge = axios.create({
  baseURL: process.env.PYTHON_SERVICE_URL || 'http://localhost:8000',
  timeout: 10000,
  responseType: 'json'
});

// Special method for fetching binary frame data
pythonBridge.getFrame = async () => {
  const response = await axios.get(
    `${process.env.PYTHON_SERVICE_URL}/frame`,
    { responseType: 'arraybuffer', timeout: 5000 }
  );
  return Buffer.from(response.data).toString('base64');
};

module.exports = pythonBridge;
```

**Why a bridge pattern?**
- Decouples Node.js from Python completely
- Python service can be restarted without affecting the web server
- Can swap Python for any other ML runtime in the future
- Each service can scale independently

### Step 2.5: Socket.IO Service (`server/src/services/socketService.js`)

**Concept:** This is the real-time heart of the new system. Instead of the browser making 30+ HTTP requests/second (polling), Socket.IO pushes frames and status updates to all connected clients simultaneously.

**How it works:**
1. A `setInterval` loop runs every 33ms (~30 FPS)
2. Each tick fetches the latest frame from the Python service
3. Converts it to Base64 and emits via WebSocket to all connected React clients
4. A separate 500ms interval fetches status and emits status updates
5. If an ALERT is detected, it also saves the violation to MongoDB

```javascript
// server/src/services/socketService.js
const pythonBridge = require('./pythonBridge');
const Violation = require('../models/Violation');
const Session = require('../models/Session');

module.exports = (io) => {
  let frameInterval = null;
  let statusInterval = null;
  let isStreaming = false;

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Start streaming when first client connects
    if (!isStreaming) {
      startStreaming(io);
      isStreaming = true;
    }

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      // Stop streaming if no clients
      if (io.sockets.sockets.size === 0) {
        stopStreaming();
        isStreaming = false;
      }
    });
  });

  function startStreaming(io) {
    // Frame streaming (~30 FPS)
    frameInterval = setInterval(async () => {
      try {
        const base64Frame = await pythonBridge.getFrame();
        io.emit('frame', base64Frame);
      } catch (err) {
        // Python service might not be running yet
      }
    }, 33);

    // Status updates (every 500ms)
    statusInterval = setInterval(async () => {
      try {
        const { data } = await pythonBridge.get('/status');
        io.emit('status', data);

        // Save violations to MongoDB
        if (data.status === 'ALERT') {
          const activeSession = await Session.findOne({ status: 'active' });
          if (activeSession) {
            await Violation.create({
              sessionId: activeSession._id,
              timestamp: new Date(),
              reason: data.reason,
              severity: data.reason.includes('NOT LOOKING') ? 'high' : 'medium'
            });
          }
          io.emit('alert', { reason: data.reason, timestamp: new Date() });
        }
      } catch (err) {
        io.emit('status', { status: 'DISCONNECTED', reason: 'Python service offline' });
      }
    }, 500);
  }

  function stopStreaming() {
    clearInterval(frameInterval);
    clearInterval(statusInterval);
  }
};
```

**Why WebSocket over HTTP Polling?**

| Metric | HTTP Polling (Current) | WebSocket (Target) |
|--------|------------------------|---------------------|
| Requests/sec | ~32 (30 frames + 1.25 status) | 0 (server pushes) |
| Latency | 33ms + network RTT | Near-instant |
| Bandwidth | HTTP headers on every request (~500B × 32/s) | Minimal frame overhead |
| Server load | Parse HTTP request 32×/s | Single persistent connection |
| Multiple clients | 32×N requests/sec | 1 emit broadcasts to all |

### Step 2.6: MongoDB Models

**Concept:** Mongoose schemas define the shape of documents stored in MongoDB. We create three collections: Sessions (proctoring sessions), Violations (individual alert events), and Settings (user configuration).

```javascript
// server/src/models/Session.js
const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  status: { type: String, enum: ['active', 'completed', 'error'], default: 'active' },
  cameraIndex: { type: Number, default: 0 },
  totalViolations: { type: Number, default: 0 },
  violationSummary: {
    notLooking: { type: Number, default: 0 },
    multipleFaces: { type: Number, default: 0 },
    noFace: { type: Number, default: 0 }
  }
});

module.exports = mongoose.model('Session', sessionSchema);
```

```javascript
// server/src/models/Violation.js
const mongoose = require('mongoose');

const violationSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  timestamp: { type: Date, default: Date.now },
  reason: { type: String, required: true },
  severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  frameSnapshot: { type: String },  // Base64 encoded JPEG of the violation moment
  duration: { type: Number }        // How long the violation lasted (seconds)
});

violationSchema.index({ sessionId: 1, timestamp: -1 });

module.exports = mongoose.model('Violation', violationSchema);
```

```javascript
// server/src/models/Settings.js
const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  lookAwayTimeout: { type: Number, default: 3.5 },
  confidenceThreshold: { type: Number, default: 0.90 },
  darkThreshold: { type: Number, default: 45 },
  soundAlerts: { type: Boolean, default: true },
  vibrationAlerts: { type: Boolean, default: true },
  cameraIndex: { type: Number, default: 0 },
  highQualityFeed: { type: Boolean, default: false },
  detectionSensitivity: { type: Number, default: 50 }
});

module.exports = mongoose.model('Settings', settingsSchema);
```

---

## Phase 3: Python Microservice (ML Bridge)

### Step 3.1: Why Keep Python?

The ML code **must** stay in Python because:
1. **PyTorch** only runs natively in Python
2. **OpenCV** Python bindings are more mature than JavaScript alternatives
3. **Model weights** (`.pth` files) are PyTorch serialized objects
4. The training pipeline (`train_pretrain.py`, `train_finetune.py`) requires PyTorch
5. **No retraining needed** — the existing model works perfectly

### Step 3.2: FastAPI Wrapper (`python-service/ml_server.py`)

**Concept:** We wrap the existing `proctor_live.py` in a FastAPI server. FastAPI is chosen over Flask because:
- **Async support** — handles concurrent requests better
- **Auto-documentation** — Swagger UI at `/docs`
- **Faster** — Built on Starlette/Uvicorn (ASGI)
- **Type-safe** — Pydantic models for request/response

```python
# python-service/ml_server.py
from fastapi import FastAPI
from fastapi.responses import Response, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import threading
import cv2
import uvicorn

from proctor_live import (
    start_proctoring, stop_proctoring, get_status,
    get_frame, set_camera
)

app = FastAPI(title="SecureProctor ML Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

proctor_thread = None

@app.post("/start")
def start():
    global proctor_thread
    if proctor_thread and proctor_thread.is_alive():
        return {"message": "Already running", "started": False}

    proctor_thread = threading.Thread(target=start_proctoring, daemon=True)
    proctor_thread.start()
    return {"message": "Proctoring started", "started": True}

@app.post("/stop")
def stop():
    stop_proctoring()
    return {"message": "Proctoring stopped", "stopped": True}

@app.get("/status")
def status():
    return get_status()

@app.get("/frame")
def frame():
    current_frame = get_frame()
    if current_frame is None:
        return Response(status_code=204)

    _, jpeg = cv2.imencode(".jpg", current_frame)
    return Response(
        content=jpeg.tobytes(),
        media_type="image/jpeg"
    )

@app.get("/cameras")
def cameras():
    available = []
    for idx in range(5):
        cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
        if cap.isOpened():
            cap.release()
            available.append(idx)
    return {"cameras": available}

@app.post("/set_camera/{camera_index}")
def set_camera_route(camera_index: int):
    set_camera(camera_index)
    return {"message": f"Camera switched to {camera_index}", "camera": camera_index}

@app.post("/train")
def trigger_training():
    """Trigger model fine-tuning in background"""
    def train():
        import subprocess
        subprocess.run(["python", "train_finetune.py"], check=True)

    t = threading.Thread(target=train, daemon=True)
    t.start()
    return {"message": "Training started in background"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### Step 3.3: Modifications to `proctor_live.py`

**Minimal changes needed** — just add a `running` reset function so the Node.js server can restart proctoring:

```python
# Add to proctor_live.py
def reset_proctoring():
    """Reset state for a fresh start"""
    global running, current_status, latest_frame, buzzer_active
    running = True
    current_status = {"status": "SAFE", "reason": "SAFE"}
    latest_frame = None
    buzzer_active = False
```

### Step 3.4: Python Requirements (`python-service/requirements.txt`)

```
torch>=2.2.2
numpy>=1.26.4
opencv-python>=4.9.0
fastapi>=0.111.0
uvicorn>=0.30.0
python-multipart>=0.0.9
```

---

## Phase 4: Frontend — React Dashboard

### Step 4.1: Why React?

| Feature | Vanilla JS (Current) | React (Target) |
|---------|---------------------|-----------------|
| DOM Updates | Manual `document.getElementById()` | Virtual DOM (automatic, efficient) |
| Components | Copy-paste HTML sections | Reusable `<StatusIndicator />`, `<VideoFeed />` |
| State | Global variables (`let violationCount`) | `useState`, `useContext`, Zustand |
| Routing | None (single page) | React Router (multi-page app) |
| Side Effects | `setInterval` everywhere | `useEffect` with cleanup |
| Animations | CSS only | Framer Motion (physics-based) |

### Step 4.2: App Entry & Routing (`client/src/App.jsx`)

**Concept:** React Router enables a multi-page SPA (Single Page Application). The current system is a single `index.html` — we'll split it into logical pages.

```jsx
// client/src/App.jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Training from './pages/Training';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/history" element={<History />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/training" element={<Training />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
```

### Step 4.3: Custom Hooks (The React Way)

**Concept:** Custom hooks encapsulate reusable logic. They replace the scattered `setInterval`, `fetch`, and global variable patterns in the current `app.js`.

**`useSocket.js` — WebSocket Connection Hook:**
```jsx
// client/src/hooks/useSocket.js
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export function useSocket() {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [frame, setFrame] = useState(null);
  const [status, setStatus] = useState({ status: 'SAFE', reason: 'SAFE' });
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_WS_URL);
    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    // Receive frames as base64 from server
    socket.on('frame', (base64) => {
      setFrame(`data:image/jpeg;base64,${base64}`);
    });

    // Receive status updates
    socket.on('status', (data) => {
      setStatus(data);
    });

    // Receive alert events
    socket.on('alert', (data) => {
      setAlerts(prev => [data, ...prev].slice(0, 100)); // Keep last 100
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, []);

  return { isConnected, frame, status, alerts, socket: socketRef.current };
}
```

**Why custom hooks?**
- `useSocket` replaces `setInterval(refreshFrame, 33)` and `setInterval(updateStatus, 800)`
- Automatic cleanup (no memory leaks when navigating away)
- Any component can access real-time data by calling `useSocket()`

**`useProctor.js` — Proctoring Controls Hook:**
```jsx
// client/src/hooks/useProctor.js
import { useState, useCallback } from 'react';
import api from '../services/api';

export function useProctor() {
  const [isProctoring, setIsProctoring] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);

  const startProctoring = useCallback(async (cameraIndex = 0) => {
    setLoading(true);
    try {
      const { data } = await api.post('/api/proctor/start', { cameraIndex });
      setIsProctoring(true);
      setSessionId(data.sessionId);
      return data;
    } catch (err) {
      console.error('Start failed:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const stopProctoring = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/api/proctor/stop');
      setIsProctoring(false);
      setSessionId(null);
      return data;
    } catch (err) {
      console.error('Stop failed:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { isProctoring, sessionId, loading, startProctoring, stopProctoring };
}
```

### Step 4.4: Dashboard Page (`client/src/pages/Dashboard.jsx`)

**Concept:** This is the React equivalent of the current `index.html`. Instead of one 250-line HTML file, it's composed of small, focused components.

```jsx
// client/src/pages/Dashboard.jsx
import { useSocket } from '../hooks/useSocket';
import { useProctor } from '../hooks/useProctor';
import VideoFeed from '../components/dashboard/VideoFeed';
import StatusIndicator from '../components/dashboard/StatusIndicator';
import StatsCards from '../components/dashboard/StatsCards';
import ViolationLog from '../components/dashboard/ViolationLog';
import ActivityChart from '../components/dashboard/ActivityChart';
import CameraSelector from '../components/dashboard/CameraSelector';

export default function Dashboard() {
  const { isConnected, frame, status, alerts } = useSocket();
  const { isProctoring, startProctoring, stopProctoring, loading } = useProctor();

  return (
    <div className="grid grid-cols-3 gap-6 p-6">
      {/* Left: Video + Stats (2 columns) */}
      <div className="col-span-2 space-y-6">
        <VideoFeed frame={frame} status={status} />
        <StatsCards
          isConnected={isConnected}
          violationCount={alerts.length}
          isProctoring={isProctoring}
        />
        <ActivityChart alerts={alerts} />
      </div>

      {/* Right: Controls + Log (1 column) */}
      <div className="space-y-6">
        <StatusIndicator status={status} />
        <CameraSelector />
        <div className="flex gap-3">
          <button
            onClick={startProctoring}
            disabled={isProctoring || loading}
            className="btn-primary flex-1"
          >
            {loading ? 'Starting...' : 'Start Proctoring'}
          </button>
          <button
            onClick={stopProctoring}
            disabled={!isProctoring || loading}
            className="btn-danger flex-1"
          >
            Stop
          </button>
        </div>
        <ViolationLog alerts={alerts} />
      </div>
    </div>
  );
}
```

### Step 4.5: Key Components

**`VideoFeed.jsx` — Live Camera Feed:**
```jsx
// client/src/components/dashboard/VideoFeed.jsx
import { motion } from 'framer-motion';

export default function VideoFeed({ frame, status }) {
  const isAlert = status?.status === 'ALERT';

  return (
    <motion.div
      className={`relative rounded-2xl overflow-hidden border-2 transition-colors ${
        isAlert ? 'border-red-500 shadow-red-500/30 shadow-lg' : 'border-green-500/30'
      }`}
      animate={isAlert ? { scale: [1, 1.01, 1] } : {}}
      transition={{ repeat: Infinity, duration: 1 }}
    >
      {/* LIVE Badge */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 
                      bg-red-600 px-3 py-1 rounded-full text-sm font-semibold">
        <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
        LIVE
      </div>

      {/* Camera Image */}
      {frame ? (
        <img
          src={frame}
          alt="Camera Feed"
          className="w-full aspect-video object-cover"
        />
      ) : (
        <div className="w-full aspect-video bg-gray-900 flex items-center 
                        justify-center text-gray-500">
          <p>Camera feed loading...</p>
        </div>
      )}

      {/* Alert Overlay */}
      {isAlert && (
        <motion.div
          className="absolute inset-0 bg-red-500/20 pointer-events-none"
          animate={{ opacity: [0.1, 0.3, 0.1] }}
          transition={{ repeat: Infinity, duration: 1 }}
        />
      )}

      {/* Corner Markers */}
      <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 
                      border-green-400 rounded-tl" />
      <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 
                      border-green-400 rounded-tr" />
      <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 
                      border-green-400 rounded-bl" />
      <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 
                      border-green-400 rounded-br" />
    </motion.div>
  );
}
```

**`StatusIndicator.jsx`:**
```jsx
// client/src/components/dashboard/StatusIndicator.jsx
import { motion, AnimatePresence } from 'framer-motion';

export default function StatusIndicator({ status }) {
  const isSafe = status?.status === 'SAFE';

  return (
    <motion.div
      className={`p-4 rounded-xl flex items-center gap-4 transition-all ${
        isSafe
          ? 'bg-green-500/10 border border-green-500/30'
          : 'bg-red-500/10 border border-red-500/30'
      }`}
      animate={!isSafe ? { scale: [1, 1.02, 1] } : {}}
      transition={{ repeat: Infinity, duration: 0.8 }}
    >
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
        isSafe ? 'bg-green-500' : 'bg-red-500'
      }`}>
        {isSafe ? '✓' : '⚠'}
      </div>
      <div>
        <p className="text-lg font-bold">{status?.status || 'UNKNOWN'}</p>
        <p className="text-sm opacity-70">{status?.reason || '—'}</p>
      </div>
    </motion.div>
  );
}
```

### Step 4.6: API Service (`client/src/services/api.js`)

```javascript
// client/src/services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  timeout: 10000,
});

// Proctor APIs
export const startProctoring = (cameraIndex) =>
  api.post('/api/proctor/start', { cameraIndex });

export const stopProctoring = () =>
  api.post('/api/proctor/stop');

// Camera APIs
export const getCameras = () =>
  api.get('/api/cameras');

export const setCamera = (index) =>
  api.post(`/api/cameras/set/${index}`);

// Session APIs
export const getSessions = () =>
  api.get('/api/sessions');

export const getSessionById = (id) =>
  api.get(`/api/sessions/${id}`);

// Violation APIs
export const getViolations = (sessionId) =>
  api.get(`/api/sessions/${sessionId}/violations`);

export default api;
```

---

## Phase 5: Real-Time Communication (WebSocket)

### Step 5.1: WebSocket vs HTTP Polling — Deep Dive

**Current System (HTTP Polling):**
```
Browser                          Flask Server
  │                                   │
  │── GET /frame ────────────────────►│  Every 33ms (30 FPS)
  │◄── 200 OK (JPEG ~50KB) ──────────│
  │── GET /frame ────────────────────►│
  │◄── 200 OK (JPEG ~50KB) ──────────│
  │── GET /status ───────────────────►│  Every 800ms
  │◄── 200 OK (JSON ~100B) ──────────│
  │   ... repeats forever ...         │
  │                                   │
  │  Total: ~32 HTTP requests/sec     │
  │  Overhead: ~32 × 500B headers     │
  │  = 16KB/sec wasted on headers     │
```

**New System (WebSocket):**
```
React App                        Express + Socket.IO
  │                                   │
  │══ WebSocket UPGRADE ═════════════►│  ONE connection
  │◄═════════════════════════════════ │
  │                                   │
  │◄── emit('frame', base64) ────────│  Server pushes
  │◄── emit('frame', base64) ────────│  No request needed
  │◄── emit('status', JSON) ─────────│
  │◄── emit('alert', JSON) ──────────│  Only on violations
  │   ... server pushes as needed ... │
  │                                   │
  │  Total: 1 persistent connection   │
  │  Overhead: ~2-6 bytes per frame   │
  │  = 150B/sec framing overhead      │
```

**Bandwidth Savings:**
- Current: ~32 HTTP requests × 500B headers = **16KB/sec** overhead
- New: ~2-6 bytes WebSocket frame header = **~150B/sec** overhead
- **Savings: 99%+ header overhead reduction**

### Step 5.2: Browser Audio Alert (Replacing Windows `winsound.Beep`)

The current system uses `winsound.Beep(1000, 500)` which is Windows-only and runs on the server machine. In the MERN system, alerts play in the browser using the Web Audio API.

```javascript
// client/src/utils/audioAlert.js
let audioContext = null;

export function playAlertSound() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.type = 'square';    // Harsh alert sound
  oscillator.frequency.value = 1000; // Same 1000Hz as winsound
  gainNode.gain.value = 0.3;     // Not too loud

  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.5); // 500ms same as winsound
}
```

**Why this is better:**
- Works on all platforms (not just Windows)
- Sound plays at the candidate's browser (where they hear it)
- Can be extended with custom audio files (`alert.mp3`)
- Volume controllable from browser settings

---

## Phase 6: MongoDB Integration

### Step 6.1: Why MongoDB?

The current system stores **nothing** persistently. When you refresh the page, all violation logs are gone. MongoDB adds:

1. **Session History** — View past proctoring sessions
2. **Violation Replay** — See exactly when and why alerts were triggered
3. **Analytics** — Trends over time, violation frequency, peak cheating times
4. **Audit Trail** — Proof that proctoring was active during an exam

### Step 6.2: Data Model Design

```
┌─────────────────────────────────────────────────────────┐
│                    MongoDB Collections                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  sessions                                                │
│  ┌────────────────────────────────────────┐              │
│  │ _id: ObjectId                          │              │
│  │ startTime: Date                        │              │
│  │ endTime: Date                          │              │
│  │ status: "active" | "completed"         │              │
│  │ cameraIndex: Number                    │              │
│  │ totalViolations: Number                │──────┐       │
│  │ duration: Number (seconds)             │      │       │
│  └────────────────────────────────────────┘      │       │
│                                                   │       │
│  violations                                       │       │
│  ┌────────────────────────────────────────┐      │       │
│  │ _id: ObjectId                          │      │       │
│  │ sessionId: ObjectId (FK) ◄─────────────│──────┘       │
│  │ timestamp: Date                        │              │
│  │ reason: String                         │              │
│  │ severity: "low" | "medium" | "high"    │              │
│  │ frameSnapshot: String (base64 JPEG)    │              │
│  │ duration: Number (seconds)             │              │
│  └────────────────────────────────────────┘              │
│                                                          │
│  settings                                                │
│  ┌────────────────────────────────────────┐              │
│  │ _id: ObjectId                          │              │
│  │ lookAwayTimeout: Number (default 3.5)  │              │
│  │ confidenceThreshold: Number (0.90)     │              │
│  │ soundAlerts: Boolean                   │              │
│  │ detectionSensitivity: Number           │              │
│  │ cameraIndex: Number                    │              │
│  └────────────────────────────────────────┘              │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Step 6.3: Session Routes (`server/src/routes/sessionRoutes.js`)

```javascript
// server/src/routes/sessionRoutes.js
const router = require('express').Router();
const Session = require('../models/Session');
const Violation = require('../models/Violation');

// GET /api/sessions — List all sessions (paginated)
router.get('/', async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const sessions = await Session.find()
    .sort({ startTime: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));
  const total = await Session.countDocuments();
  res.json({ sessions, total, page: Number(page), pages: Math.ceil(total / limit) });
});

// GET /api/sessions/:id — Single session with violations
router.get('/:id', async (req, res) => {
  const session = await Session.findById(req.params.id);
  const violations = await Violation.find({ sessionId: req.params.id })
    .sort({ timestamp: 1 });
  res.json({ session, violations });
});

// DELETE /api/sessions/:id — Delete session and its violations
router.delete('/:id', async (req, res) => {
  await Violation.deleteMany({ sessionId: req.params.id });
  await Session.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

module.exports = router;
```

---

## Phase 7: UI/UX Enhancements

This is where the MERN migration truly shines. React + TailwindCSS + Framer Motion enable UI features that were impossible or extremely difficult with vanilla HTML/JS.

### Enhancement 1: Multi-Page Dashboard with Sidebar Navigation

**Current:** Single page with everything crammed together.
**New:** Professional sidebar with animated navigation.

```
┌────────────┬──────────────────────────────────────────────┐
│            │                                               │
│  🛡 Logo   │   Dashboard                                   │
│            │   ┌─────────────────┐ ┌──────────────────┐   │
│  📊 Dash   │   │  Live Camera    │ │  Status: SAFE    │   │
│  📜 History│   │  Feed (WebSocket│ │  ┌────────────┐  │   │
│  📈 Analyt.│   │  Streaming)     │ │  │ Violations │  │   │
│  ⚙ Settings│   │                 │ │  │    Count   │  │   │
│  🧠 Training│  │                 │ │  │    = 3     │  │   │
│            │   └─────────────────┘ │  └────────────┘  │   │
│            │   ┌──────┐┌──────┐┌──┐│  ┌────────────┐  │   │
│            │   │ Time ││Viols ││FPS││  │ Violation  │  │   │
│            │   │12:34 ││  3   ││30 ││  │   Log      │  │   │
│            │   └──────┘└──────┘└──┘│  │ 12:03 ALERT│  │   │
│  ─────     │                       │  │ 12:01 ALERT│  │   │
│  🌙 Theme  │   Activity Timeline   │  └────────────┘  │   │
│  🚪 Exit   │   ████░░████░░███     │                   │   │
│            │                       │                   │   │
└────────────┴───────────────────────┴───────────────────┘
```

### Enhancement 2: Real-Time Activity Timeline (Recharts)

**Current:** Chart.js with manual data pushing.
**New:** Recharts (React-native charts) with live data streaming.

```jsx
// Recharts example for activity timeline
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={200}>
  <AreaChart data={timelineData}>
    <XAxis dataKey="time" />
    <YAxis />
    <Tooltip />
    <Area
      type="monotone"
      dataKey="status"
      stroke="#2ecc71"
      fill="url(#safeGradient)"
    />
    <Area
      type="monotone"
      dataKey="violations"
      stroke="#e74c3c"
      fill="url(#alertGradient)"
    />
  </AreaChart>
</ResponsiveContainer>
```

### Enhancement 3: Violation Snapshot Gallery

**New Feature:** When a violation occurs, capture the camera frame and store it in MongoDB. Users can review the exact moment of each violation.

```
┌──────────────────────────────────────────────────────────┐
│  Violation Gallery                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ 📸       │  │ 📸       │  │ 📸       │               │
│  │ [frame]  │  │ [frame]  │  │ [frame]  │               │
│  │          │  │          │  │          │               │
│  │ 12:03:45 │  │ 12:05:12 │  │ 12:07:33 │               │
│  │ NOT LOOK │  │ NO FACE  │  │ MULTI    │               │
│  │ 4.2s     │  │ 6.1s     │  │ 2.0s     │               │
│  └──────────┘  └──────────┘  └──────────┘               │
└──────────────────────────────────────────────────────────┘
```

### Enhancement 4: Session History Page

**New Feature:** Browse past proctoring sessions with summary statistics.

```
┌──────────────────────────────────────────────────────────────┐
│  📜 Session History                             [Search]     │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Session #12          Feb 8, 2026 2:30 PM            │    │
│  │  Duration: 45 min     Violations: 3     Score: 92%   │    │
│  │  ████████████████████░░████████████████████████████   │    │
│  │  [View Details]  [Export PDF]  [Delete]               │    │
│  ├──────────────────────────────────────────────────────┤    │
│  │  Session #11          Feb 8, 2026 10:15 AM           │    │
│  │  Duration: 1h 20min   Violations: 0     Score: 100%  │    │
│  │  ████████████████████████████████████████████████████ │    │
│  │  [View Details]  [Export PDF]  [Delete]               │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  Showing 1-10 of 12      [< Prev] [1] [2] [Next >]         │
└──────────────────────────────────────────────────────────────┘
```

### Enhancement 5: Analytics Dashboard

**New Feature:** Charts showing violation trends, peak times, and overall compliance.

```
┌──────────────────────────────────────────────────────────────┐
│  📈 Analytics                                                │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Total        │  │ Avg Duration │  │ Compliance   │      │
│  │ Sessions: 45 │  │    52 min    │  │    94.2%     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  Violation Trend (Last 7 Days)                               │
│  12│     ╭─╮                                                 │
│   8│  ╭──╯ ╰──╮    ╭──╮                                     │
│   4│──╯       ╰────╯  ╰──╮                                  │
│   0│──────────────────────╰──                                │
│    Mon  Tue  Wed  Thu  Fri  Sat  Sun                         │
│                                                              │
│  Violation Heatmap (By Hour)                                 │
│  ┌──────────────────────────────────────────┐                │
│  │  ░░░░░░███░░░░░░░░░██████░░░░░░░░░░░░  │                │
│  │  12AM     6AM     12PM     6PM    12AM  │                │
│  └──────────────────────────────────────────┘                │
│                                                              │
│  Violation Types (Pie Chart)                                 │
│    🔴 Not Looking: 65%                                       │
│    🟠 No Face: 20%                                           │
│    🟡 Multiple Faces: 15%                                    │
└──────────────────────────────────────────────────────────────┘
```

### Enhancement 6: Settings Page (Persistent)

**Current:** Settings modal in the same page, values lost on refresh.
**New:** Dedicated settings page with MongoDB persistence.

```
┌──────────────────────────────────────────────────────────────┐
│  ⚙ Settings                                  [Save Changes] │
│                                                              │
│  Detection Settings                                          │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Look-Away Timeout     [━━━━━━━●━━━━]  3.5 seconds  │    │
│  │  Confidence Threshold  [━━━━━━━━━●━]  90%            │    │
│  │  Dark Threshold        [━━━●━━━━━━━]  45             │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  Alert Preferences                                           │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  🔔 Sound Alerts            [══●] ON                 │    │
│  │  📳 Vibration Alerts        [══●] ON                 │    │
│  │  📸 Capture Violation Frame  [══●] ON                │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  Camera Settings                                             │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Default Camera    [▼ Camera 0 - Built-in      ]     │    │
│  │  High Quality Feed  [══○] OFF                        │    │
│  │  Auto-Switch on Error [══○] OFF                      │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### Enhancement 7: Model Training Page

**New Feature:** Monitor and trigger model training from the UI.

```
┌──────────────────────────────────────────────────────────────┐
│  🧠 Model Training                                          │
│                                                              │
│  Current Model: eye_cnn_final.pth                            │
│  Last Trained: Feb 7, 2026                                   │
│  Dataset Size: 200 images (100 good + 100 bad)               │
│                                                              │
│  Training Pipeline                                           │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                                                       │    │
│  │  Step 1: Collect Data     [✅ Completed]              │    │
│  │  ────────────────────────────────────────             │    │
│  │  Step 2: Pretrain (15 epochs)  [✅ Completed]         │    │
│  │  ────────────────────────────────────────             │    │
│  │  Step 3: Fine-tune (10 epochs) [✅ Completed]         │    │
│  │                                                       │    │
│  │  [🔄 Retrain Model]  [📂 Upload Dataset]             │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  Training Metrics (Last Run)                                 │
│  ┌──────────────────────────────────────────┐                │
│  │  Loss:  ████████████████░░░░  0.023      │                │
│  │  Acc:   █████████████████████  98.5%     │                │
│  │  Epochs: 10/10                            │                │
│  └──────────────────────────────────────────┘                │
└──────────────────────────────────────────────────────────────┘
```

### Enhancement 8: Dark/Light Theme (Improved)

**Current:** Basic CSS class toggle with `body.light-mode`.
**New:** TailwindCSS `dark:` variants with system preference detection and smooth transitions.

```javascript
// TailwindCSS dark mode in tailwind.config.js
export default {
  darkMode: 'class',  // Manual toggle (not system preference)
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#2ecc71', dark: '#27ae60' },
        danger: { DEFAULT: '#e74c3c', dark: '#c0392b' },
        surface: {
          light: '#f5f7fa',
          dark: '#0f2027',
        }
      }
    }
  }
}
```

### Enhancement 9: Toast Notification System

**Current:** `console.log` in `showNotification()`.
**New:** Animated toast notifications with Framer Motion.

```jsx
// client/src/components/common/Toast.jsx
import { motion, AnimatePresence } from 'framer-motion';

export default function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            className={`px-4 py-3 rounded-xl shadow-lg backdrop-blur-md ${
              toast.type === 'success' ? 'bg-green-500/90' :
              toast.type === 'error'   ? 'bg-red-500/90' :
              toast.type === 'warning' ? 'bg-yellow-500/90' :
              'bg-blue-500/90'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">
                {toast.type === 'success' ? '✓' :
                 toast.type === 'error'   ? '✕' :
                 toast.type === 'warning' ? '⚠' : 'ℹ'}
              </span>
              <p className="text-white font-medium">{toast.message}</p>
              <button onClick={() => onDismiss(toast.id)} className="ml-auto">✕</button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

### Enhancement 10: Responsive Design

**Current:** Fixed grid layout with basic `@media (max-width: 1200px)`.
**New:** Full responsive design — works on tablet (proctor monitoring station) and mobile.

```
Desktop (>1200px):          Tablet (768-1200px):       Mobile (<768px):
┌─────┬──────┬─────┐       ┌───────────────┐          ┌──────────┐
│     │ Feed │Ctrl │       │   Feed        │          │  Feed    │
│ Nav │      │     │       │               │          │          │
│     │      │     │       ├───────────────┤          ├──────────┤
│     │ Stats│ Log │       │ Stats  │ Ctrl │          │  Status  │
│     │Chart │     │       │ Chart  │ Log  │          │  Stats   │
└─────┴──────┴─────┘       └───────────────┘          │  Log     │
                                                       └──────────┘
```

---

## Phase 8: Testing & Quality Assurance

### Step 8.1: Backend Testing (Jest + Supertest)

```javascript
// server/tests/proctor.test.js
const request = require('supertest');
const app = require('../src/index');

describe('Proctor API', () => {
  it('POST /api/proctor/start should start proctoring', async () => {
    const res = await request(app)
      .post('/api/proctor/start')
      .send({ cameraIndex: 0 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/proctor/status should return status', async () => {
    const res = await request(app).get('/api/proctor/status');
    expect(res.body).toHaveProperty('status');
  });
});
```

### Step 8.2: Frontend Testing (Vitest + React Testing Library)

```javascript
// client/src/components/__tests__/StatusIndicator.test.jsx
import { render, screen } from '@testing-library/react';
import StatusIndicator from '../dashboard/StatusIndicator';

test('shows SAFE status in green', () => {
  render(<StatusIndicator status={{ status: 'SAFE', reason: 'SAFE' }} />);
  expect(screen.getByText('SAFE')).toBeInTheDocument();
});

test('shows ALERT status with warning', () => {
  render(<StatusIndicator status={{ status: 'ALERT', reason: 'NOT LOOKING (4.2s)' }} />);
  expect(screen.getByText('ALERT')).toBeInTheDocument();
  expect(screen.getByText('NOT LOOKING (4.2s)')).toBeInTheDocument();
});
```

### Step 8.3: End-to-End Testing (Cypress)

```javascript
// client/cypress/e2e/dashboard.cy.js
describe('Dashboard', () => {
  it('should load and show camera feed', () => {
    cy.visit('/');
    cy.get('[data-testid="video-feed"]').should('be.visible');
    cy.get('[data-testid="status-indicator"]').should('contain', 'SAFE');
  });

  it('should start and stop proctoring', () => {
    cy.visit('/');
    cy.get('[data-testid="start-btn"]').click();
    cy.get('[data-testid="start-btn"]').should('be.disabled');
    cy.get('[data-testid="stop-btn"]').click();
    cy.get('[data-testid="start-btn"]').should('not.be.disabled');
  });
});
```

---

## Phase 9: Deployment & DevOps

### Step 9.1: Running All Three Services

**Development (3 terminals):**
```bash
# Terminal 1: Python ML Service
cd proctoring/python-service
python ml_server.py
# → Running on http://localhost:8000

# Terminal 2: Node.js API Server
cd proctoring/server
npm run dev
# → Running on http://localhost:5000

# Terminal 3: React Frontend
cd proctoring/client
npm run dev
# → Running on http://localhost:3000
```

### Step 9.2: Docker Compose (Optional)

```yaml
# docker-compose.yml
version: '3.8'

services:
  python-service:
    build: ./python-service
    ports:
      - "8000:8000"
    devices:
      - /dev/video0:/dev/video0   # Camera access
    volumes:
      - ./python-service:/app

  server:
    build: ./server
    ports:
      - "5000:5000"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/secureproctor
      - PYTHON_SERVICE_URL=http://python-service:8000
    depends_on:
      - mongo
      - python-service

  client:
    build: ./client
    ports:
      - "3000:3000"
    depends_on:
      - server

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

volumes:
  mongo-data:
```

### Step 9.3: `package.json` Scripts

**Server:**
```json
{
  "scripts": {
    "dev": "nodemon src/index.js",
    "start": "node src/index.js",
    "test": "jest --coverage"
  }
}
```

**Client:**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest"
  }
}
```

---

## File-by-File Migration Map

This table shows exactly what happens to every existing file:

| Current File | Action | New Location | Notes |
|---|---|---|---|
| `server.py` | **REPLACE** | `server/src/index.js` + routes | Flask → Express.js |
| `app.py` | **REPLACE** | `server/src/index.js` | Merged with server.py equivalent |
| `index.html` | **REPLACE** | `client/src/pages/Dashboard.jsx` + components | Vanilla HTML → React components |
| `app.js` | **REPLACE** | `client/src/hooks/*.js` + components | Vanilla JS → React hooks |
| `style.css` | **REPLACE** | `client/tailwind.config.js` + TailwindCSS classes | Raw CSS → Utility-first CSS |
| `proctor_live.py` | **MOVE** | `python-service/proctor_live.py` | No code changes (add `reset_proctoring()`) |
| `eye_cnn_model.py` | **MOVE** | `python-service/eye_cnn_model.py` | Zero changes |
| `train_pretrain.py` | **MOVE** | `python-service/train_pretrain.py` | Zero changes |
| `train_finetune.py` | **MOVE** | `python-service/train_finetune.py` | Zero changes |
| `dataset_loader.py` | **MOVE** | `python-service/dataset_loader.py` | Zero changes |
| `collect_images.py` | **MOVE** | `python-service/collect_images.py` | Zero changes |
| `eye_cnn_final.pth` | **MOVE** | `python-service/eye_cnn_final.pth` | Zero changes |
| `pretrained_eye_cnn.pth` | **MOVE** | `python-service/pretrained_eye_cnn.pth` | Zero changes |
| *(new)* `ml_server.py` | **CREATE** | `python-service/ml_server.py` | FastAPI wrapper |

---

## Risk Assessment & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Python ↔ Node.js latency | Frame drops | Medium | Use IPC/shared memory if HTTP too slow; Buffer 2 frames |
| MongoDB not installed | Can't persist data | Low | Use `mongodb-memory-server` for dev; Cloud Atlas for free tier |
| `cv2.VideoCapture` fails in Docker | No camera feed | High | Use host network mode; pass `/dev/video0` device |
| WebSocket frame size too large | Browser lag | Medium | JPEG quality parameter (80% vs 100%); resize before send |
| CORS issues between 3 services | API calls fail | Medium | Properly configure CORS in Express and FastAPI |
| `winsound` removal breaks alerts | No audio alerts | Low | Replaced with Web Audio API in browser (cross-platform) |

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Scaffolding & Setup | 1 day | Node.js, MongoDB installed |
| Phase 2: Express API Server | 2 days | Phase 1 |
| Phase 3: Python FastAPI Wrapper | 1 day | Existing code works |
| Phase 4: React Dashboard (Core) | 3-4 days | Phase 2 + 3 |
| Phase 5: WebSocket Integration | 1 day | Phase 2 + 4 |
| Phase 6: MongoDB Integration | 1-2 days | Phase 2 |
| Phase 7: UI Enhancements | 3-4 days | Phase 4 |
| Phase 8: Testing | 2 days | All phases |
| Phase 9: Docker & Polish | 1 day | All phases |
| **Total** | **~15-17 days** | — |

---

## Quick Start (After Migration)

```bash
# 1. Start MongoDB
mongod --dbpath ./data/db

# 2. Start Python ML Service
cd proctoring/python-service
pip install -r requirements.txt
python ml_server.py

# 3. Start Node.js Server
cd proctoring/server
npm install
npm run dev

# 4. Start React Frontend
cd proctoring/client
npm install
npm run dev

# 5. Open browser
#    → http://localhost:3000
```

---

## Summary

This migration transforms the SecureProctor AI from a single-process Flask monolith into a modern three-tier MERN architecture:

1. **React Frontend** — Component-based, real-time via WebSocket, beautiful UI with TailwindCSS + Framer Motion
2. **Node.js/Express Backend** — RESTful API + Socket.IO, bridges to Python service, connects to MongoDB
3. **Python ML Microservice** — All model training and inference stays in Python, exposed via FastAPI

The ML code (CNN model, training scripts, inference engine) remains **100% unchanged in Python**. Only the web layer is replaced with industry-standard MERN technologies.

---

*Document Version: 1.0*
*Created: February 8, 2026*
*Project: SecureProctor AI — Flask to MERN Migration*
