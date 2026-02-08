# API Contracts

> Generated: 2026-02-08 | AI Smart Interviewer — MERN Stack

All request/response shapes for inter-service communication.

---

## 1. Client ↔ Server (REST)

### 1.1 Health

```
GET /health
Response 200:
{
  "status": "ok",
  "timestamp": "2026-02-08T15:28:34.295Z",
  "environment": "development",
  "uptime": 45.42
}
```

### 1.2 Interview

```
POST /api/interview/start
Request:
{
  "skills": ["Java", "Python", "React"]   // required, non-empty string[]
  "resumePath": "uploads/abc.pdf"          // optional
}
Response 201:
{
  "success": true,
  "data": {
    "sessionId": "65a1b2c3d4e5f6...",
    "state": "INTRO",
    "skills": ["Java", "Python", "React"],
    "message": "Session created successfully"
  }
}

GET /api/interview/session/:sessionId
Response 200:
{
  "success": true,
  "data": {
    "sessionId": "...",
    "state": "DEEP_DIVE",
    "questionsAsked": 12,
    "currentTopic": "Python",
    "skillsDetected": ["Python", "React"],
    "skillsQueue": ["Python", "React"],
    "answersCount": 10,
    "startedAt": "ISO date",
    "endedAt": null,
    "duration": null
  }
}

POST /api/interview/session/:sessionId/end
Response 200:
{
  "success": true,
  "data": {
    "sessionId": "...",
    "state": "FINISHED",
    "finalScore": 72,
    "duration": 18.5,
    "questionsAnswered": 25
  }
}

GET /api/interview/session/:sessionId/report
Response 200:
{
  "success": true,
  "data": {
    "summary": { "totalQuestions": 25, "answered": 22, "skipped": 3, "avgScore": 68 },
    "answers": [{ "questionText": "...", "topic": "Java", "score": 80, "isCorrect": true, ... }],
    "topicBreakdown": [{ "topic": "Java", "avgScore": 75, "count": 5 }],
    "finalScore": 72
  }
}
```

### 1.3 Questions

```
GET /api/questions/topic/:topic?limit=10&page=1
Response 200:
{
  "success": true,
  "data": {
    "questions": [
      { "question": "...", "expectedAnswer": "...", "keywords": [...], "difficulty": "medium" }
    ],
    "pagination": { "total": 47, "page": 1, "pages": 5 }
  }
}

GET /api/questions/search?q=keyword&topics=Java,Python
Response 200:
{
  "success": true,
  "data": { "query": "keyword", "results": [...], "count": 5 }
}

GET /api/questions/stats
Response 200:
{
  "success": true,
  "data": {
    "totalQuestions": 330,
    "topicStats": [{ "topic": "Java", "count": 47, "avgTimesAsked": 3.2, "avgScore": 65 }]
  }
}

GET /api/questions/topics
Response 200:
{
  "success": true,
  "data": { "topics": ["Java", "Python", ...], "count": 7 }
}
```

### 1.4 Resume

```
POST /api/resume/upload
Request: multipart/form-data
  - resume: File (PDF/DOCX)
  - sessionId: string
Response 200:
{
  "success": true,
  "data": {
    "sessionId": "...",
    "fileName": "resume.pdf",
    "skillsDetected": ["Python", "React"],
    "resumeQuestionsReady": false,
    "message": "Resume uploaded. Questions generating in background.",
    "status": "processing"
  }
}

GET /api/resume/:sessionId/data
Response 200:
{
  "success": true,
  "data": {
    "sessionId": "...",
    "resumeSummary": "...",
    "skillsDetected": ["Python", "React"],
    "hasQuestions": true
  }
}

GET /api/resume/:sessionId/questions?includeAsked=false
Response 200:
{
  "success": true,
  "data": {
    "sessionId": "...",
    "questions": [
      { "id": 0, "question": "...", "type": "deep_dive", "difficulty": "hard", "section": "projects", "asked": false }
    ],
    "totalCount": 20,
    "remainingCount": 15
  }
}
```

### 1.5 Sessions

```
GET /api/session?page=1&limit=10&state=FINISHED&sortBy=createdAt&sortOrder=desc
Response 200:
{
  "success": true,
  "data": {
    "sessions": [
      { "id": "...", "state": "FINISHED", "skills": [...], "questionsAsked": 25, "finalScore": 72, "startedAt": "...", "endedAt": "...", "duration": 18.5 }
    ],
    "pagination": { "total": 42, "page": 1, "pages": 5, "limit": 10 }
  }
}

GET /api/session/stats/summary
Response 200:
{
  "success": true,
  "data": {
    "summary": { "totalSessions": 42, "completedSessions": 35, "completionRate": 83.33, "avgScore": 68, "avgQuestionsAsked": 22 },
    "stateDistribution": [{ "state": "FINISHED", "count": 35 }],
    "topSkills": [{ "skill": "Python", "count": 30 }],
    "recentSessions": [...]
  }
}

DELETE /api/session/:sessionId
Response 200: { "success": true, "message": "Session deleted successfully" }
```

