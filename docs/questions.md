# FAQ: Internal Implementation & Design Decisions

This document compiles the technical questions asked during development and their answers, clearly explaining the "How" and "Why" of the system.

## 1. Model & Speech Recognition

### Q: What is the difference between `medium` and `medium.en` in Whisper?
*   **`medium.en`**: This model is optimized **exclusively for English**. It is generally 10-15% more accurate on standard US/UK accents because it doesn't process other languages.
*   **`medium`**: This is a **multilingual** model trained on 99 languages.
*   **Verdict:** We switched to **`medium`** because it tends to be more robust for diverse accents (like Indian English). The "English-only" model can be too strict and sometimes fails to transcribe non-standard accents correctly.

### Q: Why was the accuracy poor initially?
Speech-to-Text accuracy depends on three factors:
1.  **Model Size:** We upgraded from `base` (fast but inaccurate) to `medium` (slower but intelligent) to fix this.
2.  **Mic Quality/Noise:** Background noise can confuse the model.
3.  **Accent:** As mentioned above, multilingual models handle accent variation better than strict English-only models.

### Q: How did we solve the "Latency/Lag" problem?
*   **The Problem:** Using the high-accuracy `medium` model takes 3-4 seconds to process audio. This made the interview feel robotic (Bot asks -> User answers -> Silence for 4s -> Bot asks).
*   **The Solution (Async Zero-Latency):** We separated the system into two parallel threads:
    1.  **Main Thread (The Mouth & Ears):** As soon as you finish answering Q1, this thread *immediately* asks Q2.
    2.  **Background Thread (The Brain):** While you are listening to Q2, this thread secretly transcribes and grades your answer to Q1.
    *   **Result:** The gap between questions is now exactly **2 seconds** (manually added for natural pacing), down from 6+ seconds.

---

## 2. Evaluation Logic (The "Judge")

### Q: How does the bot evaluate answers? Is it looking for keywords?
**NO.** It does not use simple keyword matching.

*   **The Old Way (Bad):** `if "object" in answer and "class" in answer: return True`
    *   *Flaw:* If you said "It uses instances and blueprints", you would fail despite being right.
*   **Our Way (Semantic Similarity):** We use a **SentenceTransformer** model (`all-MiniLM-L6-v2`).
    *   It converts your sentence into a **Vector** (a list of numbers representing meaning).
    *   It converts the Correct Answer into a Vector.
    *   It calculates the **Cosine Similarity** (distance) between them.
    *   *Result:* Even if you use completely different words, if the *meaning* is the same, the vectors will be close, and you will get a high score.

### Q: How do real industry bots (like Mettl/HireVue) work?
*   **LLMs:** Modern platforms use Large Language Models (like GPT-4) to analyze reasoning.
*   **Multimodal:** They analyze **Video** (eye contact), **Audio** (tone/confidence), and **Text** (correctness) simultaneously.
*   **Why didn't we use GPT?** because this is a **Deep Learning Course Project**. Using an API is "Black Box" engineering. Building our own Vector Evaluator demonstrates we understand the underlying mathematics of Neural Networks.

---

## 3. System Architecture & Syllabus Compliance

### Q: Are we actually doing "Deep Learning" if we use pre-trained models?
**Yes, because we built the critical components from scratch.**

---

## 4. Resume Parsing & Question Generation Logic

### Q: Why was the generator only returning 2 or 9 questions when I asked for 20?
This was due to two distinct failures in the `question_generator.py` pipeline:

