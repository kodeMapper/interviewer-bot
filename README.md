# AI Smart Interviewer & Proctoring System
### A Syllabus-Compliant Deep Learning Implementation

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
| **Bonus** | API Integration, System Design | **Phase 2.75 Resume Upload:** GPT-4o integration for personalized question generation from resume analysis. |

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
│  │  Resume │ ───►  │ PyMuPDF /   │ ───► │  Section   │ ───► │   GPT-4o   │ │
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
4. **Generate:** `QuestionGenerator` sends parsed data to GPT-4o-mini with engineered prompts to create industry-level questions

#### 3. Zero-Latency Architecture (Critical Design)

**The Challenge:** GPT API calls take 5-15 seconds. We cannot make the candidate wait.

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

The GPT prompt is engineered to cover **all resume sections** with **all question types**:

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

```
backend/resume/
├── __init__.py              # Module exports
├── extractor.py             # PDF/DOCX/TXT text extraction
├── parser.py                # Section detection & parsing
├── gpt_client.py            # OpenAI API wrapper with retry logic
├── question_generator.py    # Prompt engineering & question generation
└── resume_question_bank.py  # Thread-safe priority queue for questions
```

**Why Modular?**
- Each component can be tested independently
- Easy to swap GPT provider (e.g., Claude, Gemini) by changing only `gpt_client.py`
- Resume processing doesn't interfere with existing interview logic

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

The system uses your existing `.env` file:
```
GPT_API_KEY=sk-proj-xxxxx...
```

**Cost Estimate:** ~$0.01-0.02 per interview (using GPT-4o-mini / Gemini 2.5 Flash)

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

### 🔴 Phase 3: The "Eye" - Proctoring System (Planned) 🚧
This is the next major step. We will build a **Convolutional Neural Network (CNN)** to detect if the candidate is cheating.

**How it will work (The Logic):**
1.  **Data Collection:** We will write a script to capture 200 images of your face:
    *   100 images: "Looking at Screen" (Good)
    *   100 images: "Looking Away / Phone" (Bad)
2.  **The Brain (CNN):** We will design a customized LeNet-5 architecture.
    *   **Convolution Layer:** Scans the image to find "Edges" (eyes, nose boundaries).
    *   **Pooling Layer:** Reduces the image size (keeping only important features).
    *   **Fully Connected Layer:** Decides "Cheating" vs "Safe".
3.  **Real-Time Integration:**
    *   The camera will run in a transparent background window.
    *   If you look away for > 3 seconds, the bot will pause and say: *"Warning: Please look at the screen."*

---

## 4. Technical Challenges & Solutions

| Challenge | Impact | Our "Deep" Solution |
| :--- | :--- | :--- |
| **Accents & Noise** | Standard models failed to transcribe Indian English accents correctly. | **Model Selection:** We benchmarked `base.en` vs `medium`. We found `medium` (multilingual) had better robustness for accents than the specialized English model. |
| **Latency (Lag)** | Waiting for transcription + analysis made the bot feel robotic (3-4s delay). | **Async Architecture:** We decoupled the "Listening" loop from the "Processing" loop. The bot asks Q2 *while* Q1 is still being graded in the background. Latency dropped to **0s**. |
| **Context Loss** | Simple bots don't know if you are talking about "Java" or "JavaScript". | **Custom MLP:** We trained our own neural network (`IntentClassifier`) on a synthetic dataset to classify technical context with 99% accuracy. |
| **Resume API Latency** | GPT calls take 5-15 seconds, causing awkward silence. | **Parallel Warmup:** We ask local questions while GPT generates resume questions in the background. Zero perceived latency. |
| **Thin Resumes** | Freshers have minimal content, forcing boring/repetitive questions. | **Adaptive Fallback:** `is_thin_resume()` detects low-content resumes and falls back to local question bank gracefully. |
| **Process Collision** | Resume processing + Adaptive questioning + Async transcription could conflict. | **Thread-Safe Design:** Mutex locks, priority queues, and event signaling ensure processes don't interfere. |
| **Generic Questions** | AI-generated questions were robotic and boring. | **Prompt Overhaul:** Complete rewrite of system prompts with "FAANG Interviewer" persona, forbidden patterns, and natural flow requirements. |
| **Missing Resume Sections** | Questions only covered projects, ignored internships/leadership/education. | **Mandatory Coverage:** Explicit prompt instructions to cover ALL 6 sections with specific question counts per section. |
| **Interview Ends Early** | After resume questions, bot said "that's covered" and stopped. | **Continuous Flow:** Bot now continues with local question bank based on detected skills, never ends prematurely. |
| **Question Order Scrambled** | Priority queue destroyed Gemini's natural question flow. | **Order Preservation:** Questions now maintain generation order instead of sorting by difficulty. |

---

## 5. App Workflow (User Journey)

