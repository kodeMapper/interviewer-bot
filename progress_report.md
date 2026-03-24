# 📋 Project Progress Report
## SkillWise — AI Smart Interview & Proctoring Platform

**Course:** Deep Learning  
**Date:** March 2026

---

## 1. Problem Statement & Objectives

### 1.1 The Problem

Current interview processes have some big issues:

- **For candidates:** Interviews are stressful and the feedback they get is generic ("you didn't pass") with no clear explanation of where they went wrong.
- **For interviewers:** Asking the same questions again and again is tiring. There's no smart way to know which topic to dig deeper into.
- **For online exams:** There's no reliable way to tell if someone is cheating (looking at another screen, reading from notes, or having someone else nearby).

Most existing solutions either use basic keyword matching (which fails if you answer correctly but use different words) or are fully "black box" API calls (just calling GPT — no understanding of how the AI actually works).

### 1.2 Our Objectives

Build **SkillWise**, a comprehensive AI-powered platform that provides a **personalized dashboard** (with login/logout capabilities) where users can track their conversational improvement over time, and take proctored interviews directly on the same page. Specifically, the system will:

1. **Understand what the candidate knows** — Using a custom-trained MLP neural network, detect which technical topics (Java, Python, React, etc.) a candidate mentions during their introduction.
2. **Evaluates answers by meaning, not keywords** — Using Sentence Transformer embeddings and cosine similarity, score whether a candidate's answer is semantically correct (even if they use completely different words than the expected answer).
3. **Asks smart follow-up questions** — Based on the detected topics, dynamically pick the right questions from a question bank and even generate resume-specific questions using Gemini.
4. **Detects cheating in real-time** — Using a CNN trained from scratch for eye-gaze detection, MediaPipe for head pose tracking and for detecting multiple people in the frame.
5. **Be a "White Box" project** — We build and train our own neural networks. We understand every layer, every loss function, every optimizer. This is NOT a wrapper around someone else's API.

---

## 2. Related Work & References

### 2.1 Industry Bots We Studied

We did a deep study of how real-world enterprise interview platforms work (see our `industry_analysis.md`). Here is what we found:

| Platform / Concept | What They Do | How We Compare |
|---|---|---|
| **Mettl / HireVue** | Use LLMs (GPT-4) + Video + Audio analysis simultaneously (multimodal) | We focus on Audio + Text + Webcam. Our approach is "White Box" — we understand the DL math. |
| **Deep Knowledge Tracing (DKT)** | Use LSTMs/RNNs to model a candidate's knowledge state over time | This is our future scope. Currently we use a simpler priority-queue approach. |
| **Adaptive Question Selection (RL)** | Industry treats "what question to ask next" as a Reinforcement Learning problem (DQN) | Our question routing uses a deterministic priority queue based on MLP topic predictions. |
| **SBERT + Vector DBs** | All questions are embedded; follow-ups are chosen via vector similarity search | We use the same SBERT model (`all-MiniLM-L6-v2`) for answer evaluation via cosine similarity. |
| **Anthropic's Interview Pipeline** | Planning → Interview → Analysis (multi-stage pipeline) | Our flow mirrors this: Intro → Deep Dive → Mix-Round → Feedback Report. |

### 2.2 Academic References

1. **Goodfellow, Bengio & Courville** — *Deep Learning* (MIT Press, 2016). Foundational textbook covering MLPs, backpropagation, CNNs, regularization.
2. **Kingma & Ba** — *Adam: A Method for Stochastic Optimization* (ICLR, 2014). The optimizer we chose after comparing it with SGD.
3. **Rumelhart, Hinton & Williams** — *Learning representations by back-propagating errors* (Nature, 1986). The backpropagation algorithm implemented in our training loop.
4. **Reimers & Gurevych** — *Sentence-BERT* (EMNLP, 2019). Basis for the embedding model we use for answer evaluation.

