# SkillWise Platform — Integration Plan: Merging MERN Interview Bot + FastAPI Proctoring [IMPLEMENTED]

**Document Version:** 1.1 (Final)  
**Date:** April 5, 2026  
**Author:** System Architecture Review  
**Status:** Completed & Verified — End-to-End Integration Success

---

## 0. System Understanding Summary

Before proposing the integration, here is a clear summary of what exists today and what the integration challenge involves.

### What Exists (Current State)

**System 1 — Smart Interview Bot (MERN Stack)**
- **Frontend:** React + Vite (port 3000), pages: Home, Interview, Dashboard, Report
- **Backend:** Express + Socket.io (port 5001), handles interview state machine, question bank, resume processing, answer evaluation
- **ML Service:** FastAPI (port 8000), thin wrapper around original Python ML code (`backend/`), exposes `/predict-intent` and `/evaluate`
- **Database:** MongoDB (via Mongoose), stores sessions, questions, answers
- **Communication:** REST API for setup + WebSocket (Socket.io) for real-time interview flow
- **Key files:** `interviewSocket.js` (event handler), `interview.service.js` (state machine), `Session.js` (schema)

**System 2 — Proctoring System (FastAPI + CNN)**
- **Backend:** FastAPI (port 5000), runs camera capture + CNN inference in a background thread
- **Core engine:** `proctor_live.py` — stateful proctoring with cascaded checks (dark → face → head → gaze)
- **Model:** EyeCNN (337K params), LeNet-style, 2-stage trained
- **Frontend:** Standalone `index.html` + `style.css` + `app.js` (vanilla JS, self-contained)
- **Communication:** REST API only (no WebSocket), MJPEG streaming for video feed
- **Reports:** JSON + CSV + MP4 + snapshots, downloadable as ZIP

**Existing Integration Touchpoints (Already Built)**
- `server/src/adapters/proctoringAdapter.js` — HTTP proxy from Express to FastAPI (status, start, stop, video)
- `server/src/routes/proctoring.routes.js` — Express routes at `/api/proctoring/*`
- The adapter already forwards `/api/proctoring/status`, `/api/proctoring/start`, `/api/proctoring/stop`, `/api/proctoring/video`

### The Integration Challenge

| Aspect | Challenge |
|--------|-----------|
| **Two runtimes** | Node.js (Express) and Python (FastAPI) — cannot be merged into one process |
| **Two frontends** | React SPA (Vite) and vanilla HTML/JS — need one unified UI |
| **Different protocols** | Socket.io (interview) vs REST-only (proctoring) — need event synchronization |
| **Independent state** | Interview state machine in MongoDB vs proctoring state in Python memory — need linked lifecycle |
| **Camera resource** | Proctoring owns the webcam exclusively — frontend cannot also access it |
| **Error isolation** | If proctoring crashes, interview must continue (and vice versa) |

---

## 1. Recommended Architecture

### 1.1 Decision: Microservices (Keep Separate, Connect Smart)

> [!IMPORTANT]
> **We recommend keeping the MERN and FastAPI systems as separate services.** Do NOT merge them into one process.

**Reasons:**
1. **Runtime incompatibility:** Node.js and Python cannot share a process. Bundling them would mean subprocess management, which is fragile.
2. **Camera ownership:** OpenCV camera capture MUST run in the Python process. There is no Node.js equivalent that matches the existing proctoring logic.
3. **Independent scaling:** The proctoring service is CPU-intensive (CNN inference per frame). The interview service is I/O-bound (socket events, DB queries). They have different resource profiles.
4. **Risk reduction:** If we keep them separate, a bug in one service cannot crash the other.
5. **Existing adapter:** The `proctoringAdapter.js` bridge already exists and works. We just need to extend it.

### 1.2 Final Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         UNIFIED FRONTEND (React + Vite) :3000               │
│                                                                              │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │ Setup Flow │  │ Interview    │  │ Proctoring     │  │ Report Page    │  │
│  │ (Skills,   │  │ Room (Voice, │  │ Panel (Webcam, │  │ (Combined      │  │
│  │  Resume,   │  │  Questions,  │  │  Status,       │  │  Interview +   │  │
│  │  PreCheck) │  │  Transcript) │  │  Alerts)       │  │  Proctoring)   │  │
│  └─────┬──────┘  └──────┬───────┘  └───────┬────────┘  └───────┬────────┘  │
│        │                │ Socket.io         │ REST (polled)      │ REST      │
│        │                │                   │                     │           │
└────────┼────────────────┼───────────────────┼─────────────────────┼───────────┘
         │                │                   │                     │
         │   ALL traffic goes through Express (single origin)       │
         │                │                   │                     │