### Standard Mode (Without Resume)
1.  **Initialization:** The system loads the 1.5GB Whisper model and our custom PyTorch MLP.
2.  **The "Handshake":** User introduces themselves. The **MLP Brain** analyzes the speech to detect skills (e.g., `['Python', 'Deep Learning']`).
3.  **The Strategy:** The Controller builds a dynamic interview path: *Introduction -> Python Deep Dive -> DL Deep Dive -> Mix Round*.
4.  **The Loop (Deep Dive):**
    *   **Ask:** Bot asks a scenario-based question.
    *   **Listen & Queue:** Bot records answer and *immediately* queues it for background processing.
    *   **Next:** Bot asks the next question instantly.
5.  **The Verdict:** Once finished, the bot generates a text report with scores and verbally explains the mistakes.

### Resume Mode (With Resume Upload) - Phase 2.75
1.  **Initialization:** Same as above, plus resume module components.
2.  **Resume Upload:** User provides path to resume file (PDF/DOCX/TXT).
3.  **Parallel Processing Begins:**
    *   **Main Thread:** Asks for introduction, detects skills via MLP.
    *   **Background Thread:** Extracts text → Parses sections → Calls GPT → Generates 15-20 questions.
4.  **Warmup Phase:** Bot asks 2-3 local questions while resume processing completes.
5.  **Resume Deep Dive:** Bot transitions to asking resume-based questions:
    *   Questions about specific projects
    *   Questions about work experience
    *   Skill-specific theoretical questions
    *   Behavioral questions about leadership/internships
6.  **Adaptive Questioning:** Even during resume questions, the bot adapts based on keywords detected in answers.
7.  **The Verdict:** Enhanced report showing:
    *   Resume summary
    *   Score breakdown (Resume Questions vs General Questions)
    *   Verbal feedback on weak areas

---

## 6. Syllabus Defense: "Are we doing Real Deep Learning?"

**YES.** Here is the distinction between "Using AI" and "Building AI," and how we satisfy the syllabus:

### A. What we USED (Pre-trained)
*   **Why:** Some tasks (Speech Recognition, Language Embeddings) require Google-scale compute to train. It is scientifically impossible to train a Whisper-level model on a laptop.
*   **Tools:** OpenAI Whisper, SentenceTransformers, GPT-4o-mini (for resume question generation).
*   **Academic Value:** Integration, System Design, Latency Optimization, API Engineering.

### B. What we BUILT (Custom Training) - *This is the Syllabus Part*
*   **Phase 1 (The Brain - Done):**
    *   **Task:** Text Classification (INTENT).
    *   **Work:** We designed a PyTorch MLP (`Linear` -> `ReLU` -> `Linear`). We wrote the training loop, loss function (`BCEWithLogitsLoss`), and created the dataset. **This covers Modules 1, 2, & 3.**
*   **Phase 3 (The Eye - Upcoming):**
    *   **Task:** Computer Vision (PROCTORING).
    *   **Work:** We will build a CNN (`Conv2d` -> `MaxPool` -> `Dropout`). We will collect our own dataset of *your* face. We will train it to detect "Cheating" vs "Focused". **This covers Module 4.**

**Conclusion:** We use pre-trained models for the "Senses" (Ears/Mouth) but we build custom Neural Networks for the "Cognition" (Brain/Eye), ensuring strictly original Deep Learning work where it counts.

---

## 7. Conclusion
By implementing the **Proctoring CNN**, the **Adaptive MLP**, and the **Resume-Based Question Generation**, this project transforms from a simple script into a robust demonstration of **Deep Learning fundamentals** combined with **modern AI integration**. It moves beyond simply "detecting text" to actually "understanding context" (via MLP), "seeing the world" (via CNN), and "personalizing interviews" (via GPT), perfectly matching the modules in your syllabus while adding real-world practicality.

---

## 8. Dependencies (requirements.txt)

```
# Core ML / Deep Learning
torch>=2.2.2
numpy>=1.26.4
sentence-transformers>=2.6.0

# Audio Processing
sounddevice>=0.5.0
openai-whisper>=20231117

# Phase 2.75: Resume Upload
PyMuPDF>=1.23.0          # PDF extraction
python-docx>=0.8.11      # DOCX parsing
google-genai>=1.0.0      # Gemini API (replaced openai)
python-dotenv>=1.0.0     # Environment variables

# Windows TTS
pywin32>=306
```

---

## 9. Environment Variables (.env)

```env
# Google Gemini API (Phase 2.75)
GEMINI_API_KEY=your-gemini-api-key-here

# Legacy OpenAI (optional, for fallback)
GPT_API_KEY=sk-proj-xxxxx...
```

---

## 10. Quick Start

```bash
# 1. Activate virtual environment
cd "C:\Users\acer\Desktop\DL Project"
.\venv\Scripts\Activate.ps1

# 2. Install dependencies (if not done)
pip install -r requirements.txt

# 3. Run the interviewer
# Without resume:
python backend/core/interview_controller.py

# With resume:
python backend/core/interview_controller.py --resume "path/to/resume.pdf"
```