### 2.3 Pre-trained Models Used (as Backbones)

| Model | Purpose | Why Pre-trained? |
|---|---|---|
| **all-MiniLM-L6-v2** | Convert text → 384-dim embedding vectors | Training a language model from scratch requires Google-scale compute. Academic practice accepts using these as backbones. |
| **OpenAI Whisper (medium)** | Speech-to-Text (Audio → Transcript) | Same reason. We use the multilingual `medium` variant for robustness with Indian accents. |
| **MediaPipe** | Detect people in webcam frames | Object detection backbone. We only use the person-class predictions from it. |

---

## 3. Dataset Details & Initial Analysis

### 3.1 Intent Classification Dataset

**File:** `backend/ml/data/interview_intents.json`

This is a **custom-created** dataset (not downloaded from the internet). We built it specifically for our multi-label intent classification task.

| Property | Detail |
|---|---|
| **Total Samples** | 282 text samples |
| **Labels** | 7 topics: Java, Python, JavaScript, React, SQL, Machine_Learning, Deep_Learning |
| **Type** | Multi-label (one text can have multiple labels) |
| **Format** | JSON array of `{text, labels}` objects |
| **Split** | 70% Train (197) / 15% Val (42) / 15% Test (43) |

**Per-Topic Distribution:**

| Topic | Samples | Example Text |
|---|---|---|
| Java | 50 | "java inheritance polymorphism encapsulation abstraction" |
| Python | 50 | "pandas numpy basics" |
| Deep_Learning | 42 | "neural networks layers" |
| Machine_Learning | 40 | "linear regression classification" |
| JavaScript | 35 | "javascript async await promises" |
| SQL | 35 | "select join where clause" |
| React | 30 | "react functional components hooks" |

**Multi-label Examples:**
- "python used for deep learning training" → `[Python, Deep_Learning]`
- "java backend sql react frontend" → `[Java, SQL, React]`

### 3.2 Eye-Gaze CNN Dataset

**Custom-collected** using a webcam capture script (`capture_dataset.py` / `collect_images.py`).

| Property | Detail |
|---|---|
| **Format** | 64×64 grayscale images |
| **Classes** | 2: `good` (looking at screen) and `bad` (looking away) |
| **Source** | Webcam frames, manually labeled into `good/` and `bad/` folders |
| **Training Strategy** | 2-stage: Pretrain on external dataset → Fine-tune on own captured data |

### 3.3 Initial EDA Observations

- The intent dataset is **reasonably balanced** (30–50 samples per class). No single class dominates.
- Multi-label overlap is realistic: phrases like "python flask api with sql database" naturally belong to both Python and SQL.
- The 384-dimensional embeddings from MiniLM produce well-separated clusters for distinct topics (verified by the high F1 scores during training).
- Eye-gaze images show clear visual differences between "looking at screen" and "looking away" when converted to grayscale 64×64.

---

## 4. Methodology / System Architecture

### 4.1 High-Level Architecture

```
                        USER (Candidate)
                             │
                ┌────────────┼────────────┐
                │            │            │
                ▼            ▼            ▼
           🎤 Voice     📸 Webcam    📄 Resume
                │            │            │
                ▼            │            ▼
          ┌──────────┐       │      ┌──────────────┐
          │ Whisper   │       │      │ Gemini API   │
          │ (STT)     │       │      │ (Q Generator)│
          └─────┬─────┘      │      └──────┬───────┘
                │             │             │
                ▼             │             ▼
        ┌───────────────┐    │    ┌───────────────────┐
        │ Sentence      │    │    │ Question Bank      │
        │ Transformer   │    │    │ (Dynamic Queue)    │
        │ (Text→384d    │    │    └───────────────────┘
        │  Vector)      │    │
        └───┬───────┬───┘    │
            │       │        │
            ▼       ▼        ▼
     ┌──────────┐ ┌──────┐ ┌──────────────────┐
     │ MLP      │ │Cosine│ │ Proctoring       │
     │ Intent   │ │ Sim  │ │ System           │
     │ Classif. │ │(Eval)│ │ (CNN+MediaPipe)  │
     │ (PyTorch)│ │      │ │                  │
     └──────────┘ └──────┘ └──────────────────┘
         │            │            │
     Topics      Score(%)     SAFE/ALERT
```

