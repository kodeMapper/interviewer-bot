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