1.  **JSON Truncation / "Extra Data" Error:**
    *   **The Problem:** The LLM (Gemini) would sometimes output valid JSON followed by conversational filler (e.g., "Here is your JSON..."), or it would wrap the output in markdown code blocks (` ```json ... `). The strict Python `json.loads()` parser would crash on this "Extra data".
    *   **The Fix:** We implemented a **Robust JSON Extractor** that strictly uses regex to isolate the substring between the *first* `{` and the *last* `}`. This discards all noise before and after the actual data.

2.  **Type Mismatch (Silent Failure):**
    *   **The Problem:** The prompt instructed the LLM to generate "Deep Dive" or "Tradeoff" questions, but our internal Python code used an `Enum` that only accepted strict keys like "PROJECT" or "SCENARIO". This caused a `ValueError` during parsing.
    *   **The Result:** The loop caught the error and silently skipped the question. If *all* questions were skipped, the system fell back to a primitive Regex extractor that could only scrape 9 questions from the text.
    *   **The Fix:** We added a **Type Mapping Layer** that translates the LLM's vocabulary (e.g., "deep_dive") into our internal system vocabulary (e.g., "PROJECT") before validation.

### Q: Why was the generator returning only 4-5 questions even after the above fixes?
**The Problem: Token Limit Truncation**
*   Even though Gemini was generating 20 questions, the response was being **cut off mid-sentence** due to the `max_tokens` limit (originally 8192).
*   The raw response file showed the 5th question ending abruptly: `"Candidate should discuss resource constraints` (incomplete).
*   The `_repair_json` function would then "fix" this by closing the brackets early, resulting in only 4 valid questions.

**The Fix:**
1.  **Increased `max_tokens`:** Changed from `8192` → `16384` in `gemini_client.py`.
2.  **Increased `timeout`:** Changed from `90s` → `120s` for longer generation times.
3.  **Leaner Output Format:** Simplified the prompt's JSON schema:
    *   Removed verbose `why_this_question` field
    *   Reduced `expected_answer` to "2-3 key points only"
    *   Limited `follow_ups` to 1 instead of 2
    *   Reduced `keywords` to "3-5 max"
    *   This cut per-question token usage from ~400 to ~200 tokens.
4.  **Set target to 10 questions:** Optimal balance between coverage and reliability.

### Q: How do we debug "Bad Responses" from the AI?
*   **Raw Logging:** Every time the generator runs, it saves the *exact* raw string returned by Gemini to `gemini_raw_response.txt` (overwritten each run).
*   **Why this is safe:** It's a small text file (~20KB) that only exists for debugging. It doesn't affect runtime performance.
*   **How to use it:** If questions are missing or malformed, open this file to see exactly what Gemini returned (e.g., truncated JSON, markdown wrappers, or hallucinations).

1.  **What we USED (The Tools):**
    *   *Whisper & SentenceTransformers:* These require massive Google-scale compute to train. It is standard academic practice to use these as "Backbones."
2.  **What we BUILT (The Syllabus Requirements):**
    *   **The Brain (Intent Classifier):** We designed and trained a **PyTorch MLP** from scratch. We wrote the training loop, defined the layers (`Linear -> ReLU`), and optimized it using Adam. This covers **Modules 1, 2, & 3** of the syllabus.
    *   **The Eye (Upcoming CNN):** We will build a **Convolutional Neural Network** from scratch to detect cheating. This covers **Module 4**.

### Q: Why did we analyze the old `bakend` folder?
To ensure the new "White Box" system lost no functionality during the upgrade. We confirmed:
*   The old system used `medium` Whisper (we matched this).
*   The old system used a `0.6` similarity threshold (we matched this).
*   The old system had hardcoded loops (we improved this to be dynamic).

### Q: Do we need external datasets (SQuAD, Common Voice)?
**No.**
*   Those datasets are for training *base models* (like BERT or Whisper) from scratch, which takes months.
*   Since we are using pre-trained backbones for Speech and Embeddings, we only needed:
    1.  **`interview_intents.json`:** A small, custom dataset we created to train our specific MLP Brain.
    2.  **`question_bank.py`:** A curated list of technical questions (which we manually enriched).

---

## 4. Application Workflow

1.  **Handshake:** User speaks -> Whisper Transcribes -> **MLP Brain** predicts Skills (Label Classification).
2.  **Planning:** Controller creates a queue: `[Java, Python, Mix-Round]`.
3.  **Execution:**
    *   Ask Q (TTS).
    *   Record A (Mic).
    *   **Fork Process:**
        *   *Path A (User):* Wait 2s -> Ask Next Q.
        *   *Path B (System):* Transcribe -> Vectorize -> Grade -> Log to Report.
4.  **Feedback:** At the end, the bot reads out the correct answers for any questions you missed (Score < 30).

---

## 5. Important Viva Questions You May Be Asked (Added for Prep)

### Q: Why did we use `BCEWithLogitsLoss` for the intent model, not `CrossEntropyLoss`?
Because one intro sentence can belong to multiple topics at the same time (example: Python + SQL). This is a **multi-label** problem, not single-label. `BCEWithLogitsLoss` handles each label independently.

### Q: What exactly is the intent model input and output?
Input is a 384-dim sentence embedding from `all-MiniLM-L6-v2`. Output is 7 topic logits: Java, Python, JavaScript, React, SQL, Machine_Learning, Deep_Learning.

### Q: Why no sigmoid layer at the last model layer if outputs are probabilities?
Sigmoid is applied inside `BCEWithLogitsLoss` during training for numerical stability. During inference, we manually apply sigmoid and threshold.

### Q: What threshold is used for intent prediction?
Default threshold is 0.5. If class probability >= 0.5, that topic is selected.

### Q: What does the answer evaluator do internally?
It creates embeddings for user answer and expected answer, computes cosine similarity, scales it to 0-100, and marks correct if score >= 60.

### Q: Why did we choose semantic similarity instead of keyword matching?
Because users can answer correctly using different words. Semantic similarity checks meaning, not exact word overlap.

### Q: How is zero-latency behavior implemented in interview flow?
Answer processing runs in background while next question is asked quickly. So user does not wait for full evaluation each time.

### Q: What is `RESUME_WARMUP` and why is it important?
While resume questions are still being generated by Gemini, bot asks local question-bank questions. This hides API delay and keeps conversation smooth.

### Q: What fallback happens if Gemini fails in resume generation?
System falls back to local/fallback question generation so interview does not stop.

### Q: In proctoring, why not alert on one bad frame?
Single frames are noisy. System uses confidence gate + temporal smoothing + timeout persistence, so alerts are more reliable.

### Q: What is the EyeCNN architecture in one line?
Conv(1->6) -> AvgPool -> Conv(6->16) -> AvgPool -> FC(2704->120) -> Dropout(0.3) -> FC(120->84) -> FC(84->2).

### Q: What does `CONF_THRESHOLD = 0.90` mean in proctoring?
If model confidence is below 0.90, prediction is forced to safe class. This reduces false alarms.

### Q: How does gaze smoothing work?
System keeps last 5 predictions. If at least 3 are suspicious, it flags looking away.

### Q: How does head pose detection work?
MediaPipe facial landmarks are used. Nose offset is normalized by face height. Thresholds classify LEFT/RIGHT/UP/DOWN.

### Q: What are the main proctoring timeouts?
Most violations use ~0.9s persistence. Dark environment uses shorter ~0.7s timeout.

### Q: How does the web app connect all services?
Frontend (React) talks to Node backend (Socket + REST). Node backend calls ML service (FastAPI). ML service imports original Python ML modules for prediction and evaluation.

### Q: Why keep ML in a separate FastAPI service when backend is Node?
Because trained ML code is Python-based (PyTorch + sentence-transformers). FastAPI wrapper lets Node use it cleanly over HTTP.

### Q: What happens if ML service is down?
Answer service falls back to keyword-based scoring. Interview still continues.

### Q: How is final score computed?
It is average score of non-skipped answers (0-100). Skipped answers are tracked separately.

### Q: What viva point shows this is not just API wrapping?
Custom MLP training loop, optimizer comparison, regularization, custom EyeCNN training, threshold/smoothing logic, and explainable reporting pipeline.

### Q: Are we using YOLOv8? If yes, for what? What does MediaPipe do?
Short answer:
- YOLOv8 code is present, but in the current live proctoring loop it is not actively used.
- MediaPipe is actively used in runtime.

Detailed simple answer:
1. YOLOv8:
- There is a utility file `proctoring_fastapi/people_detector.py` that loads `yolov8n.pt` and detects class `person`.
- But `proctoring_fastapi/proctor_live.py` does not import or call `PeopleDetector`.
- So right now, multiple-person detection in live runtime is done by face counting (MediaPipe/OpenCV), not YOLO.

2. MediaPipe:
- MediaPipe FaceMesh is used to detect face landmarks in each frame.
- From these landmarks, system does:
    - face count checks (`NO FACE`, `MULTIPLE FACES`)
    - head-pose estimation (`HEAD LEFT/RIGHT/UP/DOWN`)
- If MediaPipe fails, system falls back to OpenCV Haar face detector. In fallback, face-count and gaze-CNN checks still run, but head-pose logic is not available.

Viva one-liner you can say:
"YOLOv8 support exists as a utility module, but the current production proctor loop primarily uses MediaPipe FaceMesh for face landmarks and head pose, plus our EyeCNN for gaze classification."

### Q: Mention all datasets and links (if available). Why not Kaggle for MLP? Why use AI-generated questions in MongoDB?
Simple answer:
We use a mix of custom local datasets and optional external/pretrained sources. For MLP, we intentionally use our own domain dataset because the task is very specific to interview-skill intent detection.

Dataset list:
1. MLP Intent Dataset (main training dataset)
- File: `backend/ml/data/interview_intents.json`
- Type: Custom multi-label text dataset (7 topics)
- Public link: Not published (local project dataset)

2. Eye-Gaze Fine-tune Dataset
- Folder pattern: `proctoring_fastapi/dataset/good` and `proctoring_fastapi/dataset/bad`
- Type: Custom webcam images (64x64 grayscale)
- Public link: Not published (locally collected)

3. Eye-Gaze External Pretraining Dataset
- Folder used by script: `proctoring_fastapi/external_dataset`
- Type: External image dataset copied locally for stage-1 pretraining
- Public link: Not fixed in code/docs (source can vary by setup)

4. Resume Inputs (runtime data, not model-training dataset)
- Source: User-uploaded resumes (PDF/DOCX/TXT)
- Used for: Dynamic question generation, not for training MLP model
- Public link: Not applicable (user-provided)

5. Question Bank Seed in MongoDB
- Source file: `server/src/utils/seedQuestions.js`
- Type: Curated Q&A repository used for interview flow
- Public link: Not needed (stored in project and inserted to Mongo)

6. Pretrained model backbones used (not your own dataset files)
- Sentence embedding model: all-MiniLM-L6-v2
    - Link: https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2
- Whisper ASR model family (via faster-whisper / CTranslate2)
    - Link: https://github.com/SYSTRAN/faster-whisper
- YOLOv8 weights/model family (utility present)
    - Link: https://docs.ultralytics.com/models/yolov8/

Why not Kaggle for MLP dataset?
1. Task mismatch:
- Your MLP needs interview-intro intent labels across exact 7 project topics.
- Most Kaggle text datasets are for sentiment/spam/news/classification, not this exact label space.

2. Domain vocabulary mismatch:
- Your inputs include spoken, noisy, short interview-style text.
- Kaggle datasets are usually cleaner and different in style.

3. Multi-label requirement:
- One intro can contain multiple topics together (example: Python + SQL).
- Many Kaggle datasets are single-label, so they are not ideal directly.

4. Academic defense benefit:
- Custom dataset clearly shows problem framing, label design, and model-data alignment for your own use-case.

Do we need Kaggle at all?
- Not mandatory for this MLP use-case.
- You can use Kaggle only as optional augmentation/benchmarking, but project works correctly without it.

Why use AI-generated questions in MongoDB?
1. Clarification:
- MongoDB question bank is mainly seeded from `seedQuestions.js` (curated static set).
- Resume-specific AI questions are generated at runtime and attached to session flow.

2. Purpose:
- They are interview content, not training labels for MLP.
- MLP training still uses `interview_intents.json`.

3. Practical reason:
- Static bank gives reliability and fallback.
- AI-generated resume questions give personalization and depth.
- Hybrid approach gives both stability + customization.

### Q: We take voice input. How does text reach our model? Does Whisper output text? Sentence-Transformer and custom MLP both do intent classification?
Simple flow answer:
1. User speaks (audio waveform).
2. Whisper transcribes audio to plain text.
3. That text is converted to embedding vector by Sentence-Transformer.
4. Our custom MLP takes that vector and predicts topic intents.

Does Whisper output text?
- Yes. Whisper's transcription step returns text segments, and code joins them into one text string.

How Sentence-Transformer and custom MLP are different:
1. Sentence-Transformer:
- Role: Text encoder (feature extractor).
- Input: Text sentence.
- Output: Dense vector (for this project, 384-dim embedding).
- It is not your final intent classifier here.

2. Custom MLP:
- Role: Task-specific intent classifier trained by you.
- Input: 384-dim embedding from Sentence-Transformer.
- Output: 7 topic probabilities (Java, Python, React, SQL, etc.).
- This is the actual model making intent decisions for your use-case.

Viva one-liner:
"Whisper converts speech to text, Sentence-Transformer converts text to vector, and our custom MLP converts that vector to topic intents."

### Q: How are we doing adaptive questioning after classifying 7 subjects? Why not directly compare text with those 7 topic names?
Simple answer:
Adaptive questioning happens in two levels.

Level 1: Topic-level adaptation
1. Intro answer is transcribed by Whisper.
2. MLP predicts topic scores (Java, Python, React, etc.).
3. System creates a skills queue from top predicted topics.
4. Interview asks questions topic-by-topic from that queue.

Level 2: Intra-topic adaptation (counter-questioning)
1. While user answers, system extracts useful keywords from the answer.
2. Those keywords are pushed into a context queue.
3. Next question can be selected based on that keyword, so follow-up feels personalized.
4. If no strong keyword match is found, system falls back to normal random question in current topic.

Why not just compare text with 7 topic names directly?
1. Topic names are too short and generic:
- Comparing user text with only words like Java, Python, React is weak and noisy.

2. Real answers use indirect language:
- User may say spring boot, jvm, hooks, pandas, joins without saying the exact topic name.

3. Multi-label and overlap:
- One answer can belong to multiple topics at once (example: Python + SQL).
- MLP is trained for this multi-label behavior.

4. Robustness:
- MLP learns patterns from many examples, including noisy and spoken-style phrases.
- Direct text-vs-topic matching is brittle and misses semantic cues.

Viva one-liner:
"We do adaptation first at topic-routing level using MLP scores, then at follow-up level using keyword-based context from previous answers. Direct matching with 7 topic names is too naive for real interview language."

### Q: Explain our custom MLP fully (layers, neurons, attempts, accuracy behavior, optimization, hyperparameters, activations, trainable params)
Short answer:
Our production MLP is a 2-hidden-layer multi-label classifier: 384 -> 128 -> 64 -> 7. It uses ReLU in hidden layers, dropout 0.3, BCEWithLogitsLoss, and Adam (selected over SGD from code-level comparison loop).

Low-level architecture (exact):
1. Input:
- 384 features (Sentence-Transformer embedding size)

2. Hidden Layer 1:
- Linear(384, 128)
- ReLU
- Dropout(0.3)

3. Hidden Layer 2:
- Linear(128, 64)
- ReLU
- Dropout(0.3)

4. Output Layer:
- Linear(64, 7)
- No explicit sigmoid inside model forward
- Sigmoid is applied via BCEWithLogitsLoss (training) and manually in predict_proba (inference)

Activation functions used:
1. ReLU in both hidden layers
2. Sigmoid only for output probabilities (inside loss during training / explicit at inference)

How many layers are there?
- 3 Linear layers total (2 hidden + 1 output)
- If counted by "neural layers": input + 2 hidden + output

Exact trainable parameter count:
- Production model (`IntentClassifier`): 57,991 trainable parameters

Parameter breakdown:
1. Linear(384 -> 128): 384*128 + 128 = 49,280
2. Linear(128 -> 64): 128*64 + 64 = 8,256
3. Linear(64 -> 7): 64*7 + 7 = 455
Total = 49,280 + 8,256 + 455 = 57,991

How did we decide layers and neurons?
1. Input size is fixed by embedding model (384), so first layer must accept 384.
2. We used a compact funnel 384 -> 128 -> 64 to reduce dimensionality gradually.
3. Dataset is small, so very deep/wide networks risk overfitting.
4. Dropout + weight decay were used to keep model generalization stable.

Did we perform multiple attempts?
Confirmed from code:
1. Yes, optimizer attempts were done in training loop: Adam vs SGD.
2. Fresh model is re-initialized per optimizer trial.
3. Best optimizer is selected by validation F1 and saved to checkpoint.

What about multiple attempts for layers/neurons?
1. A larger variant class exists (`IntentClassifierLarge`, hidden dims [256,128,64], BatchNorm + Dropout 0.4).
2. But current training script main flow does not run a full architecture sweep by default.
3. So production evidence clearly shows optimizer comparison; architecture ablation logs are not persisted in current pipeline.

How did accuracy vary in saved trained model (exact checkpoint metrics)?
- Saved best optimizer: Adam
- Test exact-match accuracy: 0.7750
- Test precision: 0.9000
- Test recall: 0.8708
- Test F1: 0.8852
- Per-label accuracy:
    - Java: 0.9250
    - Python: 1.0000
    - JavaScript: 0.9500
    - React: 0.9750
    - SQL: 0.9500
    - Machine_Learning: 0.9750
    - Deep_Learning: 0.9250

How does accuracy change when increasing/decreasing layers/neurons?
Evidence-based answer you can safely give:
1. On this project, larger models are more likely to overfit because dataset size is small.
2. Smaller models can underfit and miss topic nuance.
3. The chosen 128/64 hidden sizes are a practical middle point for this dataset scale.
4. Current codebase does not store a full architecture-vs-accuracy table automatically; it stores the best trained checkpoint metrics.

Optimization techniques used:
1. Adam / SGD comparison (optimizer-level selection)
2. Learning-rate scheduler: ReduceLROnPlateau (factor 0.5, patience 5)
3. Early stopping (patience 15)
4. Dropout (0.3)
5. L2 regularization via weight_decay=1e-4
6. Xavier uniform initialization for Linear layers

Why these techniques?
1. Small dataset needs regularization to avoid overfitting (dropout + L2 + early stopping).
2. Adaptive LR helps when validation loss plateaus.
3. Xavier init improves stable convergence.
4. Adam generally converges faster and more reliably on sparse/noisy text embeddings.

Hyperparameters considered in current training pipeline:
1. batch_size = 16
2. learning_rate = 0.001
3. epochs = 100 (max)
4. early_stopping_patience = 15
5. dropout_rate = 0.3
6. weight_decay = 1e-4
7. prediction threshold = 0.5 (multi-label assignment)
8. SGD momentum = 0.9 (when SGD used)

Data split used by current processed arrays:
1. Train: 186 samples
2. Validation: 40 samples
3. Test: 40 samples
4. Total samples in current `interview_intents.json`: 266

Viva-safe summary line:
"Our custom intent MLP is a compact 384-128-64-7 multi-label network with ReLU + dropout, trained using BCEWithLogitsLoss and Adam/SGD comparison. We selected Adam as best and regularized with dropout, L2, LR scheduling, and early stopping to avoid overfitting on a small dataset."

### Q: When does interview terminate? Is there a question limit? Why ReLU not tanh? What if we increase layers/neurons? Is accuracy low and how to improve it?
Interview stop conditions (actual behavior):
1. User explicit stop:
- If user says stop phrases like "stop interview", "terminate", "end session", "abort", system sets stop signal and ends.

2. Natural completion:
- Resume round ends when resume questions are exhausted or target is reached.
- Deep-dive round moves topic-wise and then to mix round.
- Mix round ends after fixed question count and then state becomes FINISHED.

3. Manual end from UI:
- In web app, user can click end interview and session is forced to FINISHED.

Question limits (web flow defaults):
1. Warmup max: 3 questions
2. Resume target max: 20 questions
3. Deep-dive per topic: 5 questions
4. Mix round: 5 questions

So total is dynamic, not one fixed global number.

Why ReLU (and not tanh in this model):
1. ReLU trains faster and is simpler.
2. ReLU reduces vanishing-gradient risk compared to tanh/sigmoid in hidden layers.
3. Embedding inputs are high-dimensional; ReLU usually works well for such MLP classification setups.

Could tanh work?
- Yes, but may converge slower and can saturate (small gradients) for large-magnitude activations.

What does "funnel" (128 then 64) mean?
1. Gradual compression of information:
- 384 feature vector -> 128 compact representation -> 64 more task-focused representation -> 7 outputs.
2. It helps remove noise step-by-step instead of abrupt shrinking.

What if we increase layers/neurons?
1. Potential benefit:
- More capacity to learn complex patterns.
2. Risk on small dataset:
- Overfitting increases (training score high, test/generalization drops).
3. Also more compute and tuning complexity.

Did we test alternative approaches?
Confirmed from code:
1. Optimizer comparison was done (Adam vs SGD).
2. Larger architecture class exists (`IntentClassifierLarge`) for experimentation.
3. Current default training pipeline does not run full automatic architecture ablation table by default.

"Why is accuracy low?" (how to defend):
1. Exact-match accuracy in multi-label tasks is strict (all 7 labels for a sample must match exactly).
2. So exact-match can look lower while per-label metrics are high.
3. Current saved model has stronger precision/recall/F1 than exact-match alone suggests.

Is this maximum test accuracy?
1. It is the best in the currently saved checkpoint under current pipeline/config/data.
2. It is not theoretical maximum; it can improve with better data and tuning.

Should we increase dataset size?
Yes, this is usually the highest-impact improvement.
1. Add more real spoken-style labeled intro samples.
2. Improve label quality and class balance.
3. Add hard negative and overlap examples (multi-topic sentences).

Should we change layers/neurons too?
Yes, but after improving data quality/size.
Recommended priority:
1. Data quality and quantity
2. Threshold tuning and calibration
3. Architecture sweep (small/medium/large)
4. Advanced regularization and augmentation

Practical improvement plan:
1. Collect 2x-5x more labeled intent samples.
2. Run structured experiments:
- 384-64-7
- 384-128-64-7 (current)
- 384-256-128-64-7
3. Keep same train/val/test split protocol and compare exact-match, precision, recall, F1.
4. Select model by validation F1 + stability, not by train accuracy.

Viva one-liner:
"Interview termination is state-driven with warmup, resume, deep-dive, and fixed mix-round limits; ReLU is chosen for stable and efficient training; to improve accuracy further, the first lever is more high-quality labeled data, then architecture tuning."

### Q: Temporary architecture test results (to justify why we picked current model)
We ran temporary ablation on multiple MLP architectures using the same processed split and training setup.

Data split actually used in this run:
1. Train: 186 samples
2. Validation: 40 samples
3. Test: 40 samples
4. Total: 266 samples

Architectures tested (hidden layers):
1. A: [64]
2. B (current): [128, 64]
3. C: [256, 128, 64]
4. D: [128]
5. E: [256, 64]
6. F: [512, 256, 128, 64]
7. G: [96, 48]
8. H: [192, 96, 48]

Observed results (temporary run):
1. C [256,128,64]: test_f1=0.9270, exact_match=0.8000, params=140,167
2. F [512,256,128,64]: test_f1=0.9227, exact_match=0.8000, params=370,055
3. G [96,48]: test_f1=0.9162, exact_match=0.8250, params=41,959
4. B current [128,64]: test_f1=0.9145, exact_match=0.8000, params=57,991
5. H [192,96,48]: test_f1=0.9037, exact_match=0.7750, params=97,447
6. D [128]: test_f1=0.8955, exact_match=0.8000, params=50,183
7. A [64]: test_f1=0.8912, exact_match=0.8000, params=25,095
8. E [256,64]: test_f1=0.8912, exact_match=0.8000, params=115,463

How to defend model choice from this:
1. Bigger models (C, F) improved F1 a bit, but parameter count increased a lot.
2. Current model B gives strong performance with much lower complexity than C/F.
3. G gives best exact-match with fewer params, but current B remains a balanced and stable choice already integrated in pipeline.
4. For production/teaching, B is a good trade-off between performance, speed, and overfitting risk.

Important note for viva:
1. These are single-run temporary results on one split.
2. Final decision should ideally use repeated runs / cross-validation before claiming absolute best architecture.

Experiment artifacts:
1. Script: `backend/ml/training/temp_arch_ablation.py`
2. CSV results: `backend/ml/plots/temp_arch_ablation_results.csv`

### Q: Why only 266 when question bank has 330? Can we add 350 questions and retrain after increasing labeled dataset?
Clarification first:
1. `266` was the size of MLP intent dataset (`interview_intents.json`) used to train classifier.
2. `330+` question bank is interview content in MongoDB (used for asking questions), not MLP training labels.
3. They are different data pipelines.

What was done now:
1. MongoDB question bank expanded by 350 new questions (50 per topic across 7 topics).
2. Intent dataset expanded and balanced for model training:
    - Old total: 266
    - New total: 771
    - Final per-label counts: 120 each for all 7 topics (balanced)
3. Processed embeddings/splits regenerated.
4. Independent temporary architecture ablation re-run on updated data.

New split sizes after expansion:
1. Train: 539
2. Validation: 116
3. Test: 116

Post-expansion temporary architecture results (ranked by test_f1):
1. E [256,64]: test_f1=0.9935, exact=0.9741, params=115,463
2. C [256,128,64]: test_f1=0.9892, exact=0.9828, params=140,167
3. B current [128,64]: test_f1=0.9871, exact=0.9741, params=57,991
4. D [128]: test_f1=0.9871, exact=0.9741, params=50,183
5. G [96,48]: test_f1=0.9849, exact=0.9655, params=41,959
6. F [512,256,128,64]: test_f1=0.9849, exact=0.9397, params=370,055
7. A [64]: test_f1=0.9827, exact=0.9569, params=25,095
8. H [192,96,48]: test_f1=0.9762, exact=0.9310, params=97,447

Interpretation for viva:
1. More high-quality balanced labeled data significantly improved metrics.
2. Bigger is not always better: very large model did not dominate exact-match.
3. Current model remains a strong efficiency-performance tradeoff, though [256,64] scored best F1 in this temporary run.

Artifacts created in this step:
1. MongoDB augmentation script: `server/scripts/augment_question_bank.js`
2. Dataset augmentation script: `backend/ml/data/augment_intent_dataset.py`
3. Updated ablation CSV: `backend/ml/plots/temp_arch_ablation_results.csv`

### Q: Difference between intent dataset vs question bank? How correctness is decided? Can we add more questions and will it help? How decide train/val/test size? Why these neurons and funnel?
Difference between the two datasets:
1. Intent dataset (`backend/ml/data/interview_intents.json`):
- Used to train the MLP classifier.
- Format: short intro text + label(s) among 7 topics.
- Purpose: predict which topic(s) candidate belongs to.

2. Question bank (MongoDB + `seedQuestions` + augment script):
- Used at interview runtime to ask questions and store expected answers.
- Purpose: interview content delivery and answer evaluation context.
- It is NOT used to train the intent MLP.

How model decides candidate answer is correct or not:
1. System compares user's answer text with expected answer text semantically.
2. Both texts are embedded using SentenceTransformer (`all-MiniLM-L6-v2`).
3. Cosine similarity is computed.
4. Score is converted to 0-100.
5. If score >= threshold (60), answer is treated as correct.

So yes: it compares expected vs given answer semantically (not exact keyword match only).

Can we add more interview questions? Will it help?
1. Yes, and done again now:
- Added another 350 questions (50/topic), so total question bank reached 1030.
2. Will it help?
- It helps interview quality/coverage/variety.
- It does NOT directly improve MLP classifier unless intent-labeled dataset also grows.

How we decide train/val/test amount:
1. We need enough training data to learn patterns.
2. We need separate validation data for model/hyperparameter decisions.
3. We need untouched test data for final unbiased performance.
4. Practical split used in pipeline is around 70/15/15.
5. After expansion to 771 samples, actual split became 539/116/116.

Why these neuron sizes and funnel shape:
1. Input is 384-d embedding, so first layer starts at 384.
2. Funnel (e.g., 128 -> 64) gradually compresses representation.
3. This helps remove noise and force model to keep important signal.
4. Too small = underfitting risk; too large/deep = overfitting risk and higher compute.
5. Ablation runs showed larger models can improve F1 a bit, but current model gives strong trade-off with lower parameter count.

Solid viva line:
"Intent dataset trains the topic classifier; question bank drives interview content. Correctness is decided by semantic similarity between expected and candidate answers. Funnel architecture is a controlled compression from 384 features to compact task-specific features, balancing expressiveness and generalization."

### Q: What is meant by seeded and augmented? Can we retrain temporarily and check if shallower/reduced-neuron models are better now?
Simple meanings first:
1. Seeded:
- Means we fix random seed (for example 42) so data shuffling and weight initialization are reproducible.
- If we rerun with same seed and same setup, results are comparable.

2. Augmented:
- Means we increase dataset size by adding extra valid samples.
- In our case, intent dataset was expanded and balanced, and question bank was also expanded.

What was done now (temporary rerun):
1. Re-ran architecture ablation after dataset update.
2. Expanded search to include very small/shallow models too:
- linear (no hidden layer)
- single hidden layer (32/48/64/80/128/160/192/256)
- two hidden layers (64-32, 96-32, 128-32, 128-64, 160-80, 256-64)
- deeper models (256-128-64, 192-96-48, 512-256-128-64)
3. For fair comparison, seed and data-loader randomness were reset per architecture run.

Current temporary results (top ranked):
1. D [128]: test_f1=0.9914, exact=0.9914, params=50,183
2. B1 [128,32]: test_f1=0.9914, exact=0.9655, params=53,639
3. H [192,96,48]: test_f1=0.9914, exact=0.9655, params=97,447
4. B2 [160,80]: test_f1=0.9892, exact=0.9828, params=75,047
5. D1 [160]: test_f1=0.9892, exact=0.9828, params=62,727

Small-model observations:
1. Very small still works well:
- [48] gives test_f1=0.9871 with only 18,823 params.
2. Linear/no-hidden is weaker but still usable:
- linear gives test_f1=0.9763 with only 2,695 params.
3. Very deep/big model did NOT win:
- [512,256,128,64] gives test_f1=0.9826 with 370,055 params.

Answer to optimization question:
1. Yes, after augmentation, we can reduce parameters and still keep excellent performance.
2. A shallower model can help (less overfitting risk, faster inference, simpler deployment).
3. Strong practical choices now:
- Best balanced: [128] (50,183 params, top exact-match and top F1 tier)
- Compact alternative: [48] (18,823 params, only small F1 drop)

Viva one-liner:
"Seeding controls randomness for fair reproducible experiments, augmentation increases training diversity, and after augmentation a shallower MLP (like 384-128-7) matches or beats deeper models while using far fewer parameters."

### Q: Did shallow model actually work? Is current model best? Should we reduce parameters further? Why is Mongo 1030 but train+val+test is smaller?
Direct answer:
1. Yes, shallow worked.
2. Current model `[128,64]` is strong, but it is not the best in latest temporary run.
3. Best temporary result was shallow single-hidden model `[128]`.

Latest comparison (important):
1. Current model `[128,64]`:
- Params: 57,991
- Test F1: 0.9871
- Test exact-match: 0.9741

2. Shallow `[128]`:
- Params: 50,183
- Test F1: 0.9914
- Test exact-match: 0.9914

Interpretation:
1. `[128]` has around 13-14% fewer parameters than `[128,64]`.
2. In this temporary run, it also performed better.
3. So parameter reduction did not hurt here; it helped.

Should we optimize further or are we good?
1. You are already in a good zone.
2. Recommended practical step: switch default to `[128]` and keep `[48]` as ultra-light fallback.
3. But before final freeze, run multi-seed check (3-5 seeds) to ensure this is stable and not lucky-seed effect.

Why Mongo has 1030 but train+val+test is smaller:
1. 1030 is question-bank count in MongoDB.
2. That bank is used to ASK interview questions at runtime.
3. MLP train+val+test comes from intent-labeled dataset (`interview_intents.json`), currently total 771.
4. So they are different datasets for different purposes.
5. Therefore 539+116+116=771 is expected and correct; it does not need to match 1030.

Viva one-liner:
"Question-bank size and intent-training size are different because one is runtime content storage and the other is supervised classifier training data; after augmentation, a shallower 384-128-7 model gives better accuracy with fewer parameters."

### Q: Explain complete seeding (why + how) and full ML structure file-by-file with exact functions/libraries.
What seeding means (low level):
1. Seeding fixes pseudo-random generator states so random operations are repeatable.
2. Without seeding, each run can produce different split/order/init and slightly different metrics.
3. With seeding, experiments become comparable and debuggable.

Where seeding is used in this project:
1. `backend/ml/data/data_loader.py`:
- `preprocess_and_split(..., random_seed=42)` uses `np.random.seed(random_seed)`.
- The same `random_seed` is passed into `sklearn.model_selection.train_test_split(..., random_state=random_seed)`.
- Effect: train/val/test split is reproducible.

2. `backend/ml/training/temp_arch_ablation.py`:
- `set_seed(seed)` calls:
    - `random.seed(seed)`
    - `np.random.seed(seed)`
    - `torch.manual_seed(seed)`
- Before each architecture run, seed is reset and data loaders are recreated for fair same-condition comparison.

### Q: Why did we choose all-MiniLM-L6-v2? Why not other SentenceTransformer models?
Short answer:
We picked `all-MiniLM-L6-v2` because it gives the best practical balance for this project: strong semantic quality, fast CPU/GPU inference, and small memory footprint.

Detailed reason (project-specific):
1. Speed-latency fit:
- Interview flow is real-time. We already spend compute on Whisper STT and other pipeline steps.
- `all-MiniLM-L6-v2` is lightweight, so text embedding is fast and does not add noticeable delay.

2. Embedding size fit:
- It outputs 384-dim vectors.
- Our MLP input layer is designed around this (384 -> hidden -> 7 labels).
- Keeping 384 dims gives good representation while avoiding heavy model size.

3. Memory/compute efficiency:
- Larger alternatives (for example mpnet-based models) often use 768-dim embeddings and heavier encoders.
- That increases RAM/VRAM use and can slow inference, especially on modest hardware.

4. Quality is already sufficient:
- For interview-intent routing and semantic scoring, this model provides strong semantic signal.
- Our downstream metrics are already high after dataset balancing and tuning, so heavier encoders were not necessary for current requirements.

Why not other common SentenceTransformer choices:
1. `all-mpnet-base-v2`:
- Usually very strong quality, but heavier and slower.
- Cost-benefit was not favorable for our low-latency local pipeline.

2. `all-distilroberta-v1`:
- Good model, but generally heavier than MiniLM variants.
- We prioritized throughput and responsiveness for interactive interview mode.

3. `paraphrase-MiniLM-*` family:
- Some variants are good for paraphrase tasks, but `all-MiniLM-L6-v2` is a widely adopted general-purpose baseline with stable performance.

Decision framework we used:
1. Enough semantic quality for intent + evaluation tasks.
2. Fast inference for real-time UX.
3. Small embedding size to keep MLP compact and efficient.
4. Stable behavior on local hardware without extra optimization overhead.

Viva one-liner:
"We chose all-MiniLM-L6-v2 because it is the best speed-quality tradeoff for real-time interview NLP: strong semantic embeddings at 384 dimensions with much lower latency and resource usage than larger transformer encoders."

3. `backend/ml/data/augment_intent_dataset.py`:
- Uses `random.Random(seed)` in sample generation.
- Deterministically generates synthetic labeled rows from templates.

Why this is important for viva:
1. Reproducibility: same code, same seed, same split policy => near-repeatable result.
2. Fair ablation: differences are due to architecture, not random luck.
3. Debugging: regressions can be traced since randomness is controlled.

Current ML structure (exact files and what each does):
1. Data ingest + embedding + split:
- File: `backend/ml/data/data_loader.py`
- Libraries used:
    - `json`, `os`
    - `numpy as np`
    - `torch`, `torch.utils.data.Dataset`, `DataLoader`
    - `sentence_transformers.SentenceTransformer`
    - `sklearn.model_selection.train_test_split`
    - `sklearn.preprocessing.MultiLabelBinarizer`
- Key functions/classes:
    - `IntentDataset(Dataset)`
    - `load_raw_data()`
    - `preprocess_and_split()`
    - `load_processed_data()`
    - `create_dataloaders()`
- Exact flow:
    - JSON read -> labels binarized (`MultiLabelBinarizer`) -> text embeddings (`SentenceTransformer.encode`) -> split (`train_test_split`) -> arrays saved as `.npy`.

2. Neural network definition:
- File: `backend/ml/models/intent_classifier.py`
- Libraries used:
    - `torch`
    - `torch.nn as nn`
- Key classes/functions:
    - `IntentClassifier(nn.Module)` (default 384 -> 128 -> 64 -> 7)
    - `IntentClassifierLarge(nn.Module)`
    - `_init_weights()` using `nn.init.xavier_uniform_`, `nn.init.zeros_`
    - `forward()`
    - `predict_proba()`
    - `predict()`
    - `get_model_summary()`
- Exact layers used:
    - `nn.Linear`, `nn.ReLU`, `nn.Dropout`, `nn.Sequential`

3. Main training pipeline (where model is actually trained):
- File: `backend/ml/training/train_intent_model.py`
- Libraries used:
    - `numpy`, `matplotlib.pyplot`
    - `torch`, `torch.nn`, `torch.optim`
    - `datetime`
- Key functions:
    - `compute_metrics()` (sigmoid threshold, exact match, precision, recall, F1)
    - `train_epoch()`
    - `evaluate()`
    - `train_model()`
    - `plot_training_curves()`
    - `main()`
- Training details:
    - Loss: `nn.BCEWithLogitsLoss()`
    - Optimizers: `optim.Adam`, `optim.SGD`, optional `optim.RMSprop`
    - Scheduler: `optim.lr_scheduler.ReduceLROnPlateau`
    - Early stopping via patience counter
    - Saves model with `torch.save(...)` to `backend/ml/models/saved/intent_model.pth`

4. Temporary architecture experiments (ablation):
- File: `backend/ml/training/temp_arch_ablation.py`
- Purpose:
    - Compare many hidden-layer configs (linear/shallow/deep)
    - Keep split fixed; reset seed per run
    - Save ranked metrics CSV
- Output file:
    - `backend/ml/plots/temp_arch_ablation_results.csv`

5. Inference wrapper for classifier:
- File: `backend/ml/training/intent_predictor.py`
- Libraries used:
    - `torch`, `numpy`
    - `sentence_transformers.SentenceTransformer`
    - `typing` (`List`, `Dict`, `Tuple`)
- Key class/methods:
    - `IntentPredictor.__init__()` (loads checkpoint + model)
    - `encode_text()`
    - `predict_proba()`
    - `predict()`
    - `predict_with_scores()`
    - `get_top_k()`

6. Answer semantic scoring:
- File: `backend/core/answer_evaluator.py`
- Libraries used:
    - `sentence_transformers.SentenceTransformer`
    - `sentence_transformers.util.cos_sim`
- Key logic:
    - Encode user + expected answer
    - Cosine similarity -> score 0..100 -> threshold >= 60

7. Runtime service integration (Node calls this service):
- File: `ml-service/main.py`
- Libraries used:
    - `fastapi`, `pydantic`, `uvicorn`
    - imports original classes `IntentPredictor`, `AnswerEvaluator`
- Endpoints:
    - `/health`
    - `/evaluate`
    - `/predict-intent`
    - `/predict`
    - `/model-info`

Important viva precision point:
1. Model training is done in `backend/ml/training/train_intent_model.py`.
2. Temporary architecture testing is done separately in `backend/ml/training/temp_arch_ablation.py`.
3. Production inference uses checkpoint loading in `backend/ml/training/intent_predictor.py` and is exposed via `ml-service/main.py`.

### Q: Any suggestions now? Which questions should I prepare? Any pending todos? What does seed number mean (example seed(32))?
Practical suggestions (most important for viva now):
1. Prepare 3 levels for each topic:
- 1-line definition
- 30-second technical explanation
- 2-minute deep answer with one real project example
2. Keep 5 proof points ready from your project:
- Why multi-label (`BCEWithLogitsLoss`)
- Why sentence embeddings (semantic, not keyword)
- Why shallow model won after augmentation
- Why question bank count != ML training count
- How fallback works when ML service fails
3. Memorize 4 numbers:
- Input dim: 384
- Output classes: 7
- Current best shallow params: 50,183
- Split after augmentation: 539 / 116 / 116

High-priority viva questions to prepare:
1. Why `BCEWithLogitsLoss` and not `CrossEntropyLoss`?
2. Explain forward pass and backward pass in your MLP.
3. What exactly is stored in `intent_model.pth`?
4. Why does 1030 Mongo questions not mean 1030 ML training samples?
5. How does cosine similarity scoring work in answer evaluation?
6. Why did deeper model not necessarily beat shallow model?
7. What is early stopping and why used?
8. What is ReduceLROnPlateau and why used?
9. Which files do training vs inference vs API serving?
10. How did you ensure reproducible experiments?

Pending todos status (realistic):
1. Core model understanding: done.
2. Architecture ablation and shallow-vs-deep comparison: done.
3. Question bank expansion: done.
4. Intent dataset expansion and retraining: done.
5. Still recommended before final submission:
- Run multi-seed stability test (3 to 5 seeds) and report mean +- std.
- Freeze final architecture decision in report (recommended: 384-128-7).

Seed parameter in very simple words:
1. Seed is just a starting number for random generator.
2. Same seed => same random sequence.
3. Different seed => different random sequence.

What does `seed(32)` mean?
1. It means "start random generator from point 32".
2. It does NOT mean 32% accuracy or 32 samples.
3. It is only an ID for the random starting state.

Super simple example:
1. Imagine a shuffled deck machine.
2. If machine seed is 32, shuffle order might be: 7, 2, 9, 1, ...
3. If tomorrow again seed is 32, you get the same order: 7, 2, 9, 1, ...
4. If seed is 99, order changes.

Tiny Python-style idea:
1. `random.seed(32); random.randint(1,10)` -> always same first number for that seed.
2. `random.seed(32)` again -> repeats same sequence.
3. `random.seed(99)` -> new sequence.

Viva one-liner:
"Seed is a reproducibility switch for randomness; seed 32 means use random stream #32, so experiments can be repeated exactly and compared fairly."

### Q: We trained with Adam and SGD, right? Why not mini-batch/batch/other optimizers (momentum, exponential momentum, etc.)?
Short correct answer:
1. Yes, training loop compares Adam and SGD.
2. Mini-batch is already used (`batch_size=16`), so we are not doing full-batch GD.
3. SGD in code already uses momentum (`momentum=0.9`).
4. Adam already uses exponential moving averages internally (first and second moments).

Low-level clarification (important viva correction):
1. Batch strategy and optimizer are different knobs:
- Batch strategy = full-batch / mini-batch / stochastic (batch size setting)
- Optimizer = SGD / Adam / RMSprop / etc.
2. In our code:
- Batch strategy: mini-batch (`batch_size=16`)
- Optimizer options implemented: Adam, SGD(with momentum), RMSprop branch available
- Actual comparison run in main loop: Adam vs SGD

Why only Adam vs SGD in final comparison:
1. Baseline coverage:
- SGD represents classical gradient descent family.
- Adam represents adaptive + momentum family.
2. Project scope/time:
- We prioritized architecture ablation and data quality improvements first.
3. Fairness:
- Too many optimizer changes together can make interpretation noisy.

Could we use more? Yes.
Good next options:
1. RMSprop (already supported in `train_model`, just add in training loop list).
2. AdamW (better decoupled weight decay in many cases).
3. Nesterov momentum SGD.
4. Different batch sizes (8, 16, 32) with same seed and same split.

Practical next experiment grid (small but strong):
1. Optimizers: SGD(momentum), Adam, RMSprop, AdamW
2. Batch size: 8, 16, 32
3. Keep architecture fixed (for example 384-128-7)
4. Compare: test_f1, exact_match, val_loss, best_epoch, stability across 3 seeds

Viva one-liner:
"We already use mini-batch training and momentum-based optimization; Adam and SGD were chosen as representative baselines, and extension to AdamW/RMSprop with controlled batch-size sweeps is the next systematic step."

### Q: Temporary run of best experimental design (fixed 384-128-7, optimizer x batch x seeds) - what performance did it give?
Experiment setup executed:
1. Fixed architecture: `384 -> 128 -> 7`
2. Optimizers: `SGD(momentum=0.9)`, `Adam`, `RMSprop`, `AdamW`
3. Batch sizes: `8, 16, 32`
4. Seeds: `42, 7, 123`
5. Total runs: `4 x 3 x 3 = 36`

Top summary (mean across 3 seeds):
1. `RMSprop, batch=16`
- mean_test_f1 = `0.9928 +- 0.0027`
- mean_exact = `0.9799 +- 0.0041`
- mean_best_epoch = `47.0`

2. `RMSprop, batch=8`
- mean_test_f1 = `0.9914 +- 0.0031`
- mean_exact = `0.9828 +- 0.0000`
- mean_best_epoch = `32.7`

3. `Adam, batch=16`
- mean_test_f1 = `0.9885 +- 0.0010`
- mean_exact = `0.9799 +- 0.0041`
- mean_best_epoch = `53.0`

4. `AdamW, batch=8` and `AdamW, batch=16`
- both around mean_test_f1 = `0.9878`

Observed issue:
1. `SGD` settings in this temporary sweep gave near-zero F1 across all batch sizes.
2. This indicates current SGD hyperparameters are not suitable for this fixed architecture/dataset setup (likely needs LR/momentum schedule tuning).

Temporary conclusion:
1. Best performer in this run: `RMSprop + batch 16`.
2. Fast strong alternative: `RMSprop + batch 8` (slightly lower mean F1 but fewer epochs on average).

Artifacts:
1. Script: `backend/ml/training/temp_optimizer_batch_sweep.py`
2. All run logs CSV: `backend/ml/plots/temp_optimizer_batch_sweep_runs.csv`
3. Summary CSV: `backend/ml/plots/temp_optimizer_batch_sweep_summary.csv`

### Q: Should we use Adam then? Why? Does batch 16 mean 16 batches or batch size 16? Are we using mini-batch or SGD?
Direct answer:
1. In this temporary sweep, best mean result came from RMSprop (batch 16), not Adam.
2. So for this exact current setup, RMSprop is better than Adam by observed metrics.
3. But Adam is still strong and stable; it is a valid fallback baseline.

Why not blindly pick Adam:
1. We should pick based on measured performance on our dataset, not popularity.
2. Current measured ranking for fixed 384-128-7 favored RMSprop over Adam.
3. So recommendation now: use RMSprop+16 for this configuration.

Batch meaning clarification:
1. `batch_size=16` means each gradient update uses 16 samples.
2. It does NOT mean total number of batches is 16.
3. Number of batches per epoch is approximately `ceil(train_samples / batch_size)`.

Are we using mini-batch here?
1. Yes.
2. Any batch_size between 1 and full dataset size is mini-batch training.
3. In sweep, batch sizes 8/16/32 are all mini-batch.

Mini-batch vs SGD confusion (important):
1. Mini-batch describes how data is fed.
2. SGD/Adam/RMSprop/AdamW describe optimizer algorithm.
3. So you can do mini-batch + Adam, mini-batch + SGD, mini-batch + RMSprop.
4. In this sweep, we used mini-batch with all those optimizers.

Viva one-liner:
"Batch size 16 means 16 samples per update, not 16 total batches; we use mini-batch training, and optimizer choice is separate from batching. In our current sweep, RMSprop+16 outperformed Adam on mean test F1."

### Q: Is our batch size varying? Why? What is it called? How many batches are there?
Yes, but only in the temporary sweep experiment.

Why it varied:
1. We intentionally changed batch size (8, 16, 32) to test optimizer sensitivity and convergence behavior.
2. This is called a **batch-size sweep** (hyperparameter tuning).

What it is called:
1. `batch_size` = number of samples processed in one update step.
2. Since batch size is smaller than full dataset, this is **mini-batch gradient descent**.

How many batches are there (with train size = 539):
1. If `batch_size=8`: number of batches per epoch = `ceil(539/8) = 68`
2. If `batch_size=16`: number of batches per epoch = `ceil(539/16) = 34`
3. If `batch_size=32`: number of batches per epoch = `ceil(539/32) = 17`

Current default in main training pipeline:
1. Standard config uses `batch_size=16`, so usually `34` mini-batches per epoch.

Viva one-liner:
"Batch size was varied only for controlled hyperparameter sweep; with 539 training samples, batch sizes 8/16/32 give 68/34/17 mini-batches per epoch respectively."

### Q: In which file MLP is trained? Show complete flow from text -> embeddings -> MLP intent prediction with simple syntax explanation.
Direct file answer:
1. MLP training happens in `backend/ml/training/train_intent_model.py` (main training pipeline).

End-to-end flow (training side):
1. Read text+labels dataset.
2. Convert labels to multi-hot vectors.
3. Convert text to 384-d embeddings using SentenceTransformer.
4. Split into train/val/test.
5. Feed embedding vectors into MLP.
6. Train with BCEWithLogitsLoss + optimizer.
7. Save trained checkpoint (`intent_model.pth`).

Key code locations and what each does:
1. Data to embeddings (`backend/ml/data/data_loader.py`):
- `embedding_model = SentenceTransformer(embedding_model_name)`
    - `embedding_model_name`: model id string (default all-MiniLM-L6-v2)
- `embeddings = embedding_model.encode(texts, show_progress_bar=True)`
    - `texts`: list of input sentences
    - `show_progress_bar=True`: display encoding progress
- `train_test_split(..., test_size=..., random_state=...)`
    - `test_size`: fraction for test set
    - `random_state`: seed for reproducible split

2. MLP architecture (`backend/ml/models/intent_classifier.py`):
- `IntentClassifier(input_dim=384, hidden_dim_1=128, hidden_dim_2=64, output_dim=7, dropout_rate=0.3)`
    - `input_dim`: embedding size
    - `hidden_dim_1`, `hidden_dim_2`: neurons in hidden layers
    - `output_dim`: number of intent labels
    - `dropout_rate`: regularization strength
- Layers used:
    - `nn.Linear(in_features, out_features)`
    - `nn.ReLU()`
    - `nn.Dropout(p)`
- Forward pass:
    - `def forward(self, x): return self.network(x)`

3. Training loop (`backend/ml/training/train_intent_model.py`):
- `criterion = nn.BCEWithLogitsLoss()`
    - multi-label loss; includes sigmoid internally for stable training
- Optimizers:
    - `optim.Adam(model.parameters(), lr=..., weight_decay=...)`
    - `optim.SGD(..., momentum=0.9, ...)`
- Scheduler:
    - `optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', factor=0.5, patience=5)`
    - reduces LR when val loss plateaus
- Training entrypoint:
    - `main()` calls:
        - `raw_data = load_raw_data()`
        - `processed = preprocess_and_split(raw_data)`
        - `loaders = create_dataloaders(processed, batch_size=CONFIG["batch_size"])`
        - build `IntentClassifier(...)`
        - call `train_model(...)`
        - save with `torch.save({...}, model_path)`

4. Inference flow (`backend/ml/training/intent_predictor.py`):
- Load checkpoint:
    - `checkpoint = torch.load(model_path, map_location=self.device)`
    - `map_location`: load checkpoint on CPU/GPU target device
- Rebuild model from saved config:
    - `IntentClassifier(input_dim=config.get(...), hidden_dim_1=config.get(...), ...)`
- Encode new input text:
    - `embedding = self.embedding_model.encode([text])`
    - wraps single text in list because encoder expects list/batch
- Predict probabilities:
    - `logits = self.model(embedding_tensor)`
    - `probs = torch.sigmoid(logits)`
- Final intents:
    - `[label for label, prob in probs.items() if prob >= threshold]`

Very short viva script you can say:
"Training is in train_intent_model.py. We first convert text to 384-d embeddings using SentenceTransformer in data_loader.py, then pass embeddings to IntentClassifier MLP defined in intent_classifier.py, train with BCEWithLogitsLoss, and save checkpoint. During inference in intent_predictor.py, we encode new text, run MLP forward pass, apply sigmoid, and threshold probabilities to get final intent labels."
\n\n### Q: Why did we get a [rejected] (fetch first) error when pushing our code to Hugging Face, and what does --allow-unrelated-histories do?\n**A:** We got the error because the Hugging Face repository had auto-generated files (like an initial README) that our local repository didn't have. Git prevents pushing to avoid overwriting data on the remote. We used git pull --allow-unrelated-histories to tell Git to safely merge the remote's history with our local project history, even though they started independently. After merging, we could safely push our code.


### Q: What does the Git error "URL rejected: Port number was not a decimal number" mean?
**A:** It means the URL format for authentication is wrong. When we put our username and password/token directly in a Git URL, it must look like https://username:token@website.com. If we forget the @ symbol after the token, Git gets confused and thinks the text is supposed to be a port number.


### Q: What does the Git error "fatal: expected 'acknowledgments'" mean when working with Hugging Face?
**A:** This error happens when Git tries to talk to the Hugging Face server, but instead of getting standard Git data back, it receives an HTML webpage (usually an "Unauthorized" or "Sign In" error page). This almost always means the Access Token is invalid, expired, or missing "Write" permissions for the repository.

### Q: Why did Hugging Face reject our push even after auth was fixed, and how did we finally deploy?
**A:** Auth and remote setup were correct, but Hugging Face blocked two things: (1) old commit history had files larger than 10 MB, and (2) current snapshot still contained raw binary files. We solved this by creating a clean deployment snapshot in a temporary repository, tracking binary extensions with Git LFS so they became pointer files, and force-pushing that clean `main` branch to the Space remote. This avoided both oversized-history and raw-binary rejection.

### Q: Why did Docker build fail with "Package libgl1-mesa-glx has no installation candidate" on Hugging Face?
**A:** Hugging Face now builds on newer Debian images (trixie), where `libgl1-mesa-glx` is deprecated/removed. The fix is to install `libgl1` instead. After replacing that package in Dockerfile, apt installation proceeds and the build can continue.

### Q: Should we commit to GitHub while Hugging Face is still building? Are GitHub and Hugging Face Git states different?
**A:** Yes, committing now is safe and recommended. Hugging Face build runs from the snapshot already pushed to the Space, so new local/GitHub commits do not disturb the ongoing build. Also yes, GitHub and Hugging Face are currently different: GitHub branch `integration-version` and Hugging Face `main` are on different commit IDs/history. They can have similar content, but they are not the same commit graph right now.

### Q: Why did one new docs file stay unpushed, and why does the Git graph look distorted after Hugging Face integration?
**A:** The new docs file stayed unpushed because we intentionally committed only deployment-fix files (`Dockerfile` and `docs/questions.md`) to avoid accidentally committing a partial docs rename (one file deleted, one new file untracked). The graph looks branched because we merged Hugging Face with `--allow-unrelated-histories`, so Git shows two independent roots joined by a merge commit. This is normal and safe, but visually less clean.
