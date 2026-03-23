# Counter-Questioning & Adaptive Logic: Analysis & Solution

## 1. Current Progress
We have successfully implemented **Phase 1 (The Brain)** and **Phase 2 (The Flow)**. 
- **The Brain**: Classification of intents/skills is working.
- **The Flow**: We have a **Zero-Latency Async Architecture**. The system records audio, immediately queues it for background processing (Whisper + Grading), and instantly asks the next question to prevent awkward silence.

## 2. The Problem with Current Model
While the async architecture solves latency, it introduces a "Context Disconnect":

1.  **Blind Questioning**: The Main Thread asks `Q(n+1)` *immediately* after the user finishes answering `Q(n)`. At this exact moment, the transcription of `A(n)` usually hasn't finished. The bot effectively ignores what the user just said and picks a random question from the bank.
2.  **Lack of Adaptiveness**: 
    - It iterates strictly 5 times per topic (`QUESTIONS_PER_TOPIC`).
    - It pulls from a **static** `QUESTION_REPO` without checking if the question makes sense in context.
    - If the user pivots (e.g., "I generally use React Hooks"), the bot misses this keyword because it's determined to ask 5 random React questions.
3.  **The "Tell Me More" Loop**: If the topic isn't found or mapped correctly, the fallback mechanism (`get_unique_question`) defaults to "Tell me more about what you know," leading to a repetitive and confused loop if the user tries to exit or provide a non-standard answer.
4.  **No Graceful Exit**: If the user says "I don't know more" or "That's it," the bot treats it as a wrong answer or generic input and continues the interrogation.

## 3. Example of Desired Flow (The Goal)

Here is the exact interaction we want to achieve, with a breakdown of what the bot is doing behind the scenes.

**The Dialogue:**

> **Bot**: "What do you know about React?"
>
> **Candidate**: "I mostly work with functional components and I use hooks like useState a lot."
> *(Transcription is running in background... taking 2-3 seconds)*
>
> **Bot (Immediate)**: "Okay. Tell me about the Virtual DOM."
> *(Bot couldn't wait, so it asked a safe fallback question)*
>
> **Candidate**: "It updates only changed nodes."
>
> **Bot (Adaptive)**: "Going back to what you mentioned earlier about **Hooks**... can you explain how `useEffect` works compared to lifecycle methods?"
> *(Bot now knows about 'Hooks' because the background task finished)*

**The "Background Steps" (Simple Language):**

1.  **User Speaks**: The user mentions "Hooks" in Answer 1.
2.  **Bot Listens**: The Main Thread records the audio and immediately puts it in a "Todo Box" (Queue).
3.  **Bot Keeps Talking**: The Main Thread cannot wait for the Todo Box to be processed (it takes too long). So, it picks a "Safe Question" (Virtual DOM) and asks it immediately to keep the conversation flow smooth.
4.  **Worker Wakes Up**: Meanwhile, a Background Worker picks up the audio from the Todo Box.
5.  **Worker Reads**: It converts the audio to text: "...use hooks like useState...".
6.  **Worker Finds Keywords**: It spots the word "Hooks". It tells the Main Thread: *"Hey! The user knows about Hooks! Ask about that next!"*
7.  **Bot Adapts**: When it's time to ask Question 3, the Main Thread checks its notes. It sees the note about "Hooks". Instead of picking a random question, it picks a specific question about Hooks.

## 4. Proposed Solution: The "Lagged Adaptive Priority Queue"

To solve this we will use a "Listen while Speaking" approach. Since we cannot process the *immediate* answer in 0ms, we use the results of `Answer(n)` to influence `Question(n+2)`.

### A. The "Context State" (The Memory)
We introduce a shared state object that tracks the **Conversation Context**:

```python
class InterviewContext:
    def __init__(self):
        self.current_topic = "Java"
        self.extracted_keywords = queue.PriorityQueue() # Priority: (Relevance, Keyword)
        self.last_score = 0
        self.stop_signal = False # If user wants to stop
```

### B. Logic Enhancement 1: Dynamic Keyword Extraction (No Manual Tagging)
Instead of rewriting the Question Bank manually, we use **Inverted Indexing** at startup to map Keywords -> Questions.
1.  **Startup**: Scan `QUESTION_REPO`. Build map: `Key -> [Questions]`.
2.  **Runtime**: 
    - Transcribe user audio.
    - Match text against Index. 
    - Push matches to `extracted_keywords` queue.

### C. Logic Enhancement 2: Score-Based Branching
We will adapt to the candidate's competence level.
1.  **Expert (>80 score)**: Drill Down.
    -   Bot says: "You seem confident with {keyword}. Let's go deeper..."
    -   Action: Ask harder Qs on same topic.
2.  **Novice (<40 score)**: Pivot.
    -   Bot says: "Okay. Let's look at a different aspect of {current_topic}..."
    -   Action: Ask Qs from different sub-topic.

### D. Logic Enhancement 3: Natural Transitions & Early Exit
1.  **Stop Signal Check**: 
    -   If user says "I don't know", "That's it", "Stop".
    -   **Immediate Action**: Stop asking questions for this topic. Iterate to next topic or Generate Report.
    -   **Feedback**: Early exit triggers the final report generation immediately so the user gets their feedback ("fine, here is your feedback...").

2.  **Transition Templates**:
    -   "You mentioned **{keyword}** earlier..."
    -   "Moving on since that seems covered..."

### Step-by-Step Implementation Plan

1.  **Update `question_bank.py`**:
    -   Add `build_keyword_index()` to auto-generate tags.
    -   Add `COMMON_KEYWORDS` list to ignore common stopwords.

2.  **Update `InterviewController.py`**:
    -   Add `self.context` state.
    -   **Background Thread**: Extract keywords + Detect Stop signal -> Update State.
    -   **Main Thread (`get_next_question`)**:
        -   Check Stop Signal -> Break Loop.
        -   Check Keywords -> Ask Contextual Q.
        -   Empty Queue -> Ask Random Q.

3.  **Refine Fallback**:
    -   Replace the infinite "Tell me more" loop with a strict limit or a graceful "Let's move to the next topic" transition.
