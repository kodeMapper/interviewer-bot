# SkillWise — Unified AI Interview & Proctoring Platform
### Enterprise-Grade Assessment Engine | MERN + FastAPI + Deep Learning

---

## Live Deployment

- Public app (Production): https://www.skillwise.live

If you only want to try the product as a visitor, open `www.skillwise.live` and start from setup.
For backend host details, use developer docs like `RUN_GUIDE.md`.

---

## Beginner Overview (Read This First)

SkillWise is an AI interview platform that does two things together:

1. It conducts a technical interview (adaptive questions + answer evaluation).
2. It runs proctoring checks (camera-based monitoring + violation logs).

### What a beginner should know

- You can run it fully on your machine with 4 services.
- You can also use the deployed production app at `www.skillwise.live`.
- The interview report is a merged result of:
  - Interview performance report (from Express backend)
  - Proctoring report (from FastAPI proctoring service)

### What happens when a candidate uses SkillWise

1. Candidate selects skills and optionally uploads resume.
2. Interview session starts and adaptive questions begin.
3. Resume-based personalized questions are generated in background.
4. Camera frames are analyzed for proctoring alerts.
5. Final report shows score, topic breakdown, and proctoring artifacts.

### Service map in simple words

- `client/` (React, port 3000): UI pages (setup, interview, report, dashboard)
- `server/` (Express, port 5001): Main API, interview state flow, report merge
- `ml-service/` (FastAPI, port 8000): Intent prediction + answer scoring APIs
- `proctoring_fastapi/` (FastAPI, port 5000): Camera monitoring and report artifacts

### Deployment behavior (important)

- Vercel frontend auto-updates when you push to GitHub.
- Hugging Face backend does not auto-pull from GitHub.
- So backend updates require push to `huggingface` remote.

---

## 🚀 Quick Start (Unified Platform)

SkillWise consists of four integrated services. Follow the [Run Guide](RUN_GUIDE.md) for detailed setup.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  Terminal 1: ML Service (8000) │ Terminal 2: Proctoring (5000) │ Terminal 3: Backend (5001) │
│  uvicorn main:app --port 8000  │ python server.py              │ npm run dev                │
└────────────────────────────────────────────┬────────────────────────────────────────────┘
                                             ▼
                                Terminal 4: Frontend (3000)
                                       npm run dev
                                             ↓
                                Open http://localhost:3000