### 4.2 Deep Learning Component 1: Intent Classifier (MLP)

This is our **custom-built** neural network using PyTorch.

**What it does:** Given a candidate's introduction ("I know Java and React"), it detects which technical topics they mentioned.

**Architecture:**

| Layer | Shape | Activation | Regularization |
|---|---|---|---|
| Input | 384 neurons | — | — |
| Hidden 1 | 128 neurons | ReLU | Dropout (0.3) |
| Hidden 2 | 64 neurons | ReLU | Dropout (0.3) |
| Output | 7 neurons | Sigmoid | — |

- **Total Parameters:** 55,623 trainable parameters
- **Loss Function:** BCEWithLogitsLoss (Binary Cross-Entropy with built-in sigmoid for numerical stability)
- **Optimizer:** Adam (lr=0.001, weight_decay=1e-4) — selected after comparing with SGD
- **Training:** 100 max epochs with early stopping (patience=15)
- **Learning Rate Scheduler:** ReduceLROnPlateau (halves LR after 5 epochs of no improvement)

**Results:**

| Metric | Score |
|---|---|
| Exact Match Accuracy | ~93% |
| Precision | ~94.5% |
| Recall | ~92.3% |
| F1 Score | ~93.4% |

### 4.3 Deep Learning Component 2: Eye-Gaze CNN (LeNet-style)

This is our **custom-built CNN** for the proctoring system.

**What it does:** Given a 64×64 grayscale image of a face, it classifies whether the person is looking at the screen or looking away.

**Architecture:**

| Layer | Details | Output Shape |
|---|---|---|
| Conv2D | 1→6 channels, kernel=5 | 60×60×6 |
| AvgPool2D | kernel=2, stride=2 | 30×30×6 |
| Conv2D | 6→16 channels, kernel=5 | 26×26×16 |
| AvgPool2D | kernel=2, stride=2 | 13×13×16 |
| Flatten | — | 2704 |
| FC1 | 2704→120, ReLU, Dropout(0.3) | 120 |
| FC2 | 120→84, ReLU | 84 |
| FC3 | 84→2 (Softmax) | 2 |

- **Training Strategy:** 2-stage transfer learning
  1. **Stage 1 (Pretraining):** Train on external dataset (15 epochs, Adam, lr=0.001)
  2. **Stage 2 (Fine-tuning):** Fine-tune on our own webcam-captured dataset
- **Loss:** CrossEntropyLoss
- **Confidence Threshold:** 90% — predictions below this are treated as "looking at screen" (safe default)

### 4.4 Deep Learning Component 3: Answer Evaluator (Cosine Similarity)

**What it does:** Compares a candidate's answer with the expected answer using vector similarity, not keyword matching.

**How it works:**
1. Both the user's answer and the expected answer are converted to 384-dim vectors using Sentence Transformers.
2. Cosine similarity is computed between the two vectors.
3. The similarity score (0–100%) represents how close the meaning is.

**Why this is better than keyword matching:** If the expected answer is "OOP uses classes and objects" and the candidate says "It uses blueprints and instances to model real-world things", keyword matching fails (no exact word match), but cosine similarity gives a high score because the *meaning* is similar.

### 4.5 Proctoring Pipeline

The proctoring system runs in a background thread and performs real-time analysis:

