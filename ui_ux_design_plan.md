# SkillWise — Unified Platform UI/UX Design Plan

**Document Version:** 1.0  
**Date:** April 5, 2026  
**Author:** Product Design + System Architecture Review  
**Status:** Proposal — Awaiting Review

---

## 1. Design Vision & Product Experience

### 1.1 Core Design Philosophy

SkillWise is a **professional, trust-building interview platform** that must feel both powerful and calming. The candidate is already nervous — the UI must never add to that anxiety. Every pixel serves a purpose: either guiding the candidate through the interview flow, or transparently showing them how they are being monitored.

**Design pillars:**

| Pillar | Meaning | How We Achieve It |
|--------|---------|-------------------|
| **Clarity** | Every screen instantly tells you what to do next | Prominent CTAs, progress indicators, minimal visual clutter |
| **Trust** | The candidate knows exactly what the system is watching | Visible camera feed, real-time status badges, proctoring transparency panel |
| **Flow** | The interview feels continuous and uninterrupted | Smooth transitions between states, no jarring page reloads, ambient animations |
| **Professionalism** | The platform feels enterprise-grade | Dark theme, crisp typography, structured layouts, consistent spacing |

### 1.2 Target Visual Identity

- **Primary mode:** Dark theme (reduces eye strain during long interviews, feels premium, works better with webcam overlays)
- **Style:** Clean glassmorphism with subtle frosted-glass panels, soft shadows, and ambient gradient backgrounds
- **Mood:** "Enterprise SaaS meets modern dev tools" — think Linear.app meets Vercel's dashboard
- **Motion:** Smooth, purposeful, never gratuitous — every animation communicates a state change

---

## 2. Information Architecture

### 2.1 Overall Structure

```
SkillWise Platform
├── 🟢 Public Layer (no auth required for MVP)
│   ├── Landing Page (/)
│   └── Login / Sign Up (/auth) — future scope
│
├── 🔵 Candidate Layer
│   ├── Dashboard (/dashboard)
│   │   ├── Past Sessions List
│   │   ├── Performance Trends
│   │   └── Quick Start
│   │
│   ├── Interview Setup (/setup)
│   │   ├── Step 1: Skill Selection
│   │   ├── Step 2: Resume Upload (optional)
│   │   └── Step 3: Pre-Check (camera, mic, environment)
│   │
│   ├── Interview Room (/interview/:sessionId)
│   │   ├── Question Panel (main)
│   │   ├── Webcam Feed + Proctoring Status (side)
│   │   ├── Voice Controls (bottom)
│   │   ├── Transcript Display (bottom-left)
│   │   ├── Timer + Progress (top bar)
│   │   └── Alert Overlay (conditionally visible)
│   │
│   ├── Submission / Completion (/interview/:sessionId/complete)
│   │
│   └── Report (/report/:sessionId)
│       ├── Score Summary
│       ├── Question-by-Question Breakdown
│       ├── Proctoring Summary
│       ├── Topic-wise Analysis
│       └── Recommendations
│
└── 🟠 Admin Layer (future scope)
    ├── Admin Dashboard (/admin)
    ├── Live Monitoring (/admin/live/:sessionId)
    └── Reports Management (/admin/reports)
```

### 2.2 Navigation Model

- **Primary nav:** Minimal top bar with logo, nav links (Home, Dashboard), and user avatar
- **In-interview:** Navigation is locked — no sidebar, no header nav links, only the interview room controls
- **Why:** During an interview, all distractions must be eliminated. The candidate should have zero reason to leave the interview screen.

---

## 3. Screen-by-Screen Design

### 3.1 Landing Page (`/`)

**Purpose:** Introduce SkillWise and guide users to start an interview.

```
┌──────────────────────────────────────────────────────────────────────┐
│ HEADER BAR                                                           │
│  [SkillWise Logo]          [Dashboard]  [Login]  [Get Started →]    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│          ✨ SkillWise                                                │
│                                                                      │
│     AI-Powered Interview Practice                                    │
│     with Real-Time Proctoring                                        │
│                                                                      │
│     Practice technical interviews with adaptive AI questions,        │
│     voice interaction, and transparent proctoring—all in one place.  │
│                                                                      │
│            [ Start Interview →]   [ View Dashboard ]                 │
│                                                                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│  │ 🎤 Voice     │ │ 🧠 AI Brain  │ │ 📄 Resume    │ │ 👁 Proctor │ │
│  │ Interaction  │ │ MLP + SBERT  │ │ Personalized │ │ CNN + Pose │ │
│  │              │ │              │ │ Questions    │ │ Tracking   │ │
│  │ Answer using │ │ Semantic     │ │ Upload your  │ │ Real-time  │ │
│  │ your voice   │ │ evaluation   │ │ resume for   │ │ monitoring │ │
│  │ naturally    │ │ of answers   │ │ deep-dive Qs │ │ of focus   │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │
│                                                                      │
│  ─── How It Works ───                                                │
│  ① Select Skills  →  ② Upload Resume  →  ③ Take Interview  →  ④ Get │
│                                                                Report│
└──────────────────────────────────────────────────────────────────────┘
```