┌────────┼────────────────┼───────────────────┼─────────────────────┼───────────┐
│        ▼                ▼                   ▼                     ▼           │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │               EXPRESS BACKEND (API Gateway) :5001                      │  │
│  │                                                                        │  │
│  │  ┌─────────────┐  ┌──────────────────┐  ┌─────────────────────────┐   │  │
│  │  │ Interview   │  │ Proctoring       │  │ Combined Report         │   │  │
│  │  │ Routes +    │  │ Adapter (proxy)  │  │ Service (merges both    │   │  │
│  │  │ Socket.io   │  │                  │  │ interview + proctoring) │   │  │
│  │  │ Events      │  │ /api/proctoring/ │  │                         │   │  │
│  │  │             │  │ → forwards to    │  │ /api/report/:id         │   │  │
│  │  │             │  │   FastAPI :5000  │  │ → merges both reports   │   │  │
│  │  └──────┬──────┘  └────────┬─────────┘  └──────────┬──────────────┘   │  │
│  │         │                  │                        │                   │  │
│  │         │ HTTP             │ HTTP                   │                   │  │
│  │         ▼                  ▼                        │                   │  │
│  │  ┌──────────────┐  ┌──────────────────┐            │                   │  │
│  │  │ ML Service   │  │  Proctoring      │            │                   │  │
│  │  │ FastAPI :8000│  │  FastAPI :5000   │            │                   │  │
│  │  │              │  │                  │            │                   │  │
│  │  │ /predict     │  │ /start           │            │                   │  │
│  │  │ /evaluate    │  │ /stop            │            │                   │  │
│  │  │              │  │ /status          │            │                   │  │
│  │  │              │  │ /video_feed      │            │                   │  │
│  │  │              │  │ /report/latest   │            │                   │  │
│  │  └──────────────┘  └──────────────────┘            │                   │  │
│  │                                                     │                   │  │
│  │  ┌──────────────────────────────────────────────────┘                   │  │
│  │  │ MongoDB                                                              │  │
│  │  │ - sessions (interview data + proctoring summary)                     │  │
│  │  │ - questions                                                          │  │
│  │  └──────────────────────────────────────────────────────────────────────┘  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Key Architecture Decision: Express as API Gateway

**The React frontend talks ONLY to Express (port 5001).**

- All interview operations → Express directly
- All proctoring operations → Express → proxy to FastAPI (via `proctoringAdapter.js`)
- The MJPEG video feed → Express → pipe from FastAPI stream

**Why:**
- **Single origin:** No CORS headaches. The React app (proxied via Vite to :5001) only calls one backend.
- **Session linking:** Express can attach the MongoDB sessionId to proctoring requests, creating a link between the two systems.
- **Error handling centralized:** Express can gracefully degrade if proctoring is unavailable.
- **Already built:** The adapter pattern already exists in the codebase and is proven.

---

## 2. Frontend Responsibilities

### 2.1 What Changes in the React Frontend

| Component | Current State | After Integration |
|-----------|---------------|-------------------|
| `App.jsx` | Routes: /, /interview/:id, /dashboard, /report/:id | Add: /setup (multi-step), /interview/:id/complete |
| `Home.jsx` | Skill selection + resume upload | Becomes `/setup` with 3-step wizard (skills → resume → pre-check) |
| `Interview.jsx` | Question + voice controls only | Adds: side panel with webcam feed, proctoring status, alert overlay |
| `Report.jsx` | Interview results only | Adds: proctoring summary, alert timeline, snapshots, download links |
| `Dashboard.jsx` | Session list + stats | Adds: proctoring pass/fail column, proctoring stats |

### 2.2 New React Components Needed

```
client/src/
├── components/
│   ├── (existing...)
│   ├── proctoring/
│   │   ├── WebcamFeed.jsx          # MJPEG <img> from /api/proctoring/video
│   │   ├── ProctoringStatus.jsx    # SAFE/ALERT badge + details
│   │   ├── ProctoringPanel.jsx     # Side panel container (webcam + status + history)
│   │   ├── AlertOverlay.jsx        # Full-screen warning overlay
│   │   ├── AlertHistory.jsx        # Scrollable log of proctoring events
│   │   ├── PreCheck.jsx            # System check screen (camera, mic, lighting)
│   │   └── ConsentNotice.jsx       # Proctoring transparency + consent checkbox
│   │
│   └── report/
│       ├── ProctoringReport.jsx    # Proctoring summary in report page
│       └── AlertTimeline.jsx       # Visual timeline of proctoring events
│
├── context/
│   ├── InterviewContext.jsx        # (existing)
│   └── ProctoringContext.jsx       # NEW: manages proctoring state + polling
│
├── hooks/
│   ├── (existing...)
│   └── useProctoring.js            # NEW: polling hook for proctoring status
│
└── services/
    ├── api.js                      # (existing — add proctoringAPI methods)
    └── socket.js                   # (existing — no changes)
```

### 2.3 ProctoringContext — The State Bridge

The interview uses Socket.io for real-time events. The proctoring system uses REST polling. We need a React context that bridges this gap.

```javascript
// client/src/context/ProctoringContext.jsx (conceptual)

const ProctoringContext = createContext();

export function ProctoringProvider({ children, sessionId, isActive }) {
  const [status, setStatus] = useState({ status: 'SAFE', reason: 'SAFE' });
  const [alerts, setAlerts] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  // Poll proctoring status every 500ms when active
  useEffect(() => {
    if (!isActive) return;
    
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/proctoring/status');
        const data = await response.json();
        
        if (data.success) {
          const newStatus = data.data;
          
          // Detect state transitions
          if (newStatus.status !== status.status || newStatus.reason !== status.reason) {
            setAlerts(prev => [...prev, {
              timestamp: new Date(),
              status: newStatus.status,
              reason: newStatus.reason,
            }]);
          }
          
          setStatus(newStatus);
          setIsConnected(true);
        }
      } catch {
        setIsConnected(false);
      }
    }, 500);
    
    return () => clearInterval(interval);
  }, [isActive, status]);
  
  return (
    <ProctoringContext.Provider value={{ status, alerts, isConnected }}>
      {children}
    </ProctoringContext.Provider>
  );
}
```