```

| Service | Port | Technology | Purpose |
|---------|------|------------|---------|
| **Frontend** | 3000 | React + Vite | Unified UI for Candidates & Admins |
| **Backend** | 5001 | Node.js + Express | API Gateway & Interview State Machine |
| **Proctoring** | 5000 | FastAPI + OpenCV | Real-time AI Eye-Tracking & Monitoring |
| **ML Service** | 8000 | FastAPI + PyTorch | Intent Classification & Answer Evaluation |

## Current Implementation Snapshot (April 2026)

This section is the source of truth for what is running now.

- The web app uses 4 services: frontend (3000), backend (5001), proctoring (5000), and ml-service (8000).
- Resume question generation in the web app is handled in `server/src/services/resume.service.js` using Gemini.
- Proctoring is already implemented and active in production flow (not just planned).
- Frontend speech input uses browser Web Speech API. Whisper notes in this README are legacy/CLI context.
- Report page downloads now use API base URL correctly (`VITE_API_URL`) so deployed downloads work.
- Proctoring frame interval is configurable with `VITE_PROCTOR_FRAME_INTERVAL_MS` (default 500 ms = ~2 fps).
- Vercel auto-deploys from GitHub, but Hugging Face Space does not auto-sync from GitHub.

---

## 📋 Interview Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INTERVIEW FLOW (User Journey)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐    ┌─────────────────────────────────────────────────────┐   │
│  │  START   │───▶│  RESUME UPLOAD (optional PDF/DOCX)                  │   │
│  └──────────┘    └────────────────────┬────────────────────────────────┘   │
│                                       │                                     │
│                                       ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  🔄 BACKGROUND: Resume analysis + Question generation via Gemini  │    │
│  │     (Extracts skills, projects, experience → Generates 15-20 Qs)  │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                       │                                     │
│                                       ▼ (parallel)                          │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  🎤 "Tell me about yourself / What skills do you have?"           │    │
│  │     → User introduces themselves                                   │    │
│  │     → ML Model detects topics (Java, Python, React, etc.)         │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                       │                                     │
│                                       ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  📚 ADAPTIVE QUESTIONING from Local Dataset                       │    │
│  │     (5 questions per detected skill from 330-question bank)       │    │
│  │     → While waiting for resume questions to be ready              │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                       │                                     │
│                                       ▼ (resume questions ready)            │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  📝 RESUME DEEP DIVE (15-20 personalized questions)               │    │
│  │     → "Tell me about your ML project..."                          │    │
│  │     → "Why did you choose React over Vue?"                        │    │
│  │     → "What would break if your system scaled 10x?"               │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                       │                                     │
│                                       ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  🎯 MIX ROUND (5 rapid-fire questions from all topics)            │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                       │                                     │
│                                       ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  👋 SIGNOUT: "Any questions for us?" → Generate Report → END     │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SYSTEM ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                    FRONTEND (React + Vite) :3000                    │  │
│   │  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────────┐ │  │
│   │  │ Resume      │  │ Microphone   │  │ Real-time Chat Display     │ │  │
│   │  │ Upload      │  │ (Web Speech) │  │ (Socket.io)                │ │  │
│   │  └─────────────┘  └──────────────┘  └────────────────────────────┘ │  │
│   └────────────────────────────────┬────────────────────────────────────┘  │
│                                    │ WebSocket + REST                       │
│                                    ▼                                        │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                  BACKEND (Express + Socket.io) :5001                │  │
│   │  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────────┐ │  │
│   │  │ Resume      │  │ Interview    │  │ Answer Evaluation          │ │  │
│   │  │ Service     │  │ State Machine│  │ (calls ML Service)         │ │  │
│   │  │ (pdf-parse) │  │ + Question   │  │                            │ │  │
│   │  │ + Gemini    │  │ Bank (330 Q) │  │                            │ │  │
│   │  └─────────────┘  └──────────────┘  └────────────────────────────┘ │  │
│   └────────────────────────────────┬────────────────────────────────────┘  │
│                                    │ HTTP                                   │
│                                    ▼                                        │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                  ML SERVICE (FastAPI) :8000                         │  │
│   │  ┌───────────────────────────────────────────────────────────────┐ │  │
│   │  │  WRAPPER ONLY - imports from original backend/                │ │  │
│   │  │                                                               │ │  │
│   │  │  /predict-intent  → IntentPredictor (custom MLP)              │ │  │
│   │  │  /evaluate        → AnswerEvaluator (SentenceTransformer)     │ │  │
│   │  └───────────────────────────────────────────────────────────────┘ │  │
│   └────────────────────────────────┬────────────────────────────────────┘  │
│                                    │ Python imports                         │
│                                    ▼                                        │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │              ORIGINAL BACKEND (Python) - NOT MODIFIED              │  │
│   │  ┌─────────────┐  ┌──────────────────┐  ┌───────────────────────┐ │  │
│   │  │ backend/ml/ │  │ backend/core/    │  │ backend/resume/       │ │  │
│   │  │ • MLP Model │  │ • Question Bank  │  │ • Parser (optional)   │ │  │
│   │  │ • Trainer   │  │ • Answer Eval    │  │ • GPT Client          │ │  │
│   │  │ • Predictor │  │                  │  │                       │ │  │
│   │  └─────────────┘  └──────────────────┘  └───────────────────────┘ │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Points:**
- The Express `server/` handles resume parsing (Node.js pdf-parse) and question generation (Gemini API)
- The `ml-service/` is a thin FastAPI wrapper that imports the ORIGINAL Python classes from `backend/`
- The original `backend/` Python code is **NOT modified** - it's imported as-is for ML inference

---

## 1. Project Overview & Story
This project began as a standard "Voice-to-Text" bot using pre-built libraries. However, upon reviewing the **Deep Learning Course Syllabus**, we realized that simply *using* existing AI (like Whisper) does not demonstrate the required understanding of how Neural Networks actually "learn."

**The Goal:** We are transforming this application from a "Wrapper" (which just calls external tools) into a **"White Box" Deep Learning Project**. We will build, define, and train our own Neural Networks from scratch to satisfy academic requirements.

---

## 2. The Syllabus vs. The Project Plan
To ensure this project gets full marks, we have mapped every feature we plan to build directly to your course modules.

| Course Module | Required Concept | Our Implementation Plan |
| :--- | :--- | :--- |
| **Module 1** | Perceptrons, MLPs, Vectorization | **The "Interviewer Brain":** We will build a Multi-Layer Perceptron (MLP) to classify user answers into topics (e.g., "Frontend" vs "Backend"). |
| **Module 2** | Feedforward NNs, Backpropagation | **Manual Training Loop:** We will code the feedforward and backpropagation steps to train our text classifier. |
| **Module 3** | Optimization (GD, Adam, RMSProp) | **Custom Optimizers:** We will experiment with different optimizers (SGD vs Adam) to train our "Brain" model and plot the loss curves. |
| **Module 4** | Convolutional Neural Networks (CNNs) | **The "Proctoring Eye":** We will build a Custom CNN (LeNet style) to analyze webcam video and detect if the candidate is looking away (cheating). |
| **Module 6** | Regularization (Dropout, Data Augmentation) | **Anti-Overfitting:** We will apply Dropout layers to our CNN to prevent it from memorizing specific background images. |
| **Bonus** | API Integration, System Design | **Phase 2.75 Resume Upload:** Gemini-based personalized question generation from resume analysis. |

---

## 3. Project Status (White Box Evolution)

### 🟢 Phase 1: The "Brain" (Completed) ✅
We successfully built and trained a custom MLP Neural Network from scratch.
*   **Architecture:** 384-Input (Embeddings) → 128 (ReLU) → 64 (ReLU) → 7 (Sigmoid/Topic)
*   **Training:** Achieved ~100% accuracy on validation set using Adam optimizer (learning rate 0.001).
*   **Outcome:** The bot no longer "guesses"; it *understands* technical contexts (e.g., distinguishing "Java" from "JavaScript").

### 🟢 Phase 2: The "Flow" & Adaptive Logic (Completed) ✅
We optimized the system into a Zero-Latency Asynchronous Architecture with **Lagged Adaptive Priority Queue**.

#### 1. The Approach: "Lagged Adaptive Priority Queue"
*   **The Problem:** Traditional bots wait for you to finish, then think, then speak. This causes 3-4s awkward silence.
*   **Our Solution:** The bot asks Q2 *immediately* while your answer to Q1 is still being processed in the background. 
*   **The "Lag":** Adaptiveness is applied to *future* questions. If you mention "Threads" in Q1, the bot detects it and queues a Threading question for Q3 (since Q2 is already commanded).
*   **Why:** This creates a seamless, human-like flow where the conversation never stops, yet still feels responsive to your keywords.

#### 2. Advanced Control Logic
*   **Smart Skip:** Distinguishes between "I don't know" (Skip Question) and "Stop Interview" (Terminate).
*   **Topic Guardrails:** Prevents "Cross-Topic Pollution" (e.g., won't ask React questions in a Java interview even if you mention 'components').
*   **Idempotent Reporting:** Guarantees feedback generation even if the system crashes or networks fail.

#### 3. Automated Testing Suite
*   **Mock Controller:** We built a simulation framework (`tests/`) that runs full interviews without a microphone.
*   **Scenarios:** "The Ideal Candidate", "The Quitter", "The Mixed Signal".
*   **Benefit:** Allows regression testing of logic without speaking into the mic for 15 minutes.

### � Phase 2.75: Resume Upload & Personalized Questions (Completed) ✅
We introduced **Resume-Based Dynamic Question Generation** to make interviews truly personalized.

#### 1. Why This Phase?
*   **The Problem:** Previously, the bot only knew about the candidate from their verbal introduction (30-60 seconds). This limited the depth of questioning.
*   **The Solution:** Allow candidates to upload their resume (PDF/DOCX) and generate **15-20 industry-level questions** targeting their specific experiences, projects, skills, and achievements.
*   **The Outcome:** The bot now asks questions like *"Tell me about your ML project you mentioned - what challenges did you face?"* instead of generic questions.

#### 2. How It Works (Technical Flow)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        RESUME UPLOAD WORKFLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. UPLOAD          2. EXTRACT           3. PARSE            4. GENERATE   │
│  ┌─────────┐       ┌─────────────┐      ┌────────────┐      ┌────────────┐ │
│  │  Resume │ ───►  │ PyMuPDF /   │ ───► │  Section   │ ───► │  Gemini    │ │
│  │  (PDF)  │       │ python-docx │      │  Detection │      │   Prompt   │ │
│  └─────────┘       └─────────────┘      └────────────┘      └────────────┘ │
│                          │                    │                    │        │
│                          ▼                    ▼                    ▼        │
│                    "Raw Text"          ParsedResume         15-20 Q&A      │
│                                        - skills[]           - theoretical  │
│                                        - experience[]       - conceptual   │
│                                        - projects[]         - scenario     │
│                                        - internships[]      - puzzle       │
│                                        - leadership[]       - behavioral   │
│                                        - education[]        - project      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Step-by-Step:**
1. **Upload:** User provides resume path (PDF, DOCX, or TXT supported)
2. **Extract:** `ResumeExtractor` uses PyMuPDF for PDFs, python-docx for Word files
3. **Parse:** `ResumeParser` detects sections (education, experience, skills, projects, internships, leadership, achievements)
4. **Generate:** Resume service sends parsed data to Gemini (2.5 Flash) with engineered prompts to create industry-level questions

#### 3. Zero-Latency Architecture (Critical Design)

**The Challenge:** Gemini API calls can still take a few seconds. We cannot make the candidate wait.

**Our Solution: Parallel Warmup Strategy**
```
Timeline:
─────────────────────────────────────────────────────────────────────►
     │                                                              
     │  MAIN THREAD                    BACKGROUND THREAD            
     │  ────────────                   ─────────────────            
     │                                                              
  0s │  "Upload resume"                                             
     │       │                                                      
  1s │  "Introduce yourself"           Resume extraction starts     
     │       │                                                      
  5s │  Ask Warmup Q1 (local)          GPT generating questions...  
     │       │                                                      
 10s │  Ask Warmup Q2 (local)          GPT generating questions...  
     │       │                                                      
 15s │  Ask Warmup Q3 (local)          ✅ Questions ready!          
     │       │                                                      
 16s │  "I've analyzed your resume"                                 
     │       │                                                      
 17s │  Ask Resume Q1 ◄──────────────── From resume bank            
     │       │                                                      
     │      ...                                                     
