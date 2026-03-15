# Why MERN? Migration Rationale & New Concepts Explained
## AI Smart Interviewer - Technology Decision Document

**Document Version:** 1.0  
**Created:** January 31, 2026  
**Purpose:** Explain WHY we are migrating and WHAT new technologies do

---

## 📋 Table of Contents

1. [The Big Picture: Why Migrate?](#1-the-big-picture-why-migrate)
2. [Current System vs MERN System](#2-current-system-vs-mern-system)
3. [New Concepts Explained Simply](#3-new-concepts-explained-simply)
4. [Advantages of Migration](#4-advantages-of-migration)
5. [Disadvantages & Trade-offs](#5-disadvantages--trade-offs)
6. [Real Scenarios: Before vs After](#6-real-scenarios-before-vs-after)
7. [Who Benefits?](#7-who-benefits)
8. [Final Verdict](#8-final-verdict)

---

## 1. The Big Picture: Why Migrate?

### The Problem with Current System

Imagine you built an amazing robot that can interview people. But there's a catch:

| Current Limitation | Real-World Problem |
|-------------------|-------------------|
| **Runs only on YOUR laptop** | Your friend in Mumbai can't use it. Your professor can't test it from their office. |
| **Requires Python installed** | Non-technical users can't run `python interview_controller.py` |
| **Uses Windows-only features** | Mac/Linux users are excluded. pywin32 TTS doesn't work on other OS. |
| **No user interface** | Black terminal window scares normal users |
| **Single user at a time** | Only ONE person can interview at once |

### The MERN Solution

Think of MERN like opening a **restaurant** instead of cooking at home:

```
BEFORE (Python Script):
┌─────────────────────────────────────────┐
│  Your Laptop                            │
│  ┌─────────────────────────────────┐    │
│  │  Python Script                  │    │
│  │  - Microphone ✓                 │    │
│  │  - Speaker ✓                    │    │
│  │  - Screen ✓                     │    │
│  │  - ML Model ✓                   │    │
│  │  - Everything runs HERE         │    │
│  └─────────────────────────────────┘    │
│                                         │
│  👤 Only YOU can use it                 │
└─────────────────────────────────────────┘

AFTER (MERN Web App):
┌─────────────────────────────────────────┐
│  Cloud Server (Always Online)           │
│  ┌─────────────────────────────────┐    │
│  │  Node.js + MongoDB              │    │
│  │  - ML Model ✓                   │    │
│  │  - Question Bank ✓              │    │
│  │  - User Sessions ✓              │    │
│  └─────────────────────────────────┘    │
└──────────────────┬──────────────────────┘
                   │ Internet
    ┌──────────────┼──────────────┐
    │              │              │
    ▼              ▼              ▼
┌───────┐    ┌───────┐    ┌───────┐
│ User1 │    │ User2 │    │ User3 │
│ Delhi │    │ Mumbai│    │ USA   │
│ Phone │    │ Laptop│    │ iPad  │
└───────┘    └───────┘    └───────┘

👤👤👤 ANYONE with a browser can use it!
```

---

## 2. Current System vs MERN System

### Quick Comparison Table

| Aspect | Current (Python) | MERN (Web App) |
|--------|-----------------|----------------|
| **Access** | Only your computer | Any device with browser |
| **Installation** | Python + 15 packages | Nothing (just open URL) |
| **Operating System** | Windows only | Any (Windows, Mac, Linux, Mobile) |
| **Users at once** | 1 | Unlimited |
| **User Interface** | Black terminal | Beautiful React UI |
| **Data Storage** | Lost when program closes | Saved forever in MongoDB |
| **Sharing** | "Copy my code" | "Visit interviewer.com" |
| **Updates** | Everyone re-downloads | Update server once, everyone gets it |

### Architecture Comparison

```
CURRENT ARCHITECTURE:
────────────────────────────────────────────────────
                 YOUR LAPTOP
┌────────────────────────────────────────────────┐
│                                                │
│   User → Microphone → Python Script → Speaker  │
│              │              │                  │
│              │         ┌────┴────┐             │
│              │         │ Whisper │             │
│              │         │ PyTorch │             │
│              │         │ Gemini  │             │
│              │         └─────────┘             │
│              │                                 │
│        Everything happens in ONE place         │
└────────────────────────────────────────────────┘


MERN ARCHITECTURE:
────────────────────────────────────────────────────
   USER'S DEVICE              CLOUD SERVER
┌──────────────────┐      ┌────────────────────┐
│  React Frontend  │      │  Express Backend   │
│                  │      │                    │
│ - Microphone 🎤  │ ───► │ - Business Logic   │
│ - Speaker 🔊     │      │ - ML Models        │
│ - Beautiful UI   │ ◄─── │ - MongoDB          │
│ - Web Speech API │      │ - Gemini API       │
│                  │      │                    │
│  Runs in BROWSER │      │  Runs 24/7 ONLINE  │
└──────────────────┘      └────────────────────┘
        │                          │
        └──────── WebSocket ───────┘
              (Live Connection)
```

---

## 3. New Concepts Explained Simply

### 🌐 3.1 Web Server (Express.js)

**What is it?**
A Web Server is like a **waiter in a restaurant**. Customers (browsers) ask for things, and the waiter brings them.

**Simple Analogy:**
```
Restaurant                    Web App
──────────────────────────────────────────
Customer walks in        →    User opens website
Customer asks for menu   →    Browser requests homepage
Waiter brings menu       →    Server sends HTML/CSS/JS
Customer orders food     →    User clicks "Start Interview"
Chef cooks food          →    Server processes request
Waiter serves food       →    Server sends response
```

**Why do we need it?**
- Your Python script is like cooking at home. Only people in your house can eat.
- A Web Server is like opening a restaurant. Anyone can come in.

**In Our App:**
```javascript
// User asks: "Give me a Java question"
// Server (waiter) responds:

app.get('/api/questions/Java', (req, res) => {
    const question = getRandomJavaQuestion();
    res.json({ question: question });  // "Here's your order!"
});
```

---

### 🔌 3.2 WebSocket (Socket.io)

**What is it?**
Normal web requests are like **sending letters**. WebSocket is like a **phone call**.

**The Problem with Letters (HTTP):**
```
Letter Approach (Normal HTTP):
──────────────────────────────────────────
You:     "Is my food ready?" 📬
Server:  "No" 📬
(5 seconds later)
You:     "Is my food ready?" 📬
Server:  "No" 📬
(5 seconds later)
You:     "Is my food ready?" 📬
Server:  "Yes! Here it is" 📬

Problem: You have to keep asking! (This is called "Polling")
```

**The Phone Call Approach (WebSocket):**
```
Phone Call Approach (WebSocket):
──────────────────────────────────────────
You:     📞 *picks up phone, stays connected*
Server:  📞 "I'll call you when food is ready"
         ... you wait, doing other things ...
Server:  📞 "RING! Your food is ready!"

Benefit: Server can reach YOU whenever it wants!
```

**In Our App - Why This Matters:**

| Scenario | Without WebSocket | With WebSocket |
|----------|------------------|----------------|
| Resume processing done | User keeps clicking "Check Status" | Server instantly says "Resume ready!" |
| User says "Stop Interview" | Wait for next question cycle | IMMEDIATELY stops everything |
| Next question ready | User clicks "Next" button | Question appears automatically |
| Background evaluation done | Nothing happens until refresh | Score pops up in real-time |

**Real Code Example:**
```javascript
// SERVER: Pushing a question to user (without them asking!)
io.to(userId).emit('new_question', {
    question: "What is polymorphism?",
    topic: "Java"
});

// CLIENT: Receiving it instantly
socket.on('new_question', (data) => {
    speak(data.question);  // Bot speaks immediately!
    showOnScreen(data.question);
});
```

---

### 🗄️ 3.3 MongoDB (Database)

**What is it?**
A database is like a **filing cabinet** that never forgets.

**Current Problem:**
```
Current Python Script:
──────────────────────────────────────────
1. You run the interview
2. Questions, answers, scores are in RAM (temporary memory)
3. You close the program
4. 💨 POOF! Everything is gone forever.

"What was that candidate's score yesterday?"
"I don't know, I closed the terminal."
```

**With MongoDB:**
```
MERN with MongoDB:
──────────────────────────────────────────
1. User completes interview
2. Everything saved to database:
   - Session ID: abc123
   - Candidate: "Rahul Sharma"
   - Score: 78/100
   - Answers: [...]
   - Date: Jan 31, 2026
   
3. Server restarts, power goes off, doesn't matter
4. Data is SAFE FOREVER

"Show me all candidates who scored above 80"
"Sure! Here are 47 candidates..."
```

**Real Code Example:**
```javascript
// Saving an interview session
const session = new Session({
    candidateName: "Rahul Sharma",
    score: 78,
    answers: [...],
    date: new Date()
});
await session.save();  // Saved forever!

// Finding it later (even years later)
const topCandidates = await Session.find({ score: { $gte: 80 } });
```

---

### 🔊 3.4 Web Speech API (Browser TTS)

**What is it?**
Your browser can **speak text out loud** without any server or installation.

**The Problem:**
```
Current: Windows SAPI (pywin32)
──────────────────────────────────────────
1. Python script runs on YOUR computer
2. Python tells Windows: "Speak this text"
3. Windows plays audio on YOUR speakers
4. ✅ Works!

But wait...

MERN: Server runs on CLOUD
──────────────────────────────────────────
1. Node.js runs on AWS/Google Cloud server
2. Node.js tells... which Windows? 🤔
3. Server's speakers play audio... in a data center... 🔇
4. ❌ User hears NOTHING!

The server is in California. The user is in Delhi.
Sound doesn't travel through the internet!
```

**The Solution - Web Speech API:**
```
MERN with Web Speech API:
──────────────────────────────────────────
1. Server sends TEXT to browser: "What is Java?"
2. Browser's Web Speech API converts text to audio
3. Audio plays on USER'S speakers
4. ✅ User hears it!

The BROWSER does the speaking, not the server!
```

**Real Code Example:**
```javascript
// In React (Browser)
function speak(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-IN';  // Indian English accent
    utterance.rate = 1.0;
    speechSynthesis.speak(utterance);  // 🔊 Plays on user's device!
}

// When server sends a question
socket.on('new_question', (data) => {
    speak(data.question);  // Browser speaks it!
});
```

---

### ⚛️ 3.5 React (Frontend Framework)

**What is it?**
React is a way to build **interactive user interfaces** easily.

**Current Problem:**
```
Current: Terminal Interface
──────────────────────────────────────────
C:\> python interview_controller.py

🤖 BOT: What is polymorphism?
🎤 LISTENING... (Press ENTER to stop)
   [Recording] Press ENTER when done >>>

Problems:
- Scary for non-technical users
- No visual feedback
- Can't show progress bars, scores, etc.
- Looks like hacking to normal people 😅
```

**With React:**
```
MERN: Beautiful Web Interface
──────────────────────────────────────────
┌─────────────────────────────────────────────────────┐
│  🎯 AI Smart Interviewer                            │
├─────────────────────────────────────────────────────┤
│                                                     │
│   Topic: Java                    Score: 72/100     │
│   ████████████░░░░ Question 4 of 10                │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │                                             │   │
│  │   🤖 "What is the difference between       │   │
│  │       ArrayList and LinkedList?"            │   │
│  │                                             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│         🎤 Recording...  ⏱️ 00:23                   │
│                                                     │
│   [ 🛑 Stop Recording ]    [ ⏭️ Skip Question ]    │
│                                                     │
│  ─────────────────────────────────────────────────  │
│  📜 Transcript:                                    │
│  Q1: What is OOP? ✅ 85/100                        │
│  Q2: Explain inheritance ✅ 70/100                 │
│  Q3: What is JVM? ⏭️ Skipped                       │
│                                                     │
└─────────────────────────────────────────────────────┘

Benefits:
- Visual progress
- Click buttons instead of typing commands
- Real-time score updates
- Works on phone/tablet too!
```

---

### 🐍➡️📦 3.6 Python Microservice

**What is it?**
We keep the ML models (PyTorch) in a small Python server that Node.js talks to.

**Why not convert everything to JavaScript?**
```
The Problem:
──────────────────────────────────────────
Your ML Model:
- IntentClassifier (PyTorch)
- SentenceTransformer (Python library)
- Trained weights (intent_model.pth)

These are written in Python.
There's NO equivalent in JavaScript that gives same accuracy.

Converting = Risk of accuracy drop
Keeping Python = Guaranteed same results
```

**The Solution - Microservice:**
```
Microservice Architecture:
──────────────────────────────────────────

Node.js Backend               Python ML Service
┌────────────────┐           ┌────────────────┐
│                │           │                │
│  "Hey Python,  │  ──────►  │  IntentClassifier
│   what topic   │           │  SentenceTransformer
│   is this?"    │           │                │
│                │  ◄──────  │  "It's Java,   │
│                │           │   85% sure"    │
└────────────────┘           └────────────────┘

Node.js handles: Web requests, WebSocket, MongoDB
Python handles: ML inference (the brainy stuff)

Best of both worlds!
```

**Real Code Example:**
```python
# Python FastAPI (ml-service)
@app.post("/predict")
async def predict(request: PredictRequest):
    # Uses the exact same IntentClassifier you already trained!
    predictions = predictor.predict_with_scores(request.text)
    return {"predictions": predictions}
```

```javascript
// Node.js calling Python
const response = await axios.post('http://ml-service:8000/predict', {
    text: "I work with React hooks"
});
console.log(response.data);  // { predictions: [{ topic: "React", score: 0.92 }] }
```

---

## 4. Advantages of Migration

### ✅ 4.1 Accessibility

| Advantage | Example |
|-----------|---------|
| **Use from anywhere** | Student in hostel, professor at home, recruiter in office - all can access same interview |
| **No installation** | Just share a link: `https://interviewer.yoursite.com` |
| **Any device** | Laptop, phone, tablet, smart TV with browser |
| **Any OS** | Windows, Mac, Linux, Android, iOS - all work |

### ✅ 4.2 Scalability

```
Current: 1 user at a time
──────────────────────────────────────────
python interview_controller.py
# Microphone is BUSY
# Nobody else can run it

MERN: Unlimited users
──────────────────────────────────────────
User1: Interview in progress (Java)
User2: Interview in progress (Python)
User3: Uploading resume
User4: Viewing report
User5: Just started
...
User500: Interview in progress

All at the same time! Server handles everything.
```

### ✅ 4.3 Data Persistence

| Data | Before | After |
|------|--------|-------|
| Interview history | Gone when you close terminal | Saved forever in MongoDB |
| Candidate scores | Lost | Searchable, filterable, exportable |
| Analytics | None | "Show avg score for Java topic last month" |
| Resume questions | Generated once, lost | Cached, reusable |

### ✅ 4.4 User Experience

```
Before: Technical user required
──────────────────────────────────────────
1. Install Python 3.10
2. pip install -r requirements.txt
3. Download Whisper model (2GB)
4. Set GEMINI_API_KEY in .env
5. Run: python backend/core/interview_controller.py --resume C:\path\resume.pdf
6. Speak into microphone
7. Press ENTER when done

After: Anyone can use it
──────────────────────────────────────────
1. Open browser
2. Go to website
3. Click "Start Interview"
4. Done!
```

### ✅ 4.5 Maintainability

| Aspect | Before | After |
|--------|--------|-------|
| Bug fix | Everyone re-downloads code | Update server once, everyone gets fix |
| New questions | Edit JSON, redistribute | Admin panel to add questions |
| Model update | Re-share .pth file | Update ML service, instant for all |

### ✅ 4.6 Collaboration

```
Before: Single developer workflow
──────────────────────────────────────────
"Here's my code, clone it and run"
Everyone has different versions

After: Team workflow
──────────────────────────────────────────
Frontend team: Works on React UI
Backend team: Works on Express API
ML team: Works on Python service
All deploy to same server!
```

---

## 5. Disadvantages & Trade-offs

### ❌ 5.1 Complexity

```
Before: 1 codebase
──────────────────────────────────────────
interviewer-bot/
└── backend/
    └── Everything in Python

After: 3+ codebases
──────────────────────────────────────────
interviewer-bot/
├── client/        (React - JavaScript)
├── server/        (Express - JavaScript)
└── ml-service/    (FastAPI - Python)

More code to maintain!
```

### ❌ 5.2 Learning Curve

| New Technology | What to Learn |
|---------------|---------------|
| React | Components, Hooks, State management |
| Express | Routes, Middleware, REST API design |
| MongoDB | Schemas, Queries, Indexing |
| Socket.io | Events, Rooms, Broadcasting |
| Docker | Containers, Compose, Networking |

**Time investment:** 2-4 weeks to learn stack properly

### ❌ 5.3 Hosting Costs

```
Before: FREE
──────────────────────────────────────────
Runs on your laptop = No cost

After: Server costs
──────────────────────────────────────────
Option 1: Free tier (limited)
- Render.com free tier
- MongoDB Atlas free tier
- Works for small projects

Option 2: Production hosting
- VPS: $5-20/month
- MongoDB Atlas: $0-50/month
- Domain: $10/year

Total: ~$20/month for serious use
```

### ❌ 5.4 Internet Dependency

| Before | After |
|--------|-------|
| Works offline (except Gemini calls) | Requires internet always |
| No latency | Network latency added |
| No server downtime risk | Server can go down |

### ❌ 5.5 Audio Quality Trade-off

```
Before: Whisper (Highly Accurate)
──────────────────────────────────────────
- OpenAI Whisper running locally
- Excellent accuracy
- Handles accents well
- But: Slow (5-10 sec per transcription)

After: Options vary
──────────────────────────────────────────
Option A: Web Speech API (Browser)
- Fast
- Free
- But: Less accurate, browser-dependent

Option B: Whisper on server (Keep Python)
- Same accuracy as before
- But: Need to stream audio, adds latency

Option C: Cloud STT (Google/OpenAI)
- Fast + Accurate
- But: Costs money ($0.006/15 seconds)
```

### ❌ 5.6 Windows TTS Quality Loss

```
Before: Windows SAPI
──────────────────────────────────────────
- "Ravi" or "Heera" Indian voices
- Consistent quality
- Works offline

After: Web Speech API
──────────────────────────────────────────
- Depends on browser/OS
- Chrome on Windows: Good (uses Windows voices)
- Chrome on Mac: Different voices
- Firefox: Limited voice options
- Mobile: Varies by device

Solution: Use premium TTS API for production
(Google Cloud TTS, ElevenLabs)
```

---

## 6. Real Scenarios: Before vs After

### Scenario 1: College Placement Cell

**Before:**
```
Placement Officer: "We want to use your interview bot for 200 students"
You: "Sure! Everyone needs to:
      1. Install Python
      2. Download 2GB of models
      3. Run commands in terminal
      4. Have a Windows laptop"
Placement Officer: "Uh... never mind"
```

**After:**
```
Placement Officer: "We want to use your interview bot for 200 students"
You: "Sure! Here's the link: interview.yoursite.com
      They just need a browser and microphone."
Placement Officer: "Perfect! Can we see analytics?"
You: "Yes, login to admin panel for all scores and reports."
```

### Scenario 2: Remote Interview

**Before:**
```
Candidate is in Bangalore, Interviewer is in Delhi.

Interviewer: "Install this Python script and run it"
Candidate: "I have a Mac..."
Interviewer: "Oh... pywin32 doesn't work on Mac"
Candidate: "Can I use my phone?"
Interviewer: "No... you need Python installed"

*Interview cancelled*
```

**After:**
```
Candidate is in Bangalore, Interviewer is in Delhi.

Interviewer: "Go to interview.company.com and click Start"
Candidate: *Opens on phone browser*
Candidate: *Completes interview*
Interviewer: *Watches live or reviews recording later*

*Interview successful*
```

### Scenario 3: Updating Question Bank

**Before:**
```
You: *Edits question_bank.py*
You: "Hey everyone, I added 50 new questions!"
Users: "Cool, where do we download it?"
You: *Shares new code on WhatsApp*
User1: "I'm getting import errors"
User2: "My old version was working, this broke it"
User3: "Can you send the old version?"
*Chaos*
```

**After:**
```
You: *Adds questions via admin panel*
You: "I added 50 new questions!"
Users: *Open website*
Users: *Automatically have new questions*
*No downloads, no errors, everyone happy*
```

### Scenario 4: Debugging User Issues

**Before:**
```
User: "It's not working"
You: "What error do you see?"
User: "Some Python error, red text"
You: "Can you copy paste it?"
User: *Sends blurry screenshot*
You: "Install this package: pip install xyz"
User: "Permission denied"
You: "Try: pip install --user xyz"
User: "Still not working"
*3 hours later, still debugging*
```

**After:**
```
User: "It's not working"
You: *Checks server logs*
You: "I see the error. Fixed it on my end."
User: *Refreshes page*
User: "It works now!"
*5 minutes total*
```

### Scenario 5: Showing to Investors/Faculty

**Before:**
```
Professor: "Show me your project"
You: *Opens terminal*
You: *Types commands*
Professor: "What is this black screen?"
You: "It's a command line interface..."
Professor: "Where's the application?"
You: "This IS the application..."
Professor: *Confused* "Okay... marks deducted for no UI"
```

**After:**
```
Professor: "Show me your project"
You: *Opens beautiful React dashboard*
You: *Clicks "Start Interview"*
You: *Bot speaks, shows animations*
Professor: "Wow! This looks professional!"
Professor: "Can I try it on my phone?"
You: *Shares link*
Professor: *Uses it immediately*
*Full marks for presentation*
```

---

## 7. Who Benefits?

### 👨‍🎓 Students/Candidates
| Benefit | Explanation |
|---------|-------------|
| No setup required | Just open browser and start |
| Works on phone | Practice interviews on the go |
| Review past attempts | All sessions saved with scores |
| Progress tracking | See improvement over time |

### 👨‍🏫 Professors/Evaluators
| Benefit | Explanation |
|---------|-------------|
| Easy deployment | Share link with entire class |
| Analytics dashboard | See class performance at a glance |
| No technical support | Nothing to install = no support tickets |
| Scalable | Works for 10 or 1000 students |

### 👨‍💻 Developers (You!)
| Benefit | Explanation |
|---------|-------------|
| Portfolio piece | "I built a full-stack MERN app" looks great on resume |
| Industry skills | React, Node, MongoDB, WebSocket = most wanted skills |
| Collaborative | Others can contribute to frontend/backend separately |
| Deployable | Can actually host it for real users |

### 🏢 Organizations
| Benefit | Explanation |
|---------|-------------|
| Bulk interviews | Screen hundreds of candidates |
| Consistent evaluation | Same questions, same scoring |
| Data analytics | "What topics do candidates struggle with?" |
| White-label ready | Can be customized for different companies |

---

## 8. Final Verdict

### Should You Migrate? ✅ YES, if:

- [ ] You want others to use your project
- [ ] You want a portfolio-ready full-stack project
- [ ] You want to learn industry-standard technologies
- [ ] You need multiple users at once
- [ ] You want data persistence and analytics
- [ ] You plan to deploy it publicly

### Maybe Not Yet ❌ if:

- [ ] You only need it for personal use
- [ ] You have no time to learn new stack (2-4 weeks)
- [ ] You can't afford hosting costs ($10-20/month)
- [ ] You need it to work offline

### The Bottom Line

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   Current Python Script = Great for DEVELOPMENT             │
│   MERN Web App = Great for DEPLOYMENT                       │
│                                                             │
│   You've built the ENGINE. 🔧                               │
│   Now it's time to build the CAR. 🚗                        │
│                                                             │
│   The engine (ML models, logic) stays the same.             │
│   The car (web interface, server) makes it usable           │
│   by everyone, everywhere.                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚠️ What Gets Migrated vs What Stays in Python

### ❌ NOT Migrated (Stays as ORIGINAL Python Code)

| File | Why it stays |
|------|--------------|
| `backend/ml/models/intent_classifier.py` | PyTorch MLP model - cannot be converted without accuracy loss |
| `backend/ml/training/intent_predictor.py` | Uses SentenceTransformer - Python-only library |
| `backend/core/answer_evaluator.py` | Semantic similarity using SentenceTransformer |
| `backend/ml/models/saved/intent_model.pth` | Trained model weights - works with PyTorch |

**The `ml-service/` just WRAPS these files with a FastAPI REST API. No logic reimplemented!**

### ✅ Migrated to JavaScript/Node.js

| Original Python | New JavaScript | Notes |
|-----------------|----------------|-------|
| `backend/core/interview_controller.py` | `server/src/services/interview.service.js` | State machine logic |
| `backend/core/question_bank.py` | MongoDB + `server/src/utils/seedQuestions.js` | 170+ questions |
| `backend/resume/extractor.py` | `server/src/services/resume.service.js` | PDF/DOCX parsing |
| `backend/resume/parser.py` | `server/src/services/resume.service.js` | Section detection |
| `backend/resume/gemini_client.py` | `server/src/services/resume.service.js` | Uses @google/generative-ai |
| CLI interface (terminal) | React SPA (browser) | Complete UI rewrite |
| Windows TTS (pywin32) | Web Speech API (browser) | Cross-platform |
| Whisper STT (server) | Web Speech API (browser) | No server load |

---

## Quick Reference: Technology Purpose

| Technology | One-Line Purpose |
|------------|-----------------|
| **React** | Beautiful UI that works on any device |
| **Express.js** | Handles web requests and business logic |
| **MongoDB** | Saves data forever (questions, scores, sessions) |
| **Socket.io** | Real-time communication (bot can speak anytime) |
| **Web Speech API** | Browser speaks text (replaces Windows TTS) |
| **Python Microservice** | **Wraps ORIGINAL ML code** - does NOT reimplement |
| **Docker** | Package everything so it runs anywhere |

---

**Document End**

*"A web app is not better than a script—it's just a different delivery mechanism. Choose based on your AUDIENCE."*

*"The ML/DL code stays in Python because that's where it works best. We just wrap it in an API."*

*Last Updated: January 31, 2026*