**Why polling (not WebSocket)?**
- The proctoring FastAPI service does not support WebSocket. Adding it would require modifying `proctor_live.py`, which violates the "don't break existing functionality" constraint.
- 500ms polling is more than sufficient — human perception of "real-time" is ~200ms, and the proctoring system itself uses 0.9s debounce thresholds.
- Polling through the Express proxy gives us the error isolation we need.

> [!NOTE]
> **Future optimization:** If latency becomes an issue, add a WebSocket endpoint to the FastAPI service later. The React context can be updated to use WebSocket without changing any consumer components.

---

## 3. Backend Responsibilities

### 3.1 Express Backend Changes

#### 3.1.1 Extend `proctoringAdapter.js`

Add new proxy methods for the additional proctoring endpoints:

```javascript
// New methods to add to proctoringAdapter.js

// GET /api/proctoring/settings
async function getSettings(req, res) { ... }

// POST /api/proctoring/settings
async function updateSettings(req, res) { ... }

// POST /api/proctoring/session/meta — links interview session to proctoring
async function setSessionMeta(req, res) {
  // Extract candidate info from MongoDB session
  // Forward to proctoring service
  const sessionId = req.params.sessionId;
  const session = await Session.findById(sessionId);
  
  const metaPayload = {
    candidate_name: session.candidateName || 'Candidate',
    exam_id: sessionId,
    subject: session.userSelectedSkills.join(', '),
  };
  
  const { data } = await axios.post(`${PROCTOR_BASE}/session/meta`, metaPayload);
  res.json({ success: true, data });
}

// GET /api/proctoring/report — fetch latest proctoring report
async function getReport(req, res) { ... }
```

#### 3.1.2 Add Session-Proctoring Link

Extend the MongoDB Session schema to store proctoring metadata:

```javascript
// Add to Session.js schema

// Proctoring Data (stored after interview ends)
proctoringData: {
  enabled: { type: Boolean, default: false },
  startedAt: Date,
  endedAt: Date,
  totalAlerts: { type: Number, default: 0 },
  alertEvents: [{
    timestamp: Date,
    status: String,  // ALERT or STATUS_RECOVERED
    reason: String,  // LOOKING_AWAY, HEAD_LEFT, NO_FACE, etc.
    duration: Number  // seconds
  }],
  passed: { type: Boolean, default: true },
  reportPath: String  // path to proctoring JSON report
}
```

#### 3.1.3 Combined Report Service

Create a new service that merges interview + proctoring reports:

```javascript
// server/src/services/report.service.js (new)

async function generateCombinedReport(sessionId) {
  // 1. Get interview data from MongoDB
  const session = await Session.findById(sessionId);
  const interviewReport = interviewService.generateReport(session);
  
  // 2. Get proctoring data from FastAPI
  let proctoringReport = null;
  try {
    const { data } = await axios.get(`${PROCTOR_BASE}/report/latest`);
    proctoringReport = data;
  } catch {
    // Proctoring data unavailable — still return interview data
  }
  
  // 3. Merge into combined report
  return {
    interview: interviewReport,
    proctoring: proctoringReport,
    combined: {
      overallScore: interviewReport.summary.finalScore,
      proctoringPassed: session.proctoringData?.passed ?? true,
      totalDuration: session.durationMinutes,
      completedAt: session.endedAt,
    }
  };
}
```

### 3.2 FastAPI Proctoring — No Major Changes

> [!TIP]
> The proctoring FastAPI service (`server.py`, `proctor_live.py`) requires **zero code changes** for initial integration. All communication happens through existing REST endpoints.

The Express adapter proxies everything. The proctoring service doesn't need to know about the interview system at all.

**Minor optional enhancements (non-breaking):**
- Add a `GET /health` endpoint for service discovery (trivial)
- Add the `interview_session_id` to the session metadata (via existing `/session/meta` endpoint)

---

## 4. API Communication Flow

### 4.1 Complete API Map

```
React Frontend → Express Backend → [FastAPI Services]

INTERVIEW FLOW (existing, unchanged):
  POST /api/interview/start      → creates MongoDB session
  GET  /api/interview/session/:id → gets session data
  WS   socket.io events           → join-session, start-interview,
                                     question, submit-answer,
                                     next-question, end-interview, etc.

PROCTORING FLOW (via Express proxy, new frontend integration):
  POST /api/proctoring/start          → Express → POST FastAPI:5000/start
  POST /api/proctoring/stop           → Express → POST FastAPI:5000/stop
  GET  /api/proctoring/status         → Express → GET  FastAPI:5000/status
  GET  /api/proctoring/video          → Express → GET  FastAPI:5000/video_feed (piped stream)
  GET  /api/proctoring/settings       → Express → GET  FastAPI:5000/settings
  POST /api/proctoring/settings       → Express → POST FastAPI:5000/settings
  POST /api/proctoring/session/meta   → Express → POST FastAPI:5000/session/meta
  GET  /api/proctoring/report         → Express → GET  FastAPI:5000/report/latest

COMBINED (new):
  GET  /api/report/:sessionId/combined → Express merges interview + proctoring
  GET  /api/report/:sessionId/proctoring-download → Express → piped file from FastAPI
```