1. **Dark Environment Detection** — Checks average brightness of each frame. Alert if < 45.
2. **Face Detection** — Uses MediaPipe FaceMesh (with Haar Cascade fallback). Alert if no face detected for > 0.9 seconds.
3. **Multiple People Detection** — If more than 1 face is detected, alert after 0.9 seconds.
4. **Head Pose Tracking** — Uses MediaPipe facial landmarks (nose, eye positions) to calculate head orientation. Alerts for HEAD LEFT/RIGHT/UP/DOWN with smoothing buffer.
5. **Eye-Gaze CNN** — Crops the face from the frame, converts to 64×64 grayscale, feeds to our CNN. If "looking away" is predicted 3+ times in a 5-frame buffer, triggers ALERT.
6. **Buzzer** — Plays an audible alert when a violation is detected.
7. **Snapshot + Video Recording** — Captures evidence snapshots and records the entire session as MP4.
8. **Report Generation** — Creates JSON + CSV reports with timestamped violation events.

---

## 5. Progress Made So Far

### 5.1 Interviewer Bot (Complete ✅)

| Component | Status | Details |
|---|---|---|
| MLP Intent Classifier | ✅ Done | Custom PyTorch MLP, trained and evaluated (F1: ~93%) |
| Answer Evaluator | ✅ Done | Cosine similarity using SentenceTransformers |
| Whisper Integration | ✅ Done | Async zero-latency transcription (medium model) |
| Question Generation | ✅ Done | Gemini-powered resume-based question generation |
| Interview Controller | ✅ Done | Full interview flow: Intro → Deep Dive → Mix-Round → Feedback |
| ML Service API | ✅ Done | FastAPI microservice exposing intent prediction and evaluation endpoints |
| Swagger Documentation | ✅ Done | OpenAPI docs for ML service (`/docs`) |

**Technical Highlights:**
- **Async Zero-Latency:** Separated transcription into a background thread. While the bot asks the next question, the previous answer is being transcribed and graded simultaneously. Gap between questions reduced from 6+ seconds to exactly 2 seconds.
- **Optimizer Comparison:** Trained the MLP with both Adam and SGD. Adam converged ~2× faster and achieved higher F1 (~0.95 vs ~0.90 for SGD).
- **Robust JSON Parsing:** Implemented regex-based JSON extraction and type-mapping layer to handle Gemini's inconsistent output formatting.

### 5.2 Proctoring System (Complete ✅)

| Component | Status | Details |
|---|---|---|
| Eye-Gaze CNN | ✅ Done | LeNet-style CNN, 2-stage training (pretrain + fine-tune) |
| Head Pose Detection | ✅ Done | MediaPipe landmarks with smoothing buffer |
| Face Detection | ✅ Done | MediaPipe FaceMesh with Haar Cascade fallback |
| Dark Environment Detection | ✅ Done | Brightness thresholding |
| Multiple People Detection | ✅ Done | MediaPipe multi-face + person detector |
| Buzzer Alert | ✅ Done | Audio alert via winsound |
| Session Recording | ✅ Done | MP4 video + JPEG snapshots of violations |
| Report Generation | ✅ Done | JSON + CSV reports with timestamps and statistics |
| FastAPI Server | ✅ Done | Full REST API with Swagger docs |
| MJPEG Live Stream | ✅ Done | Real-time video feed endpoint (`/video_feed`) |

### 5.3 Backend Infrastructure

| Component | Status | Details |
|---|---|---|
| ML Microservice | ✅ Done | FastAPI server wrapping original Python ML code |
| API Documentation Hub | ✅ Done | Unified docs portal linking all 3 services |
| CORS Configuration | ✅ Done | All services support cross-origin requests |

---

## 6. Next Steps & Timeline

| Phase | Task | Target |
|---|---|---|
| **Phase 1** | Build the unified SkillWise frontend (Vite + React) | Week 1 |
| **Phase 2** | Create Swagger documentation for all APIs | Week 1–2 |
| **Phase 3** | Integrate Interviewer Bot into the frontend | Week 2 |
| **Phase 4** | Integrate Proctoring System into the frontend | Week 2–3 |
| **Phase 5** | End-to-end testing & polish | Week 3 |
| **Phase 6** | Dockerize all services & deployment setup | Week 3–4 |
| **Phase 7** | Final documentation & submission | Week 4 |