---

## 2. Client ↔ Server (WebSocket / Socket.io)

### 2.1 Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `join-session` | `{ sessionId: string, isReconnect?: boolean }` | Join interview room |
| `start-interview` | _(none)_ | Begin interview flow |
| `next-question` | _(none)_ | Request next question |
| `submit-answer` | `{ answer: string, isTranscribed?: boolean, detectedSkills?: string[] }` | Submit spoken/typed answer |
| `speech-interim` | `{ text: string }` | Live transcription broadcast |
| `get-progress` | _(none)_ | Request progress update |
| `request-hint` | _(none)_ | Request hint for current question |
| `end-interview` | _(none)_ | User-initiated early end |

### 2.2 Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `session-joined` | `{ sessionId, state, userSelectedSkills, skillsDetected, questionsAsked, currentTopic, totalAnswered, totalSkipped, averageScore, currentQuestion?, isReconnect }` | Confirmation after join |
| `interview-message` | `{ type: "intro"\|"transition", message: string, speakText: string }` | System messages (spoken by TTS) |
| `question` | `{ question: string, type?, topic?, difficulty?, expectedAnswer?, keywords?, questionId?, speakText: string, expectsIntro?, requiresSkillDetection? }` | New question |
| `answer-result` | `{ type: "recorded"\|"skipped", message: string, isSkipped: boolean, speakText: string }` | Immediate answer acknowledgement |
| `progress` | `{ state, currentTopic, totalAnswered, totalSkipped, averageScore, questionsAsked, topicsRemaining?, resumeQuestionsRemaining? }` | Progress update |
| `interview-complete` | `{ message: string, summary: object, report?: object, speakText: string }` | Interview finished |
| `hint` | `{ hint: string, speakText: string }` | Hint for current question |
| `error` | `{ message: string }` | Error notification |

---

## 3. Server → ML Service (REST)

### 3.1 Health Check

```
GET http://localhost:8000/health
Response 200:
{
  "status": "ok",
  "intent_predictor": true,
  "answer_evaluator": true
}
```

### 3.2 Answer Evaluation (called by answer.service.js)

```
POST http://localhost:8000/evaluate
Request:
{
  "user_answer": "String of the user's spoken answer",
  "expected_answer": "String of the expected correct answer",
  "keywords": ["keyword1", "keyword2"]
}
Response 200:
{
  "score": 75,        // 0-100
  "is_correct": true  // score >= threshold
}

Timeout: 2 seconds
Fallback: keyword-based scoring in Node.js if ML service unavailable
```

### 3.3 Intent Prediction

```
POST http://localhost:8000/predict-intent
Request:
{
  "text": "I know Java and Python, I've worked with React for frontend",
  "threshold": 0.5
}
Response 200:
{
  "topics": ["Java", "Python", "React"],
  "scores": { "Java": 0.92, "Python": 0.88, "React": 0.76, ... },
  "top_topics": ["Java", "Python", "React"]
}

POST http://localhost:8000/predict
Request: { "text": "...", "threshold": 0.5 }
Response 200:
{
  "predictions": [{ "topic": "Java", "score": 0.92 }, ...],
  "top_topics": ["Java", "Python", "React"]
}
```

### 3.4 Model Info

```
GET http://localhost:8000/model-info
Response 200:
{
  "intent_predictor": {
    "labels": ["Java", "Python", "JavaScript", "React", "SQL", "Machine_Learning", "Deep_Learning"],
    "device": "cpu",
    "model_type": "IntentClassifier (MLP 384->128->64->7)"
  },
  "answer_evaluator": {
    "model": "all-MiniLM-L6-v2",
    "method": "Cosine Similarity"
  }
}
```

---

## 4. Proctoring Flask API (Standalone)

| Method | Path | Response |
|--------|------|----------|
| GET | `/` | HTML dashboard |
| GET | `/status` | `{ "looking_away": bool, "looking_away_duration": float, "warnings": int, ... }` |
| GET | `/start` | `{ "message": "Proctoring started" }` |
| GET | `/stop` | `{ "message": "Proctoring stopped" }` |
| GET | `/cameras` | `{ "cameras": [0, 1, ...] }` |
| GET | `/set_camera/<n>` | `{ "message": "Camera switched to <n>", "camera": int }` |
| GET | `/video_feed` | MJPEG stream (`multipart/x-mixed-replace`) |
| GET | `/frame` | Single JPEG frame (200) or empty (204) |

**Note:** Proctoring is currently standalone with no adapter connecting it to the Express server. To integrate, an adapter in the Express server would need to forward proctoring status/start/stop to `http://localhost:5000`.

---

## 5. External Services

| Service | How Used | From |
|---------|----------|------|
| **MongoDB** (Atlas or local:27017) | Session & Question persistence | Server (Mongoose) |
| **Google Gemini API** | Resume question generation | Server (`@google/generative-ai`), uses API key rotation |
| **HuggingFace** (model download) | `all-MiniLM-L6-v2` embedding model | ML Service (sentence-transformers, auto-downloaded) |