### 4.2 Data Format Between Services

All inter-service communication uses JSON over HTTP:

```json
// Express → FastAPI: Start proctoring with session context
POST /session/meta
{
  "candidate_name": "John Doe",
  "exam_id": "662a1b2c3d4e5f...",   // MongoDB ObjectId
  "subject": "Python, React",
  "roll_number": ""
}

// FastAPI → Express: Status response (polled)
GET /status
{
  "status": "SAFE",       // or "ALERT"
  "reason": "SAFE"        // or "LOOKING AWAY", "HEAD LEFT", etc.
}

// FastAPI → Express: Report manifest
GET /report/latest
{
  "json": "proctor_report_2026-04-05_14-30-00.json",
  "csv": "proctor_events_2026-04-05_14-30-00.csv",
  "video": "proctor_session_2026-04-05_14-30-00.mp4",
  "snapshots": ["alert_001.jpg", "alert_002.jpg"],
  "download": {
    "json": "/report/download/json",
    "csv": "/report/download/csv",
    "video": "/report/download/video",
    "package": "/report/download/package"
  }
}
```

---

## 5. Event Flow During Live Interview + Proctoring

### 5.1 Sequence Diagram: Complete Interview Lifecycle

```
┌─────────┐     ┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  React  │     │ Express │     │ FastAPI  │     │FastAPI   │     │ MongoDB  │
│ Frontend│     │ Backend │     │ Proctor  │     │ML Service│     │          │
└────┬────┘     └────┬────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │               │               │                │                │
     │ 1. POST /api/interview/start  │                │                │
     │──────────────>│               │                │                │
     │               │───────────────────────────────────────────────>│
     │               │               │                │  Create session│
     │<──────────────│               │                │                │
     │  sessionId    │               │                │                │
     │               │               │                │                │
     │ 2. Navigate to /setup (step 3: pre-check)     │                │
     │               │               │                │                │
     │ 3. POST /api/proctoring/session/meta           │                │
     │──────────────>│──────────────>│                │                │
     │               │ proxy         │ store meta     │                │
     │<──────────────│<──────────────│                │                │
     │               │               │                │                │
     │ 4. POST /api/proctoring/start │                │                │
     │──────────────>│──────────────>│                │                │
     │               │ proxy         │ start camera   │                │
     │               │               │ + CNN thread   │                │
     │<──────────────│<──────────────│                │                │
     │               │               │                │                │
     │ 5. GET /api/proctoring/video (stream)          │                │
     │──────────────>│──────────────>│                │                │
     │<═════════════ MJPEG stream piped ═════════════│                │
     │               │               │                │                │
     │ 6. Camera + lighting check passes              │                │
     │    User clicks "Begin Interview"               │                │
     │               │               │                │                │
     │ 7. WebSocket: join-session    │                │                │
     │══════════════>│               │                │                │
     │ 8. WebSocket: start-interview │                │                │
     │══════════════>│               │                │                │
     │               │ interview-message (intro)      │                │
     │<══════════════│               │                │                │
     │               │ question (first Q)             │                │
     │<══════════════│               │                │                │
     │               │               │                │                │
     │ ═══════ INTERVIEW LOOP (repeats) ═══════      │                │
     │               │               │                │                │
     │ [Every 500ms] │               │                │                │
     │ 9. GET /api/proctoring/status │                │                │
     │──────────────>│──────────────>│                │                │
     │<──────────────│<──────────────│                │                │
     │  {SAFE/ALERT} │               │                │                │
     │               │               │                │                │
     │ [If ALERT detected → show overlay in React]    │                │
     │               │               │                │                │
     │ 10. User answers (voice)      │                │                │
     │  WebSocket: submit-answer     │                │                │
     │══════════════>│               │                │                │
     │               │ Process answer│                │                │
     │               │──────────────────────────────>│                │
     │               │               │  /evaluate     │                │
     │               │<─────────────────────────────│                │
     │               │───────────────────────────────────────────────>│
     │               │               │                │  Store answer  │
     │  answer-result│               │                │                │
     │<══════════════│               │                │                │
     │               │               │                │                │
     │ ═══════ END OF INTERVIEW ═══════              │                │
     │               │               │                │                │
     │ 11. WebSocket: end-interview  │                │                │
     │══════════════>│               │                │                │
     │               │               │                │                │
     │ 12. POST /api/proctoring/stop │                │                │
     │──────────────>│──────────────>│                │                │
     │               │               │ Stop camera    │                │
     │               │               │ Generate report│                │
     │               │<──────────────│                │                │
     │               │ {report links}│                │                │
     │               │               │                │                │
     │ 13. Express fetches proctoring report          │                │
     │               │──────────────>│                │                │
     │               │<──────────────│  JSON report   │                │
     │               │───────────────────────────────────────────────>│
     │               │               │                │Save to session │
     │               │               │                │                │
     │ 14. interview-complete (with combined data)    │                │
     │<══════════════│               │                │                │
     │               │               │                │                │
     │ 15. Navigate to /report/:id   │                │                │
     │               │               │                │                │
     │ 16. GET /api/report/:id/combined               │                │
     │──────────────>│               │                │                │
     │<──────────────│ Merged interview + proctoring  │                │
     │               │               │                │                │
```