### Detailed Plan:

1. **Frontend Creation (Vite + React)**
   - Build a clean, modern UI that connects to all three backend services.
   - Pages: Landing Page, Login/Signup, Dashboard (improvement tracking), Interview Setup, Live Interview (with webcam + chat), Proctoring overlay, Report Viewing.

2. **Swagger Documentation**
   - Finalize OpenAPI specs for all 3 SkillWise services: Proctoring System (port 5000), Interviewer Bot (port 5001), ML Service (port 8000).
   - The unified SkillWise API Docs Hub is already live at `/api-docs` on the Proctoring System.

3. **Integration of Interviewer Bot + Proctoring in a Single Frontend**
   - Run the interview and proctoring simultaneously. While the candidate answers questions, the Proctoring System monitors their webcam in real-time.
   - Display the live webcam feed (via MJPEG stream) alongside the interview interface.
   - Show proctoring status (SAFE/ALERT) in real-time on the UI.
   - At the end, combine both the interview feedback report and the proctoring report into a single comprehensive result.

4. **Deployment Plan**

   **a. Containerization (Docker)**
   - Create a `Dockerfile` for each of the 3 services:
     - `proctoring_fastapi/` → Python FastAPI container (with OpenCV, PyTorch, MediaPipe)
     - `server/` → Node.js Express container (with MongoDB connection)
     - `ml-service/` → Python FastAPI container (with PyTorch, SentenceTransformers)
   - Write a `docker-compose.yml` to orchestrate all services together along with MongoDB.
   - This makes the entire SkillWise platform one-command deployable: `docker-compose up`.

   **b. Cloud Hosting**
   - **Option 1 (Budget):** Deploy on a single VPS (DigitalOcean / AWS EC2) using Docker Compose.
   - **Option 2 (Scalable):** Deploy each service as a separate container on AWS ECS / Google Cloud Run.
   - The Vite frontend can be deployed as static files on Vercel / Netlify for fast global CDN delivery.
   - MongoDB can use MongoDB Atlas (free tier) for managed database hosting.

   **c. CI/CD Pipeline**
   - Set up GitHub Actions to auto-build Docker images on push to `main`.
   - Run automated tests (intent classifier accuracy, API smoke tests) before deployment.
   - Auto-deploy to staging on successful builds.

   **d. Production Readiness Checklist**
   - Environment variable management for API keys (Gemini, MongoDB).
   - HTTPS/TLS termination via reverse proxy (Nginx / Caddy).
   - Rate limiting on public API endpoints.
   - Logging and monitoring (structured JSON logs, health-check endpoints already exist).
   - CORS configuration locked down to the production frontend domain.

---

## 7. Syllabus Coverage Summary

| DL Module | Topic | Where We Cover It |
|---|---|---|
| **Module 1** | Perceptrons, MLPs, Vectorization | MLP Intent Classifier (384→128→64→7), Sentence Transformer embeddings |
| **Module 2** | Feedforward NNs, Backpropagation | Training loop: forward pass, `loss.backward()`, `optimizer.step()` |
| **Module 3** | Optimization (SGD, Adam, RMSProp) | Optimizer comparison (Adam vs SGD), LR Scheduling |
| **Module 4** | CNNs | Eye-Gaze CNN (LeNet-style, Conv2D + AvgPool + FC layers) |
| **Module 5** | Autoencoders | Sentence embeddings as implicit encoding (text → 384-dim latent space) |
| **Module 6** | Regularization | Dropout (0.3), L2/Weight Decay (1e-4), Early Stopping (patience=15) |

---

*Document Version: 1.0 | Last Updated: March 2026*
