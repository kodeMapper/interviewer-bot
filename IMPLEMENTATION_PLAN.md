# Detailed Implementation Plan: AI Smart Interviewer

This document outlines the step-by-step roadmap to transform the current voice bot into a Deep Learning-based Interviewer and Proctoring system.

## Phase 1: The "Interviewer Brain" (Adaptive Questioning MLP)
**Goal:** Replace hardcoded question lists with a Neural Network that predicts the next topic based on student responses.
**Syllabus Coverage:** Modules 1, 2, 3 (MLPs, Optimization, Backpropagation).

### Step 1.1: Dataset Engineering
*   **Action:** Create a JSON/CSV file containing "Intent" data.
*   **Structure (Multi-Label):**
    *   `text`: "I have worked with relational databases like MySQL." -> `label`: ["SQL"]
    *   `text`: "I prefer NoSQL like MongoDB." -> `label`: ["NoSQL"]
    *   **Mixed Concepts:** `text`: "I use React for frontend and Python for backend." -> `label`: ["React", "Python"]
    *   *Why?* Real candidates often bridge topics. This label structure allows the model to learn relationships between technologies.
*   **Plan:** We will use a synthesized dataset with ~175 examples, including specific cases for comparative answers.

### Step 1.2: Text Preprocessing & Vectorization
*   **Industry Standard:** Use BERT embeddings (Transformers).
*   **Our Approach:** We will use `Sentence-Transformers` (already installed) to convert text into fixed-size vectors (384 dimensions). This is the input features for our MLP.

### Step 1.3: Building the Neural Network (PyTorch)
*   **Action:** Write a Python class `IntentClassifier(nn.Module)`.
*   **Architecture:**
    *   Input Layer: Size 384 (Vector size from Sentence-Transformers).
    *   Hidden Layer 1: Size 128 + ReLU Activation (Module 2).
    *   Hidden Layer 2: Size 64 + ReLU.
    *   **Output Layer:** Size N (Number of Topics).
    *   **Activation Strategy:** To support Mixed Concepts (e.g., Java + SQL), we will use **Sigmoid** activation on the output layer (instead of Softmax) to allow selecting multiple topics simultaneously (Multi-label classification).

### Step 1.4: The Training Loop (Module 3)
*   **Action:** Write a generic training function.
*   **Components:**
    *   **Loss Function:** `CrossEntropyLoss` (Standard for classification).
    *   **Optimizer:** We will compare `SGD` (Stochastic Gradient Descent) vs `Adam` to see which converges faster (Syllabus Module 3).
*   **Result:** A saved model file (`intent_model.pth`).

### Step 1.5: Inference Engine
*   **Action:** Update `ai_interviewer_backend.py`.
*   **Logic:**
    1.  User speaks -> Whisper transcribes.
    2.  Vectorize transcript.
    3.  Pass to MLP Model -> Get predicted Topic.
    4.  Select a question from that Topic bucket.

---

## Phase 2: The "Proctoring Eye" (Computer Vision CNN)
**Goal:** Detect if the candidate is looking away or if multiple people are in the frame.
**Syllabus Coverage:** Modules 4, 6 (CNNs, Regularization).

### Step 2.1: Data Collection Script
*   **Action:** Write a simple OpenAI/CV2 script (`capture_faces.py`).
*   **Process:**
    *   User sits in front of webcam.
    *   Press '1' -> Save crop of face as "Looking_Center".
    *   Look away -> Press '2' -> Save crop of face as "Looking_Away".
    *   Target: 100 images per class.

### Step 2.2: Building the CNN (PyTorch)
*   **Action:** Define `ProctorCNN` class.
*   **Architecture (LeNet Inspired):**
    *   `Conv2d` (32 filters) -> `ReLU` -> `MaxPool2d`.
    *   `Conv2d` (64 filters) -> `ReLU` -> `MaxPool2d`.
    *   `Dropout(0.5)` (Syllabus Module 6 - Regularization).
    *   `Linear` (Dense) layers for final binary classification (0 or 1).