### 5.2 Event Synchronization: Interview ↔ Proctoring

These two systems operate **independently** during the interview. They do NOT need to be tightly coupled. Here's why and how:

| Scenario | Interview System | Proctoring System | Coordination |
|----------|-----------------|-------------------|--------------|
| **Normal flow** | Asks questions, evaluates answers | Monitors camera, tracks violations | None needed — they run in parallel |
| **Alert triggered** | Continues running (timer keeps going) | Raises ALERT, plays buzzer | Frontend polls status, shows overlay |
| **Candidate looks back** | Still running | Returns to SAFE | Frontend dismisses overlay |
| **Multiple violations** | Optionally pauses (future scope) | Continues monitoring | Frontend can count alerts and decide to pause |
| **Interview ends** | Saves to MongoDB + generates report | Express calls /stop → generates report | Express merges both reports |
| **Proctoring crashes** | Continues without monitoring | Down | Frontend shows "monitoring offline" badge |
| **Interview crashes / User disconnects** | Automatically calls `/stop` on socket disconnect to prevent camera memory leaks | Down / Continues until stopped | Express `socket.on('disconnect')` triggers proctoring stop |

**Key design principle:** The proctoring system never controls the interview flow. It's an observation layer, not a control layer. Alerts are displayed to the candidate but do not automatically terminate or pause the interview. This separation is critical for stability.

---

## 6. Authentication & Session Management

### 6.1 Current State

There is **no authentication** in the current system. Sessions are created anonymously via `POST /api/interview/start`.

### 6.2 Recommended Approach for MVP

For the initial integration, **keep it sessionless** (no auth):

1. A new interview session creates a MongoDB document with a unique `_id`
2. This `_id` is used as the session identifier everywhere
3. The proctoring service receives this `_id` via `/session/meta` as the `exam_id`
4. All API calls use the session ID as a path parameter

**Session lifecycle:**

```
CREATE → candidate clicks "Continue" on skill selection
         → POST /api/interview/start → returns sessionId

LINK   → pre-check screen
         → POST /api/proctoring/session/meta { exam_id: sessionId }
         → POST /api/proctoring/start

ACTIVE → interview room
         → WebSocket: join-session { sessionId }
         → Interview events + proctoring polling run simultaneously

END    → candidate clicks "End Interview" or interview completes naturally
         → WebSocket: end-interview
         → POST /api/proctoring/stop
         → Express fetches proctoring report and saves to session

VIEW   → report page
         → GET /api/report/:sessionId/combined
```

### 6.3 Future Auth (Post-MVP)

When auth is needed:
- Add JWT-based authentication to Express
- Session creation requires a valid token
- Dashboard shows only authenticated user's sessions
- Proctoring service doesn't need auth (it's behind Express proxy)

---

## 7. Real-Time Updates & Alert Handling

### 7.1 Proctoring Status Polling

```
React Frontend                Express Backend              FastAPI Proctoring
     │                              │                              │
     │  GET /api/proctoring/status  │                              │
     │─────────────────────────────>│  GET /status                │
     │                              │─────────────────────────────>│
     │                              │<─────────────────────────────│
     │<─────────────────────────────│  { status, reason }          │
     │                              │                              │
     │  [500ms later]               │                              │
     │  GET /api/proctoring/status  │                              │
     │─────────────────────────────>│  ... repeats ...             │
```

**Polling frequency:** 500ms
- Why 500ms: The proctoring system uses 0.9s persistence timers. 500ms polling catches state transitions within one cycle.
- If network is slow: `ProctoringContext` implements exponential backoff (500ms → 1000ms → 2000ms) on consecutive failures, then resumes 500ms on success.

### 7.2 Alert UI State Machine

```
         ┌──────────────────┐
         │   SAFE (default)  │
         │                    │──── status === 'SAFE' ────┐
         │  • Green badge     │                            │
         │  • No overlay      │                            │
         └────────┬───────────┘                            │
                  │                                        │
                  │ status === 'ALERT'                     │
                  │ for > 1 poll cycle                     │
                  ▼                                        │
         ┌───────────────────┐                             │
         │   ALERT (warning)  │                            │
         │                    │                            │
         │  • Red badge       │                            │
         │  • Overlay visible  │                            │
         │  • Buzzer audible   │                            │
         │  • Alert logged     │                            │
         └────────┬───────────┘                            │
                  │                                        │
                  │ status === 'SAFE'                      │
                  │ (proctoring recovered)                  │
                  └────────────────────────────────────────┘
```

### 7.3 Violation Counting