```

**Result:** The candidate never experiences any delay - the bot seamlessly transitions from local questions to resume-based questions.

#### 4. What Questions Are Generated?

The Gemini prompt is engineered to cover **all resume sections** with **all question types**:

| Resume Section | Question Types Generated |
|----------------|--------------------------|
| **Skills** | Theoretical (explain concept), Conceptual (why does it work?) |
| **Projects** | Project deep-dive, Challenges faced, Tech stack choices |
| **Experience** | Behavioral (STAR method), Responsibilities, Achievements |
| **Internships** | What you learned, Contribution to team |
| **Leadership** | Scenario-based, Conflict resolution, Team management |
| **Education** | Relevant coursework, Academic projects |

**Difficulty Distribution:**
- 25% Easy (warmup, confidence builders)
- 50% Medium (core competency)
- 25% Hard (challenge questions)

#### 5. Thin Resume Handling

**The Problem:** Some resumes have minimal content (e.g., a fresher with only education and a few skills).

**Our Solution:**
- `ParsedResume.is_thin_resume()` detects if resume has `question_capacity < 8`
- If thin, the system generates fewer resume questions and relies more on local question bank
- Never forces boring/repetitive questions

#### 6. Module Structure (Code Organization)

Current web implementation uses:

```
server/src/services/resume.service.js
  - Extract text from PDF/DOCX
  - Detect skills
  - Generate resume questions with Gemini
  - Fallback question generation when API is unavailable

