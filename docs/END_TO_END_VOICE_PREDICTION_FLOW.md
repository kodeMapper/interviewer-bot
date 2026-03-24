# End-to-End Voice → Prediction Flow (Function-Level Explanation)

## 🎯 High-Level Overview

```
VOICE AUDIO 
    ↓
WHISPER (STT) → TEXT
    ↓
SENTENCETRANSFORMER (Embedding) → 384-D VECTOR
    ↓
INTENT CLASSIFIER MLP (384→128→64→7) → LOGITS
    ↓
SIGMOID + THRESHOLD → INTENT LABELS
    ↓
LOAD NEXT QUESTION FROM QUESTION BANK
```

---

## 📍 Detailed Step-by-Step Flow

### **STEP 1: Voice Capture & Recording**
**Location:** [backend/core/interview_controller.py](backend/core/interview_controller.py#L599) (`listen()` method)

**What happens:**
- User speaks answer
- `sounddevice.sd.rec()` captures audio at 16kHz (SAMPLE_RATE = 16000)
- Audio stored as NumPy array (float32)

**Function Call Path:**
```python
# In InterviewController.__init__() [Line 127]:
self.stt_model = WhisperModel(WHISPER_MODEL_SIZE="medium", 
                               device="cuda"/"cpu", 
                               compute_type="int8")

# In run_loop() [Line 728]:
audio = self._listen_for_answer()  # Calls sounddevice.rec() + playback.wait()
```

**Data Structure:**
- `audio`: NumPy array, shape (N,), dtype float32
- N = duration_seconds × 16000

---

### **STEP 2: Speech-to-Text Conversion (Whisper)**
**Location:** [backend/core/interview_controller.py](backend/core/interview_controller.py#L608-L618)

**Function Name:** `_transcribe_internal(audio)`

**What happens:**
- Takes audio NumPy array
- Passes to faster-whisper v3 (medium model, INT8 quantization)
- Returns transcribed text

**Code:**
```python
def _transcribe_internal(self, audio):
    """Actual faster-whisper inference (Blocking)"""
    if len(audio) == 0: 
        return ""
    if audio.dtype != np.float32:
        audio = audio.astype(np.float32)
    
    # faster-whisper returns a generator of segments
    segments, info = self.stt_model.transcribe(audio, beam_size=5, language="en")
    text = " ".join([segment.text for segment in segments])
    return text.strip()
```

**Data Flow:**
```
audio (float32 array, 16kHz)
    ↓ [Whisper Model (medium, INT8)]
    ↓ tokenization → feature extraction → transformer
text: str (e.g., "I used Python to build REST APIs")
```

**Example Output:**
```
"I have worked with Python, Docker, and REST APIs to build scalable microservices"
```

---

### **STEP 3: Skill/Intent Detection from Intro (First Time)**
**Location:** [backend/core/interview_controller.py](backend/core/interview_controller.py#L735)

**Function Name:** `self.router.predict_with_scores(intro_text, threshold=0.3)`

**What happens:**
- Takes intro text: "I know Python, Java, Docker, Kubernetes..."
- Runs through IntentPredictor to get skill topics with confidence scores
- Returns top matched skills (with threshold filtering at 0.3)

**Execution Path:**
```python
# In run_loop() [Line 735]:
conf_topics = self.router.predict_with_scores(intro_text, threshold=0.3)
# Example return: [("Python", 0.92), ("Docker", 0.87), ("Java", 0.78)]

self.skills_queue = [t[0] for t in conf_topics]  # Extract topic names
# Result: skills_queue = ["Python", "Docker", "Java"]
```

**Where router is created [Line 125]:**
```python
from ml.training.intent_predictor import IntentPredictor
self.router = IntentPredictor()
```

---

### **STEP 4: ML Prediction Pipeline (Inside IntentPredictor)**
**Location:** [backend/ml/training/intent_predictor.py](backend/ml/training/intent_predictor.py)

#### **4a. Load Model & Encoder**
```python
class IntentPredictor:
    def __init__(self):
        # Load SentenceTransformer
        self.encoder = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Load PyTorch model checkpoint
        checkpoint = torch.load('intent_model.pth')
        self.model = IntentClassifier(input_dim=384, 
                                      hidden_dim=128,
                                      hidden_dim2=64, 
                                      num_classes=7)
        self.model.load_state_dict(checkpoint['model_state_dict'])
        self.model.eval()  # Set to eval mode
        
        # Store labels for reference
        self.labels = checkpoint['labels']  # e.g. [Python, Java, Docker, Kubernetes, ...]
```

#### **4b. Text → Embedding**
**Function Name:** `encode_text(text)`

```python
def encode_text(self, text):
    """Convert text to 384-D embedding via SentenceTransformer"""
    embedding = self.encoder.encode([text], convert_to_tensor=True)
    return embedding  # Shape: (1, 384)
```

**Execution Path in predict_with_scores():**
```python
def predict_with_scores(self, text, threshold=0.5):
    # 1. Encode text → 384-D vector
    embedding = self.encode_text(text)
    # embedding shape: torch.Size([1, 384])
```

**Data Flow:**
```
Text: "I know Python and Docker"
    ↓ [SentenceTransformer.encode()]
    ↓ tokenization → BERT-like model → pooling
Embedding: FloatTensor of shape (1, 384), dtype float32
e.g., [-0.052, 0.195, -0.143, ..., 0.088]  (384 values)
```

#### **4c. MLP Forward Pass**
**Function Name:** `model.forward(embedding)`

**Architecture Diagram:**
```
Input (384)
    ↓
Linear + ReLU + Dropout(0.5)
    ↓ 128
Linear + ReLU + Dropout(0.5)
    ↓ 64
Linear
    ↓
Output Logits (7)
```

**Code in IntentClassifier [backend/ml/models/intent_classifier.py](backend/ml/models/intent_classifier.py):**
```python
class IntentClassifier(nn.Module):
    def __init__(self, input_dim=384, hidden_dim=128, hidden_dim2=64, num_classes=7):
        super().__init__()
        self.network = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),     # 384 → 128
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(hidden_dim, hidden_dim2),   # 128 → 64
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(hidden_dim2, num_classes)   # 64 → 7
        )
    
    def forward(self, x):
        return self.network(x)  # x shape: (batch, 384) → output shape: (batch, 7)
```

**Execution:**
```python
def predict_with_scores(self, text, threshold=0.5):
    embedding = self.encode_text(text)  # (1, 384)
    
    # 2. Forward pass
    with torch.no_grad():
        logits = self.model(embedding)  # torch.Size([1, 7])
```

**Data Flow:**
```
Embedding (1, 384)
    ↓ [Linear(384→128)]
    128D tensor
    ↓ [ReLU] (max(0, x))
    128D tensor (negative values → 0)
    ↓ [Dropout(0.5)] (training OFF, so no-op in eval mode)
    128D tensor
    ↓ [Linear(128→64)]
    64D tensor
    ↓ [ReLU]
    64D tensor
    ↓ [Linear(64→7)]
Logits: (1, 7)
e.g., [-1.2, 0.89, -0.45, 2.1, 0.33, -0.78, 1.55]
```

#### **4d. Sigmoid + Threshold**
**Function Name:** `predict_proba()` and `predict()`

```python
def predict_proba(self, text):
    """Convert logits to probabilities via sigmoid"""
    embedding = self.encode_text(text)
    with torch.no_grad():
        logits = self.model(embedding)
        probs = torch.sigmoid(logits)  # Apply sigmoid: 1/(1+e^-x)
    return probs.cpu().numpy()[0]  # Shape: (7,), values in [0,1]

def predict(self, text, threshold=0.5):
    """Return intent labels where probability > threshold"""
    probs = self.predict_proba(text)
    # probs = [0.23, 0.92, 0.18, 0.87, 0.41, 0.05, 0.76]
    
    predicted_labels = []
    for idx, prob in enumerate(probs):
        if prob > threshold:
            predicted_labels.append(self.labels[idx])
    
    return predicted_labels
    # Example: ["Java", "Docker", "Kubernetes"]

def predict_with_scores(self, text, threshold=0.5):
    """Return (label, score) tuples sorted by score"""
    probs = self.predict_proba(text)
    results = []
    for idx, prob in enumerate(probs):
        if prob > threshold:
            results.append((self.labels[idx], float(prob)))
    
    # Sort by score descending
    return sorted(results, key=lambda x: x[1], reverse=True)
    # Example: [("Docker", 0.92), ("Kubernetes", 0.87), ("Java", 0.23)]
```

**Data Flow:**
```
Logits (7): [-1.2, 0.89, -0.45, 2.1, 0.33, -0.78, 1.55]
    ↓ [Sigmoid: 1/(1+e^-x)]
Probabilities (7): [0.23, 0.71, 0.39, 0.89, 0.58, 0.32, 0.82]
    ↓ [Filter by threshold=0.5]
Filtered: [("Java", 0.71), ("Docker", 0.89), ("Kubernetes", 0.82)]
    ↓ [Sort by score DESC]
Final Result: [("Docker", 0.89), ("Kubernetes", 0.82), ("Java", 0.71)]
```

**Example Probability Calculation (logit → sigmoid):**
```
logit = 2.1
sigmoid(2.1) = 1 / (1 + e^-2.1) = 1 / (1 + 0.122) ≈ 0.89 (89% confidence for Docker)
```

---

### **STEP 5: Pick Next Question Based on Detected Skills**
**Location:** [backend/core/interview_controller.py](backend/core/interview_controller.py#L760-L800)

**Functions Involved:**

1. **`self.skills_queue = [t[0] for t in conf_topics]`**
   - Extracts topic names from prediction results
   - Example: `[("Docker", 0.89), ("Java", 0.71)]` → `["Docker", "Java"]`

2. **`self.get_unique_question(topic)`** [Line 630]
   ```python
   def get_unique_question(self, topic):
       from core.question_bank import get_all_questions
       options = get_all_questions(topic)  # Returns list of (Q, A) tuples
       random.shuffle(options)
       
       for q, ans in options:
           if q not in self.asked_q_hashes:  # Avoid asking same Q twice
               self.asked_q_hashes.add(q)
               return q, ans
       return None, None
   ```

3. **`get_all_questions(topic)`** in [backend/core/question_bank.py](backend/core/question_bank.py)
   ```python
   def get_all_questions(topic):
       if topic == "Docker":
           return [
               ("What is a Docker container?", "A Docker container is a lightweight..."),
               ("Explain Docker volumes.", "Volumes allow persistent data storage..."),
               ...
           ]
   ```

**Execution Flow:**
```
Predicted Topics: [("Docker", 0.89), ("Java", 0.71)]
    ↓
skills_queue = ["Docker", "Java"]
    ↓
Pick first topic: "Docker"
    ↓
get_all_questions("Docker") → fetches all Docker questions from bank
    ↓
get_unique_question("Docker") → picks random unasked question
    ↓
Selected Q: "What is a Docker container?"
Selected Expected Answer: "A Docker container is a lightweight..."
    ↓
SPEAK QUESTION to user
```

---

### **STEP 6: Wait for Answer & Background Processing**
**Location:** [backend/core/interview_controller.py](backend/core/interview_controller.py#L600)

**Functions:**
```python
# In run_loop() [Line ~760]:
audio = self._listen_for_answer()  # Record user's voice response

# Queue for background processing
self.active_tasks += 1
self.processing_queue.put((audio, q, expected, topic))
print(f"→ Answer queued ({self.active_tasks} pending)...")
```

**What happens in background [_background_processor() #450]:**
```python
def _background_processor(self):
    """Consumer Thread: Transcribes, Extracing Keywords, and Judges"""
    while True:
        task = self.processing_queue.get()  # Wait for next answer
        if task is None: break
        
        audio, question, expected, topic = task
        
        # 1. TRANSCRIBE
        text = self._transcribe_internal(audio)
        # "I use Docker for containerization in microservices"
        
        # 2. CHECK INTENTS (Stop/Skip signals)
        text_lower = text.lower()
        for phrase in self.stop_phrases:
            if phrase in text_lower:
                self.stop_signal = True
                break
        
        # 3. JUDGE ANSWER
        score, is_correct = self.judge.evaluate(text, expected)
        # score = 78 (out of 100)
        # is_correct = True (cosine similarity >= 60%)
        
        # 4. LOG
        self.report_card.append({
            'topic': topic,
            'question': question,
            'user_ans': text,
            'expected': expected,
            'score': score
        })
        
        # 5. DECREMENT TASK COUNT
        with self.lock:
            self.active_tasks -= 1
        self.processing_queue.task_done()
```

---

### **STEP 7: Answer Evaluation (Judge)**
**Location:** [backend/core/answer_evaluator.py](backend/core/answer_evaluator.py)

**Function Name:** `self.judge.evaluate(user_answer, expected_answer)`

**What happens:**
- Uses SentenceTransformer to embed both answers
- Calculates cosine similarity (0-100 scale)
- Filters out non-technical words
- Returns (score, is_correct)

**Code:**
```python
class AnswerEvaluator:
    def __init__(self):
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
    
    def evaluate(self, user_answer, expected_answer):
        # 1. Embed both using SentenceTransformer
        user_embedding = self.model.encode(user_answer)        # (384,)
        expected_embedding = self.model.encode(expected_answer) # (384,)
        
        # 2. Calculate cosine similarity
        similarity = util.cos_sim(user_embedding, expected_embedding)
        # similarity = 0.78 (78%)
        
        # 3. Convert to 0-100 scale
        score = int(similarity[0][0].item() * 100)
        # score = 78
        
        # 4. Check if correct (threshold >= 60%)
        is_correct = score >= 60
        
        return score, is_correct
```

**Data Flow:**
```
User Answer: "Docker uses containerization with images and containers"
Expected: "A Docker container is a lightweight..."
    ↓ [Encode both via SentenceTransformer] → (384,) each
    ↓ [Cosine Similarity]
    ↓ util.cos_sim() → value in [0, 1]
similarity = 0.78
    ↓ × 100
score = 78
    ↓ [is_correct = score >= 60]
is_correct = True
```

---

## 🔗 Complete Call Chain

```
run_loop()
├─ _listen_for_answer() → records voice
│  └─ sounddevice.rec() → audio (NumPy array)
│
├─ _transcribe_internal(audio) → text
│  └─ self.stt_model.transcribe() [Whisper]
│
├─ self.router.predict_with_scores(text) → [(topic, score), ...]
│  └─ IntentPredictor.predict_with_scores()
│     ├─ encode_text() → SentenceTransformer.encode() → (1, 384)
│     ├─ self.model.forward() → (1, 7) logits
│     └─ torch.sigmoid() → (1, 7) probabilities
│
├─ self.skills_queue = [t[0] for t in conf_topics]
│
├─ get_unique_question(topic)
│  └─ question_bank.get_all_questions(topic) → [(Q, A), ...]
│
├─ speak(question) → TTS to user
│
├─ _listen_for_answer() → records answer
│
└─ processing_queue.put((audio, q, expected, topic))
   └─ _background_processor() [async thread]
      ├─ _transcribe_internal(audio) → text
      ├─ self.judge.evaluate(text, expected)
      │  └─ AnswerEvaluator.evaluate()
      │     ├─ SentenceTransformer.encode(text) → (384,)
      │     ├─ SentenceTransformer.encode(expected) → (384,)
      │     └─ util.cos_sim() → similarity → score (0-100)
      │
      └─ report_card.append({...})
```

---

## 📊 Data Transformation Summary

| Step | Input | Function | Output | Size |
|------|-------|----------|--------|------|
| 1 | Voice | `listen()` | Audio array | (N,) NumPy float32 |
| 2 | Audio | `_transcribe_internal()` | Text string | str |
| 3 | Text | `router.predict_with_scores()` | Topics + scores | [(str, float), ...] |
| 4a | Text | `encode_text()` | Embedding | (1, 384) tensor |
| 4c | Embedding | `model.forward()` | Logits | (1, 7) tensor |
| 4d | Logits | `torch.sigmoid()` | Probabilities | (1, 7) tensor, [0-1] |
| 5 | Probabilities | Filter & sort | Final topics | [(str, float), ...] |
| 6 | Topic | `get_unique_question()` | (Q, A) pair | (str, str) tuple |
| 7 | (User ans, Expected) | `evaluate()` | Score | int [0-100] |

---

## 🎓 Key Concepts Explained

### **Why SentenceTransformer (384 dimensions)?**
- Converts variable-length text into fixed 384-D vectors
- Semantically similar texts → similar embeddings
- Enables mathematical operations (similarity, clustering, etc.)

### **Why MLP (128→64→7)?**
- **384 input:** SentenceTransformer output size
- **128 hidden:** Reduces dimensionality, learns subject patterns
- **64 hidden:** Further refinement, extracts subject-specific features
- **7 output:** Number of technical subjects (Python, Java, Docker, Kubernetes, SQL, AWS, ML)

### **Why Sigmoid + Threshold?**
- **Multi-label classification:** A text can mention multiple skills (Python AND Docker)
- **Sigmoid:** Converts logits to [0,1] range for each label independently
- **Threshold (0.3):** Only keep predictions with confidence > 30%
- **Contrast with Softmax:** Softmax sums to 1 (single-label only)

### **Why BCEWithLogitsLoss** (loss function)?
- Binary Cross-Entropy for multi-label classification
- Each of 7 labels treated as independent binary (yes/no)
- Allows combination like "Python" + "Docker" simultaneously

---

## 🚀 Execution Timeline Example

```
Time  Thread           Event
────────────────────────────────────────────────────────────
0ms   MAIN            speak("What is Docker?")
50ms  USER            [speaks for 3 seconds]
3050ms MAIN           listen() captures [16000*3 samples] = 48,000 samples
3050ms MAIN           processing_queue.put((audio, q, expected))
3050ms WORKER         task_received()
3060ms WORKER         _transcribe_internal(audio) → Whisper processes
3100ms WORKER         → "Docker is a containerization platform"
3100ms MAIN           speak("Good. Next question...")
3100ms WORKER         judge.evaluate(text, expected)
3110ms WORKER         → SentenceTransformer.encode() [MAIN might do next prediction meanwhile]
3120ms WORKER         → cosine similarity → score = 85
3120ms WORKER         → report_card.append(...)
3120ms MAIN           [continues to next question regardless]
```

---

## 💾 File References

| Component | File | Key Functions |
|-----------|------|----------------|
| **Speech-to-Text** | [backend/core/interview_controller.py](backend/core/interview_controller.py#L608) | `_transcribe_internal()` |
| **Intent Prediction** | [backend/ml/training/intent_predictor.py](backend/ml/training/intent_predictor.py) | `predict_with_scores()`, `encode_text()` |
| **MLP Architecture** | [backend/ml/models/intent_classifier.py](backend/ml/models/intent_classifier.py) | `IntentClassifier` class, `forward()` |
| **Question Selection** | [backend/core/question_bank.py](backend/core/question_bank.py) | `get_all_questions()` |
| **Answer Evaluation** | [backend/core/answer_evaluator.py](backend/core/answer_evaluator.py) | `evaluate()` |
| **Main Loop** | [backend/core/interview_controller.py](backend/core/interview_controller.py#L714) | `run_loop()` |
| **Background Processing** | [backend/core/interview_controller.py](backend/core/interview_controller.py#L450) | `_background_processor()` |

---

## ✅ Summary

**Flow:** Voice → Text → Embedding (384D) → MLP (128-64-7) → Sigmoid + Threshold → Topic Labels → Next Question

**Key ML Pipeline:**
1. **Whisper (STT):** Speech audio → text transcription
2. **SentenceTransformer:** Text → 384-dimensional semantic embedding
3. **IntentClassifier MLP:** 384D embedding → 7 subject probabilities
4. **Threshold filtering:** Keep confident predictions (>30% in intro, >50% in regular)
5. **Question bank:** Map predicted topic → load unasked questions
6. **Background judge:** Score user answers via cosine similarity of embeddings

**Parallelism:** While asking the next question, the background thread transcribes, evaluates, and logs the previous answer