The frontend tracks alert history in `ProctoringContext`:

```javascript
// Alert tracking logic in ProctoringContext
const [alertHistory, setAlertHistory] = useState([]);
const [totalAlerts, setTotalAlerts] = useState(0);

// When status transitions from SAFE to ALERT:
if (prevStatus === 'SAFE' && newStatus === 'ALERT') {
  setTotalAlerts(prev => prev + 1);
  setAlertHistory(prev => [...prev, {
    id: Date.now(),
    timestamp: new Date(),
    reason: data.reason,
    startedAt: new Date()
  }]);
}

// When status transitions from ALERT to SAFE:
if (prevStatus === 'ALERT' && newStatus === 'SAFE') {
  setAlertHistory(prev => {
    const updated = [...prev];
    const lastAlert = updated[updated.length - 1];
    if (lastAlert && !lastAlert.endedAt) {
      lastAlert.endedAt = new Date();
      lastAlert.duration = (lastAlert.endedAt - lastAlert.startedAt) / 1000;
    }
    return updated;
  });
}
```

This alert history is sent to Express when the interview ends, and stored in `session.proctoringData.alertEvents`.

---

## 8. Error Isolation Strategy

### 8.1 Failure Modes and Graceful Degradation

| Failure | Impact | Mitigation |
|---------|--------|------------|
| **Proctoring service not running** | No webcam, no monitoring | Interview continues normally. Side panel shows "Monitoring unavailable" with offline badge. Pre-check warns user. |
| **Proctoring service crashes mid-interview** | Webcam feed stops, status polling fails | `ProctoringContext` detects failure (3 consecutive failed polls), shows "Monitoring paused — connection lost" badge. Interview continues. |
| **Express backend crashes** | Everything stops | React shows "Connection lost. Reconnecting..." Socket.io auto-reconnect handles this. |
| **Candidate closes browser (Ungraceful exit)** | Socket disconnects, but `/stop` is never called from frontend | Express `socket.on('disconnect')` captures the exit and automatically calls `proctoringAdapter.stop()` to kill the Python camera thread, preventing severe memory leaks. |
| **ML service crashes** | Answer evaluation fails | Express catches error, scores answer as 0, logs "Evaluation unavailable", interview continues with next question |
| **MongoDB crashes** | Sessions can't be saved | Express returns 503. React shows error toast. Existing answers in memory are preserved. |
| **Camera hardware fails** | No video feed | Proctoring service detects this internally (`cap.isOpened()` fails), returns status with reason "CAMERA_ERROR". Frontend shows "Camera unavailable" |
| **Network interruption** | All communication fails | Socket.io auto-reconnects. Proctoring polling enters backoff mode. Interview state preserved on server. |

### 8.2 Implementation Pattern: Try-Catch Isolation

Every cross-service call in Express uses this pattern:

```javascript
async function getStatus(req, res) {
  try {
    const { data } = await axios.get(`${PROCTOR_BASE}/status`, { timeout: 3000 });
    res.json({ success: true, data });
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      // Proctoring service is down — this is NOT a fatal error
      return res.json({
        success: true,
        data: { status: 'OFFLINE', reason: 'SERVICE_UNAVAILABLE' },
        warning: 'Proctoring service is not running'
      });
    }
    // Unexpected error — still don't crash
    res.json({
      success: true,
      data: { status: 'OFFLINE', reason: 'ERROR' },
      error: err.message
    });
  }
}
```

**Key:** The Express server NEVER returns 500 for proctoring failures. It always returns a valid response with degraded data.

---

## 9. Scalability & Future Expansion

### 9.1 Current Scale Target

- Single instance deployment (1 candidate at a time)
- All services on one machine
- This is appropriate for the academic project scope

### 9.2 Future Scale Path

| Phase | Scale | Changes Needed |
|-------|-------|----------------|
| **Phase 1 (now)** | 1 candidate, 1 machine | No changes |
| **Phase 2** | 5 concurrent candidates | Multiple proctoring instances (each with own camera mapping). Express stateless via Redis session store. |
| **Phase 3** | 50+ candidates | Proctoring service dockerized. GPU acceleration for CNN. Load balancer in front of Express. MongoDB Atlas managed DB. |
| **Phase 4** | Enterprise | WebSocket gateway (replacing Socket.io). Message queue (RabbitMQ/Redis Streams) between services. Kubernetes orchestration. |

### 9.3 Extension Points (Designed Into Architecture)

1. **New detection modules:** Add to proctoring cascade without touching interview system
2. **New question sources:** Add to Express question service without touching proctoring
3. **Emotion analysis:** Add as another FastAPI service, proxy through Express
4. **Admin dashboard:** Add new React routes, new Express endpoints for admin queries
5. **Multi-language support:** Frontend-only change (i18n), no backend impact

---

## 10. Deployment Strategy

### 10.1 Docker Compose (Recommended)