backend/resume/
  - Legacy Python resume modules kept for CLI/research flow
```

**Why this is useful:**
- Web app stays simple: React -> Express API -> Gemini
- Backend controls retries, key rotation, and fallback
- Old Python modules are preserved for experimentation

#### 7. How to Use

**Option 1: Command Line**
```bash
python backend/core/interview_controller.py --resume "C:\path\to\resume.pdf"
```

**Option 2: Interactive**
```bash
python backend/core/interview_controller.py
# When prompted: Enter resume path (or press ENTER to skip)
```

**Option 3: Without Resume (Original Mode)**
```bash
python backend/core/interview_controller.py
# Press ENTER when prompted to skip resume upload
```

#### 8. Expected Outcome

| Metric | Before (Phase 2) | After (Phase 2.75) |
|--------|------------------|---------------------|
| Question Personalization | Generic based on skills | Specific to resume content |
| Interview Depth | Surface-level | Deep-dive into projects/experience |
| Candidate Engagement | Moderate | High (questions about THEIR work) |
| Latency | 0s | 0s (maintained via parallel processing) |

#### 9. Configuration

For current web flow, set Gemini keys in `server/.env`.
You can use single key, comma-separated keys, or numbered keys.

```
GEMINI_API_KEY=your-key
# OR
GEMINI_API_KEYS=key1,key2,key3
# OR (for strict secret UIs)
GEMINIAPIKEY1=key1
GEMINIAPIKEY2=key2
GEMINIAPIKEY3=key3
```

**Note:** If Gemini is unavailable, the app falls back to local question generation so interview flow can continue.

### ✅ Phase 2.75 Updates: Gemini Migration & Natural Interviewing (Completed) ✅

After initial development with OpenAI GPT-4o-mini, we migrated to **Google Gemini 2.5 Flash** due to API quota exhaustion. This section documents the major enhancements made to the resume-based questioning system.

#### 1. API Migration: OpenAI → Google Gemini

| Aspect | Before (OpenAI) | After (Gemini) |
|--------|-----------------|----------------|
| Model | `gpt-4o-mini` | `models/gemini-2.5-flash` |
| SDK | `openai>=1.12.0` | `google-genai>=1.0.0` |
| Feature | Text-only prompts | **Direct PDF Upload** (Vision API) |
| Latency | 5-10s | 3-7s |
| Cost | ~$0.01/interview | Free tier available |

**Key Technical Changes:**
- Migrated from deprecated `google-generativeai` to new `google-genai` SDK
- Implemented `generate_with_file()` for direct PDF upload to Gemini Vision
- Added robust JSON repair logic for truncated/malformed API responses
- Increased timeout (60s→90s), max_tokens (4000→8192), retries (3→5)

#### 2. Natural Interviewing: Prompt Engineering Overhaul

The original prompts produced generic, robotic questions. We completely rewrote them to simulate a **senior FAANG interviewer with 15+ years of experience**.

**Forbidden Patterns (AI will NEVER ask these):**
```
❌ "Tell me about your roles and responsibilities"
❌ "Describe your experience with X"
❌ "What projects have you worked on?"
❌ Any question that could apply to ANY resume
```

**Required Patterns (AI MUST use these):**
```
✅ "Why did you choose [specific tech] over [alternative]?"
✅ "You achieved [specific metric from resume]. Walk me through how."
✅ "What would break first if [their project] scaled 10x?"
✅ "If you rebuilt [Project X] today, what would you change?"
```

**Question Distribution:**
| Type | Percentage | Purpose |
|------|------------|---------|
| Deep-dive | 40% | Explore ONE topic deeply (bugs, metrics, surprises) |
| Tradeoff | 25% | Test decision-making (Why A over B?) |
| Scaling | 20% | Systems thinking (What breaks at 100x?) |
| Retrospective | 15% | Growth mindset (What would you do differently?) |

#### 3. Mandatory Section Coverage

Every resume section gets dedicated questions if present:

| Section | Questions | Focus |
|---------|-----------|-------|
| **Work Experience** | 3-4 | Challenges faced, impact, responsibilities |
| **Internships** | 2-3 | Learning, contributions, what you'd do differently |
| **Projects** | 3-4 | Architecture, tech choices, scaling challenges |
| **Skills/Technologies** | 2-3 | Conceptual depth ("how it works under the hood") |
| **Leadership** | 1-2 | Team dynamics, conflict resolution, initiative |
| **Education** | 1-2 | Relevant coursework, thesis, foundational knowledge |

#### 4. Intelligent Post-Resume Flow

After resume questions are exhausted, the bot now intelligently continues:

```
                            Resume Questions Exhausted
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
              Questions < 15                      Questions ≥ 15
                    │                                   │
                    ▼                                   ▼
    "What else do you do? Any other         "Let me ask more questions
     technologies or projects?"              based on your skills."
                    │                                   │
          ┌────────┴────────┐                          │
          │                 │                          │
    User mentions       User says                      │
    new skills         "that's it"                     │
          │                 │                          │
          ▼                 ▼                          ▼
    DEEP_DIVE on       DEEP_DIVE on              DEEP_DIVE on
    new skills         detected skills           detected skills
    (from intro)       (from resume)             (from resume)
          │                 │                          │
          └────────┬────────┴──────────────────────────┘
                   │
                   ▼
           Local Question Bank
           (5 questions per topic)
                   │
                   ▼
            Rapid Fire Round
            (5 mixed questions)
                   │
                   ▼
           Final Checkout + Report