**Component placement rationale:**
- **Hero section** is center-aligned with a large headline — the user immediately knows what this product does
- **Feature cards** (4 columns on desktop, 2 on tablet, 1 on mobile) explain each capability — especially the proctoring card which builds trust by being upfront
- **CTA buttons** are placed directly below the hero text — the "Start Interview" button is primary (filled), "View Dashboard" is secondary (outlined)
- **How It Works** strip uses a horizontal stepper — establishes the mental model of the flow before the user enters it

**Visual treatment:**
- Background: subtle radial gradient from deep navy (#0a0f1a) center to near-black edges
- Feature cards: frosted glass (backdrop-filter: blur(16px), semi-transparent background)
- Hero text: white (#f1f5f9) with a subtle text-shadow for depth
- Accent: electric blue (#3b82f6) for CTAs and highlights

---

### 3.2 Interview Setup (`/setup`) — Multi-Step Flow

**Purpose:** Guide the candidate through skills → resume → system pre-check before entering the interview room.

This replaces the current `Home.jsx` with a 3-step wizard.

#### Step 1: Skill Selection

```
┌──────────────────────────────────────────────────────────────────────┐
│ ← Back to Home                    Step 1 of 3: Select Skills        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  What topics should we interview you on?                             │
│  Select one or more skills from the list below.                      │
│                                                                      │
│  ┌─────────┐  ┌─────────┐  ┌──────────────┐  ┌─────────┐          │
│  │ ☐ Java  │  │ ☑ Python│  │ ☐ JavaScript │  │ ☑ React │          │
│  └─────────┘  └─────────┘  └──────────────┘  └─────────┘          │
│  ┌─────────┐  ┌──────────────────┐  ┌──────────────────────┐       │
│  │ ☐ SQL   │  │ ☐ Machine Learning│  │ ☐ Deep Learning      │       │
│  └─────────┘  └──────────────────┘  └──────────────────────┘       │
│                                                                      │
│  Selected: Python, React (2 topics)                                  │
│                                                                      │
│  CANDIDATE DETAILS                                                   │
│  [ Candidate Name ]   [ Roll Number (Optional) ]  [ Exam ID (Opt) ]  │
│                                                                      │
│                                          [ Continue → ]              │
└──────────────────────────────────────────────────────────────────────┘
```

**Why this layout:**
- Skill chips are large touch-friendly targets (not small checkboxes) — works on mobile and desktop
- Selected count shown immediately as feedback
- Previous selections persist if user goes back

#### Step 2: Resume Upload

```
┌──────────────────────────────────────────────────────────────────────┐
│ ← Back                           Step 2 of 3: Resume (Optional)     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Upload your resume for personalized questions                       │
│  We'll analyze your projects, skills, and experience to              │
│  ask tailored questions. This is optional.                           │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                                                                │  │
│  │         📄 Drag & drop your resume here                       │  │
│  │            or click to browse                                  │  │
│  │                                                                │  │
│  │         Supported: PDF, DOCX (max 5MB)                         │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  [After upload — shows extracted summary:]                           │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ ✅ Resume processed successfully                               │  │
│  │ Skills found: Python, TensorFlow, React, Docker                │  │
│  │ Sections: 3 projects, 2 internships, 5 skills                  │  │
│  │ Questions generated: 18 personalized questions                 │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  [ ← Back ]                      [ Skip & Continue ]  [ Continue → ]│
└──────────────────────────────────────────────────────────────────────┘
```

**Why:**
- Large drop zone makes upload easy and obvious
- Success state shows what was extracted — builds confidence that "the system understood me"
- "Skip & Continue" is always available — resume is optional

#### Step 3: Pre-Check Screen (NEW — Critical Addition)

This screen is **essential** for the proctored environment. It verifies camera, microphone, lighting, and network before the interview starts.

```
┌──────────────────────────────────────────────────────────────────────┐
│ ← Back                         Step 3 of 3: System Check            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Let's make sure everything is ready.                                │
│                                                                      │
│  ┌──────────────────────────────────┐  ┌──────────────────────────┐ │
│  │                                  │  │ SYSTEM CHECKLIST         │ │
│  │     [ Live Camera Preview ]      │  │                          │ │
│  │                                  │  │ ✅ Camera detected       │ │
│  │     You should see yourself      │  │ ✅ Microphone working    │ │
│  │     in this box.                 │  │ ✅ Lighting adequate     │ │
│  │                                  │  │ ⏳ Network latency: 45ms│ │
│  │                                  │  │ ✅ Browser compatible    │ │
│  │     [SAFE] status overlay        │  │                          │ │
│  │                                  │  │ ⚠️ Close other tabs     │ │
│  └──────────────────────────────────┘  │    for best performance  │ │
│                                         └──────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ ⚙️ ADVANCED PROCTORING CONFIGURATION (Expandable)                │  │
│  │                                                                │  │
│  │ Camera: [ Default Laptop Camera ▼ ]                            │  │
│  │                                                                │  │
│  │ ☑ Dark Environment Detection    ☑ Face Detection               │  │
│  │ ☑ Gaze Tracking                 ☑ Multiple People Detection    │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 📋 PROCTORING TRANSPARENCY NOTICE                              │  │
│  │                                                                │  │
│  │ During this interview, the following will be monitored:        │  │
│  │ • Camera feed — to verify your identity and attention          │  │
│  │ • Head position — to detect if you look away from screennn    │  │
│  │ • Eye gaze — using AI to detect focus                         │  │
│  │ • Face count — to ensure you are alone                        │  │
│  │ • Environment brightness — to ensure proper visibility        │  │
│  │                                                                │  │
│  │ Violations will be logged with timestamps and snapshots.       │  │
│  │ You will receive visual and audio alerts for any violations.   │  │
│  │                                                                │  │
│  │ ☑ I understand and agree to proceed under proctored conditions │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  [ ← Back ]                              [ Begin Interview → ]      │
└──────────────────────────────────────────────────────────────────────┘
```

**Why this screen exists:**
- **Technical validation:** If camera or mic fails here, we can fix it BEFORE the interview starts, not during it
- **Trust building:** The transparency notice tells the candidate exactly what is being monitored — no surprises
- **Legal compliance:** The consent checkbox creates a clear opt-in moment
- **Proctoring warmup:** Starting the proctoring service here (calling `/start`) gives it time to initialize camera + model before the interview begins

**Visual treatment:**
- Camera preview is a live MJPEG feed from the proctoring service (`/video_feed`)
- Checklist items animate in one-by-one as checks complete (staggered fade-in)
- SAFE badge overlaid on camera preview in green; switches to yellow/red if issues detected
- "Begin Interview" button is disabled until all critical checks pass and consent is given

---

### 3.3 Interview Room (`/interview/:sessionId`) — The Core Screen

This is the most important screen. It must handle:
- Question display + voice controls (existing)
- Webcam feed + proctoring status (new)
- Alerts and violations (new)
- Timer and progress (enhanced)

#### Layout Architecture (Desktop — 1440px+)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ TOP BAR (fixed, 56px)                                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐  │
│ │ SkillWise    │ Session Timer ⏱ 14:32  │ Q 8/25  │ Avg: 72%  │ [End] │  │
│ └─────────────────────────────────────────────────────────────────────────┘  │
│ ┌─────PROGRESS BAR (topic progress, full-width, thin)────────────────────┐  │
│ │ ████████████████████░░░░░░░░░░ Resume Deep Dive (8/15)                 │  │
│ └─────────────────────────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────┬─────────────────────────────────┤
│ MAIN PANEL (70%)                           │ SIDE PANEL (30%)                │
│                                            │                                 │
│ ┌────────────────────────────────────────┐ │ ┌─────────────────────────────┐│
│ │                                        │ │ │     WEBCAM FEED             ││
│ │  QUESTION CARD                         │ │ │                             ││
│ │                                        │ │ │  ┌─────────────────────┐   ││
│ │  Topic: Python  │  Type: Deep Dive     │ │ │  │                     │   ││
│ │  Q8 of 15                              │ │ │  │   (MJPEG Stream)    │   ││
│ │                                        │ │ │  │                     │   ││
│ │  "You mentioned using Flask for your   │ │ │  │   [SAFE ✓]          │   ││
│ │   REST API. Why did you choose Flask   │ │ │  │                     │   ││
│ │   over FastAPI or Django, given that   │ │ │  └─────────────────────┘   ││
│ │   your project needed WebSocket        │ │ │                             ││
│ │   support?"                            │ │ │  Status: SAFE               ││
│ │                                        │ │ │  Duration: 14m 32s          ││
│ │                                        │ │ │  Alerts: 1                  ││
│ │                                        │ │ │  FPS: 30 | Net: Connected   ││
│ └────────────────────────────────────────┘ │ │                             ││
│                                            │ └─────────────────────────────┘│
│ ┌────────────────────────────────────────┐ │                                 │
│ │  💡 HINT (conditionally visible)       │ │ ┌─────────────────────────────┐│
│ │  Think about: async support, WSGI...   │ │ │     PROCTORING DETAILS      ││
│ └────────────────────────────────────────┘ │ │                             ││
│                                            │ │  Head Pose: ✓ Center        ││
│ ┌────────────────────────────────────────┐ │ │  Gaze: ✓ On Screen          ││
│ │  TRANSCRIPT DISPLAY                    │ │ │  Faces: 1 ✓                 ││
│ │                                        │ │ │  Lighting: Good ✓           ││
│ │  "I chose Flask because it's           │ │ │                             ││
│ │   lightweight and I wanted fine-grained│ │ │  ── Alert History ──        ││
│ │   control over the routing..."         │ │ │  14:12 — HEAD LEFT (0.9s)   ││
│ │  [Speaking... ●]                       │ │ │  14:09 — SAFE recovered     ││
│ └────────────────────────────────────────┘ │ │                             ││
│                                            │ └─────────────────────────────┘│
│ ┌────────────────────────────────────────┐ │                                 │
│ │  ANSWER RESULT (after submission)      │ │                                 │
│ │  Score: 78%  ████████░░               │ │                                 │
│ │  [Next Question →]                     │ │                                 │
│ └────────────────────────────────────────┘ │                                 │
│                                            │                                 │
│ ┌────────────────────────────────────────┐ │                                 │
│ │  VOICE CONTROLS (centered)             │ │                                 │
│ │                                        │ │                                 │
│ │     [ Skip ]  [ 🎤 TAP TO SPEAK ]     │ │                                 │
│ │               [ 💡 Hint ]              │ │                                 │
│ └────────────────────────────────────────┘ │                                 │
└────────────────────────────────────────────┴─────────────────────────────────┘
```

#### Why This Layout (Detailed Rationale)

| Element | Position | Rationale |
|---------|----------|-----------|
| **Top bar** | Fixed top, full-width | Always visible; candidate always knows elapsed time, question count, and average score without scrolling |
| **Progress bar** | Below top bar | Thin (4px) topic-progress indicator — gives a sense of "how much is left" without being distracting |
| **Question card** | Main panel, top | The most important element — placed at the top-left for natural reading order (F-pattern). Large font (18-20px) for readability while speaking |
| **Transcript display** | Main panel, below question | Shows what the system is hearing in real-time — builds confidence that "my answer is being captured". Also helps the candidate self-correct |
| **Voice controls** | Main panel, bottom center | Thumb-accessible on mobile; visually prominent so the candidate always knows how to interact |
| **Webcam feed** | Side panel, top | Small but always-visible — the candidate can see themselves, which is a critical trust element. Also lets them self-correct posture/gaze |
| **Proctoring details** | Side panel, below webcam | Shows the real-time status of each detection system — head pose, gaze, face count, lighting. Transparency reduces anxiety |
| **Alert history** | Side panel, bottom | Scrollable log of recent proctoring events — candidate can see "okay, that brief look away was noted but I recovered quickly" |

#### SAFE Status Badge (On Webcam Feed)

```
┌─────────────────────┐       ┌─────────────────────┐
│                     │       │                     │
│                     │       │                     │
│                     │       │                     │
│  ┌────────────┐     │       │  ┌────────────┐     │
│  │ ✓ SAFE     │     │       │  │ ⚠ ALERT    │     │
│  │ #10b981    │     │       │  │ #ef4444    │     │
│  └────────────┘     │       │  └────────────┘     │
└─────────────────────┘       └─────────────────────┘
  Normal state                   Alert state
  (green pill badge)             (red pill badge, pulsing)
```

**Badge behavior:**
- SAFE: Static green badge, bottom-left of webcam container
- ALERT: Red badge with subtle pulse animation (0.5s ease-in-out), reason text appears below ("Looking Away")
- Transition: Smooth color crossfade (300ms) between states

---

### 3.4 Alert Overlay (During Interview — Conditionally Visible)

When a proctoring ALERT is triggered (persists > threshold), a non-blocking overlay appears:

```
┌──────────────────────────────────────────────────────────────────────┐
│                         INTERVIEW ROOM                               │
│                      (content dims to 40% opacity)                   │
│                                                                      │
│     ┌────────────────────────────────────────────────────────────┐   │
│     │                                                            │   │
│     │    ⚠️  ATTENTION REQUIRED                                  │   │
│     │                                                            │   │
│     │    Please look at the screen.                              │   │
│     │                                                            │   │
│     │    Reason: LOOKING AWAY                                    │   │
│     │    Duration: 2.3 seconds                                   │   │
│     │                                                            │   │
│     │    This violation has been logged.                          │   │
│     │    The interview will resume when you look back.            │   │
│     │                                                            │   │
│     │    Alerts so far: 2                                        │   │
│     │                                                            │   │
│     └────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Design decisions:**
- **Non-blocking:** The alert does NOT pause the interview timer (that's an admin decision). It's a warning overlay.
- **Auto-dismiss:** When proctoring status returns to SAFE, the overlay fades out (500ms) automatically
- **Not a modal:** No close button needed — it's driven entirely by proctoring state
- **Audio buzzer:** The 🔊 winsound buzzer from the proctoring system plays simultaneously
- **Counter:** Shows total alerts so far — reminds the candidate this is being tracked

---

### 3.5 Violation / Pause States

#### Multiple Violations State (Critical)

If the candidate accumulates > N alerts (configurable, e.g., 5), the interview can auto-pause:

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│     ┌────────────────────────────────────────────────────────────┐   │
│     │                                                            │   │
│     │    🛑  INTERVIEW PAUSED                                    │   │
│     │                                                            │   │
│     │    Multiple attention violations detected.                  │   │
│     │    Total alerts: 5                                         │   │
│     │                                                            │   │
│     │    The interview has been temporarily paused.               │   │
│     │    Please ensure:                                          │   │
│     │    • You are looking at the screen                         │   │
│     │    • No one else is visible in the frame                   │   │
│     │    • Your environment is well-lit                          │   │
│     │                                                            │   │
│     │    [ Resume Interview ]     [ End Interview ]              │   │
│     │                                                            │   │
│     └────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

#### No Face Detected State

```
┌──────────────────────────────────────────────────────────────────────┐
│     ┌────────────────────────────────────────────────────────────┐   │
│     │    👤  FACE NOT DETECTED                                   │   │
│     │                                                            │   │
│     │    We cannot see you in the camera frame.                  │   │
│     │    Please adjust your position.                            │   │
│     │                                                            │   │
│     │    [ Camera feed showing no face ]                         │   │
│     │                                                            │   │
│     └────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

---

### 3.6 Submission Screen (`/interview/:sessionId/complete`)

**Purpose:** Transition screen between interview completion and report generation.

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│              ✅ Interview Complete!                                   │
│                                                                      │
│       Your interview has ended. Here's a quick summary:              │
│                                                                      │
│       ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│       │ Questions    │  │ Average      │  │ Duration     │         │
│       │    25        │  │   78%        │  │   24 min     │         │
│       └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                      │
│       ┌──────────────┐  ┌──────────────┐                            │
│       │ Proctoring   │  │ Alerts       │                            │
│       │  PASSED ✓    │  │    2         │                            │
│       └──────────────┘  └──────────────┘                            │
│                                                                      │
│       Generating your detailed report...                             │
│       ████████████████░░░░░░ 78%                                     │
│                                                                      │
│       [ View Full Report → ]  (enabled when ready)                   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Why a separate submission screen:**
- Creates a clear "interview ended" moment — psychological closure
- Allows time for report generation (combines interview + proctoring data)
- The quick summary stats use large card layout — instant gratification
- "Proctoring: PASSED ✓" is a trust element — confirms the candidate's behavior was acceptable

---

### 3.7 Results / Report Screen (`/report/:sessionId`)

**Purpose:** Comprehensive post-interview report combining interview performance + proctoring data.

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← Back to Dashboard              Interview Report                   │
│                                    April 5, 2026 · Session #abc123   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─── OVERALL SCORE ─────────────────────────────────────────────┐  │
│  │                                                                │  │
│  │     78%          A-                                            │  │
│  │   ████████░░    Grade                                          │  │
│  │                                                                │  │
│  │  Duration: 24m  Questions: 25  Skipped: 2                     │  │
│  │  Topics: Python, React, Deep Learning                         │  │
│  │  Proctoring: PASSED (2 minor alerts)                          │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─── TOPIC BREAKDOWN ───────────────────────────────────────────┐  │
│  │                                                                │  │
│  │  Python          ████████████░░░░  82%  (8 questions)         │  │
│  │  React           █████████░░░░░░░  68%  (7 questions)         │  │
│  │  Deep Learning   ██████████████░░  92%  (6 questions)         │  │
│  │  Mix Round       ████████░░░░░░░░  65%  (4 questions)         │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─── PROCTORING SUMMARY ────────────────────────────────────────┐  │
│  │                                                                │  │
│  │  Status: PASSED ✓    Total Alerts: 2    Max Severity: LOW     │  │
│  │                                                                │  │
│  │  Timeline (Activity Chart):                                    │  │
│  │  [ Interactive Chart.js graph plotting events over time ]      │  │
│  │  ──●───────────────●──────────────────────────── 24 min        │  │
│  │    ↑               ↑                                           │  │
│  │  HEAD LEFT       LOOKING AWAY                                  │  │
│  │  (0.9s, warn)    (1.2s, warn)                                 │  │
│  │                                                                │  │
│  │  Snapshots: [thumb1] [thumb2]                                  │  │
│  │  [ Download CSV Log ] [ Watch Session Video (.mp4) ]           │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─── QUESTION-BY-QUESTION ──────────────────────────────────────┐  │
│  │                                                                │  │
│  │  Q1. "Tell me about yourself..." [Intro]                      │  │
│  │       Your answer: "I have experience in..."                   │  │
│  │       Score: — (intro, no score)                               │  │
│  │                                                                │  │
│  │  Q2. "Why did you choose Flask over FastAPI?" [Python]         │  │
│  │       Your answer: "Flask is lightweight..."                   │  │
│  │       Expected: "Flask offers simplicity..."                   │  │
│  │       Score: 88% ████████████░░                                │  │
│  │       ✓ Keywords matched: Flask, lightweight, WSGI             │  │
│  │                                                                │  │
│  │  Q3. ...                                                       │  │
│  │  [Expandable accordion for each question]                      │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─── RECOMMENDATIONS ──────────────────────────────────────────┐   │
│  │                                                                │  │
│  │  Strengths:                                                    │  │
│  │  ✓ Strong conceptual understanding of Python ecosystems        │  │
│  │  ✓ Good system design thinking (scaling questions)             │  │
│  │                                                                │  │
│  │  Areas for Improvement:                                        │  │
│  │  △ React state management patterns — review useReducer         │  │
│  │  △ Mix-round speed — practice concise answers                  │  │
│  │                                                                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  [ Download Report (PDF) ]  [ Share Link ]  [ Practice Again → ]     │
└──────────────────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- **Proctoring summary** is prominently placed — it's a new differentiator
- **Timeline visualization** shows alert events on a horizontal timeline — makes the proctoring results feel objective and data-driven, not scary
- **Snapshots** are shown as small thumbnails for transparency
- **Question-by-question** uses an accordion pattern — keeps the page scannable but allows detailed expansion
- **Recommendations** section adds educational value — the candidate learns from the experience

---

### 3.8 Dashboard (`/dashboard`)

**Purpose:** View past interview sessions and track improvement over time.

```
┌──────────────────────────────────────────────────────────────────────┐
│  SkillWise Dashboard                                                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─── PERFORMANCE OVERVIEW ──────────────────────────────────────┐  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐ │  │
│  │  │ Total   │  │ Avg     │  │ Best    │  │ Proctoring     │ │  │
│  │  │ 12      │  │ 74%     │  │ 92%     │  │ 100% passed    │ │  │
│  │  │sessions │  │ score   │  │ score   │  │ (0 fails)      │ │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────────────┘ │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─── SCORE TREND ───────────────────────────────────────────────┐  │
│  │  📈 Line chart showing score progression across sessions       │  │
│  │     (X: session date, Y: score %)                              │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─── RECENT SESSIONS ──────────────────────────────────────────┐   │
│  │                                                                │  │
│  │  Date         Topics              Score   Proctor  Action     │  │
│  │  ────────────────────────────────────────────────────────────  │  │
│  │  Apr 5, 2026  Python, React        78%    PASS     [View →]   │  │
│  │  Apr 3, 2026  Java, SQL            82%    PASS     [View →]   │  │
│  │  Apr 1, 2026  Deep Learning        65%    PASS     [View →]   │  │
│  │  Mar 28       JavaScript           71%    PASS     [View →]   │  │
│  │                                                                │  │
│  │  [ Load More ]                                                 │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  [ Start New Interview → ]                                           │
└──────────────────────────────────────────────────────────────────────┘
```

**Dashboard includes proctoring data** — the "Proctor" column in sessions list and the "Proctoring: 100% passed" stat card normalize proctoring as a standard part of the experience.

---

### 3.9 Admin / Recruiter Dashboard (Future Scope)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Admin Dashboard                                        [Logout]     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  LIVE SESSIONS (2 active)                                            │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Candidate        Status     Q#    Score   Proctor   Action   │  │
│  │  John Doe         Active     Q12   76%     SAFE ✓    [Watch]  │  │
│  │  Jane Smith       Active     Q5    82%     ALERT ⚠   [Watch]  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  [ Watch ] opens a read-only view of the interview room with         │
│  the webcam feed, proctoring status, and live transcript.            │
│                                                                      │
│  Admin Watch View includes:                                          │
│  • Live Activity Chart (Chart.js timeline of candidate's focus)      │
│  • Interactive Violation Log (with "Clear Log" capability)           │
│  • Real-time Snapshot Gallery                                        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. State Management (Empty, Loading, Error, Warning, Recovery)

Every screen must handle all five states. Here are the designs:

### 4.1 Loading States

| Screen | Loading State |
|--------|---------------|
| Interview Room | Skeleton cards for question + "Connecting to interview session..." spinner |
| Webcam Feed | Grey rectangle with camera icon + "Initializing camera..." text |
| Report | Skeleton layout with shimmer animation + "Generating your report..." |
| Dashboard | Skeleton table rows with shimmer effect |
| Resume Upload | Progress bar inside drop zone + "Analyzing your resume..." |

**Visual:** All loading states use a shimmer animation (gradient sweep from left to right at 1.5s interval) on skeleton placeholders.

### 4.2 Empty States

| Screen | Empty State |
|--------|-------------|
| Dashboard (no sessions) | Illustration + "No interviews yet. Start your first practice session!" + [Start Interview CTA] |
| Report (no answers) | "This session has no recorded answers. It may have been interrupted." |
| Alert History (no alerts) | "No alerts. You've maintained excellent focus! 🎯" (positive reinforcement) |

### 4.3 Error States

| Error | UI Response |
|-------|-------------|
| Socket disconnected | Yellow banner: "Connection lost. Reconnecting..." with auto-retry (exponential backoff) |
| Proctoring service down | Orange banner on webcam panel: "Proctoring offline — interview continues, monitoring paused" |
| ML service unreachable | Inline error on answer submission: "Evaluation temporarily unavailable" — interview continues |
| Camera permission denied | Red alert in pre-check: "Camera access required for proctored interviews. Please allow access." |
| Mic permission denied | Red alert: "Microphone access required. You can still type your answers." |

### 4.4 Warning States

| Warning | UI Response |
|---------|-------------|
| Slow network | Yellow dot on top bar: "Slow connection detected" |
| Low battery (if detectable) | "Low battery — ensure your device stays powered" |
| Background noise detected | Brief toast: "High background noise detected. Move to a quieter environment." |

### 4.5 Recovery States

| Recovery | UI Response |
|----------|-------------|
| Socket reconnected | Green banner: "Connected!" → auto-fade after 3s. Session state restored from server. |
| Proctoring recovered | Webcam status flips from "OFFLINE" to "SAFE" with green pulse animation |
| Camera re-established | Pre-check item flips from ❌ to ✅ with a small celebratory checkmark animation |

---

## 5. Responsive Behavior

### 5.1 Breakpoints

| Breakpoint | Range | Layout Changes |
|------------|-------|----------------|
| **Desktop** | ≥1280px | Side-by-side layout: main panel (70%) + proctoring panel (30%) |
| **Laptop** | 1024-1279px | Same layout, slightly compressed. Proctoring panel at 35% |
| **Tablet** | 768-1023px | Stack layout: question full-width, webcam moves to a floating PiP (picture-in-picture) corner widget |
| **Mobile** | <768px | Full stack: question top, controls bottom, webcam in a collapsible drawer accessible via floating button |

### 5.2 Mobile-Specific Adaptations

- **Webcam feed:** Becomes a small floating bubble (80×80px) in the bottom-right corner, tappable to expand
- **Voice controls:** Full-width bottom sheet, large microphone button for thumb access
- **Question card:** Scrollable if text is long
- **Proctoring details:** Hidden behind a "Monitoring ✓" tap target that opens a bottom sheet

### 5.3 Tablet Layout

- The webcam feed stays visible as a PiP overlay (160×120px) in the top-right corner
- Proctoring details collapse into a single status badge on the PiP
- The main question and controls take full width

---

## 6. Animations & Micro-Interactions

### 6.1 Transition Catalog

| Trigger | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Page navigation | Fade + slide up | 300ms | ease-out |
| New question arrives | Old card slides left + fades, new card slides in from right | 400ms | spring(0.5, 0.5) |
| Answer submitted | Transcript animates up into answer-result area | 350ms | ease-in-out |
| SAFE → ALERT | Badge color crossfade + pulse begins | 300ms | ease-in |
| ALERT → SAFE | Pulse stops + badge color crossfade | 500ms | ease-out |
| Alert overlay appears | Background dims (opacity 0→0.6) + overlay slides down | 400ms | ease-out |
| Alert overlay dismisses | Reverse of above | 500ms | ease-in |
| Score reveal (report) | Counter animates from 0 to final value | 1200ms | ease-out (cubic) |
| Proctoring checklist items | Staggered fade-in, 100ms delay between each | 200ms each | ease-out |
| Microphone button press | Scale pulse (1→1.1→1) + ripple effect | 200ms | ease-in-out |
| Microphone recording | Continuous gentle pulse animation on mic icon border | 1s loop | sine |

### 6.2 Continuous Animations

- **Timer:** No animation — static text that updates every second (animations on timers are distracting)
- **MJPEG feed:** Native 30fps from the stream
- **Recording indicator:** Small red dot that pulses when mic is active
- **Progress bar:** Smooth width transition when moving to next question segment

---

## 7. Color Strategy

### 7.1 Color Palette

```
BACKGROUND
  --bg-primary:      #0a0f1a    (Deep navy, almost black — main background)
  --bg-secondary:    #111827    (Slightly lighter — card backgrounds)
  --bg-elevated:     #1e293b    (Panel backgrounds, input fields)

TEXT
  --text-primary:    #f1f5f9    (White-ish — headings, important text)
  --text-secondary:  #94a3b8    (Cool gray — body text, descriptions)
  --text-muted:      #64748b    (Dim gray — timestamps, metadata)

ACCENT (Interactive elements)
  --accent-primary:  #3b82f6    (Electric blue — primary buttons, links)
  --accent-hover:    #2563eb    (Darker blue — hover state)
  --accent-glow:     #3b82f620  (Blue with 12% opacity — button glow)

STATUS COLORS
  --safe:            #10b981    (Emerald green — SAFE status)
  --safe-bg:         #10b98120  (Green with 12% opacity — SAFE badge background)
  --alert:           #ef4444    (Red — ALERT status, critical errors)
  --alert-bg:        #ef444420  (Red with 12% opacity)
  --warning:         #f59e0b    (Amber — warnings, caution states)
  --warning-bg:      #f59e0b20
  --info:            #38bdf8    (Light blue — informational elements)

BORDERS
  --border-default:  #1e293b    (Subtle — card borders)
  --border-hover:    #334155    (Visible — hover borders)
  --border-focus:    #3b82f6    (Accent — focus rings)
```

### 7.2 Why This Palette

- **Dark theme primary:** Reduces eye strain during 20-30 minute interviews; webcam feed pops against dark background
- **Blue accent:** Professional and calming — associated with trust and intelligence (LinkedIn, Indeed, etc.)
- **Emerald SAFE:** Green universally signals "okay" — immediately reassuring to the candidate
- **Red ALERT:** Unmistakable urgency without being overwhelming (used sparingly)
- **Amber warnings:** The middle ground — "pay attention but don't panic"

---

## 8. Typography

### 8.1 Font Stack

```css
--font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono:    'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
```

**Why Inter:** Clean, highly legible at all sizes, excellent numeric characters (important for scores/timers), free, widely supported.

### 8.2 Type Scale

| Use | Size | Weight | Line Height |
|-----|------|--------|-------------|
| Page title | 32px (2rem) | 700 (bold) | 1.2 |
| Section heading | 24px (1.5rem) | 600 (semibold) | 1.3 |
| Card title | 18px (1.125rem) | 600 | 1.4 |
| Body text | 16px (1rem) | 400 (regular) | 1.6 |
| Question text | 18px (1.125rem) | 500 (medium) | 1.5 |
| Small / caption | 14px (0.875rem) | 400 | 1.5 |
| Metadata / timestamp | 12px (0.75rem) | 400 | 1.4 |
| Monospace (code, IDs) | 14px | 400 | 1.5 |

---

## 9. Spacing System

Using an 8px base grid:

```
--space-1:   4px     (tight: between icon and label)
--space-2:   8px     (compact: between related items in a group)
--space-3:   12px    (standard: input padding, small gaps)
--space-4:   16px    (comfortable: between cards in a row)
--space-5:   20px    (section: between distinct sections inside a card)
--space-6:   24px    (card padding)
--space-8:   32px    (component padding, large section gaps)
--space-10:  40px    (section padding)
--space-12:  48px    (page section gaps)
--space-16:  64px    (major page section spacing)
```

---

## 10. Component Style Direction

### 10.1 Card Components

```css
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 16px;
  padding: var(--space-6);
  transition: border-color 200ms ease;
}
.card:hover {
  border-color: var(--border-hover);
}
```

### 10.2 Button Hierarchy

| Type | Style | Use Case |
|------|-------|----------|
| Primary | Filled blue bg, white text, subtle shadow | Start Interview, Continue, Submit |
| Secondary | Transparent bg, border, accent text | Back, Skip, Cancel |
| Danger | Red bg, white text | End Interview, Delete Session |
| Ghost | No border, accent text only | Hint, minor actions |
| Icon | Circle, subtle bg | Microphone, settings toggles |

### 10.3 Status Badges

```
SAFE:    bg-emerald-500/20, text-emerald-400, border-emerald-500/30, rounded-full
ALERT:   bg-red-500/20, text-red-400, border-red-500/30, rounded-full, animate-pulse
WARNING: bg-amber-500/20, text-amber-400, border-amber-500/30, rounded-full
OFFLINE: bg-gray-500/20, text-gray-400, border-gray-500/30, rounded-full
```

---

## 11. Accessibility Considerations

| Requirement | Implementation |
|-------------|----------------|
| **Keyboard navigation** | All interactive elements are focusable with visible focus rings (2px solid blue outline) |
| **Screen readers** | ARIA labels on all controls: `aria-label="Start recording"`, `role="alert"` on proctoring alerts |
| **Color contrast** | All text meets WCAG AA contrast ratios (≥4.5:1 for body, ≥3:1 for large text) |
| **Reduced motion** | `prefers-reduced-motion: reduce` — disables all animations except essential state changes |
| **Alt text** | Webcam feed: `aria-label="Your live camera feed. Status: SAFE"` |
| **Focus trapping** | During alert overlay, focus is trapped inside the overlay |

---

## 12. Component Hierarchy (How Elements Support the Interview Experience)

```
Interview Room Component Tree
│
├─ TopBar (fixed)
│  ├─ Logo (clickable → confirm exit dialog)
│  ├─ SessionTimer (derived from session.startedAt)
│  ├─ QuestionCounter (e.g., "Q 8/25")
│  ├─ AverageScore (live, from socket 'progress' events)
│  └─ EndInterviewButton (danger, with confirm dialog)
│
├─ ProgressBar (thin, below top bar)
│  └─ TopicSegment (colored by topic, animates width)
│
├─ MainPanel (left 70%)
│  ├─ QuestionCard (AnimatePresence for transitions)
│  │  ├─ TopicBadge
│  │  ├─ TypeIndicator (Deep Dive, Mix, Resume, etc.)
│  │  └─ QuestionText
│  │
│  ├─ HintPanel (conditional, yellow bg)
│  │
│  ├─ TranscriptDisplay
│  │  ├─ FinalizedText
│  │  ├─ InterimText (lighter color, italic)
│  │  └─ ListeningIndicator (pulsing dot)
│  │
│  ├─ AnswerResult (conditional, after submission)
│  │  ├─ ScoreBar (animated fill)
│  │  └─ NextButton
│  │
│  └─ VoiceControls
│     ├─ SkipButton
│     ├─ MicrophoneButton (large, center, pulsing when active)
│     └─ HintButton
│
├─ SidePanel (right 30%) — NEW
│  ├─ WebcamFeed
│  │  ├─ MJPEGStream (from proctoring service)
│  │  └─ StatusBadge (overlay, SAFE/ALERT)
│  │
│  ├─ ProctoringDetails
│  │  ├─ HeadPoseIndicator (✓ Center / ⚠ LEFT)
│  │  ├─ GazeIndicator (✓ On Screen / ⚠ Looking Away)
│  │  ├─ FaceCountIndicator (1 ✓ / 2 ⚠)
│  │  └─ LightingIndicator (Good ✓ / Dark ⚠)
│  │
│  └─ AlertHistory (scrollable log)
│     └─ AlertEvent[] (timestamp, type, duration)
│
└─ AlertOverlay (conditional, covers MainPanel)
   ├─ WarningIcon
   ├─ ReasonText
   ├─ DurationCounter
   └─ AlertCount
```

**Hierarchy rationale:**
- The QuestionCard is the highest-priority visual element — it's what the candidate needs to answer
- VoiceControls are second — they're the primary interaction mechanism
- WebcamFeed is third — always visible but not dominant
- ProctoringDetails are fourth — informational, not interactive
- AlertOverlay is emergency-level — only appears when attention is required, and overrides everything else

---

## 13. Proctoring Transparency Elements

These are specific UI elements designed to build trust between the candidate and the proctoring system:

| Element | Location | Purpose |
|---------|----------|---------|
| **Pre-Check Consent** | Setup Step 3 | Candidate explicitly sees what will be monitored before starting |
| **Live Webcam Preview** | Side panel, interview room | "I can see what the system sees" — no hidden surveillance |
| **Detailed Status Indicators** | Side panel, below webcam | Granular view of each detection system's current reading |
| **Alert History Log** | Side panel, scrollable | All proctoring events are visible to the candidate — nothing is hidden |
| **SAFE Badge** | Webcam overlay | Constant positive reinforcement — "you're doing fine" |
| **Alert Counter** | Top bar + alert overlay | Candidate knows their current standing |
| **Proctoring Summary (Report)** | Report page | Full timeline of events with downloadable evidence — auditable and fair |
| **Snapshot Gallery (Report)** | Report page | Candidate can see exactly which frames triggered snapshots |

**Why transparency matters:**
Research shows that candidates who understand HOW they are being monitored perform better and report less anxiety than those who know they are monitored but don't know the specifics. Transparency converts "surveillance anxiety" into "system partnership."

---

*This UI/UX plan is designed to be implemented incrementally. The interview room layout is the most critical screen and should be built first, followed by the setup flow (with pre-check), then the report page enhancements, and finally the dashboard updates.*