```yaml
# docker-compose.yml

version: '3.8'

services:
  # React Frontend (built as static files, served by nginx)
  frontend:
    build: ./client
    ports:
      - "3000:80"
    depends_on:
      - backend

  # Express Backend (API Gateway)
  backend:
    build: ./server
    ports:
      - "5001:5001"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/skillwise
      - PROCTOR_URL=http://proctoring:5000
      - ML_SERVICE_URL=http://ml-service:8000
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    depends_on:
      - mongo
      - ml-service

  # Proctoring Service
  proctoring:
    build: ./proctoring_fastapi
    ports:
      - "5000:5000"
    devices:
      - /dev/video0:/dev/video0  # Camera passthrough (Linux)
    environment:
      - INTERVIEW_API_URL=http://backend:5001
      - ML_SERVICE_URL=http://ml-service:8000
    volumes:
      - proctor-reports:/app/reports

  # ML Service
  ml-service:
    build: ./ml-service
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app/backend:ro  # Mount original backend as read-only

  # MongoDB
  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

volumes:
  mongo-data:
  proctor-reports:
```

### 10.2 Development Mode (Current — 4 Terminals)

```
Terminal 1: cd proctoring_fastapi && python server.py           # port 5000
Terminal 2: cd ml-service && uvicorn main:app --port 8000       # port 8000
Terminal 3: cd server && npm run dev                            # port 5001
Terminal 4: cd client && npm run dev                            # port 3000
```

> [!NOTE]
> The Vite dev server (port 3000) proxies `/api/*` to Express (port 5001). Express proxies `/api/proctoring/*` to FastAPI (port 5000). So the React app only directly communicates with one server.

---

## 11. Migration Strategy: From Separate Systems to Unified Platform

### 11.1 Phase-by-Phase Migration (Low Risk)

This migration is designed so that **at every phase, the system is fully functional**. No "big bang" switchover.

#### Phase A: Foundation (Days 1-2)

**Goal:** Extend the Express adapter + add proctoring to the MongoDB schema. No frontend changes yet.

- [ ] Extend `proctoringAdapter.js` with `getSettings`, `updateSettings`, `setSessionMeta`, `getReport`
- [ ] Extend `proctoring.routes.js` with new proxy routes
- [ ] Add `proctoringData` field to `Session.js` schema
- [ ] Create `report.service.js` for combined report generation
- [ ] Add `GET /api/report/:sessionId/combined` route
- [ ] Test all proxy routes manually via Postman/Swagger

**Validation:** All existing functionality works unchanged. New routes are additive.

#### Phase B: Pre-Check Screen (Days 3-4)

**Goal:** Add the system check + proctoring consent screen to the setup flow.

- [ ] Create `PreCheck.jsx` component
- [ ] Create `ConsentNotice.jsx` component
- [ ] Modify `Home.jsx` → convert to 3-step wizard (or create new `/setup` route)
- [ ] WebcamFeed component (simple `<img src="/api/proctoring/video" />`)
- [ ] System checks: camera detection, mic permission, lighting check via proctoring `/status`
- [ ] Wire: clicking "Begin Interview" calls `/api/proctoring/start` + `/api/proctoring/session/meta`

**Validation:** Candidate can see themselves before interview starts. Proctoring is running when they enter the interview room.

#### Phase C: Interview Room Integration (Days 5-7)

**Goal:** Add the proctoring side panel to the interview room.

- [ ] Create `ProctoringContext.jsx` with polling logic
- [ ] Create `ProctoringPanel.jsx` (webcam + status + alert history)
- [ ] Create `ProctoringStatus.jsx` (SAFE/ALERT badge)
- [ ] Create `AlertOverlay.jsx` (warning modal)
- [ ] Create `AlertHistory.jsx` (scrollable log)
- [ ] Modify `Interview.jsx` layout: add side panel (CSS grid: 70/30 split)
- [ ] Wrap `Interview.jsx` with `ProctoringProvider`
- [ ] On interview end (`end-interview` socket event), call `/api/proctoring/stop`
- [ ] After stop, fetch proctoring report and save to session

**Validation:** Full interview with live proctoring monitoring. Alerts visible in real-time. Interview works even if proctoring is offline (graceful degradation).

#### Phase D: Report Enhancement (Days 8-9)

**Goal:** Add proctoring summary to the report page.

- [ ] Create `ProctoringReport.jsx` component
- [ ] Create `AlertTimeline.jsx` (visual timeline)
- [ ] Modify `Report.jsx` to call `/api/report/:sessionId/combined`
- [ ] Display proctoring summary: total alerts, timeline, snapshots
- [ ] Add "Download CSV Log" button (piped from FastAPI via Express)
- [ ] Add "Watch Session Video (.mp4)" button (piped via Express stream) to allow recruiters to review cheating instances

**Validation:** Report shows both interview performance and proctoring behavior.

#### Phase E: Dashboard & Polish (Days 10-12)

**Goal:** Update dashboard with proctoring data + final polish.

- [ ] Add proctoring pass/fail column to session list
- [ ] Add proctoring stats to overview cards
- [ ] Responsive design: tablet PiP mode, mobile floating webcam
- [ ] Animation polish: transitions, micro-interactions
- [ ] Error state handling: all edge cases
- [ ] End-to-end testing
- [ ] Documentation update

**Validation:** Complete unified platform working end-to-end.

### 11.2 Rollback Strategy