```

**Key Behavior Changes:**
- The interview **NEVER ends prematurely** after resume questions
- Even if user says "that's it", bot continues with local question bank
- Skills detected from resume AND introduction are used for local questions
- Adaptive counter-questioning maintained throughout (keyword detection)

#### 5. Question Flow Preservation

**Problem:** The priority queue was scrambling Gemini's carefully ordered questions.

**Solution:** Questions now preserve generation order:
```python
# OLD: Auto-sorted by difficulty (destroyed flow)
priority = difficulty_score + type_score + random_factor

# NEW: Preserves Gemini's natural chain
priority = generation_order * 10  # Q1→Q2→Q3 relationship maintained
```

This ensures that follow-up questions stay connected:
- Q1: "Tell me about Project X's architecture"
- Q2: "Why did you choose Redis for caching?" ← References Q1's answer
- Q3: "What if Redis went down? How did you handle that?" ← Builds on Q2

### 🟢 Phase 3: The "Eye" - Proctoring System (Completed) ✅
The proctoring system is now implemented and integrated.

**How it works now:**
1.  **Realtime camera checks:** Frontend captures frames and sends them to proctoring API.
2.  **Detection engine:** Proctoring service evaluates gaze/head direction, face presence, and suspicious states.
3.  **Alert telemetry:** Alerts are counted and included in the final combined report.
4.  **Artifacts:** CSV/video/package downloads are available through backend proxy routes.
5.  **Stability layer:** Camera fallback and recovery logic handles fullscreen and device-level drops.

---

## 4. Technical Challenges & Solutions

| Challenge | Impact | Our "Deep" Solution |
| :--- | :--- | :--- |
| **Accents & Noise** | Standard models failed to transcribe Indian English accents correctly. | **Model Selection:** We benchmarked `base.en` vs `medium`. We found `medium` (multilingual) had better robustness for accents than the specialized English model. |
| **Latency (Lag)** | Waiting for transcription + analysis made the bot feel robotic (3-4s delay). | **Async Architecture:** We decoupled the "Listening" loop from the "Processing" loop. The bot asks Q2 *while* Q1 is still being graded in the background. Latency dropped to **0s**. |
| **Context Loss** | Simple bots don't know if you are talking about "Java" or "JavaScript". | **Custom MLP:** We trained our own neural network (`IntentClassifier`) on a synthetic dataset to classify technical context with 99% accuracy. |
| **Resume API Latency** | Gemini calls can take a few seconds, causing awkward silence. | **Parallel Warmup:** We ask local questions while Gemini generates resume questions in the background. Zero perceived latency. |
| **Thin Resumes** | Freshers have minimal content, forcing boring/repetitive questions. | **Adaptive Fallback:** `is_thin_resume()` detects low-content resumes and falls back to local question bank gracefully. |
| **Process Collision** | Resume processing + Adaptive questioning + Async transcription could conflict. | **Thread-Safe Design:** Mutex locks, priority queues, and event signaling ensure processes don't interfere. |
| **Generic Questions** | AI-generated questions were robotic and boring. | **Prompt Overhaul:** Complete rewrite of system prompts with "FAANG Interviewer" persona, forbidden patterns, and natural flow requirements. |
| **Missing Resume Sections** | Questions only covered projects, ignored internships/leadership/education. | **Mandatory Coverage:** Explicit prompt instructions to cover ALL 6 sections with specific question counts per section. |
| **Interview Ends Early** | After resume questions, bot said "that's covered" and stopped. | **Continuous Flow:** Bot now continues with local question bank based on detected skills, never ends prematurely. |
| **Question Order Scrambled** | Priority queue destroyed Gemini's natural question flow. | **Order Preservation:** Questions now maintain generation order instead of sorting by difficulty. |

---

## 5. App Workflow (User Journey)

### Standard Mode (Without Resume)
1.  **Setup:** User selects skills, enters identity fields, and completes system pre-check.
2.  **Session Start:** Frontend calls `POST /api/interview/start` and opens socket session.
3.  **Interview Loop:** Bot asks questions, user answers via mic (Web Speech API), backend evaluates answers.
4.  **Adaptive Flow:** Questions continue by skill/topic state machine (`INTRO -> DEEP_DIVE -> MIX_ROUND`).
5.  **Final Report:** Backend generates interview report, and frontend shows merged report (interview + proctoring).

### Resume Mode (With Resume Upload) - Phase 2.75
1.  **Resume Upload:** User uploads PDF/DOCX from setup flow.
2.  **Backend Parse:** Express service extracts text and detects resume sections/skills.
3.  **Question Generation:** Gemini generates resume-specific interview questions.
4.  **Warmup + Transition:** Local questions are used while resume questions are getting ready.
5.  **Resume Deep Dive:** Bot asks targeted project, experience, and skill questions.
6.  **Fallback Safety:** If Gemini fails, interview continues with local question bank.
7.  **Final Output:** Combined report still gets generated and shown on report page.

---

## 6. Syllabus Defense: "Are we doing Real Deep Learning?"

**YES.** Here is the distinction between "Using AI" and "Building AI," and how we satisfy the syllabus:

### A. What we USED (Pre-trained)
*   **Why:** Some tasks (Speech Recognition, Language Embeddings) require Google-scale compute to train. It is scientifically impossible to train a Whisper-level model on a laptop.
*   **Tools:** Browser Web Speech API (web flow), SentenceTransformers, Gemini 2.5 Flash (resume question generation). Whisper remains in legacy/CLI paths.
*   **Academic Value:** Integration, System Design, Latency Optimization, API Engineering.

### B. What we BUILT (Custom Training) - *This is the Syllabus Part*
*   **Phase 1 (The Brain - Done):**
    *   **Task:** Text Classification (INTENT).
    *   **Work:** We designed a PyTorch MLP (`Linear` -> `ReLU` -> `Linear`). We wrote the training loop, loss function (`BCEWithLogitsLoss`), and created the dataset. **This covers Modules 1, 2, & 3.**
*   **Phase 3 (The Eye - Done):**
    *   **Task:** Computer Vision (PROCTORING).
  *   **Work:** We built and integrated the proctoring pipeline with Eye-CNN based checks, realtime frame analysis, and report artifact generation. **This covers Module 4.**

**Conclusion:** We use pre-trained models for the "Senses" (Ears/Mouth) but we build custom Neural Networks for the "Cognition" (Brain/Eye), ensuring strictly original Deep Learning work where it counts.

---

## 7. Conclusion
By implementing the **Proctoring pipeline**, the **Adaptive MLP**, and the **Resume-Based Question Generation**, this project transforms from a simple script into a robust demonstration of **Deep Learning fundamentals** combined with **modern AI integration**. It moves beyond simply "detecting text" to actually "understanding context" (via MLP), "seeing the world" (via proctoring CNN logic), and "personalizing interviews" (via Gemini), matching the syllabus while staying practical.

---

## 8. Dependencies (requirements.txt)

```
# Root Python dependencies (CLI interviewer + shared backend modules)
# Install: pip install -r requirements.txt

