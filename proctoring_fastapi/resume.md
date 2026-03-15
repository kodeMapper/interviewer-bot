# Phase 2.75: Resume Upload & Dynamic Question Generation

## Technical Implementation Document
### AI Smart Interviewer - Resume-Based Adaptive Questioning System

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Component Deep Dive](#3-component-deep-dive)
4. [Async Flow & Race Condition Resolution](#4-async-flow--race-condition-resolution)
5. [API Integration Strategy](#5-api-integration-strategy)
6. [Data Flow & State Management](#6-data-flow--state-management)
7. [Confidence Score Algorithm](#7-confidence-score-algorithm)
8. [Error Handling & Resilience](#8-error-handling--resilience)
9. [Module Structure](#9-module-structure)
10. [Implementation Phases](#10-implementation-phases)
11. [Testing Strategy](#11-testing-strategy)
12. [Performance Considerations](#12-performance-considerations)

---

## 1. Executive Summary

### 1.1 Objective
Introduce a **Resume Upload** functionality that extracts candidate information and dynamically generates personalized interview questions using ChatGPT API, while maintaining the existing zero-latency async architecture.

### 1.2 Core User Flow
```
┌─────────────┐    ┌───────────────┐    ┌──────────────┐    ┌────────────────┐
│  Upload     │───▶│  Text         │───▶│  GPT API     │───▶│  Resume        │
│  Resume     │    │  Extraction   │    │  Question    │    │  Question      │
│  (PDF/DOCX) │    │  (PyMuPDF)    │    │  Framing     │    │  Bank Created  │
└─────────────┘    └───────────────┘    └──────────────┘    └────────────────┘
                          │                    │
                          ▼                    ▼
                   ┌──────────────────────────────────────┐
                   │  PARALLEL: Bot asks intro questions  │
                   │  using LOCAL question bank (fallback)│
                   └──────────────────────────────────────┘
```

### 1.3 Key Challenges & Solutions

| Challenge | Impact | Solution |
|-----------|--------|----------|
| GPT API latency (2-5s) | Awkward silence | Parallel processing - ask local questions while GPT generates |
| Race conditions | Duplicate questions, state corruption | Priority queues + mutex locks + state flags |
| Thin resumes | Poor question quality | Intelligent fallback to existing question bank |
| Adaptive questioning collision | Counter-questions conflicting with resume flow | Unified priority system with source tagging |

---

## 2. System Architecture Overview

### 2.1 High-Level Architecture
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Web/Desktop)                             │
│  ┌──────────────┐  ┌──────────────────┐  ┌────────────────────────────────────┐ │
│  │ Resume Upload│  │ Audio Recording  │  │ Real-time Feedback Display         │ │
│  └──────────────┘  └──────────────────┘  └────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (Python)                                    │
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                         InterviewController (V5)                          │  │
│  │   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │  │
│  │   │ Resume Manager  │  │ Question Router │  │ State Machine   │          │  │
│  │   │ (New Module)    │  │ (Priority Queue)│  │ (Extended)      │          │  │
│  │   └─────────────────┘  └─────────────────┘  └─────────────────┘          │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌────────────────────┐  ┌───────────────────┐  ┌─────────────────────────┐    │
│  │ resume/             │  │ core/             │  │ ml/                     │    │
│  │  ├── extractor.py  │  │  ├── interview_   │  │  ├── intent_classifier │    │
│  │  ├── parser.py     │  │  │    controller  │  │  ├── confidence_scorer │    │
│  │  ├── gpt_client.py │  │  ├── question_    │  │  └── (existing)        │    │
│  │  └── question_gen. │  │  │    bank.py     │  │                         │    │
│  │       py           │  │  └── answer_      │  │                         │    │
│  └────────────────────┘  │       evaluator   │  └─────────────────────────┘    │
│                          └───────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────┐
                    │       External Services             │
                    │  ┌─────────────┐  ┌─────────────┐  │
                    │  │ OpenAI API  │  │ Whisper STT │  │
                    │  │ (GPT-4)     │  │ (Local)     │  │
                    │  └─────────────┘  └─────────────┘  │
                    └─────────────────────────────────────┘
```

### 2.2 Thread Model
```
┌─────────────────────────────────────────────────────────────────────────┐
│                           THREAD ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   MAIN THREAD (UI/TTS/Recording)                                         │
│   ├── User Interaction                                                   │
│   ├── TTS Output (Speak)                                                 │
│   ├── Audio Recording (Listen)                                           │
│   └── State Transitions                                                  │
│                                                                          │
│   BACKGROUND THREAD 1 (Transcription Worker) [EXISTING]                 │
│   ├── Whisper Inference                                                  │
│   ├── Answer Evaluation                                                  │
│   ├── Keyword Extraction (Adaptive)                                      │
│   └── Report Card Updates                                                │
│                                                                          │
│   BACKGROUND THREAD 2 (Resume Processor) [NEW]                          │
│   ├── PDF/DOCX Text Extraction                                           │
│   ├── GPT API Call (Question Generation)                                 │
│   ├── Question Parsing & Validation                                      │
│   └── Resume Question Bank Population                                    │
│                                                                          │
│   SHARED STATE (Thread-Safe)                                             │
│   ├── processing_queue (audio tasks)                                     │
│   ├── resume_questions_queue (generated Qs)                              │
│   ├── context_keywords (adaptive follow-up)                              │
│   ├── state_flags (is_resume_ready, stop_signal, etc.)                   │
│   └── report_card (final results)                                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Deep Dive

### 3.1 Resume Module Structure
```
backend/resume/
├── __init__.py
├── extractor.py          # PDF/DOCX text extraction
├── parser.py             # Structured data extraction (sections, skills)
├── gpt_client.py         # OpenAI API wrapper with retry logic
├── question_generator.py # Prompt engineering & response parsing
└── resume_question_bank.py # Storage for generated Q&A pairs
```

### 3.2 Extractor Module (`extractor.py`)

**Purpose**: Extract raw text from uploaded resume files.

**Libraries Used**:
- `PyMuPDF` (fitz) - For PDF extraction (best performance)
- `python-docx` - For DOCX extraction
- `pdf2image` + `pytesseract` - OCR fallback for scanned PDFs

```python
# extractor.py - Core Structure

import fitz  # PyMuPDF
from docx import Document
from typing import Tuple, Optional
import os

class ResumeExtractor:
    """
    Extracts text from resume files (PDF, DOCX).
    Returns tuple: (extracted_text, extraction_method, confidence_score)
    """
    
    SUPPORTED_FORMATS = ['.pdf', '.docx', '.doc', '.txt']
    
    def __init__(self):
        self.ocr_available = self._check_ocr_availability()
    
    def extract(self, file_path: str) -> Tuple[str, str, float]:
        """
        Main extraction method.
        Returns: (text, method_used, confidence_0_to_1)
        """
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext == '.pdf':
            return self._extract_pdf(file_path)
        elif ext in ['.docx', '.doc']:
            return self._extract_docx(file_path)
        elif ext == '.txt':
            return self._extract_txt(file_path)
        else:
            raise ValueError(f"Unsupported format: {ext}")
    
    def _extract_pdf(self, path: str) -> Tuple[str, str, float]:
        """
        PDF extraction with multi-layer fallback:
        1. Direct text extraction (fastest)
        2. OCR fallback (for scanned documents)
        """
        doc = fitz.open(path)
        text = ""
        
        for page in doc:
            text += page.get_text()
        
        # If text is too short, might be scanned - try OCR
        if len(text.strip()) < 100 and self.ocr_available:
            return self._ocr_extract_pdf(path)
        
        confidence = min(1.0, len(text) / 500)  # Simple heuristic
        return text.strip(), "direct", confidence
    
    def _extract_docx(self, path: str) -> Tuple[str, str, float]:
        """Extract from DOCX using python-docx."""
        doc = Document(path)
        text = "\n".join([para.text for para in doc.paragraphs])
        return text.strip(), "docx", 0.95
    
    def _ocr_extract_pdf(self, path: str) -> Tuple[str, str, float]:
        """OCR fallback for scanned PDFs."""
        # Implementation with pdf2image + pytesseract
        pass
    
    def _check_ocr_availability(self) -> bool:
        """Check if Tesseract OCR is installed."""
        try:
            import pytesseract
            pytesseract.get_tesseract_version()
            return True
        except:
            return False
```

### 3.3 Resume Parser (`parser.py`)

**Purpose**: Structure extracted text into meaningful sections.

```python
# parser.py - Core Structure

import re
from dataclasses import dataclass, field
from typing import List, Dict, Optional

@dataclass
class ResumeSection:
    """Represents a section of the resume."""
    name: str
    content: str
    keywords: List[str] = field(default_factory=list)
    question_potential: int = 0  # 0-10 score for how many questions can be generated

@dataclass
class ParsedResume:
    """Structured representation of a resume."""
    raw_text: str
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    
    education: List[ResumeSection] = field(default_factory=list)
    experience: List[ResumeSection] = field(default_factory=list)
    projects: List[ResumeSection] = field(default_factory=list)
    skills: List[str] = field(default_factory=list)
    certifications: List[str] = field(default_factory=list)
    achievements: List[str] = field(default_factory=list)
    
    # Computed Properties
    total_experience_years: float = 0.0
    seniority_level: str = "entry"  # entry, mid, senior
    question_capacity: int = 0  # How many meaningful questions can be generated
    
    def is_thin_resume(self) -> bool:
        """Check if resume has enough content for meaningful questions."""
        return self.question_capacity < 5

class ResumeParser:
    """
    Parses extracted text into structured resume sections.
    Uses regex patterns and NLP techniques.
    """
    
    SECTION_PATTERNS = {
        'education': r'(?i)(education|academic|qualification|degree)',
        'experience': r'(?i)(experience|employment|work history|career)',
        'projects': r'(?i)(project|portfolio|work sample)',
        'skills': r'(?i)(skill|technical|technology|expertise|proficiency)',
        'certifications': r'(?i)(certification|certificate|credential|license)',
        'achievements': r'(?i)(achievement|award|honor|recognition|accomplishment)',
        'leadership': r'(?i)(leadership|volunteer|extracurricular|activity)',
    }
    
    def parse(self, raw_text: str) -> ParsedResume:
        """
        Main parsing method.
        Returns structured ParsedResume object.
        """
        resume = ParsedResume(raw_text=raw_text)
        
        # Extract contact info
        resume.name = self._extract_name(raw_text)
        resume.email = self._extract_email(raw_text)
        resume.phone = self._extract_phone(raw_text)
        
        # Split into sections
        sections = self._split_into_sections(raw_text)
        
        for section_name, content in sections.items():
            self._populate_section(resume, section_name, content)
        
        # Calculate metadata
        resume.total_experience_years = self._calculate_experience(resume)
        resume.seniority_level = self._determine_seniority(resume)
        resume.question_capacity = self._calculate_question_capacity(resume)
        
        return resume
    
    def _calculate_question_capacity(self, resume: ParsedResume) -> int:
        """
        Estimate how many meaningful questions can be generated.
        Used to determine if fallback to local questions is needed.
        """
        capacity = 0
        
        # Each experience entry = 3-4 potential questions
        capacity += len(resume.experience) * 3
        
        # Each project = 2-3 potential questions
        capacity += len(resume.projects) * 2
        
        # Skills = 1 question per 2 skills
        capacity += len(resume.skills) // 2
        
        # Certifications = 1 question each
        capacity += len(resume.certifications)
        
        return capacity
```

### 3.4 GPT Client (`gpt_client.py`)

**Purpose**: Robust OpenAI API interaction with retry logic, rate limiting, and error handling.

```python
# gpt_client.py - Core Structure

import openai
import time
import json
from typing import Optional, Dict, Any, Callable
from dataclasses import dataclass
from enum import Enum
import threading

class GPTModel(Enum):
    GPT_4 = "gpt-4"
    GPT_4_TURBO = "gpt-4-turbo-preview"
    GPT_35_TURBO = "gpt-3.5-turbo"

@dataclass
class GPTConfig:
    """Configuration for GPT API calls."""
    model: GPTModel = GPTModel.GPT_4_TURBO
    max_tokens: int = 4000
    temperature: float = 0.7
    max_retries: int = 3
    retry_delay: float = 1.0
    timeout: float = 30.0

class GPTClient:
    """
    Robust OpenAI API client with:
    - Automatic retries with exponential backoff
    - Rate limiting
    - Streaming support
    - Callback for progress updates
    """
    
    def __init__(self, api_key: str, config: Optional[GPTConfig] = None):
        openai.api_key = api_key
        self.config = config or GPTConfig()
        self._rate_limit_lock = threading.Lock()
        self._last_request_time = 0
        self._min_request_interval = 0.5  # seconds between requests
    
    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        on_progress: Optional[Callable[[str], None]] = None
    ) -> str:
        """
        Generate completion with retry logic.
        
        Args:
            prompt: User message
            system_prompt: System context
            on_progress: Callback for streaming updates
            
        Returns:
            Generated text response
        """
        messages = []
        
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        
        messages.append({"role": "user", "content": prompt})
        
        return self._call_with_retry(messages, on_progress)
    
    def _call_with_retry(
        self,
        messages: list,
        on_progress: Optional[Callable]
    ) -> str:
        """Execute API call with exponential backoff retry."""
        
        for attempt in range(self.config.max_retries):
            try:
                # Rate limiting
                self._apply_rate_limit()
                
                response = openai.ChatCompletion.create(
                    model=self.config.model.value,
                    messages=messages,
                    max_tokens=self.config.max_tokens,
                    temperature=self.config.temperature,
                    timeout=self.config.timeout,
                    stream=on_progress is not None
                )
                
                if on_progress:
                    # Streaming mode
                    full_response = ""
                    for chunk in response:
                        delta = chunk.choices[0].delta.get('content', '')
                        full_response += delta
                        on_progress(delta)
                    return full_response
                else:
                    return response.choices[0].message.content
                    
            except openai.error.RateLimitError:
                wait_time = self.config.retry_delay * (2 ** attempt)
                print(f"   [GPT] Rate limited. Waiting {wait_time}s...")
                time.sleep(wait_time)
                
            except openai.error.APIError as e:
                if attempt < self.config.max_retries - 1:
                    time.sleep(self.config.retry_delay)
                else:
                    raise
                    
            except openai.error.Timeout:
                if attempt < self.config.max_retries - 1:
                    print(f"   [GPT] Timeout. Retrying...")
                else:
                    raise
        
        raise Exception("Max retries exceeded")
    
    def _apply_rate_limit(self):
        """Ensure minimum interval between requests."""
        with self._rate_limit_lock:
            elapsed = time.time() - self._last_request_time
            if elapsed < self._min_request_interval:
                time.sleep(self._min_request_interval - elapsed)
            self._last_request_time = time.time()
```

### 3.5 Question Generator (`question_generator.py`)

**Purpose**: Prompt engineering and response parsing for interview question generation.

```python
# question_generator.py - Core Structure

from typing import List, Tuple, Optional, Dict
from dataclasses import dataclass
from enum import Enum
import json
import re

class QuestionType(Enum):
    THEORETICAL = "theoretical"
    CONCEPTUAL = "conceptual"
    SCENARIO_BASED = "scenario"
    PUZZLE = "puzzle"
    BEHAVIORAL = "behavioral"
    PROJECT_DEEP_DIVE = "project"
    EXPERIENCE_VERIFICATION = "experience"

@dataclass
class GeneratedQuestion:
    """A single generated interview question."""
    question: str
    expected_answer: str
    question_type: QuestionType
    source_section: str  # Which resume section this relates to
    difficulty: int  # 1-5 scale
    keywords: List[str]  # For adaptive matching
    follow_up_potential: bool  # Can lead to counter-questions

@dataclass
class ResumeQuestionSet:
    """Complete set of questions generated from a resume."""
    questions: List[GeneratedQuestion]
    generation_time: float
    resume_hash: str  # For caching
    candidate_name: str
    total_questions: int
    by_type: Dict[QuestionType, List[GeneratedQuestion]]
    by_section: Dict[str, List[GeneratedQuestion]]

class QuestionGenerator:
    """
    Generates interview questions from parsed resume using GPT.
    Implements sophisticated prompt engineering for quality output.
    """
    
    SYSTEM_PROMPT = """You are an expert technical interviewer with 15+ years of experience 
conducting interviews at top tech companies. Your task is to generate insightful, 
industry-standard interview questions based on a candidate's resume.

RULES:
1. Generate questions that TEST actual knowledge, not just verify resume claims
2. Mix question types: theoretical, conceptual, scenario-based, puzzle, behavioral
3. For each experience/project, ask about challenges faced and solutions implemented
4. For each skill listed, ask questions that probe depth (not surface-level)
5. Include follow-up questions that could branch from answers
6. Match difficulty to apparent seniority level
7. DO NOT generate boring/generic questions like "Tell me about X on your resume"
8. Each question MUST have an expected answer that a good candidate would give

OUTPUT FORMAT (JSON):
{
    "questions": [
        {
            "question": "...",
            "expected_answer": "...",
            "type": "theoretical|conceptual|scenario|puzzle|behavioral|project|experience",
            "source_section": "experience|projects|skills|education|certifications",
            "difficulty": 1-5,
            "keywords": ["keyword1", "keyword2"],
            "follow_up_potential": true|false
        }
    ],
    "candidate_assessment": {
        "estimated_seniority": "entry|mid|senior",
        "key_strengths": ["...", "..."],
        "areas_to_probe": ["...", "..."]
    }
}
"""

    USER_PROMPT_TEMPLATE = """Generate {num_questions} industry-level interview questions for the following resume.

RESUME CONTENT:
{resume_text}

ADDITIONAL CONTEXT:
- Seniority Level: {seniority}
- Primary Skills: {skills}
- Focus Areas: {focus_areas}

QUESTION DISTRIBUTION:
- 30% Theoretical (test fundamental knowledge)
- 25% Scenario-based (real-world problem solving)
- 20% Project deep-dive (specifics from their work)
- 15% Conceptual (understanding of principles)
- 10% Behavioral/Puzzle

Remember: 
- If the resume is thin, focus on skills and education
- Generate only questions that can be meaningfully answered
- Include expected answers for each question
"""

    def __init__(self, gpt_client):
        self.gpt_client = gpt_client
    
    def generate(
        self,
        parsed_resume,
        num_questions: int = 20,
        on_progress: Optional[callable] = None
    ) -> ResumeQuestionSet:
        """
        Generate questions from parsed resume.
        
        Args:
            parsed_resume: ParsedResume object
            num_questions: Target number of questions (may be fewer for thin resumes)
            on_progress: Callback for progress updates
            
        Returns:
            ResumeQuestionSet with all generated questions
        """
        # Adjust question count for thin resumes
        if parsed_resume.is_thin_resume():
            num_questions = min(num_questions, parsed_resume.question_capacity + 5)
            print(f"   [Generator] Thin resume detected. Reducing to {num_questions} questions.")
        
        # Build prompt
        prompt = self.USER_PROMPT_TEMPLATE.format(
            num_questions=num_questions,
            resume_text=parsed_resume.raw_text[:3000],  # Truncate for token limits
            seniority=parsed_resume.seniority_level,
            skills=", ".join(parsed_resume.skills[:10]),
            focus_areas=self._determine_focus_areas(parsed_resume)
        )
        
        # Call GPT
        start_time = time.time()
        response = self.gpt_client.generate(
            prompt=prompt,
            system_prompt=self.SYSTEM_PROMPT,
            on_progress=on_progress
        )
        generation_time = time.time() - start_time
        
        # Parse response
        questions = self._parse_response(response, parsed_resume)
        
        return self._build_question_set(
            questions=questions,
            generation_time=generation_time,
            parsed_resume=parsed_resume
        )
    
    def _parse_response(self, response: str, resume) -> List[GeneratedQuestion]:
        """Parse GPT JSON response into GeneratedQuestion objects."""
        try:
            # Extract JSON from response (handle markdown code blocks)
            json_match = re.search(r'```json\s*(.*?)\s*```', response, re.DOTALL)
            if json_match:
                response = json_match.group(1)
            
            data = json.loads(response)
            questions = []
            
            for q in data.get('questions', []):
                questions.append(GeneratedQuestion(
                    question=q['question'],
                    expected_answer=q['expected_answer'],
                    question_type=QuestionType(q.get('type', 'theoretical')),
                    source_section=q.get('source_section', 'general'),
                    difficulty=q.get('difficulty', 3),
                    keywords=q.get('keywords', []),
                    follow_up_potential=q.get('follow_up_potential', False)
                ))
            
            return questions
            
        except json.JSONDecodeError as e:
            print(f"   [Generator] JSON parse error: {e}")
            return self._fallback_parse(response)
    
    def _fallback_parse(self, response: str) -> List[GeneratedQuestion]:
        """Fallback parser for malformed GPT responses."""
        # Implement regex-based extraction as backup
        questions = []
        # ... pattern matching logic
        return questions
    
    def _determine_focus_areas(self, resume) -> str:
        """Determine what areas to focus questions on."""
        areas = []
        if resume.experience:
            areas.append("work experience verification")
        if resume.projects:
            areas.append("project deep-dive")
        if resume.skills:
            areas.append("technical skills assessment")
        if resume.certifications:
            areas.append("certification knowledge")
        return ", ".join(areas) if areas else "general technical skills"
```

---

## 4. Async Flow & Race Condition Resolution

### 4.1 The Concurrency Challenge

The system now has **THREE** concurrent processes that can modify shared state:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      CONCURRENT PROCESSES                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Process 1: Main Interview Loop                                         │
│   ├── Asks questions (from LOCAL or RESUME bank)                         │
│   ├── Records audio                                                      │
│   ├── Transitions between states                                         │
│   └── READS: question banks, state, flags                               │
│       WRITES: asked_questions set, current_topic, state                 │
│                                                                          │
│   Process 2: Transcription Worker (Existing)                             │
│   ├── Transcribes audio                                                  │
│   ├── Extracts keywords for adaptive questioning                         │
│   ├── Evaluates answers                                                  │
│   └── READS: audio queue                                                 │
│       WRITES: context_keywords, report_card, stop_signal                 │
│                                                                          │
│   Process 3: Resume Processor (NEW)                                      │
│   ├── Extracts text from resume                                          │
│   ├── Calls GPT API                                                      │
│   ├── Populates resume question bank                                     │
│   └── READS: resume file                                                 │
│       WRITES: resume_questions, is_resume_ready flag                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Race Condition Scenarios

#### Scenario 1: Question Source Collision
```
Time ─────────────────────────────────────────────────────────────────────▶

Thread 1 (Main):    [Ask Q1 from LOCAL]  [Ask Q2 from LOCAL]  [Ask Q3 from ???]
                                                                      │
Thread 3 (Resume):  [Extracting...]  [GPT calling...]  [READY!] ──────┘
                                                              │
                                                              ▼
                                              COLLISION: Which source to use?
                                              - Resume just became ready
                                              - But Q3 was already selected from LOCAL
```

**Solution**: Use a **Question Priority Queue** with source tagging:

```python
@dataclass
class QueuedQuestion:
    question: str
    expected_answer: str
    source: str  # 'local', 'resume', 'adaptive'
    priority: int  # Higher = ask first
    topic: str
    timestamp: float

class QuestionPriorityQueue:
    """Thread-safe priority queue for questions."""
    
    def __init__(self):
        self._queue = []
        self._lock = threading.Lock()
        self._asked_hashes = set()
    
    def enqueue(self, q: QueuedQuestion):
        """Add question with duplicate check."""
        with self._lock:
            q_hash = hash(q.question)
            if q_hash not in self._asked_hashes:
                heapq.heappush(self._queue, (-q.priority, q.timestamp, q))
    
    def dequeue(self) -> Optional[QueuedQuestion]:
        """Get next highest priority question."""
        with self._lock:
            while self._queue:
                _, _, q = heapq.heappop(self._queue)
                q_hash = hash(q.question)
                if q_hash not in self._asked_hashes:
                    self._asked_hashes.add(q_hash)
                    return q
            return None
    
    def has_resume_questions(self) -> bool:
        """Check if resume questions are available."""
        with self._lock:
            return any(q.source == 'resume' for _, _, q in self._queue)
```

#### Scenario 2: State Transition Race
```
Time ─────────────────────────────────────────────────────────────────────▶

Thread 1:    [State = INTRO]  [Recording...]  [Transcribe...]  [State = DEEP_DIVE]
                    │                                                  │
Thread 3:           │  [Resume ready, wants to set RESUME_MODE] ───────┘
                    │                                                  │
                    ▼                                                  ▼
            RACE: Both trying to set interview state at same time
```

**Solution**: State Machine with Atomic Transitions:

```python
class InterviewState(Enum):
    INIT = auto()
    WAITING_RESUME = auto()    # NEW: Waiting for resume upload
    RESUME_PROCESSING = auto() # NEW: Resume being processed
    INTRO = auto()
    DEEP_DIVE_LOCAL = auto()   # Using local questions
    DEEP_DIVE_RESUME = auto()  # Using resume questions
    MIX_ROUND = auto()
    FINISHED = auto()

class StateMachine:
    """Thread-safe state machine with transition validation."""
    
    VALID_TRANSITIONS = {
        InterviewState.INIT: [InterviewState.WAITING_RESUME],
        InterviewState.WAITING_RESUME: [InterviewState.RESUME_PROCESSING, InterviewState.INTRO],
        InterviewState.RESUME_PROCESSING: [InterviewState.INTRO],
        InterviewState.INTRO: [InterviewState.DEEP_DIVE_LOCAL, InterviewState.DEEP_DIVE_RESUME],
        InterviewState.DEEP_DIVE_LOCAL: [InterviewState.DEEP_DIVE_RESUME, InterviewState.MIX_ROUND],
        InterviewState.DEEP_DIVE_RESUME: [InterviewState.MIX_ROUND, InterviewState.DEEP_DIVE_LOCAL],
        InterviewState.MIX_ROUND: [InterviewState.FINISHED],
    }
    
    def __init__(self):
        self._state = InterviewState.INIT
        self._lock = threading.RLock()  # Reentrant for nested calls
        self._transition_callbacks = []
    
    def transition(self, new_state: InterviewState) -> bool:
        """Atomic state transition with validation."""
        with self._lock:
            if new_state in self.VALID_TRANSITIONS.get(self._state, []):
                old_state = self._state
                self._state = new_state
                self._notify_callbacks(old_state, new_state)
                return True
            return False
    
    @property
    def current(self) -> InterviewState:
        with self._lock:
            return self._state
```

#### Scenario 3: Adaptive Question Collision with Resume Questions
```
Time ─────────────────────────────────────────────────────────────────────▶

Thread 2 (Transcription): [Detected keyword "microservices"]
                          [Queue adaptive question about microservices]
                                            │
                                            ▼
Thread 3 (Resume):        [GPT generated question about microservices from resume]
                                            │
                                            ▼
                         COLLISION: Two questions about same topic from different sources
```

**Solution**: Unified Keyword Deduplication:

```python
class AdaptiveQuestionManager:
    """Manages adaptive questions with deduplication across sources."""
    
    def __init__(self):
        self._used_keywords = set()
        self._used_topics = set()
        self._lock = threading.Lock()
    
    def should_ask_adaptive(self, keyword: str, topic: str) -> bool:
        """Check if an adaptive question should be asked."""
        with self._lock:
            key = f"{keyword}:{topic}"
            if key in self._used_keywords:
                return False
            self._used_keywords.add(key)
            return True
    
    def mark_topic_covered(self, topic: str, keywords: List[str]):
        """Mark a topic as covered (e.g., from resume question)."""
        with self._lock:
            self._used_topics.add(topic)
            for kw in keywords:
                self._used_keywords.add(f"{kw}:{topic}")
```

### 4.3 Critical Section Analysis

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     CRITICAL SECTIONS & LOCKS                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   LOCK 1: question_bank_lock (RLock)                                     │
│   ├── Protects: resume_question_bank, local_question_bank                │
│   ├── Used by: Main Thread (read), Resume Thread (write)                 │
│   └── Pattern: Read-heavy, occasional write                              │
│                                                                          │
│   LOCK 2: state_lock (RLock)                                             │
│   ├── Protects: interview_state, current_topic, skills_queue            │
│   ├── Used by: All threads                                               │
│   └── Pattern: Frequent short reads, rare writes                         │
│                                                                          │
│   LOCK 3: report_lock (Lock)                                             │
│   ├── Protects: report_card, active_tasks counter                        │
│   ├── Used by: Main Thread (read), Transcription Thread (write)          │
│   └── Pattern: Append-only writes                                        │
│                                                                          │
│   LOCK 4: context_lock (Lock)                                            │
│   ├── Protects: context_keywords queue, used_keywords set                │
│   ├── Used by: Transcription Thread (write), Main Thread (read)          │
│   └── Pattern: Producer-consumer                                         │
│                                                                          │
│   ATOMIC FLAGS (threading.Event):                                        │
│   ├── resume_ready_event                                                 │
│   ├── stop_event                                                         │
│   └── interview_started_event                                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Deadlock Prevention

**Rule 1: Lock Ordering**
```python
# Always acquire locks in this order to prevent deadlock
LOCK_ORDER = [
    'state_lock',      # 1st
    'question_bank_lock',  # 2nd
    'context_lock',    # 3rd
    'report_lock',     # 4th
]
```

**Rule 2: Timeout on Lock Acquisition**
```python
def safe_acquire(lock, timeout=5.0) -> bool:
    """Acquire lock with timeout to prevent deadlock."""
    acquired = lock.acquire(timeout=timeout)
    if not acquired:
        logging.warning(f"Lock acquisition timeout: {lock}")
    return acquired
```

**Rule 3: Use Context Managers**
```python
@contextmanager
def multi_lock(*locks):
    """Acquire multiple locks in order."""
    acquired = []
    try:
        for lock in locks:
            lock.acquire()
            acquired.append(lock)
        yield
    finally:
        for lock in reversed(acquired):
            lock.release()
```

---

## 5. API Integration Strategy

### 5.1 OpenAI API Best Practices

```python
# api_config.py

from dataclasses import dataclass
from typing import Optional
import os
from dotenv import load_dotenv

# Load .env file from project root
load_dotenv()

@dataclass
class APIConfig:
    """Configuration for external API calls."""
    
    # OpenAI Settings - Uses GPT_API_KEY from your .env file
    openai_api_key: str = os.getenv("GPT_API_KEY", "")
    openai_model: str = "gpt-4-turbo-preview"
    openai_max_tokens: int = 4000
    openai_temperature: float = 0.7
    
    # Rate Limiting
    max_requests_per_minute: int = 50
    request_cooldown_seconds: float = 0.5
    
    # Retry Configuration
    max_retries: int = 3
    initial_retry_delay: float = 1.0
    max_retry_delay: float = 30.0
    retry_multiplier: float = 2.0
    
    # Timeouts
    connection_timeout: float = 10.0
    read_timeout: float = 60.0
    
    # Cost Management
    max_tokens_per_session: int = 50000
    warn_at_tokens: int = 40000
    
    def validate(self) -> bool:
        """Validate configuration."""
        if not self.openai_api_key:
            raise ValueError("GPT_API_KEY not set in .env file")
        return True
```

### 5.2 Secure API Key Management

```python
# secrets_manager.py

import os
import json
from pathlib import Path
from typing import Optional
from cryptography.fernet import Fernet

class SecretsManager:
    """
    Secure management of API keys and secrets.
    Supports: Environment variables, encrypted file, keyring.
    """
    
    SECRETS_FILE = ".secrets.enc"
    
    def __init__(self):
        self._cache = {}
        self._fernet = self._get_cipher()
    
    def get_api_key(self, service: str) -> Optional[str]:
        """
        Get API key with fallback chain:
        1. Environment variable
        2. Encrypted secrets file
        3. System keyring
        """
        # Try environment first
        env_key = f"{service.upper()}_API_KEY"
        if env_key in os.environ:
            return os.environ[env_key]
        
        # Try encrypted file
        if self._secrets_file_exists():
            secrets = self._load_secrets()
            if service in secrets:
                return secrets[service]
        
        # Try keyring (Windows Credential Manager)
        try:
            import keyring
            return keyring.get_password("ai_interviewer", service)
        except:
            pass
        
        return None
    
    def set_api_key(self, service: str, key: str, persist: bool = True):
        """Store API key securely."""
        if persist:
            secrets = self._load_secrets() if self._secrets_file_exists() else {}
            secrets[service] = key
            self._save_secrets(secrets)
    
    def _get_cipher(self) -> Fernet:
        """Get or create encryption key."""
        key_file = Path.home() / ".ai_interviewer_key"
        if key_file.exists():
            key = key_file.read_bytes()
        else:
            key = Fernet.generate_key()
            key_file.write_bytes(key)
            key_file.chmod(0o600)  # Owner read/write only
        return Fernet(key)
```

### 5.3 Prompt Template Management

```python
# prompts.py

from string import Template
from typing import Dict, Any

class PromptManager:
    """
    Manages prompt templates for GPT interactions.
    Supports versioning and A/B testing.
    """
    
    TEMPLATES = {
        "question_generation_v1": Template("""
Generate ${num_questions} interview questions based on this resume:

${resume_text}

Requirements:
- Mix theoretical, scenario-based, and behavioral questions
- Include expected answers
- Match difficulty to seniority: ${seniority}
- Focus on: ${focus_areas}

Output as JSON array.
"""),
        
        "question_generation_v2": Template("""
You are a senior technical interviewer. Analyze this resume and generate 
${num_questions} insightful questions.

RESUME:
${resume_text}

CANDIDATE PROFILE:
- Estimated Level: ${seniority}
- Key Skills: ${skills}
- Experience: ${experience_years} years

QUESTION MIX:
- 30% Technical depth (test real understanding)
- 25% Problem-solving scenarios
- 20% Experience verification
- 15% Architecture/Design
- 10% Behavioral

For EACH question, provide:
1. The question itself
2. A comprehensive expected answer
3. Difficulty (1-5)
4. Keywords for follow-up

CRITICAL: Don't ask surface-level questions. Test actual knowledge.
"""),
    }
    
    @classmethod
    def get(cls, template_name: str, **kwargs) -> str:
        """Get formatted prompt."""
        template = cls.TEMPLATES.get(template_name)
        if not template:
            raise ValueError(f"Unknown template: {template_name}")
        return template.safe_substitute(**kwargs)
```

---

## 6. Data Flow & State Management

### 6.1 Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              COMPLETE DATA FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  1. INITIALIZATION PHASE                                                         │
│     ┌─────────────┐                                                              │
│     │ User lands  │                                                              │
│     │ on app      │                                                              │
│     └──────┬──────┘                                                              │
│            │                                                                     │
│            ▼                                                                     │
│     ┌─────────────┐    ┌───────────────┐                                         │
│     │ Upload      │───▶│ Resume        │                                         │
│     │ Resume      │    │ Extractor     │                                         │
│     └─────────────┘    └───────┬───────┘                                         │
│                                │                                                 │
│                                ▼                                                 │
│                        ┌───────────────┐    ┌───────────────┐                    │
│                        │ Resume        │───▶│ GPT API       │                    │
│                        │ Parser        │    │ (Question Gen)│                    │
│                        └───────────────┘    └───────┬───────┘                    │
│                                                     │                            │
│                                                     ▼                            │
│  ╔══════════════════════════════════════════════════════════════════╗           │
│  ║ PARALLEL EXECUTION                                                ║           │
│  ╠══════════════════════════════════════════════════════════════════╣           │
│  ║                                                                   ║           │
│  ║  Thread A: Resume Processing          Thread B: Interview Start   ║           │
│  ║  ┌───────────────────────────┐       ┌───────────────────────┐   ║           │
│  ║  │ 1. Parse resume sections  │       │ 1. "Tell me about     │   ║           │
│  ║  │ 2. Call GPT API           │       │     yourself"         │   ║           │
│  ║  │ 3. Parse JSON response    │       │ 2. Extract skills     │   ║           │
│  ║  │ 4. Build question bank    │       │ 3. Ask LOCAL Qs       │   ║           │
│  ║  │ 5. Set resume_ready=True  │       │    while waiting      │   ║           │
│  ║  └───────────────────────────┘       └───────────────────────┘   ║           │
│  ║           │                                    │                  ║           │
│  ║           └────────────────┬───────────────────┘                  ║           │
│  ║                            ▼                                      ║           │
│  ║                   ┌─────────────────┐                             ║           │
│  ║                   │ MERGE POINT     │                             ║           │
│  ║                   │ (When both      │                             ║           │
│  ║                   │  threads ready) │                             ║           │
│  ║                   └─────────────────┘                             ║           │
│  ╚══════════════════════════════════════════════════════════════════╝           │
│                                │                                                 │
│                                ▼                                                 │
│  2. MAIN INTERVIEW LOOP                                                          │
│     ┌─────────────────────────────────────────────────────────────┐             │
│     │                                                              │             │
│     │   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │             │
│     │   │ Question     │───▶│ Speak        │───▶│ Record       │  │             │
│     │   │ Router       │    │ (TTS)        │    │ Audio        │  │             │
│     │   └──────────────┘    └──────────────┘    └──────┬───────┘  │             │
│     │         ▲                                        │          │             │
│     │         │                                        ▼          │             │
│     │   ┌─────┴────────┐                       ┌──────────────┐   │             │
│     │   │ Decision     │◀──────────────────────│ Process      │   │             │
│     │   │ Engine       │                       │ Answer       │   │             │
│     │   └──────────────┘                       └──────────────┘   │             │
│     │                                                              │             │
│     │   Sources:                                                   │             │
│     │   ├── Resume Questions (priority if available)              │             │
│     │   ├── Adaptive Questions (from user keywords)               │             │
│     │   └── Local Questions (fallback)                            │             │
│     │                                                              │             │
│     └─────────────────────────────────────────────────────────────┘             │
│                                │                                                 │
│                                ▼                                                 │
│  3. EVALUATION PHASE                                                             │
│     ┌─────────────────────────────────────────────────────────────┐             │
│     │ ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │             │
│     │ │ Confidence   │───▶│ Report       │───▶│ Verbal       │   │             │
│     │ │ Calculator   │    │ Generator    │    │ Feedback     │   │             │
│     │ └──────────────┘    └──────────────┘    └──────────────┘   │             │
│     └─────────────────────────────────────────────────────────────┘             │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 State Transitions

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         STATE MACHINE DIAGRAM                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│                          ┌────────────────┐                              │
│                          │      INIT      │                              │
│                          └───────┬────────┘                              │
│                                  │                                       │
│                                  ▼                                       │
│                    ┌─────────────────────────┐                           │
│                    │    WAITING_FOR_RESUME   │                           │
│                    └───────────┬─────────────┘                           │
│                                │                                         │
│              ┌─────────────────┴────────────────┐                        │
│              │                                  │                        │
│              ▼                                  ▼                        │
│    ┌────────────────────┐            ┌────────────────┐                  │
│    │ RESUME_PROCESSING  │            │  SKIP_RESUME   │                  │
│    │ (async in bg)      │            │  (no file)     │                  │
│    └─────────┬──────────┘            └───────┬────────┘                  │
│              │                               │                           │
│              └───────────────┬───────────────┘                           │
│                              │                                           │
│                              ▼                                           │
│                    ┌─────────────────┐                                   │
│                    │      INTRO      │                                   │
│                    │ (get skills)    │                                   │
│                    └───────┬─────────┘                                   │
│                            │                                             │
│                            ▼                                             │
│        ┌──────────────────────────────────────┐                          │
│        │  resume_ready?                       │                          │
│        │  ┌───────────────┐  ┌──────────────┐ │                          │
│        │  │ YES: Use      │  │ NO: Use      │ │                          │
│        │  │ RESUME_DIVE   │  │ LOCAL_DIVE   │ │                          │
│        │  └───────┬───────┘  └──────┬───────┘ │                          │
│        └──────────┼─────────────────┼─────────┘                          │
│                   │                 │                                    │
│                   ▼                 ▼                                    │
│         ┌─────────────────┐  ┌─────────────────┐                         │
│         │  DEEP_DIVE_     │  │  DEEP_DIVE_     │                         │
│         │  RESUME         │◀─│  LOCAL          │                         │
│         │                 │  │  (fallback)     │                         │
│         └────────┬────────┘  └─────────────────┘                         │
│                  │     ▲                                                 │
│                  │     │ (switch when resume ready)                      │
│                  │     │                                                 │
│                  ▼                                                       │
│         ┌─────────────────┐                                              │
│         │    MIX_ROUND    │                                              │
│         │ (both sources)  │                                              │
│         └────────┬────────┘                                              │
│                  │                                                       │
│                  ▼                                                       │
│         ┌─────────────────┐                                              │
│         │    CHECKOUT     │                                              │
│         │ (final question)│                                              │
│         └────────┬────────┘                                              │
│                  │                                                       │
│                  ▼                                                       │
│         ┌─────────────────┐                                              │
│         │    FINISHED     │                                              │
│         │ (generate report│                                              │
│         └─────────────────┘                                              │
│                                                                          │
│  INTERRUPT STATES (can trigger from any state):                          │
│  ├── STOP_REQUESTED (user says "stop interview")                         │
│  └── ERROR (unrecoverable error)                                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Question Routing Logic

```python
# question_router.py

from enum import Enum
from dataclasses import dataclass
from typing import Optional, Tuple
import random

class QuestionSource(Enum):
    RESUME = "resume"           # From GPT-generated resume questions
    LOCAL = "local"             # From local question bank
    ADAPTIVE = "adaptive"       # Counter-questions from detected keywords
    FALLBACK = "fallback"       # Generic questions when all else fails

@dataclass
class RoutedQuestion:
    """A question with routing metadata."""
    question: str
    expected_answer: str
    source: QuestionSource
    topic: str
    priority: int
    transition_phrase: str = ""

class QuestionRouter:
    """
    Routes questions from multiple sources based on priority and availability.
    Implements the "Resume First, Local Fallback" strategy.
    """
    
    # Priority levels (higher = ask first)
    PRIORITY_RESUME_EXPERIENCE = 100
    PRIORITY_RESUME_PROJECT = 90
    PRIORITY_ADAPTIVE = 80
    PRIORITY_RESUME_SKILLS = 70
    PRIORITY_LOCAL_SCENARIO = 60
    PRIORITY_LOCAL_THEORETICAL = 50
    PRIORITY_FALLBACK = 10
    
    def __init__(self, 
                 resume_bank,
                 local_bank,
                 adaptive_manager,
                 state_machine):
        self.resume_bank = resume_bank
        self.local_bank = local_bank
        self.adaptive = adaptive_manager
        self.state = state_machine
        self._asked = set()
    
    def get_next_question(self, allowed_topics: list) -> Optional[RoutedQuestion]:
        """
        Get the next question based on priority and availability.
        
        Priority Order:
        1. Adaptive questions (if keyword detected recently)
        2. Resume experience questions
        3. Resume project questions
        4. Resume skills questions
        5. Local scenario questions
        6. Local theoretical questions
        7. Fallback generic questions
        """
        
        # 1. Check for adaptive question (counter-questioning)
        adaptive_q = self._try_adaptive(allowed_topics)
        if adaptive_q:
            return adaptive_q
        
        # 2. Check resume questions (if ready)
        if self.resume_bank.is_ready():
            resume_q = self._try_resume(allowed_topics)
            if resume_q:
                return resume_q
        
        # 3. Fall back to local questions
        local_q = self._try_local(allowed_topics)
        if local_q:
            return local_q
        
        # 4. Ultimate fallback
        return self._get_fallback()
    
    def _try_adaptive(self, topics: list) -> Optional[RoutedQuestion]:
        """Try to get an adaptive counter-question."""
        keyword = self.adaptive.get_pending_keyword()
        if not keyword:
            return None
        
        # Find question matching keyword within allowed topics
        q = self.adaptive.get_question_for_keyword(keyword, topics)
        if q and q.question not in self._asked:
            self._asked.add(q.question)
            return RoutedQuestion(
                question=q.question,
                expected_answer=q.expected_answer,
                source=QuestionSource.ADAPTIVE,
                topic=q.topic,
                priority=self.PRIORITY_ADAPTIVE,
                transition_phrase=self._get_adaptive_transition(keyword)
            )
        return None
    
    def _try_resume(self, topics: list) -> Optional[RoutedQuestion]:
        """Try to get a resume-based question."""
        # Prioritize experience > projects > skills
        for section in ['experience', 'projects', 'skills']:
            q = self.resume_bank.get_unused_question(section)
            if q and q.question not in self._asked:
                self._asked.add(q.question)
                priority = {
                    'experience': self.PRIORITY_RESUME_EXPERIENCE,
                    'projects': self.PRIORITY_RESUME_PROJECT,
                    'skills': self.PRIORITY_RESUME_SKILLS
                }[section]
                return RoutedQuestion(
                    question=q.question,
                    expected_answer=q.expected_answer,
                    source=QuestionSource.RESUME,
                    topic=section,
                    priority=priority,
                    transition_phrase=self._get_resume_transition(section)
                )
        return None
    
    def _try_local(self, topics: list) -> Optional[RoutedQuestion]:
        """Get question from local bank."""
        topic = random.choice(topics) if topics else "General"
        q = self.local_bank.get_unique_question(topic)
        if q:
            self._asked.add(q[0])
            return RoutedQuestion(
                question=q[0],
                expected_answer=q[1],
                source=QuestionSource.LOCAL,
                topic=topic,
                priority=self.PRIORITY_LOCAL_SCENARIO
            )
        return None
    
    def _get_adaptive_transition(self, keyword: str) -> str:
        """Get natural transition phrase for adaptive questions."""
        phrases = [
            f"You mentioned {keyword} earlier. ",
            f"Going back to your point about {keyword}. ",
            f"Speaking of {keyword}. ",
            f"Related to what you said about {keyword}. ",
        ]
        return random.choice(phrases)
    
    def _get_resume_transition(self, section: str) -> str:
        """Get transition phrase for resume questions."""
        phrases = {
            'experience': [
                "Looking at your experience, ",
                "Based on your background, ",
                "From your work history, "
            ],
            'projects': [
                "About one of your projects, ",
                "Regarding the work you've done, ",
                "I see you worked on something interesting. "
            ],
            'skills': [
                "You listed some skills. ",
                "About your technical expertise, ",
                ""
            ]
        }
        return random.choice(phrases.get(section, [""]))
```

---

## 7. Confidence Score Algorithm

### 7.1 Multi-Factor Confidence Scoring

```python
# confidence_scorer.py

from dataclasses import dataclass
from typing import List, Dict, Tuple
import numpy as np

@dataclass
class ConfidenceMetrics:
    """Individual metrics contributing to confidence score."""
    response_time_score: float      # How quickly they answered
    speech_fluency_score: float     # Hesitation, filler words
    answer_completeness: float      # Did they cover all points
    technical_accuracy: float       # Semantic match with expected
    consistency_score: float        # Alignment with previous answers
    engagement_score: float         # Length and detail of responses

@dataclass
class ConfidenceResult:
    """Final confidence assessment."""
    overall_score: float            # 0-100
    confidence_level: str           # "Low", "Moderate", "High", "Very High"
    metrics: ConfidenceMetrics
    strengths: List[str]
    areas_for_improvement: List[str]
    detailed_breakdown: Dict[str, float]

class ConfidenceScorer:
    """
    Calculates overall confidence score using multiple behavioral signals.
    
    Formula: 
    Confidence = w1*ResponseTime + w2*Fluency + w3*Completeness + 
                 w4*Accuracy + w5*Consistency + w6*Engagement
    
    Weights are calibrated based on importance:
    - Technical Accuracy: 35% (most important)
    - Completeness: 25%
    - Consistency: 15%
    - Fluency: 10%
    - Response Time: 10%
    - Engagement: 5%
    """
    
    WEIGHTS = {
        'technical_accuracy': 0.35,
        'completeness': 0.25,
        'consistency': 0.15,
        'fluency': 0.10,
        'response_time': 0.10,
        'engagement': 0.05
    }
    
    CONFIDENCE_LEVELS = [
        (90, "Very High"),
        (75, "High"),
        (60, "Moderate"),
        (40, "Low"),
        (0, "Very Low")
    ]
    
    def __init__(self, evaluator):
        self.evaluator = evaluator
        self.answer_history = []
    
    def calculate(self, report_card: List[Dict]) -> ConfidenceResult:
        """
        Calculate overall confidence from interview report.
        
        Args:
            report_card: List of answer entries from interview
            
        Returns:
            ConfidenceResult with detailed breakdown
        """
        if not report_card:
            return self._empty_result()
        
        # Calculate individual metrics
        metrics = ConfidenceMetrics(
            response_time_score=self._calc_response_time_score(report_card),
            speech_fluency_score=self._calc_fluency_score(report_card),
            answer_completeness=self._calc_completeness_score(report_card),
            technical_accuracy=self._calc_accuracy_score(report_card),
            consistency_score=self._calc_consistency_score(report_card),
            engagement_score=self._calc_engagement_score(report_card)
        )
        
        # Weighted sum
        overall = (
            metrics.response_time_score * self.WEIGHTS['response_time'] +
            metrics.speech_fluency_score * self.WEIGHTS['fluency'] +
            metrics.answer_completeness * self.WEIGHTS['completeness'] +
            metrics.technical_accuracy * self.WEIGHTS['technical_accuracy'] +
            metrics.consistency_score * self.WEIGHTS['consistency'] +
            metrics.engagement_score * self.WEIGHTS['engagement']
        )
        
        # Determine level
        level = self._get_confidence_level(overall)
        
        # Analyze strengths and weaknesses
        strengths, improvements = self._analyze_performance(metrics)
        
        return ConfidenceResult(
            overall_score=round(overall, 1),
            confidence_level=level,
            metrics=metrics,
            strengths=strengths,
            areas_for_improvement=improvements,
            detailed_breakdown={
                'Response Time': metrics.response_time_score,
                'Speech Fluency': metrics.speech_fluency_score,
                'Answer Completeness': metrics.answer_completeness,
                'Technical Accuracy': metrics.technical_accuracy,
                'Consistency': metrics.consistency_score,
                'Engagement': metrics.engagement_score
            }
        )
    
    def _calc_accuracy_score(self, report_card: List[Dict]) -> float:
        """Calculate accuracy based on semantic similarity scores."""
        scores = [entry.get('score', 0) for entry in report_card]
        return np.mean(scores) if scores else 0
    
    def _calc_fluency_score(self, report_card: List[Dict]) -> float:
        """
        Analyze speech fluency by detecting:
        - Filler words (um, uh, like, you know)
        - Long pauses (represented by ...)
        - Incomplete sentences
        """
        FILLER_WORDS = ['um', 'uh', 'like', 'you know', 'basically', 'actually', 'so yeah']
        
        total_words = 0
        filler_count = 0
        
        for entry in report_card:
            answer = entry.get('user_ans', '').lower()
            words = answer.split()
            total_words += len(words)
            
            for filler in FILLER_WORDS:
                filler_count += answer.count(filler)
        
        if total_words == 0:
            return 0
        
        # Filler ratio (lower is better)
        filler_ratio = filler_count / total_words
        
        # Convert to 0-100 score (0% fillers = 100, 10%+ fillers = 0)
        fluency = max(0, 100 - (filler_ratio * 1000))
        return fluency
    
    def _calc_completeness_score(self, report_card: List[Dict]) -> float:
        """
        Measure answer completeness:
        - Compare answer length to expected
        - Check for keyword coverage
        """
        completeness_scores = []
        
        for entry in report_card:
            user_ans = entry.get('user_ans', '')
            expected = entry.get('expected', '')
            
            if not expected:
                continue
            
            # Length ratio (capped at 100%)
            length_ratio = min(1.0, len(user_ans) / max(len(expected), 1))
            
            # Keyword coverage
            expected_keywords = set(expected.lower().split())
            user_keywords = set(user_ans.lower().split())
            if expected_keywords:
                coverage = len(expected_keywords & user_keywords) / len(expected_keywords)
            else:
                coverage = 0.5
            
            completeness = (length_ratio * 0.4 + coverage * 0.6) * 100
            completeness_scores.append(completeness)
        
        return np.mean(completeness_scores) if completeness_scores else 0
    
    def _calc_consistency_score(self, report_card: List[Dict]) -> float:
        """
        Check for consistency across answers:
        - Contradictions
        - Skill claims vs. demonstrated knowledge
        """
        # Group answers by topic
        topic_scores = {}
        for entry in report_card:
            topic = entry.get('topic', 'General')
            score = entry.get('score', 0)
            if topic not in topic_scores:
                topic_scores[topic] = []
            topic_scores[topic].append(score)
        
        # Calculate variance within topics (high variance = inconsistent)
        variances = []
        for scores in topic_scores.values():
            if len(scores) > 1:
                variances.append(np.std(scores))
        
        if not variances:
            return 75  # Default to moderate consistency
        
        avg_variance = np.mean(variances)
        
        # Convert variance to score (low variance = high consistency)
        consistency = max(0, 100 - avg_variance)
        return consistency
    
    def _calc_engagement_score(self, report_card: List[Dict]) -> float:
        """
        Measure engagement through:
        - Average answer length
        - Use of examples
        - Asking clarifying questions
        """
        total_length = 0
        example_count = 0
        
        EXAMPLE_INDICATORS = ['for example', 'for instance', 'such as', 'like when', 'in my experience']
        
        for entry in report_card:
            answer = entry.get('user_ans', '')
            total_length += len(answer)
            
            for indicator in EXAMPLE_INDICATORS:
                if indicator in answer.lower():
                    example_count += 1
                    break
        
        avg_length = total_length / len(report_card) if report_card else 0
        example_ratio = example_count / len(report_card) if report_card else 0
        
        # Ideal answer length: 100-200 chars
        length_score = min(100, (avg_length / 150) * 100)
        example_score = example_ratio * 100
        
        return (length_score * 0.6 + example_score * 0.4)
    
    def _calc_response_time_score(self, report_card: List[Dict]) -> float:
        """
        Score based on response times.
        Note: Requires timing data to be captured during interview.
        """
        # If timing data is not available, return neutral score
        times = [entry.get('response_time', None) for entry in report_card]
        valid_times = [t for t in times if t is not None]
        
        if not valid_times:
            return 70  # Default neutral score
        
        avg_time = np.mean(valid_times)
        
        # Ideal response time: 5-15 seconds
        if 5 <= avg_time <= 15:
            return 100
        elif avg_time < 5:
            # Too fast might indicate shallow answers
            return 60
        else:
            # Decreasing score for longer times
            return max(30, 100 - (avg_time - 15) * 2)
    
    def _get_confidence_level(self, score: float) -> str:
        """Map numeric score to confidence level."""
        for threshold, level in self.CONFIDENCE_LEVELS:
            if score >= threshold:
                return level
        return "Very Low"
    
    def _analyze_performance(self, metrics: ConfidenceMetrics) -> Tuple[List[str], List[str]]:
        """Identify strengths and areas for improvement."""
        strengths = []
        improvements = []
        
        if metrics.technical_accuracy >= 80:
            strengths.append("Strong technical knowledge")
        elif metrics.technical_accuracy < 50:
            improvements.append("Review core concepts for listed skills")
        
        if metrics.speech_fluency_score >= 80:
            strengths.append("Clear and articulate communication")
        elif metrics.speech_fluency_score < 50:
            improvements.append("Practice reducing filler words")
        
        if metrics.answer_completeness >= 75:
            strengths.append("Thorough and complete answers")
        elif metrics.answer_completeness < 50:
            improvements.append("Provide more detailed explanations")
        
        if metrics.consistency_score >= 80:
            strengths.append("Consistent knowledge across topics")
        elif metrics.consistency_score < 50:
            improvements.append("Focus on depth over breadth")
        
        if metrics.engagement_score >= 70:
            strengths.append("Good use of examples and context")
        elif metrics.engagement_score < 40:
            improvements.append("Include more real-world examples")
        
        return strengths, improvements
```

### 7.2 Verbal Confidence Feedback

```python
# verbal_feedback.py

class VerbalConfidenceFeedback:
    """Generates verbal feedback based on confidence analysis."""
    
    TEMPLATES = {
        "Very High": [
            "Excellent performance! You demonstrated strong confidence and deep technical knowledge.",
            "You showed outstanding preparation. Your answers were precise and well-articulated."
        ],
        "High": [
            "Great job overall. You appeared confident and handled most questions well.",
            "You demonstrated solid knowledge. With a bit more depth in some areas, you'd be even stronger."
        ],
        "Moderate": [
            "You showed decent understanding but could benefit from more preparation in some areas.",
            "Your confidence varied across topics. Consider focusing more on your weaker areas."
        ],
        "Low": [
            "You seemed uncertain in several areas. More practice would help build confidence.",
            "Consider reviewing the fundamentals before your next interview."
        ],
        "Very Low": [
            "There's significant room for improvement. Focus on building core knowledge first.",
            "I recommend thorough preparation before attempting technical interviews."
        ]
    }
    
    def generate_feedback(self, result: ConfidenceResult) -> str:
        """Generate verbal feedback script."""
        import random
        
        base = random.choice(self.TEMPLATES[result.confidence_level])
        
        # Add specific feedback
        feedback_parts = [base]
        
        if result.strengths:
            feedback_parts.append(f"Your strengths include: {', '.join(result.strengths[:2])}.")
        
        if result.areas_for_improvement:
            feedback_parts.append(f"Areas to work on: {', '.join(result.areas_for_improvement[:2])}.")
        
        feedback_parts.append(f"Your overall confidence score is {result.overall_score} out of 100.")
        
        return " ".join(feedback_parts)
```

---

## 8. Error Handling & Resilience

### 8.1 Error Hierarchy

```python
# exceptions.py

class InterviewError(Exception):
    """Base exception for interview system."""
    pass

class ResumeError(InterviewError):
    """Errors related to resume processing."""
    pass

class ResumeExtractionError(ResumeError):
    """Failed to extract text from resume."""
    pass

class ResumeParseError(ResumeError):
    """Failed to parse resume structure."""
    pass

class APIError(InterviewError):
    """Errors related to external API calls."""
    pass

class GPTAPIError(APIError):
    """OpenAI API specific errors."""
    pass

class GPTRateLimitError(GPTAPIError):
    """Rate limit exceeded."""
    pass

class GPTTimeoutError(GPTAPIError):
    """API request timed out."""
    pass

class StateError(InterviewError):
    """Invalid state transition."""
    pass

class ConcurrencyError(InterviewError):
    """Thread synchronization error."""
    pass
```

### 8.2 Graceful Degradation Strategy

```python
# resilience.py

from functools import wraps
from typing import Callable, Any, Optional
import logging

logger = logging.getLogger(__name__)

class GracefulDegradation:
    """
    Implements graceful degradation when components fail.
    Ensures interview can continue even with partial failures.
    """
    
    @staticmethod
    def with_fallback(
        fallback_fn: Callable,
        error_types: tuple = (Exception,),
        log_error: bool = True
    ):
        """
        Decorator that calls fallback function on error.
        
        Usage:
            @GracefulDegradation.with_fallback(get_local_question)
            def get_resume_question():
                return gpt_client.generate()
        """
        def decorator(fn: Callable) -> Callable:
            @wraps(fn)
            def wrapper(*args, **kwargs):
                try:
                    return fn(*args, **kwargs)
                except error_types as e:
                    if log_error:
                        logger.warning(f"{fn.__name__} failed: {e}. Using fallback.")
                    return fallback_fn(*args, **kwargs)
            return wrapper
        return decorator
    
    @staticmethod
    def retry_with_backoff(
        max_retries: int = 3,
        initial_delay: float = 1.0,
        max_delay: float = 30.0,
        backoff_factor: float = 2.0
    ):
        """
        Decorator for retrying with exponential backoff.
        """
        def decorator(fn: Callable) -> Callable:
            @wraps(fn)
            def wrapper(*args, **kwargs):
                delay = initial_delay
                last_exception = None
                
                for attempt in range(max_retries):
                    try:
                        return fn(*args, **kwargs)
                    except Exception as e:
                        last_exception = e
                        if attempt < max_retries - 1:
                            logger.info(f"Retry {attempt + 1}/{max_retries} after {delay}s")
                            time.sleep(delay)
                            delay = min(delay * backoff_factor, max_delay)
                
                raise last_exception
            return wrapper
        return decorator

class FallbackChain:
    """
    Chain of fallback handlers for question sourcing.
    """
    
    def __init__(self):
        self.handlers = []
    
    def add_handler(self, handler: Callable, priority: int = 0):
        """Add a handler with priority (higher = try first)."""
        self.handlers.append((priority, handler))
        self.handlers.sort(key=lambda x: -x[0])
    
    def execute(self, *args, **kwargs) -> Optional[Any]:
        """Try handlers in priority order until one succeeds."""
        for priority, handler in self.handlers:
            try:
                result = handler(*args, **kwargs)
                if result is not None:
                    return result
            except Exception as e:
                logger.debug(f"Handler {handler.__name__} failed: {e}")
                continue
        return None

# Usage example
question_fallback_chain = FallbackChain()
question_fallback_chain.add_handler(get_resume_question, priority=100)
question_fallback_chain.add_handler(get_adaptive_question, priority=80)
question_fallback_chain.add_handler(get_local_question, priority=50)
question_fallback_chain.add_handler(get_generic_question, priority=10)
```

### 8.3 Recovery Procedures

```python
# recovery.py

class InterviewRecovery:
    """
    Handles recovery from various failure scenarios.
    """
    
    def __init__(self, controller):
        self.controller = controller
        self.checkpoint_file = "interview_checkpoint.json"
    
    def save_checkpoint(self):
        """Save interview state for recovery."""
        checkpoint = {
            'state': self.controller.state.name,
            'questions_asked': list(self.controller.asked_q_hashes),
            'report_card': self.controller.report_card,
            'skills_queue': self.controller.skills_queue,
            'current_topic': self.controller.current_topic,
            'timestamp': time.time()
        }
        with open(self.checkpoint_file, 'w') as f:
            json.dump(checkpoint, f)
    
    def recover_from_checkpoint(self) -> bool:
        """Attempt to recover from last checkpoint."""
        if not os.path.exists(self.checkpoint_file):
            return False
        
        try:
            with open(self.checkpoint_file, 'r') as f:
                checkpoint = json.load(f)
            
            # Only recover if checkpoint is recent (< 30 minutes)
            if time.time() - checkpoint['timestamp'] > 1800:
                return False
            
            self.controller.state = InterviewState[checkpoint['state']]
            self.controller.asked_q_hashes = set(checkpoint['questions_asked'])
            self.controller.report_card = checkpoint['report_card']
            self.controller.skills_queue = checkpoint['skills_queue']
            self.controller.current_topic = checkpoint['current_topic']
            
            return True
        except Exception as e:
            logger.error(f"Recovery failed: {e}")
            return False
    
    def handle_gpt_failure(self):
        """Handle complete GPT API failure."""
        logger.warning("GPT API unavailable. Switching to local-only mode.")
        self.controller.resume_bank.disable()
        self.controller.speak("I'll continue with standard questions.")
    
    def handle_audio_failure(self):
        """Handle microphone/audio failure."""
        logger.error("Audio system failure.")
        self.controller.speak("I'm having trouble hearing you. Please check your microphone.")
        # Allow retry or skip
```

---

## 9. Module Structure

### 9.1 Complete Directory Structure

```
backend/
├── __init__.py
├── core/
│   ├── __init__.py
│   ├── interview_controller.py    # Main controller (V5 - Updated)
│   ├── question_bank.py           # Local question storage
│   ├── answer_evaluator.py        # Semantic similarity scoring
│   ├── state_machine.py           # NEW: Interview state management
│   └── question_router.py         # NEW: Multi-source question routing
│
├── resume/                        # NEW MODULE
│   ├── __init__.py
│   ├── extractor.py               # PDF/DOCX text extraction
│   ├── parser.py                  # Resume structure parsing
│   ├── gpt_client.py              # OpenAI API client
│   ├── question_generator.py      # GPT prompt engineering
│   └── resume_question_bank.py    # Resume-based Q&A storage
│
├── scoring/                       # NEW MODULE
│   ├── __init__.py
│   ├── confidence_scorer.py       # Multi-factor confidence
│   └── verbal_feedback.py         # Spoken feedback generation
│
├── utils/
│   ├── __init__.py
│   ├── exceptions.py              # NEW: Custom exceptions
│   ├── resilience.py              # NEW: Retry & fallback logic
│   ├── recovery.py                # NEW: Checkpoint & recovery
│   ├── secrets_manager.py         # NEW: API key management
│   └── logging_config.py          # NEW: Structured logging
│
├── ml/
│   ├── __init__.py
│   ├── data/
│   │   └── ...
│   ├── models/
│   │   └── intent_classifier.py
│   └── training/
│       └── intent_predictor.py
│
└── config/
    ├── __init__.py
    ├── api_config.py              # NEW: API configurations
    └── prompts.py                 # NEW: GPT prompt templates
```

### 9.2 Module Dependencies

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MODULE DEPENDENCY GRAPH                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│                        ┌─────────────────────┐                           │
│                        │ interview_controller│                           │
│                        │       (V5)          │                           │
│                        └──────────┬──────────┘                           │
│                                   │                                      │
│          ┌────────────────────────┼────────────────────────┐             │
│          │                        │                        │             │
│          ▼                        ▼                        ▼             │
│  ┌───────────────┐      ┌─────────────────┐      ┌─────────────────┐    │
│  │ question_     │      │   resume/       │      │   scoring/      │    │
│  │ router        │      │   module        │      │   module        │    │
│  └───────┬───────┘      └────────┬────────┘      └────────┬────────┘    │
│          │                       │                        │             │
│          │               ┌───────┴───────┐               │             │
│          │               │               │               │             │
│          ▼               ▼               ▼               ▼             │
│  ┌───────────────┐  ┌─────────┐  ┌───────────┐  ┌───────────────┐      │
│  │ question_bank │  │extractor│  │gpt_client │  │confidence_    │      │
│  │ (local)       │  └─────────┘  └─────┬─────┘  │scorer         │      │
│  └───────────────┘                     │        └───────────────┘      │
│                                        │                                │
│                                        ▼                                │
│                              ┌─────────────────┐                        │
│                              │ OpenAI API      │                        │
│                              │ (External)      │                        │
│                              └─────────────────┘                        │
│                                                                          │
│  SHARED UTILITIES:                                                       │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐               │
│  │ state_machine │  │ resilience    │  │ exceptions    │               │
│  └───────────────┘  └───────────────┘  └───────────────┘               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Implementation Phases

### 10.1 Phase Breakdown

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      IMPLEMENTATION ROADMAP                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 2.75-A: Foundation (Week 1)                                       │
│  ════════════════════════════════                                        │
│  □ Create resume/ module structure                                       │
│  □ Implement ResumeExtractor (PDF + DOCX)                                │
│  □ Implement ResumeParser (section detection)                            │
│  □ Create GPTClient with retry logic                                     │
│  □ Add API key management (SecretsManager)                               │
│  □ Unit tests for extraction and parsing                                 │
│                                                                          │
│  PHASE 2.75-B: Question Generation (Week 2)                              │
│  ═════════════════════════════════════════                               │
│  □ Design prompt templates for GPT                                       │
│  □ Implement QuestionGenerator                                           │
│  □ JSON parsing with fallback handling                                   │
│  □ ResumeQuestionBank for storing generated Q&A                          │
│  □ Integration tests with mock GPT responses                             │
│                                                                          │
│  PHASE 2.75-C: Async Integration (Week 3)                                │
│  ══════════════════════════════════════                                  │
│  □ Create StateMachine class                                             │
│  □ Implement thread-safe QuestionPriorityQueue                           │
│  □ Build QuestionRouter with fallback chain                              │
│  □ Update InterviewController (V5) for parallel processing               │
│  □ Implement "ask local while GPT processes" flow                        │
│  □ Add checkpoint/recovery system                                        │
│                                                                          │
│  PHASE 2.75-D: Confidence Scoring (Week 4)                               │
│  ═════════════════════════════════════════                               │
│  □ Implement ConfidenceScorer with all metrics                           │
│  □ Create verbal feedback generator                                      │
│  □ Integrate into report generation                                      │
│  □ End-to-end testing                                                    │
│                                                                          │
│  PHASE 2.75-E: Polish & Testing (Week 5)                                 │
│  ══════════════════════════════════════                                  │
│  □ Edge case handling (thin resumes, API failures)                       │
│  □ Performance optimization                                              │
│  □ Mock interview test scenarios                                         │
│  □ Documentation and cleanup                                             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Detailed Tasks

#### Phase 2.75-A: Foundation

| Task | File | Description | Priority |
|------|------|-------------|----------|
| Create module structure | `resume/__init__.py` | Initialize resume module | P0 |
| PDF extraction | `resume/extractor.py` | PyMuPDF-based extraction | P0 |
| DOCX extraction | `resume/extractor.py` | python-docx integration | P0 |
| OCR fallback | `resume/extractor.py` | Tesseract for scanned PDFs | P1 |
| Section detection | `resume/parser.py` | Regex patterns for sections | P0 |
| Skill extraction | `resume/parser.py` | NLP-based skill detection | P0 |
| API client | `resume/gpt_client.py` | OpenAI wrapper with retries | P0 |
| Secrets management | `utils/secrets_manager.py` | Secure API key storage | P0 |

#### Phase 2.75-B: Question Generation

| Task | File | Description | Priority |
|------|------|-------------|----------|
| Prompt templates | `config/prompts.py` | V1 and V2 prompt designs | P0 |
| Generator class | `resume/question_generator.py` | GPT interaction logic | P0 |
| JSON parsing | `resume/question_generator.py` | Robust response parsing | P0 |
| Fallback parser | `resume/question_generator.py` | Regex backup for malformed JSON | P1 |
| Question bank | `resume/resume_question_bank.py` | Thread-safe Q&A storage | P0 |
| Thin resume detection | `resume/parser.py` | Capacity calculation | P0 |

#### Phase 2.75-C: Async Integration

| Task | File | Description | Priority |
|------|------|-------------|----------|
| State machine | `core/state_machine.py` | Thread-safe state transitions | P0 |
| Priority queue | `core/question_router.py` | Heapq-based question queue | P0 |
| Question router | `core/question_router.py` | Multi-source routing logic | P0 |
| Controller V5 | `core/interview_controller.py` | Parallel resume processing | P0 |
| Lock management | `core/interview_controller.py` | Deadlock prevention | P0 |
| Recovery system | `utils/recovery.py` | Checkpoint save/restore | P1 |

#### Phase 2.75-D: Confidence Scoring

| Task | File | Description | Priority |
|------|------|-------------|----------|
| Accuracy metric | `scoring/confidence_scorer.py` | Semantic similarity score | P0 |
| Fluency metric | `scoring/confidence_scorer.py` | Filler word detection | P0 |
| Completeness metric | `scoring/confidence_scorer.py` | Answer coverage analysis | P0 |
| Consistency metric | `scoring/confidence_scorer.py` | Cross-topic variance | P1 |
| Engagement metric | `scoring/confidence_scorer.py` | Example detection | P1 |
| Verbal feedback | `scoring/verbal_feedback.py` | TTS script generation | P0 |

---

## 11. Testing Strategy

### 11.1 Test Categories

```python
# tests/test_resume_extraction.py

import pytest
from backend.resume.extractor import ResumeExtractor

class TestResumeExtraction:
    """Unit tests for resume extraction."""
    
    @pytest.fixture
    def extractor(self):
        return ResumeExtractor()
    
    def test_pdf_extraction_success(self, extractor, sample_pdf):
        """Test successful PDF text extraction."""
        text, method, confidence = extractor.extract(sample_pdf)
        assert len(text) > 100
        assert method == "direct"
        assert confidence > 0.5
    
    def test_docx_extraction_success(self, extractor, sample_docx):
        """Test successful DOCX text extraction."""
        text, method, confidence = extractor.extract(sample_docx)
        assert len(text) > 100
        assert method == "docx"
    
    def test_unsupported_format(self, extractor):
        """Test handling of unsupported file formats."""
        with pytest.raises(ValueError, match="Unsupported format"):
            extractor.extract("resume.xyz")
    
    def test_empty_pdf(self, extractor, empty_pdf):
        """Test handling of empty/corrupted PDFs."""
        text, method, confidence = extractor.extract(empty_pdf)
        assert len(text.strip()) == 0 or method == "ocr"

# tests/test_question_generator.py

class TestQuestionGenerator:
    """Unit tests for GPT question generation."""
    
    def test_question_count_normal_resume(self, generator, sample_parsed_resume):
        """Test correct number of questions for normal resume."""
        result = generator.generate(sample_parsed_resume, num_questions=15)
        assert len(result.questions) >= 10
        assert len(result.questions) <= 20
    
    def test_question_count_thin_resume(self, generator, thin_parsed_resume):
        """Test reduced questions for thin resume."""
        result = generator.generate(thin_parsed_resume, num_questions=15)
        assert len(result.questions) < 10
    
    def test_question_type_distribution(self, generator, sample_parsed_resume):
        """Test that questions have proper type distribution."""
        result = generator.generate(sample_parsed_resume)
        types = [q.question_type for q in result.questions]
        
        # Should have at least 3 different types
        assert len(set(types)) >= 3
    
    @pytest.mark.integration
    def test_actual_gpt_call(self, generator_with_real_api, sample_parsed_resume):
        """Integration test with actual GPT API (requires API key)."""
        result = generator_with_real_api.generate(sample_parsed_resume)
        assert result.generation_time < 30  # Should complete in 30s
        assert all(q.expected_answer for q in result.questions)

# tests/test_concurrency.py

class TestConcurrency:
    """Tests for race conditions and thread safety."""
    
    def test_parallel_resume_processing(self, controller):
        """Test that resume processing runs parallel to interview."""
        import threading
        import time
        
        results = {'resume_done': False, 'questions_asked': 0}
        
        def mock_resume_processing():
            time.sleep(2)  # Simulate GPT delay
            results['resume_done'] = True
        
        def mock_interview_loop():
            while results['questions_asked'] < 3:
                time.sleep(0.5)
                results['questions_asked'] += 1
        
        t1 = threading.Thread(target=mock_resume_processing)
        t2 = threading.Thread(target=mock_interview_loop)
        
        t1.start()
        t2.start()
        t1.join()
        t2.join()
        
        # Interview should have asked questions while resume was processing
        assert results['questions_asked'] >= 2
        assert results['resume_done']
    
    def test_no_duplicate_questions(self, controller):
        """Test that no question is asked twice."""
        asked = set()
        for _ in range(20):
            q = controller.get_next_question()
            if q:
                assert q.question not in asked
                asked.add(q.question)
    
    def test_state_transition_thread_safety(self, state_machine):
        """Test concurrent state transitions."""
        import threading
        
        errors = []
        
        def try_transition():
            try:
                state_machine.transition(InterviewState.DEEP_DIVE_LOCAL)
            except StateError as e:
                errors.append(e)
        
        threads = [threading.Thread(target=try_transition) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        
        # Only one should succeed
        assert len([e for e in errors]) >= 9

# tests/test_scenarios.py

class TestInterviewScenarios:
    """End-to-end scenario tests."""
    
    def test_ideal_candidate_with_resume(self, mock_controller):
        """Simulate ideal candidate with rich resume."""
        # Upload rich resume
        mock_controller.process_resume("sample_rich_resume.pdf")
        
        # Start interview
        mock_controller.simulate_intro("I'm a software engineer with 5 years experience...")
        
        # Answer questions well
        for _ in range(10):
            q = mock_controller.get_question()
            mock_controller.simulate_answer(q, quality="good")
        
        report = mock_controller.generate_report()
        assert report.confidence.overall_score >= 75
        assert report.confidence.confidence_level in ["High", "Very High"]
    
    def test_thin_resume_fallback(self, mock_controller):
        """Test fallback to local questions for thin resume."""
        mock_controller.process_resume("sample_thin_resume.pdf")
        
        # Check that local questions are used as fallback
        questions_used = []
        for _ in range(10):
            q = mock_controller.get_question()
            questions_used.append(q.source)
        
        # Should have mix of resume and local
        assert QuestionSource.LOCAL in questions_used
    
    def test_gpt_failure_recovery(self, mock_controller):
        """Test graceful handling of GPT API failure."""
        # Simulate GPT failure
        mock_controller.gpt_client.force_failure = True
        
        mock_controller.process_resume("sample_resume.pdf")
        mock_controller.simulate_intro("I know Python...")
        
        # Interview should continue with local questions
        q = mock_controller.get_question()
        assert q is not None
        assert q.source == QuestionSource.LOCAL
```

### 11.2 Test Coverage Requirements

| Module | Minimum Coverage | Critical Paths |
|--------|-----------------|----------------|
| `resume/extractor.py` | 90% | PDF/DOCX extraction, OCR fallback |
| `resume/parser.py` | 85% | Section detection, skill extraction |
| `resume/gpt_client.py` | 90% | Retry logic, error handling |
| `resume/question_generator.py` | 85% | JSON parsing, fallback |
| `core/state_machine.py` | 95% | All transitions, thread safety |
| `core/question_router.py` | 90% | Priority ordering, deduplication |
| `scoring/confidence_scorer.py` | 85% | All metric calculations |

---

## 12. Performance Considerations

### 12.1 Latency Budget

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        LATENCY BUDGET ANALYSIS                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  USER PERCEPTION: < 2 seconds between question end and next question    │
│                                                                          │
│  BREAKDOWN:                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ OPERATION                      │ CURRENT │ TARGET │ STRATEGY        │ │
│  ├────────────────────────────────┼─────────┼────────┼─────────────────┤ │
│  │ User finishes speaking         │    0ms  │   0ms  │ -               │ │
│  │ Audio capture complete         │  100ms  │ 100ms  │ -               │ │
│  │ TTS starts next question       │    0ms  │   0ms  │ Pre-queued      │ │
│  │ Total perceived delay          │  100ms  │ <200ms │ ACHIEVED ✓      │ │
│  └────────────────────────────────┴─────────┴────────┴─────────────────┘ │
│                                                                          │
│  BACKGROUND OPERATIONS (don't affect user):                              │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Resume extraction              │   500ms │  500ms │ Threading       │ │
│  │ GPT question generation        │    3-5s │    N/A │ Parallel        │ │
│  │ Whisper transcription          │    2-3s │    N/A │ Background      │ │
│  │ Answer evaluation              │   200ms │  200ms │ Background      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 12.2 Memory Management

```python
# memory_optimization.py

class MemoryOptimization:
    """
    Strategies for managing memory in long interviews.
    """
    
    @staticmethod
    def clear_processed_audio():
        """Clear audio buffers after processing."""
        import gc
        gc.collect()
    
    @staticmethod
    def limit_question_cache(cache, max_size=100):
        """Limit question cache size using LRU."""
        if len(cache) > max_size:
            # Remove oldest entries
            sorted_items = sorted(cache.items(), key=lambda x: x[1]['timestamp'])
            for key, _ in sorted_items[:len(cache) - max_size]:
                del cache[key]
    
    @staticmethod
    def stream_large_responses():
        """Use streaming for large GPT responses to reduce memory."""
        # Implemented in GPTClient with stream=True
        pass
```

### 12.3 API Cost Optimization

```python
# cost_management.py

class CostManager:
    """
    Track and optimize API costs.
    """
    
    # GPT-4 Turbo pricing (as of 2024)
    COST_PER_1K_INPUT = 0.01
    COST_PER_1K_OUTPUT = 0.03
    
    def __init__(self, budget_limit=1.0):  # $1 per session
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.budget_limit = budget_limit
    
    def track_usage(self, input_tokens: int, output_tokens: int):
        """Track token usage."""
        self.total_input_tokens += input_tokens
        self.total_output_tokens += output_tokens
        
        current_cost = self.calculate_cost()
        if current_cost > self.budget_limit * 0.8:
            logging.warning(f"Approaching budget limit: ${current_cost:.2f}")
    
    def calculate_cost(self) -> float:
        """Calculate current session cost."""
        input_cost = (self.total_input_tokens / 1000) * self.COST_PER_1K_INPUT
        output_cost = (self.total_output_tokens / 1000) * self.COST_PER_1K_OUTPUT
        return input_cost + output_cost
    
    def should_use_cached_questions(self) -> bool:
        """Determine if we should use cached questions to save cost."""
        return self.calculate_cost() > self.budget_limit * 0.5
```

---

## 13. Dependencies

### 13.1 New Dependencies to Add

```python
# Additional requirements for Phase 2.75

# Resume Processing
PyMuPDF>=1.23.0         # PDF text extraction (fitz)
python-docx>=0.8.11     # DOCX parsing
pdf2image>=1.16.0       # For OCR fallback
pytesseract>=0.3.10     # OCR engine wrapper

# OpenAI Integration
openai>=1.12.0          # GPT API client
tiktoken>=0.5.0         # Token counting
python-dotenv>=1.0.0    # Load .env file (GPT_API_KEY)

# Security
cryptography>=42.0.0    # API key encryption
keyring>=25.0.0         # System keyring access

# Testing
pytest>=8.0.0
pytest-cov>=4.0.0
pytest-asyncio>=0.23.0
```

### 13.2 Updated requirements.txt

```
# AI Smart Interviewer - Phase 2.75 Dependencies
# Python 3.10+ recommended

# === Core ML / Deep Learning ===
torch>=2.2.2
numpy>=1.26.4
tensorflow>=2.16.1 
tf-keras>=2.16.0

# === NLP / Embeddings ===
sentence-transformers>=2.6.0
transformers>=4.40.0
huggingface_hub>=0.22.0

# === Resume Processing (NEW) ===
PyMuPDF>=1.23.0
python-docx>=0.8.11
pdf2image>=1.16.0
pytesseract>=0.3.10

# === OpenAI Integration (NEW) ===
openai>=1.12.0
tiktoken>=0.5.0
python-dotenv>=1.0.0    # For loading GPT_API_KEY from .env

# === Data Processing ===
scikit-learn>=1.4.0

# === Visualization ===
matplotlib>=3.8.3

# === Audio Processing ===
sounddevice>=0.5.0
openai-whisper>=20231117

# === Security (NEW) ===
cryptography>=42.0.0
keyring>=25.0.0

# === Windows TTS ===
pywin32>=306; sys_platform == 'win32'

# === Testing (NEW) ===
pytest>=8.0.0
pytest-cov>=4.0.0
pytest-asyncio>=0.23.0
```

---

## 14. API Configuration

### 14.1 Environment Variables

```bash
# .env file (DO NOT COMMIT)
# NOTE: Your project already has .env with GPT_API_KEY set

# OpenAI Configuration (EXISTING IN YOUR .env)
GPT_API_KEY=sk-proj-...  # Already configured in your .env

# Optional Additional Settings
GPT_MODEL=gpt-4-turbo-preview
GPT_MAX_TOKENS=4000
GPT_TEMPERATURE=0.7

# Rate Limiting
MAX_REQUESTS_PER_MINUTE=50
REQUEST_COOLDOWN_SECONDS=0.5

# Cost Management
MAX_COST_PER_SESSION=1.00

# Debug
DEBUG_MODE=false
LOG_LEVEL=INFO
```

### 14.2 Configuration Loading

```python
# config/settings.py

from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    """Application settings loaded from environment."""
    
    # OpenAI - Maps to GPT_API_KEY in your .env file
    gpt_api_key: str  # Will load from GPT_API_KEY in .env
    gpt_model: str = "gpt-4-turbo-preview"
    gpt_max_tokens: int = 4000
    gpt_temperature: float = 0.7
    
    # Rate Limiting
    max_requests_per_minute: int = 50
    request_cooldown_seconds: float = 0.5
    
    # Cost
    max_cost_per_session: float = 1.0
    
    # Debug
    debug_mode: bool = False
    log_level: str = "INFO"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
```

---

## 15. Conclusion

This document provides a comprehensive technical implementation plan for Phase 2.75 of the AI Smart Interviewer. The key innovations include:

1. **Parallel Processing Architecture**: Resume processing runs in background while interview proceeds with local questions, ensuring zero perceived latency.

2. **Robust Concurrency Handling**: Thread-safe state machines, priority queues, and proper lock management prevent race conditions.

3. **Graceful Degradation**: Multiple fallback chains ensure the interview continues even when components fail.

4. **Multi-Factor Confidence Scoring**: Comprehensive candidate assessment beyond simple answer matching.

5. **Modular Design**: Clean separation of concerns enables independent testing and future extensions.

The implementation follows industry best practices for:
- Thread synchronization
- API integration with retry logic
- Error handling and recovery
- Security (API key management)
- Performance optimization
- Comprehensive testing

---

## Appendix A: Quick Reference

### State Transition Commands
```python
# Valid state transitions
INIT → WAITING_FOR_RESUME
WAITING_FOR_RESUME → RESUME_PROCESSING | INTRO (skip resume)
RESUME_PROCESSING → INTRO
INTRO → DEEP_DIVE_LOCAL | DEEP_DIVE_RESUME
DEEP_DIVE_LOCAL → DEEP_DIVE_RESUME (when resume ready) | MIX_ROUND
DEEP_DIVE_RESUME → MIX_ROUND | DEEP_DIVE_LOCAL (fallback)
MIX_ROUND → FINISHED
```

### Lock Acquisition Order
```python
# Always acquire in this order to prevent deadlock
1. state_lock
2. question_bank_lock
3. context_lock
4. report_lock
```

### Priority Levels
```python
PRIORITY_RESUME_EXPERIENCE = 100
PRIORITY_RESUME_PROJECT = 90
PRIORITY_ADAPTIVE = 80
PRIORITY_RESUME_SKILLS = 70
PRIORITY_LOCAL_SCENARIO = 60
PRIORITY_LOCAL_THEORETICAL = 50
PRIORITY_FALLBACK = 10
```

---

*Document Version: 2.0*  
*Last Updated: Phase 2.75 Implementation Complete (Gemini Migration + Natural Interviewing)*  
*Author: AI Smart Interviewer Development Team*

---

## 16. Implementation Updates: Gemini Migration & Natural Interviewing

This section documents the actual implementation changes made during Phase 2.75 development.

### 16.1 API Migration: OpenAI → Google Gemini

Due to OpenAI API quota exhaustion (429 errors), we migrated to Google Gemini 2.5 Flash.

#### 16.1.1 SDK Migration

```python
# OLD: google-generativeai (deprecated)
import google.generativeai as genai
genai.configure(api_key=api_key)
model = genai.GenerativeModel("gemini-1.5-flash")

# NEW: google-genai (current)
from google import genai
client = genai.Client(api_key=api_key)
response = client.models.generate_content(
    model="models/gemini-2.5-flash",
    contents=[...]
)
```

#### 16.1.2 Direct PDF Upload (Gemini Vision)

Instead of extracting text and sending it, we now upload the PDF directly:

```python
# gemini_client.py - generate_with_file()

def generate_with_file(self, prompt: str, file_path: str, ...) -> str:
    """Upload file directly to Gemini for vision-based processing."""
    
    # Read PDF as bytes
    with open(file_path, "rb") as f:
        pdf_bytes = f.read()
    
    # Create multimodal content
    contents = [
        types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
        types.Part.from_text(text=prompt)
    ]
    
    # Call Gemini with file
    response = self.client.models.generate_content(
        model=self.model,
        contents=contents,
        config=self.generation_config
    )
    return response.text
```

**Benefits:**
- Gemini sees original formatting (tables, bullet points, columns)
- No text extraction errors or OCR issues
- Better understanding of resume structure

#### 16.1.3 Robust JSON Parsing

Gemini sometimes returns truncated JSON. We added repair logic:

```python
def _repair_json(self, response: str) -> str:
    """Attempt to repair truncated or malformed JSON."""
    
    # Count brackets
    open_braces = response.count('{')
    close_braces = response.count('}')
    open_brackets = response.count('[')
    close_brackets = response.count(']')
    
    # Add missing closures
    response += ']' * (open_brackets - close_brackets)
    response += '}' * (open_braces - close_braces)
    
    return response

def _extract_questions_fallback(self, response: str, parsed_resume) -> List[GeneratedQuestion]:
    """Extract questions from malformed response using regex."""
    questions = []
    
    # Pattern: "question": "..."
    pattern = r'"question"\s*:\s*"([^"]+)"'
    matches = re.findall(pattern, response)
    
    for q_text in matches:
        if len(q_text) > 20:  # Filter out fragments
            questions.append(GeneratedQuestion(
                question=q_text,
                question_type=QuestionType.THEORETICAL,
                difficulty=QuestionDifficulty.MEDIUM,
                expected_answer="Resume-based question",
                section_source="general"
            ))
    
    return questions
```

### 16.2 Prompt Engineering: Natural Interviewing

#### 16.2.1 System Prompt (Interviewer Persona)

```python
SYSTEM_PROMPT = """You are a senior technical interviewer with 15+ years at FAANG companies.
You conduct interviews like a REAL human - conversational, curious, and deeply probing.

YOUR INTERVIEWING STYLE:
1. You DON'T ask robotic, one-line questions
2. You GO DEEP on each topic - "Why did you choose that?", "What if we used X instead?", "How would you scale this?"
3. You CONNECT questions naturally - one answer leads to the next question
4. You sound like a curious colleague, NOT a checklist reader
5. You CHALLENGE the candidate respectfully - "That's interesting, but what about...?"

QUESTION FLOW PHILOSOPHY:
- Start with their MOST IMPRESSIVE achievement and dig deep
- Move from "what you did" → "why you did it" → "what you learned" → "what you'd do differently"
- For each technology/project, ask: implementation → challenges → alternatives → scaling
- End each topic with a forward-looking question: "How would you improve this now?"

FORBIDDEN PATTERNS (NEVER use these):
❌ "Tell me about your roles and responsibilities"
❌ "Describe your experience with X"  
❌ "What projects have you worked on?"
❌ "Can you explain your experience?"
❌ Any question that could apply to ANY resume

REQUIRED PATTERNS (ALWAYS use these):
✅ Reference EXACT project names, company names, tech stack, metrics from resume
✅ Ask "Why did you choose [specific tech] over [alternative]?"
✅ Ask "You achieved [specific metric]. Walk me through how."
✅ Ask "What would break first if this scaled 10x?"
✅ Ask "If you rebuilt [project] today, what would you change?"

OUTPUT: Valid JSON. Each question must sound like something a real interviewer would say out loud."""
```

#### 16.2.2 Question Distribution Prompt

```python
DIRECT_PDF_PROMPT = """Read this resume THOROUGHLY. You are about to interview this candidate.

Generate {num_questions} interview questions that form a NATURAL CONVERSATION FLOW.

QUESTION TYPES TO MIX:

   DEEP-DIVE (40%): Explore ONE thing deeply
   - "In [Project], you used [Tech]. Walk me through a specific bug you encountered and how you debugged it."
   - "You achieved [X% improvement]. What metrics did you track? What surprised you?"
   
   TRADEOFF (25%): Test decision-making
   - "Why [Tech A] over [Tech B] for [this specific use case in their project]?"
   - "You chose [Architecture]. What would you sacrifice to make it 10x faster?"
   
   SCALING/EDGE CASES (20%): Test systems thinking
   - "Your [system] handles [current load]. What breaks first at 100x scale?"
   - "What's the failure mode you're most worried about in [their project]?"
   
   RETROSPECTIVE (15%): Test growth mindset
   - "If you rebuilt [Project] from scratch today, what would you do differently?"
   - "What's the one thing you learned at [Company] that you couldn't have learned elsewhere?"

SECTION COVERAGE (MANDATORY - STRICT REQUIREMENT):
   You MUST generate questions covering ALL these sections. Distribute as follows:
   
   IF resume has the section, ask AT LEAST this many questions:
   - WORK EXPERIENCES: 3-4 questions (Professional roles, impact, challenges faced)
   - INTERNSHIPS: 2-3 questions (Learning, contributions, what you'd do differently)
   - PROJECTS: 3-4 questions (Architecture, tech stacks, challenges, scaling)
   - SKILLS/TECHNOLOGIES: 2-3 questions (Conceptual depth, "how it works under the hood")
   - LEADERSHIP: 1-2 questions (Team management, conflict resolution, initiative)
   - EDUCATION: 1-2 questions (Relevant coursework, thesis, foundational knowledge)
   
   IMPORTANT: Do NOT skip any section that exists in the resume!
   If the resume mentions an internship, you MUST ask about it.
   If the resume mentions leadership roles, you MUST ask about them.
   If the resume mentions education details, you MUST ask about them.

PERSONALIZATION REQUIREMENTS:
   Every single question MUST contain at least ONE of:
   - Exact company name from their resume
   - Exact project name from their resume
   - Exact technology/tool from their resume
   - Exact metric/achievement from their resume
   
   If the resume mentions "Improved API latency by 40%", your question should say "40%", not "improved latency"

OUTPUT FORMAT (JSON):
{
    "summary": "2-3 sentence profile: their level, key strengths, what makes them interesting",
    "questions": [
        {
            "question": "The full question as you would SAY it out loud to the candidate",
            "type": "deep_dive|tradeoff|scaling|retrospective|behavioral",
            "difficulty": "easy|medium|hard",
            "expected_answer": "Key points a GOOD candidate would mention (be specific)",
            "section": "experience|projects|skills|internships|leadership|education",
            "keywords": ["keywords", "for", "adaptive", "followup"],
            "follow_ups": ["Natural follow-up if they give a good answer", "Probe if they're vague"],
            "why_this_question": "Brief note on what you're testing"
        }
    ]
}"""
```

### 16.3 Interview Controller Updates

#### 16.3.1 Post-Resume Questioning Logic

When resume questions are exhausted, the interview continues intelligently:

```python
# interview_controller.py - RESUME_DEEP_DIVE state

else:
    # Resume questions exhausted
    total_asked = self.resume_bank.get_stats()['asked'] if self.resume_bank else 0
    print(f"   [Main] Resume questions exhausted. Total asked: {total_asked}")
    
    if total_asked < 15:
        # Not enough questions asked - PROMPT USER
        self.speak("That covers the main points from your resume. What else do you do? Any other technologies or projects you'd like to discuss?")
        
        audio = self.listen()
        response_text = self.transcribe_blocking(audio)
        
        # Check for new skills
        conf_topics = self.router.predict_with_scores(response_text, threshold=0.3)
        new_skills = [t[0] for t in conf_topics]
        
        if new_skills:
            # Condition 1: User mentions new skills
            self.speak(f"Great, let's discuss {', '.join(new_skills)}.")
            for skill in new_skills:
                if skill not in self.skills_detected:
                    self.skills_detected.append(skill)
                    self.skills_queue.append(skill)
            
            self.state = InterviewState.DEEP_DIVE
            self.current_topic = self.skills_queue.pop(0)
            
        else:
            # Condition 2: User says "that's it" - STILL CONTINUE!
            print("   [Main] User has no more to add. Continuing with local question bank.")
            
            if self.skills_detected:
                self.speak(f"Alright. Let me ask a few more questions based on what we've discussed.")
                self.state = InterviewState.DEEP_DIVE
                self.current_topic = self.skills_detected[0]
            else:
                self.speak("Let me ask some general technical questions.")
                self.state = InterviewState.MIX_ROUND
    else:
        # Enough questions asked (>15) - still continue with local bank
        self.speak("Now let me ask you some more questions from our side.")
        self.state = InterviewState.DEEP_DIVE
        self.current_topic = self.skills_detected[0]
```

**Key Insight:** The interview **NEVER ends prematurely**. Even when the user says "that's all I have", we continue with:
1. Skills detected from their introduction
2. Skills parsed from their resume
3. Skills mentioned during the interview (via async transcription keyword detection)

#### 16.3.2 Skill Rotation After Topic Exhaustion

When questions for a topic run out, we rotate to other detected skills:

```python
# Logic for transitions in DEEP_DIVE state
if self.questions_asked_count >= QUESTIONS_PER_TOPIC:
    if self.skills_queue:
        # More skills in queue
        self.current_topic = self.skills_queue.pop(0)
        self.questions_asked_count = 0
        self.speak(f"Moving on to {self.current_topic}.")
    else:
        # No more skills in queue - rotate through detected skills
        remaining_skills = [s for s in self.skills_detected if s != self.current_topic]
        if remaining_skills:
            self.current_topic = random.choice(remaining_skills)
            self.questions_asked_count = 0
            self.speak(f"Let me ask more about {self.current_topic}.")
        else:
            # All skills covered - final mix round
            self.state = InterviewState.MIX_ROUND
            self.questions_asked_count = 0
            self.speak("Rapid fire round.")
```

#### 16.3.3 Question Flow Preservation

The priority queue now preserves Gemini's generation order:

```python
# resume_question_bank.py - add_questions()

def add_questions(self, question_set: ResumeQuestionSet) -> int:
    with self._lock:
        added_count = 0
        
        # Preserve generation order instead of sorting by difficulty
        current_base_priority = self._total_added * 10
        
        for i, q in enumerate(question_set.questions):
            # Deduplication
            q_normalized = q.question.lower().strip()
            if q_normalized in self._seen_questions:
                continue
            
            self._seen_questions.add(q_normalized)
            
            # Priority = generation order (Q1=10, Q2=20, Q3=30...)
            # This preserves Gemini's natural conversation chain
            priority = current_base_priority + (i * 10)
            
            pq = PrioritizedQuestion(priority=priority, question=q)
            self._pending_queue.put(pq)
            self._pending_list.append(pq)
            self._total_added += 1
            added_count += 1
        
        return added_count
```

### 16.4 Configuration Updates

#### 16.4.1 Updated gemini_client.py Config

```python
@dataclass
class GPTConfig:
    """Configuration for Gemini API calls."""
    model: str = "models/gemini-2.5-flash"  # Updated from gemini-1.5-flash
    max_tokens: int = 8192      # Increased from 4000
    temperature: float = 0.7
    max_retries: int = 5        # Increased from 3
    retry_delay: float = 2.0    # Increased from 1.0
    timeout: float = 90.0       # Increased from 60.0
```

#### 16.4.2 Environment Variables

```env
# .env file
GEMINI_API_KEY=your-gemini-api-key-here
```

### 16.5 Summary of All Changes

| File | Change | Purpose |
|------|--------|---------|
| `gemini_client.py` | SDK migration, model update, direct PDF upload | Use latest Gemini API |
| `question_generator.py` | Complete prompt rewrite | Natural interviewing style |
| `question_generator.py` | Section coverage requirements | Cover all resume sections |
| `resume_question_bank.py` | Priority calculation fix | Preserve question flow |
| `interview_controller.py` | Post-resume flow logic | Never end interview early |
| `interview_controller.py` | Skill rotation logic | Continue with local bank |
| `interview_controller.py` | "What else" prompt handling | Handle both conditions |

### 16.6 Testing the Implementation

```bash
# Run with resume
python backend/core/interview_controller.py --resume "resume.pdf"

# Expected behavior:
# 1. Bot asks 2-3 warmup questions while processing resume
# 2. Transitions to resume-based questions (covers all sections)
# 3. After resume questions exhausted, prompts for more skills
# 4. If user says "that's it", continues with local question bank
# 5. Rotates through all detected skills
# 6. Ends with rapid fire round + final checkout
```

---

*End of Implementation Documentation*