### Step 2.3: Training & Visualization
*   **Action:** Train on the captured images.
*   **Deliverable:** Plot Training Loss vs Validation Loss graphs (to show "Overfitting" concepts).

### Step 2.4: Real-time Integration
*   **Action:** Create `proctoring_module.py`.
*   **Logic:**
    *   Runs in a separate thread.
    *   Captures frame every 1 second.
    *   Runs model inference.
    *   If "Looking_Away" > 3 consecutive times -> Signal Backend to "Pause Interview" & Speak Warning.

---

## Phase 3: Industry-Standard Enhancements (Bonus)
**Goal:** Add "Resume-worthy" features that are easy to implement but impressive.

### Step 3.1: Emotion Analysis (Multimodal Feed)
*   **Concept:** Industry tools measure "Confidence".
*   **Implementation:** Use the `DeepFace` library (Open Source).
*   **Integration:** While the CNN checks "Gaze", `DeepFace` checks "Emotion" (Happy, Fear, Neutral).
*   **Output:** "Candidate answered correctly but seemed nervous (Fear detected)."

### Step 3.2: Retrieval Augmented Generation (RAG) - Future Plan
*   **Concept:** Instead of hardcoded questions, fetch them from a PDF (Resume/Syllabus).
*   **Plan:** Use `LangChain` to read a PDF, chunk it, store in a Vector DB (ChromaDB), and query it using the MLP's intent output.

---

## Resources & Tools

### Required Libraries (We will install these)
*   **PyTorch (`torch`)**: For building MLPs and CNNs (The core Deep Learning framework).
*   **OpenCV (`opencv-python`)**: For image capturing and processing.
*   **Matplotlib**: For plotting training graphs (Loss/Accuracy).

### Datasets (External Options)
If we decide to scale up, we can use these industry-standard datasets:

1.  **StackSample (10% of Stack Overflow)**
    *   **Content:** Questions, Answers, and Tags (e.g., `python`, `sql`).
    *   **Usage:** Train the model to predict the "Tag" based on the "Question Body".
    *   **Link:** [Kaggle - StackSample](https://www.kaggle.com/datasets/stackoverflow/stacksample)
2.  **60k Stack Overflow Questions**
    *   **Content:** High-quality questions with quality ratings.
    *   **Usage:** Use "Quality" ratings to filter out bad training examples.
    *   **Link:** [Kaggle - 60k Stack Overflow](https://www.kaggle.com/datasets/imoore/60k-stack-overflow-questions-with-quality-rating)
3.  **CodeSearchNet**
    *   **Content:** Code functions paired with documentation comments.
    *   **Usage:** Good for mapping "Technical Explanations" (Docs) to "Code Concepts" (Function names).
    *   **Link:** [Hugging Face - CodeSearchNet](https://huggingface.co/datasets/code_search_net)
4.  **Ubuntu Dialogue Corpus**
    *   **Content:** Multi-turn technical support chat logs.
    *   **Usage:** Useful if we want to build a "Chatbot" that remembers context over many turns.
    *   **Link:** [Kaggle - Ubuntu Dialogue](https://www.kaggle.com/datasets/rtatman/ubuntu-dialogue-corpus)
5.  **Software Engineering Question Classification**
    *   **Content:** Questions labeled by intent (e.g., "How-to", "Debug", "Conceptual").
    *   **Usage:** To classify if a user is asking for help or explaining a concept.
    *   **Link:** [Mendeley Data](https://data.mendeley.com/datasets/86228kw92j/1)

### Why Synthetic Data? (The "Pro Move")
For this specific academic project, we will generate our own focused dataset using LLMs (ChatGPT).

*   **Precision vs. Noise:** Real datasets (like StackOverflow) have thousands of tags (`regex`, `pandas`, `css`, `legacy-code`). We only want to test **3 specific topics** (Java, Python, SQL). Using real data would require massive filtering and cleaning.
*   **The Overfitting "Feature":** You asked if small data causes *underfitting*. Actually, small data usually causes **Overfitting** (the model memorizes the examples).
    *   **Academic Benefit:** This effectively demonstrates **Module 6 (Regularization)**. We *expect* the model to overfit initially. Then, we apply **Dropout** and **Data Augmentation** (synonym replacement) to fix it. This "Problem -> Solution" narrative is exactly what professors look for.
*   **Pattern Repetition:** To avoid AI repeating the same patterns, we will prompt it specifically: *"Generate 50 variations using bad grammar, short slang, and technical jargon."* This mimics real students better than polished StackOverflow questions.

### Strategy for Success with Synthetic Data
To ensure our small synthetic dataset yields high-quality results and avoids the pitfalls of "toy data," we will employ the following strategy:
1.  **Start with Overfitting:** We will intentionally train a model that achieves 100% accuracy on our small training set. This proves the network *can* learn the patterns (Module 2).
2.  **Apply Regularization (Module 6):** Once overfitted, we will introduce **Dropout layers** and **L2 Regularization** to the Training Loop. We will observe how this lowers the training accuracy slightly but improves validation accuracy, preventing the model from just memorizing the "Chatbot generated" phrases.
3.  **Iterative Augmentation:** If the model fails on a specific type of sentence (e.g., "I dunno Java"), we will generate 20 more examples specifically targeting that weakness and retrain. This "Active Learning" cycle is far more efficient than evaluating a massive generic dataset.

### Prompt for Dataset Generation (Data Augmentation)
Use the following prompt with ChatGPT/LLM to generate the `interview_intents.json`. It explicitly uses Data Augmentation techniques (Noise, Synonym Replacement, Style Transfer) to ensure diversity.

> **Prompt:**
> "I am building an NLP classifier for a technical interview bot. I need a dataset of 100 user responses categorized by their technical topic.
>
> Please generate a JSON list of objects with specific fields: `text` (the user's answer) and `label` (the topic).
>
> **Topics to cover:**
> - `Java` (Core, OOP, collections)
> - `Python` (Scripting, libraries, syntax)
> - `JavaScript` (ES6, changes, async)
> - `React` (Hooks, components, state)
> - `SQL` (Queries, joins, normalization)
> - `Machine_Learning` (Regression, clustering, models)
> - `Deep_Learning` (Neural networks, backprop, bias/variance)
>
> **CRITICAL: Apply Data Augmentation Techniques (Module 6) to the `text` field:**
> 1.  **Style Transfer:** Write 30% of answers as a **nervous beginner** (e.g., 'Umm, I think Java is OOP...'), 30% as an **arrogant expert** (short, concise), and 40% as **standard**.
> 2.  **Noise Injection:** Randomly remove correct punctuation, use lowercase 'i', or add filler words like 'uh', 'like', 'basically'.
> 3.  **Synonym Replacement:** Do not just use the word 'use'. Swap with 'utilize', 'work with', 'coded in', 'built stuff with'.
> 4.  **Imbalanced Length:** Make some answers very short (2 words) and some long (2 sentences).
>
> **Example Output Format:**
> ```json
> [
>   {"text": "basically java is object oriented stuff", "label": "Java"},
>   {"text": "I utilize useEffect for side effects in functional components", "label": "React"},
>   {"text": "back prop is used to update weights", "label": "Deep_Learning"},
>   {"text": "select star from tables where id = 1", "label": "SQL"}
> ]
> ```
> Generate 20 distinct examples for EACH topic (Total ~140 rows)."

### Learning Resources
*   **Neural Networks (Module 1/2):** 3Blue1Brown Neural Network Series (YouTube).
*   **Backpropagation (Module 2):** Andrej Karpathy's "Micrograd" video (YouTube).
*   **CNNs (Module 4):** Stanford CS231n notes.

## Execution Strategy
1.  **Start Small:** We will begin with Phase 1 (The MLP Text Classifier). It requires no webcam, just code.
2.  **Iterate:** Once the "Brain" works, we add the "eyes" (Phase 2).
3.  **Finalize:** Connect the two with the existing Audio system.