# Core numerical + ML stack
numpy>=1.26,<2.0
torch>=2.2,<3
sentence-transformers>=3.0,<6
scikit-learn>=1.4,<2

# Speech + audio (CLI interviewer)
sounddevice>=0.4,<1
faster-whisper>=1.1,<2
pywin32>=306; platform_system == "Windows"

# Resume parsing + LLM integration
python-dotenv>=1.0,<2
PyMuPDF>=1.24,<2
python-docx>=1.1,<2
google-genai>=1.0,<2
google-generativeai>=0.8,<1

# Optional OCR fallback for scanned PDFs
pdf2image>=1.17,<2
pytesseract>=0.3,<1

# Optional utilities
matplotlib>=3.8,<4
```

---

## 9. Environment Variables (.env)

```env
# server/.env
PORT=5001
NODE_ENV=development
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/<db>
CLIENT_URL=http://localhost:3000
ML_SERVICE_URL=http://127.0.0.1:8000
PROCTOR_URL=http://127.0.0.1:5000
SESSION_SECRET=change-this-in-production

# Gemini (any one format is fine)
GEMINI_API_KEY=your-key
# OR
GEMINI_API_KEYS=key1,key2,key3
# OR numbered
GEMINIAPIKEY1=key1
GEMINIAPIKEY2=key2
GEMINIAPIKEY3=key3
# OR numbered with underscores
# GEMINI_API_KEY_1=key1
# GEMINI_API_KEY_2=key2
# GEMINI_API_KEY_3=key3