At any phase, if something breaks badly:
- **Phase A:** Revert schema changes (MongoDB is schemaless, old documents still work). Remove new routes. Zero impact on existing functionality.
- **Phase B:** Remove pre-check step, go directly to interview room. Proctoring is never started.
- **Phase C:** Remove proctoring panel from interview room, revert to single-column layout. Interview still works.
- **Phase D:** Revert to interview-only report page.
- **Phase E:** Dashboard changes are purely additive.

**Every phase is independently revertible.**

---

## 12. Risk Analysis & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Camera conflict:** Browser and proctoring both try to access webcam | High | Camera fails in one system | **Proctoring owns the camera exclusively.** Frontend webcam is the MJPEG stream from proctoring, not a direct `getUserMedia()` call. The pre-check screen's camera preview uses the proctoring stream. |
| **Polling overhead:** 500ms polling creates too many HTTP requests | Low | Slight performance degradation | The status endpoint returns ~50 bytes of JSON. 2 requests/second is negligible. |
| **MJPEG stream through proxy adds latency** | Medium | Webcam feed feels laggy | Express pipes the stream directly (`response.data.pipe(res)`). Added latency is <50ms. If needed, switch to direct FastAPI URL (requires CORS config). |
| **Interview ends but proctoring doesn't stop** | Medium | Camera stays on, resources wasted | The `end-interview` handler explicitly calls `/api/proctoring/stop`. Safety net: add a cleanup timer that stops proctoring 5 minutes after last status poll. |
| **Proctoring `app.js` frontend conflicts with React** | None | None | We are NOT using the proctoring's `index.html` or `app.js`. The React frontend builds its own UI. The proctoring service is used purely as an API. |
| **Session ID mismatch:** Interview session and proctoring session get out of sync | Low | Wrong proctoring data in report | The `exam_id` in proctoring metadata is set to the MongoDB session ID. When fetching the report, we verify the `exam_id` matches. |
| **CNN model load time on first start** | Medium | Slow first start | Proctoring service loads the model at startup (`on_startup`). Pre-check screen waits for `/status` to succeed before allowing interview start. |

---

## 13. Testing Strategy

### 13.1 Before Integration (Baseline Tests)

Run these before making any changes to establish a baseline:

```bash
# 1. Interview system works standalone
cd server && npm test          # API route tests
cd client && npm run build     # Frontend builds without errors

# 2. Proctoring system works standalone
cd proctoring_fastapi
python -m pytest tests/        # If tests exist
curl http://localhost:5000/status  # Returns valid JSON

# 3. ML service works standalone
curl http://localhost:8000/health
curl -X POST http://localhost:8000/predict -d '{"text":"Java programming"}'
```

### 13.2 Integration Tests (Per Phase)

#### Phase A Tests
```bash
# Test new proxy routes
curl http://localhost:5001/api/proctoring/status     # Should return status or "offline" gracefully
curl http://localhost:5001/api/proctoring/settings    # Should proxy to FastAPI
curl -X POST http://localhost:5001/api/proctoring/session/meta \
  -H "Content-Type: application/json" \
  -d '{"candidate_name":"Test","exam_id":"test123"}'
```

#### Phase B Tests
- Open `/setup` → verify 3-step flow works
- Step 3: camera preview shows MJPEG stream
- System checklist shows all checks passing
- Consent checkbox enables "Begin Interview" button
- Clicking "Begin Interview" starts proctoring (verify via `curl /api/proctoring/status`)

#### Phase C Tests
- Start interview → verify proctoring panel shows webcam + SAFE badge
- Look away from screen → verify ALERT badge appears within ~2 seconds
- Look back → verify SAFE badge returns
- Disable proctoring service (kill Python) → verify interview continues with "monitoring offline" badge
- Restart proctoring service → verify monitoring resumes automatically

#### Phase D Tests
- Complete full interview → navigate to report
- Report shows both interview scores AND proctoring summary
- Alert timeline shows correct events with timestamps
- "Download" button retrieves ZIP from proctoring service

#### Phase E Tests
- Dashboard shows proctoring column for all sessions
- Responsive: test on 1440px, 1024px, 768px, 375px viewports
- Full end-to-end: setup → pre-check → interview (5 questions) → report → dashboard

### 13.3 After Integration (Regression Tests)

Run ALL baseline tests again to verify nothing is broken:

```bash
# Everything from 13.1 must still pass
# PLUS: run existing interview scenarios
# - Create session, answer 3 questions, end interview, view report
# - Resume upload flow
# - Skip questions flow
# - End interview early flow
```

### 13.4 Edge Case Tests

| Test | Expected Result |
|------|-----------------|
| Start interview without starting proctoring | Interview works, proctoring panel shows "offline" |
| Start proctoring without internet | Proctoring operates locally (no external dependencies) |
| Very long interview (>30 min) | Proctoring report generates correctly, MJPEG stream stays stable |
| Close browser tab during interview | Session preserved in MongoDB, reconnection possible, proctoring auto-stops on next request |
| Multiple tabs open | Only one tab should be actively polling proctoring |

---

*This integration plan is designed for minimal risk. At every step, the existing functionality is preserved. The two systems communicate through HTTP proxies and shared session IDs, never through direct code coupling. This makes the integration reversible, testable, and maintainable.*