# client/.env
VITE_API_URL=http://localhost:5001/api
VITE_PROCTOR_FRAME_INTERVAL_MS=500
```

For Hugging Face Spaces, secret names without underscores are also supported (example: `CLIENTURL`, `MONGODBURI`, `GEMINIAPIKEY1`).

---

## 10. Quick Start

### Option A: MERN Web Application (Recommended)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Terminal 1: ML Service       │  Terminal 2: Proctoring │  Terminal 3: Backend │
│  cd ml-service                │  cd proctoring_fastapi  │  cd server           │
│  .\venv\Scripts\activate      │  .\venv\Scripts\activate │  npm install         │
│  uvicorn main:app --port 8000 │  python server.py       │  npm run dev         │
└────────────────────────────────────────────┬──────────────────────────────────┘
               ▼
           Terminal 4: Frontend (UI)
             cd client
             npm install
             npm run dev
```

Open http://localhost:3000 in your browser.

| Component | Technology | Port |
|-----------|------------|------|
| **Frontend** | React + Vite + Web Speech API | 3000 |
| **Backend** | Express.js + Socket.io + MongoDB | 5001 |
| **Proctoring** | FastAPI + OpenCV | 5000 |
| **ML Service** | FastAPI (wraps original `backend/`) | 8000 |

> **Important:** The deep learning models (`IntentClassifier`, `AnswerEvaluator`) are **NOT reimplemented**. The FastAPI service simply imports and exposes them as HTTP endpoints.

### Option A.1: Deployment Sync Note (Vercel + Hugging Face)

- Vercel frontend updates when you push to GitHub branch.
- Hugging Face Space backend updates only when you push to the `huggingface` remote.
- Restarting Space does not pull new GitHub code by itself.

Typical sync command:

```bash
git push huggingface integration-version:main
```

### Option B: Original Python CLI (Backend Only)

```bash
# 1. Activate virtual environment
cd "C:\Users\acer\Desktop\DL Project"
.\venv\Scripts\Activate.ps1

# 2. Install dependencies (if not done)
pip install -r requirements.txt

# 3. Run the interviewer
python backend/core/interview_controller.py --resume "path/to/resume.pdf"
```

---

## 11. Skills & Topics

### A. ML Model Trained Topics (7 Fixed)
The custom MLP classifier in `backend/ml/` is trained to detect these 7 topics from user speech:

| Topic | Example Keywords |
|-------|------------------|
| Java | Spring Boot, JVM, Maven, Hibernate |
| Python | Django, Flask, Pandas, NumPy |
| JavaScript | Node.js, Express, npm, TypeScript |
| React | Hooks, Redux, Next.js, JSX |
| SQL | MySQL, PostgreSQL, Oracle, queries |
| Machine Learning | scikit-learn, regression, classification |
| Deep Learning | PyTorch, TensorFlow, CNN, RNN |

These are used for **adaptive questioning** from the local 330-question bank.

### B. Resume-Based Dynamic Skills (Unlimited)
When a resume is uploaded, the system extracts **ANY skill** mentioned and generates personalized questions:

- Technologies from projects (Docker, Kubernetes, AWS, etc.)
- Frameworks from experience (Angular, Vue, Flask, etc.)
- Domain knowledge (Finance, Healthcare, E-commerce)
- Soft skills from leadership sections

**The flow blends both sources:**
1. While resume questions are being generated in background → Ask from local bank
2. Once ready → Switch to personalized resume questions
3. After resume questions → Continue with detected skills from local bank

---

## 12. Known Issues & Planned Fixes

> 📋 For detailed implementation plans, see [PROBLEMS_SOLUTION_PLAN.md](PROBLEMS_SOLUTION_PLAN.md)

| Issue | Status | Description |
|-------|--------|-------------|
| **Intro Message Cutoff** | 🔴 Open | The intro message sometimes gets interrupted by the first question due to TTS-to-question timing issues |
| **Resume Question Validation** | 🔴 Open | Gemini sometimes returns question types not in MongoDB enum (e.g., `achievements`, `education`) causing validation errors |
| **Speech Recognition Accuracy** | 🟡 Known | Web Speech API accuracy varies by browser/network; Chrome recommended |
| **Audio Interrupt Handling** | 🟡 Known | Loud noises can interfere with TTS/STT flow |
| **Evaluation Precision** | 🟡 Planned | Current cosine similarity may need keyword weighting for technical questions |

### Temporary Workarounds

1. **Intro Cutoff**: Wait for the intro message to finish before the first question loads
2. **Resume Validation**: If questions fail validation, fallback questions are automatically used
3. **Speech Accuracy**: Use Chrome browser; speak clearly with minimal background noise

---

## 13. Directory Structure

```
project-root/
├── backend/                    # Original Python ML/CLI modules
├── client/                     # React + Vite frontend (port 3000)
├── server/                     # Express + Socket.io backend (port 5001)
├── ml-service/                 # FastAPI wrapper for intent/evaluate (port 8000)
├── proctoring_fastapi/         # FastAPI proctoring service (port 5000)
├── docs/                       # Technical docs, migration history, API guides
├── design/                     # UI/UX text plans and screen drafts
├── scripts/                    # Utility scripts (smoke checks, helpers)
├── tests/                      # Interview flow simulation tests
├── README.md                   # Project overview (this file)
├── RUN_GUIDE.md                # Local run + deployment sync guide
└── requirements.txt            # Root Python dependencies
```

---

## 🎨 V2 UI Design System (Stitch MCP)

The frontend uses a custom **"Ethereal/Immersive"** design system generated via [Stitch MCP](https://stitch.google.com/), featuring:

| Token | Description |
|-------|-------------|
| `.glass-panel` | Frosted glass containers with backdrop blur and violet glow |
| `.glass-card` | Interactive cards with hover lift and cyan border transitions |
| `.glow-active` | Active state glow with cyan/violet gradient |
| `.portal-glow` | Deep purple box-shadow for portal-style elements |
| `.scan-line` | Animated cyan scan line for proctoring HUD |

**Fonts:** Manrope (headlines), Inter (body), Space Grotesk (labels/monospace)  
**Colors:** M3 dark theme — `#a68cff` (primary), `#00daf3` (secondary), `#0e0e0e` (background)

### Navigation Map
```
Landing (/)
  ├─ "Start Assessment" → /setup
  ├─ "Launch Dashboard" → /:username/dashboard
  ├─ "Assess" nav → /setup
  └─ "Admin" nav → /admin

Setup (/setup)  
  ├─ Step 1 (Skills + Identity) → Step 2
  ├─ Step 2 (Resume Upload) → Step 3
  └─ Step 3 (System PreCheck) → /interview/:sessionId

Interview (/interview/:sessionId)
  └─ "Terminate" → /interview/:sessionId/complete

Complete (/interview/:sessionId/complete)
  └─ "View Report" → /report/:sessionId

Report (/report/:sessionId)
  ├─ "Dashboard" → /:username/dashboard
  └─ "Practice Again" → /setup

Dashboard (/:username/dashboard)
  ├─ "View Report" → /report/:sessionId
  └─ "Start Interview" → /setup

Admin (/admin)
  └─ "Extract Report" → /report/:sessionId
```

### Future Scope
See [`docs/deployment_needs_and_futureScope.md`](docs/deployment_needs_and_futureScope.md) for unimplemented features including Authentication/RBAC, Talent Pool, Insights analytics, and deployment infrastructure.

