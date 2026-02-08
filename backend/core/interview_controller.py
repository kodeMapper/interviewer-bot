"""
Interview Controller (Async V5 - Resume Integration)
Zero-Latency Architecture:
1. Main Thread: Speaks & Records. Pushes audio to Queue.
2. Background Thread #1: Transcribes (Whisper) & Judges.
3. Background Thread #2: Resume Processing + GPT Question Generation.
4. Result: Next question is asked IMMEDIATELY after recording stops.

Phase 2.75: Resume Upload Integration
- Parallel question generation while asking local questions
- Seamless transition from local to resume-based questions
- Zero-latency architecture maintained
"""

import sys
import os
import time
import queue
import threading
import numpy as np
import sounddevice as sd
import whisper
import win32com.client
import torch
import random
from enum import Enum, auto
from concurrent.futures import ThreadPoolExecutor
from typing import Optional, Dict, Any, List

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml.training.intent_predictor import IntentPredictor
from core.question_bank import get_all_questions
from core.answer_evaluator import AnswerEvaluator

# Resume Module Imports (Phase 2.75)
try:
    from resume.extractor import ResumeExtractor
    from resume.parser import ResumeParser
    from resume.gpt_client import GPTClient, GPTClientError
    from resume.question_generator import QuestionGenerator, GeneratedQuestion
    from resume.resume_question_bank import ResumeQuestionBank, HybridQuestionManager
    RESUME_MODULE_AVAILABLE = True
except ImportError as e:
    print(f"   [Warning] Resume module not available: {e}")
    RESUME_MODULE_AVAILABLE = False

# ================= CONFIG =================
WHISPER_MODEL_SIZE = "medium"  # User requested exact match to old system
SAMPLE_RATE = 16000
QUESTIONS_PER_TOPIC = 5
RESUME_QUESTIONS_TARGET = 20  # Target 18-22 resume-based questions (covering all sections)

class InterviewState(Enum):
    INTRO = auto()
    RESUME_WARMUP = auto()  # Phase 2.75: Ask local questions while GPT generates
    RESUME_DEEP_DIVE = auto()  # Phase 2.75: Resume-based questions
    DEEP_DIVE = auto()
    MIX_ROUND = auto()
    FINISHED = auto()

class InterviewController:
    def __init__(self, resume_path: Optional[str] = None):
        """
        Initialize AI Interviewer.
        
        Args:
            resume_path: Optional path to resume file (PDF/DOCX/TXT).
                        If provided, enables resume-based question generation.
        """
        print("\n[INIT] Initializing AI Interviewer (Async Mode + Resume)...")
        
        # 1. TTS - Single voice, synchronous mode
        self.speaker = win32com.client.Dispatch("SAPI.SpVoice")
        self.speaker.Rate = 0  # Normal speed
        self.speaker.Volume = 100  # Full volume
        self._set_indian_voice()
        print("✅ TTS Ready (single voice, sync mode)")
        
        # 2. Whisper (Loaded but used in background)
        print(f"\n[INIT] Loading Whisper '{WHISPER_MODEL_SIZE}'...")
        self.stt_model = whisper.load_model(WHISPER_MODEL_SIZE)
        print("✅ Whisper STT Ready")
        
        # 3. Brains
        self.router = IntentPredictor()
        self.judge = AnswerEvaluator()
        
        # Async Infrastructure
        self.processing_queue = queue.Queue() # Stores (audio, question, expected_ans, topic)
        self.active_tasks = 0
        self.lock = threading.Lock()
        
        # Context State for Adaptiveness (Counter-Questioning)
        self.context_keywords = queue.Queue() # Keywords found in previous answer
        self.used_keywords = set() # To prevent repeating same topic
        self.stop_signal = False
        self.skip_signal = False
        self.stop_phrases = ["stop interview", "terminate", "end session", "abort"]
        self.skip_phrases = ["don't know", "skip", "no idea", "pass", "next question"]
        
        # Session State
        self.state = InterviewState.INTRO
        self.skills_queue = []
        self.skills_detected = []  # Initialize here
        self.current_topic = ""
        self.questions_asked_count = 0
        self.asked_q_hashes = set()
        self.report_card = []
        self.is_running = False
        self.report_generated = False # Flag for idempotency
        self.checkout_asked = False   # Flag for final question
        
        # ===== PHASE 2.75: RESUME INTEGRATION =====
        # Resolve resume path to absolute path
        if resume_path:
            if not os.path.isabs(resume_path):
                # Try multiple locations for relative paths
                possible_paths = [
                    os.path.abspath(resume_path),  # Current directory
                    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), resume_path),  # Project root
                    os.path.join(os.path.expanduser("~"), "Desktop", resume_path),  # Desktop
                ]
                for path in possible_paths:
                    if os.path.exists(path):
                        resume_path = path
                        print(f"   [Resume] Found at: {resume_path}")
                        break
        
        self.resume_path = resume_path
        self.resume_enabled = resume_path is not None and RESUME_MODULE_AVAILABLE
        self.resume_bank: Optional[ResumeQuestionBank] = None
        self.resume_generation_complete = threading.Event()
        self.resume_parsed_data = None
        self.resume_summary = ""
        self.warmup_questions_asked = 0
        self.max_warmup_questions = 3  # Ask 3 local questions while GPT generates
        
        if self.resume_enabled:
            self._init_resume_module()
        
        # Start Background Workers
        self.executor = ThreadPoolExecutor(max_workers=2)  # +1 for resume processing
        self.executor.submit(self._background_processor)
        
    def _init_resume_module(self):
        """Initialize resume processing components."""
        print("\n[RESUME] Initializing resume module...")
        
        try:
            self.resume_extractor = ResumeExtractor()
            self.resume_parser = ResumeParser()
            self.resume_bank = ResumeQuestionBank(
                on_question_ready=self._on_resume_questions_ready
            )
            
            # Try to initialize GPT client
            try:
                self.gpt_client = GPTClient()
                self.question_generator = QuestionGenerator(self.gpt_client)
                print("✅ Resume module ready (GPT enabled)")
            except Exception as e:
                print(f"   [Resume] GPT client unavailable: {e}")
                self.gpt_client = None
                self.question_generator = None
                
        except Exception as e:
            print(f"   [Resume] Module init failed: {e}")
            self.resume_enabled = False
    
    def _on_resume_questions_ready(self):
        """Callback when resume questions become available."""
        print("   [Resume] 🎯 Questions ready! Transitioning when appropriate...")
        self.resume_generation_complete.set()

    def _set_indian_voice(self):
        voices = self.speaker.GetVoices()
        for i in range(voices.Count):
            voice = voices.Item(i)
            desc = voice.GetDescription()
            if any(x in desc for x in ["India", "Heera", "Veena", "Ravi"]):
                self.speaker.Voice = voice
                break
    
    def _process_resume_background(self):
        """
        Background thread: Process resume and generate questions.
        Runs in parallel while main thread asks warmup questions.
        
        NEW: Uses direct PDF upload to Gemini for better accuracy.
        """
        if not self.resume_enabled or not self.resume_path:
            return
        
        print(f"\n   [Resume BG] Starting resume processing: {self.resume_path}")
        
        try:
            # Check if file is PDF - use direct upload for best results
            is_pdf = self.resume_path.lower().endswith('.pdf')
            
            if is_pdf and self.question_generator:
                # NEW: Direct PDF mode - upload resume directly to Gemini
                print("   [Resume BG] Using direct PDF upload to Gemini (best accuracy)...")
                
                # Still extract for backup/logging
                text, method, confidence = self.resume_extractor.extract(self.resume_path)
                print(f"   [Resume BG] Extracted {len(text)} chars using {method} (conf: {confidence:.1%})")
                
                # Parse for metadata
                self.resume_parsed_data = self.resume_parser.parse(text)
                print(f"   [Resume BG] Found: {len(self.resume_parsed_data.skills)} skills, "
                      f"{len(self.resume_parsed_data.projects)} projects, "
                      f"{len(self.resume_parsed_data.experience)} experiences")
                
                # Generate questions using direct PDF upload
                print("   [Resume BG] Generating questions via Gemini (direct PDF mode)...")
                
                question_set = self.question_generator.generate_from_file(
                    file_path=self.resume_path,
                    parsed_resume=self.resume_parsed_data,
                    num_questions=RESUME_QUESTIONS_TARGET
                )
                
                self.resume_summary = question_set.resume_summary
                
                # Add to resume question bank
                added = self.resume_bank.add_questions(question_set)
                print(f"   [Resume BG] ✅ Added {added} questions to bank")
                print(f"   [Resume BG] 📁 Questions stored in: ResumeQuestionBank (in-memory priority queue)")
                
                self.resume_bank.set_generation_complete(True)
            else:
                # Fallback: Extract text and generate from text
                print("   [Resume BG] Extracting text...")
                text, method, confidence = self.resume_extractor.extract(self.resume_path)
                
                if not text or len(text) < 50:
                    print("   [Resume BG] ⚠️ Insufficient text extracted. Using fallback.")
                    self.resume_generation_complete.set()
                    return
                
                print(f"   [Resume BG] Extracted {len(text)} chars using {method} (conf: {confidence:.1%})")
                
                # Parse into sections
                print("   [Resume BG] Parsing sections...")
                self.resume_parsed_data = self.resume_parser.parse(text)
                
                # Check for thin resume
                if self.resume_parsed_data.is_thin_resume():
                    print("   [Resume BG] ⚠️ Thin resume detected. Using local questions primarily.")
                
                print(f"   [Resume BG] Found: {len(self.resume_parsed_data.skills)} skills, "
                      f"{len(self.resume_parsed_data.projects)} projects, "
                      f"{len(self.resume_parsed_data.experience)} experiences")
                
                # Generate questions using GPT
                if self.question_generator and self.gpt_client:
                    print("   [Resume BG] Generating questions via Gemini...")
                    
                    question_set = self.question_generator.generate(
                        parsed_resume=self.resume_parsed_data,
                        num_questions=RESUME_QUESTIONS_TARGET,
                        raw_text=text
                    )
                    
                    self.resume_summary = question_set.resume_summary
                    
                    # Add to resume question bank
                    added = self.resume_bank.add_questions(question_set)
                    print(f"   [Resume BG] ✅ Added {added} questions to bank")
                    print(f"   [Resume BG] 📁 Questions stored in: ResumeQuestionBank")
                    
                    self.resume_bank.set_generation_complete(True)
                else:
                    print("   [Resume BG] GPT unavailable. Using fallback questions.")
                    self._generate_fallback_resume_questions()
            
        except Exception as e:
            print(f"   [Resume BG] ❌ Error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            self.resume_generation_complete.set()
            print("   [Resume BG] Processing complete.")
    
    def _generate_fallback_resume_questions(self):
        """Generate SPECIFIC questions from parsed resume without GPT."""
        if not self.resume_parsed_data or not self.resume_bank:
            return
        
        from resume.question_generator import GeneratedQuestion, QuestionType, QuestionDifficulty
        
        questions = []
        
        # Skill-based questions - SPECIFIC
        for skill in self.resume_parsed_data.skills[:5]:
            questions.append(GeneratedQuestion(
                question=f"You mentioned {skill} in your resume. Can you walk me through a specific project where you used {skill}? What problems did it solve?",
                question_type=QuestionType.THEORETICAL,
                difficulty=QuestionDifficulty.MEDIUM,
                expected_answer=f"Should describe hands-on experience with {skill}, specific use case",
                section_source="skills",
                keywords=[skill]
            ))
        
        # Project questions - SPECIFIC with project names
        for project in self.resume_parsed_data.projects[:3]:
            # project is a ResumeSection object
            if hasattr(project, 'name') and project.name:
                proj_name = project.name[:40]
            elif hasattr(project, 'content') and project.content:
                proj_name = project.content.split('.')[0][:40]
            else:
                proj_name = str(project)[:40] if project else "your project"
            
            questions.append(GeneratedQuestion(
                question=f"In your {proj_name} project, what was the most technically challenging part? How did you overcome it?",
                question_type=QuestionType.PROJECT,
                difficulty=QuestionDifficulty.MEDIUM,
                expected_answer="Should discuss technical challenges and solutions",
                section_source="projects"
            ))
        
        # Experience questions - SPECIFIC with company names
        for exp in self.resume_parsed_data.experience[:2]:
            # exp is a ResumeSection object
            if hasattr(exp, 'name') and exp.name:
                exp_summary = exp.name[:40]
            elif hasattr(exp, 'content') and exp.content:
                exp_summary = exp.content[:40]
            else:
                exp_summary = str(exp)[:40] if exp else "your previous role"
            
            questions.append(GeneratedQuestion(
                question=f"At {exp_summary}, what was a specific technical decision you made and why did you choose that approach?",
                question_type=QuestionType.EXPERIENCE,
                difficulty=QuestionDifficulty.EASY,
                expected_answer="Should describe responsibilities and achievements",
                section_source="experience"
            ))
        
        # Add to bank
        from resume.question_generator import ResumeQuestionSet
        q_set = ResumeQuestionSet(questions=questions, resume_summary="Fallback questions (personalized)")
        self.resume_bank.add_questions(q_set)
        self.resume_bank.set_generation_complete(True)
    
    def _get_resume_question(self) -> Optional[Dict[str, Any]]:
        """Get next resume question if available."""
        if not self.resume_bank or not self.resume_bank.has_questions():
            return None
        
        q = self.resume_bank.get_next_question()
        if q:
            return {
                "question": q.question,
                "expected": q.expected_answer,
                "type": q.question_type.value,
                "section": q.section_source,
                "keywords": q.keywords
            }
        return None
    
    def _get_local_question_for_warmup(self) -> Optional[tuple]:
        """Get a local question for warmup phase."""
        # Use detected skills or General
        if self.skills_queue:
            topic = self.skills_queue[0]
        elif self.skills_detected:
            topic = random.choice(self.skills_detected)
        else:
            topic = "General"
        
        return self.get_unique_question(topic), topic

    def _map_resume_skills_to_topics(self, resume_skills: List[str]) -> List[str]:
        """
        Map resume skills (raw strings) to our local question bank topics.
        
        The local question bank has specific topics like:
        - Python, Java, JavaScript, React, Angular, Node.js, SQL, MongoDB,
        - Machine Learning, Deep Learning, AWS, Docker, Kubernetes, etc.
        
        We need to match resume skills to these supported topics.
        """
        # Mapping of common skill variations to our question bank topics
        SKILL_MAPPING = {
            # Python ecosystem
            'python': 'Python', 'python3': 'Python', 'django': 'Python', 'flask': 'Python',
            'fastapi': 'Python', 'pandas': 'Python', 'numpy': 'Python',
            
            # Java ecosystem
            'java': 'Java', 'spring': 'Java', 'spring boot': 'Java', 'springboot': 'Java',
            'hibernate': 'Java', 'maven': 'Java', 'gradle': 'Java',
            
            # JavaScript ecosystem
            'javascript': 'JavaScript', 'js': 'JavaScript', 'typescript': 'JavaScript',
            'node': 'Node.js', 'node.js': 'Node.js', 'nodejs': 'Node.js', 'express': 'Node.js',
            'react': 'React', 'react.js': 'React', 'reactjs': 'React', 'redux': 'React',
            'angular': 'Angular', 'angularjs': 'Angular', 'vue': 'JavaScript', 'vue.js': 'JavaScript',
            
            # Databases
            'sql': 'SQL', 'mysql': 'SQL', 'postgresql': 'SQL', 'postgres': 'SQL', 'oracle': 'SQL',
            'mongodb': 'MongoDB', 'mongo': 'MongoDB', 'nosql': 'MongoDB',
            'redis': 'SQL', 'dynamodb': 'SQL',
            
            # Cloud & DevOps
            'aws': 'AWS', 'amazon web services': 'AWS', 'ec2': 'AWS', 's3': 'AWS', 'lambda': 'AWS',
            'docker': 'Docker', 'containerization': 'Docker',
            'kubernetes': 'Kubernetes', 'k8s': 'Kubernetes',
            'azure': 'AWS', 'gcp': 'AWS', 'google cloud': 'AWS',  # Map to AWS as closest
            
            # AI/ML
            'machine learning': 'Machine Learning', 'ml': 'Machine Learning',
            'deep learning': 'Deep Learning', 'dl': 'Deep Learning',
            'tensorflow': 'Deep Learning', 'pytorch': 'Deep Learning', 'keras': 'Deep Learning',
            'nlp': 'Machine Learning', 'computer vision': 'Deep Learning',
            'neural network': 'Deep Learning', 'cnn': 'Deep Learning', 'rnn': 'Deep Learning',
            
            # Other
            'git': 'General', 'github': 'General', 'linux': 'General',
            'c++': 'General', 'c': 'General', 'go': 'General', 'rust': 'General',
            'html': 'JavaScript', 'css': 'JavaScript',
            'rest': 'General', 'api': 'General', 'microservices': 'General',
            'agile': 'General', 'scrum': 'General',
        }
        
        mapped_topics = []
        
        for skill in resume_skills:
            skill_lower = skill.lower().strip()
            
            # Direct mapping
            if skill_lower in SKILL_MAPPING:
                topic = SKILL_MAPPING[skill_lower]
                if topic not in mapped_topics:
                    mapped_topics.append(topic)
            else:
                # Try partial match
                for key, topic in SKILL_MAPPING.items():
                    if key in skill_lower or skill_lower in key:
                        if topic not in mapped_topics:
                            mapped_topics.append(topic)
                        break
        
        # Limit to top 5 most relevant topics
        return mapped_topics[:5] if mapped_topics else ['General']

    def _background_processor(self):
        """Consumer Thread: Transcribes, Extracing Keywords, and Judges"""
        print("   [Background Worker Started]")
        while True:
            try:
                task = self.processing_queue.get()
                if task is None: break # Sentinel to stop
                
                audio, question, expected, topic = task
                
                # 1. Transcribe
                text = self._transcribe_internal(audio)
                
                # 1.5 Extract Keywords & Intents
                text_lower = text.lower()
                
                # Check Stop Signals
                for phrase in self.stop_phrases:
                    if phrase in text_lower:
                        print(f"   [Intent Detected] STOP Signal: '{text}'")
                        self.stop_signal = True
                        break
                
                # Check Skip Signals
                if not self.stop_signal:
                    for phrase in self.skip_phrases:
                        if phrase in text_lower:
                            print(f"   [Intent Detected] SKIP Signal: '{text}'")
                            self.skip_signal = True
                            break
                
                # Check Keywords (Simple substring match against known keys)
                from core.question_bank import KEYWORD_INDEX
                found_keywords = []
                for kw in KEYWORD_INDEX.keys():
                    # Simple heuristic: exact word match to avoid false positives
                    if kw in text_lower:
                        found_keywords.append(kw)
                
                    if kw in text_lower:
                        found_keywords.append(kw)
                
                if found_keywords:
                    # Pick one relevant keyword to follow up on
                    # We pick the longest one assuming it's most specific (e.g. 'react hooks' > 'hooks')
                    best_kw = max(found_keywords, key=len)
                    self.context_keywords.put(best_kw)
                    print(f"   🔍 [Context] Keywords: {found_keywords} -> Queued: '{best_kw}'")

                # 2. Judge
                score, is_correct = self.judge.evaluate(text, expected)
                
                # 3. Log
                with self.lock:
                    print(f"\n   [Processed] Q: {question[:30]}... | Ans: {text[:30]}... | Score: {score}")
                    self.report_card.append({
                        "topic": topic,
                        "question": question,
                        "user_ans": text,
                        "expected": expected,
                        "score": score
                    })
                    self.active_tasks -= 1
                    
                self.processing_queue.task_done()
            except Exception as e:
                print(f"Error in background worker: {e}")

    def speak(self, text):
        """
        Speak text using TTS. Blocks until speech is complete.
        Uses synchronous mode to prevent voice overlap.
        """
        print(f"🤖 BOT: {text}")
        try:
            # Use SVSFlagsAsync = 1 for async, SVSFDefault = 0 for sync
            # We use sync (0) to prevent overlapping voices
            self.speaker.Speak(text, 0)  # 0 = SVSFDefault = synchronous
        except Exception as e:
            print(f"   [TTS Error] Could not speak: {e}")
    
    def _stop_speech(self):
        """Stop any ongoing speech."""
        try:
            # Purge speech queue and stop current speech
            self.speaker.Speak("", 3)  # 3 = SVSFPurgeBeforeSpeak | SVSFlagsAsync
        except:
            pass

    def listen(self):
        q = queue.Queue()
        def callback(indata, frames, time, status):
            q.put(indata.copy())
        
        print("\n🎤 LISTENING... (Press ENTER to stop)")
        with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, callback=callback):
            input("   [Recording] Press ENTER when done >>> ")
            
        print("⏹️ Stopped")
        
        chunks = []
        while not q.empty(): chunks.append(q.get())
        if not chunks: return np.array([])
        return np.concatenate(chunks, axis=0).flatten()

    def _transcribe_internal(self, audio):
        """Actual Whisper inference (Blocking)"""
        if len(audio) == 0: return ""
        audio = audio.astype(np.float32)
        res = self.stt_model.transcribe(audio, fp16=False, language="en")
        return res["text"].strip()

    def transcribe_blocking(self, audio):
        """For Intro only - we need result immediately"""
        print("⏳ Transcribing (Blocking for Intro)...")
        return self._transcribe_internal(audio)

    def get_unique_question(self, topic):
        from core.question_bank import get_all_questions
        options = get_all_questions(topic)
        random.shuffle(options)
        for q, ans in options:
            if q not in self.asked_q_hashes:
                self.asked_q_hashes.add(q)
                return q, ans
        return None, None  # Return None if exhausted instead of loop

    def generate_report(self):
        if self.report_generated: return # Idempotency check
        self.report_generated = True
        
        print("⏳ Waiting for pending transcriptions...")
        self.processing_queue.join() # Wait for all background tasks
        
        filename = "interview_feedback.txt"
        with open(filename, "w", encoding="utf-8") as f:
            f.write("AI INTERVIEW FEEDBACK REPORT\n")
            f.write("============================\n\n")
            
            # Resume summary if available
            if self.resume_enabled and self.resume_summary:
                f.write("CANDIDATE PROFILE (from Resume):\n")
                f.write(f"{self.resume_summary}\n\n")
            
            # Resume bank stats if available
            if self.resume_bank:
                stats = self.resume_bank.get_stats()
                f.write("RESUME-BASED QUESTIONS:\n")
                f.write(f"   Generated: {stats['total_added']}\n")
                f.write(f"   Asked: {stats['asked']}\n")
                f.write(f"   By Type: {stats.get('by_type', {})}\n\n")
            
            total_score = 0
            resume_score = 0
            resume_count = 0
            local_score = 0
            local_count = 0
            
            for idx, entry in enumerate(self.report_card):
                f.write(f"Q{idx+1} [{entry['topic']}]: {entry['question']}\n")
                f.write(f"   You Said: {entry['user_ans']}\n")
                f.write(f"   Expected: {entry['expected']}\n")
                f.write(f"   Score: {entry['score']}/100\n\n")
                total_score += entry['score']
                
                # Track resume vs local scores
                if 'Resume:' in entry['topic']:
                    resume_score += entry['score']
                    resume_count += 1
                else:
                    local_score += entry['score']
                    local_count += 1
            
            avg = total_score / len(self.report_card) if self.report_card else 0
            f.write("=" * 40 + "\n")
            f.write(f"FINAL SCORE: {int(avg)}/100\n")
            
            # Breakdown by source
            if resume_count > 0:
                f.write(f"   Resume Questions: {int(resume_score/resume_count)}/100 ({resume_count} questions)\n")
            if local_count > 0:
                f.write(f"   General Questions: {int(local_score/local_count)}/100 ({local_count} questions)\n")
            
        print(f"\n📄 Report generated: {filename}")
        os.system(f"start {filename}")
        
        # Verbal Feedback
        self.provide_verbal_feedback()

    def ask_checkout_question(self):
        """Asks the final open-ended question if not already asked."""
        if self.checkout_asked or self.stop_signal: return

        self.checkout_asked = True
        final_q = "Before we finish, please describe your practical experience with these technologies."
        self.speak(final_q)
        
        # We need to listen, but softly handle if audio fails
        try:
            audio = self.listen()
            if len(audio) > 0:
                self.active_tasks += 1
                self.processing_queue.put((audio, final_q, "Practical usage summary.", "Final"))
                print(f"   -> Answer queued for processing ({self.active_tasks} pending)...")
        except Exception as e:
            print(f"   [Checkout Error] Could not record answer: {e}")

    def run_loop(self):
        try:
            self.is_running = True
            print("\n=== AI INTERVIEWER (Async Mode + Resume) ===\n")
            
            # Modified greeting for resume mode
            if self.resume_enabled:
                self.speak("Hello. I am your AI Interviewer. I have your resume and will ask personalized questions.")
                
                # Start resume processing in background IMMEDIATELY
                self.executor.submit(self._process_resume_background)
                print("   [Main] Resume processing started in background...")
            else:
                self.speak("Hello. I am your AI Interviewer. I will analyze your answers in the background.")
            
            self.speak("Let's begin. Please introduce yourself and list your technical skills.")
            
            # --- PHASE 1: INTRO (Blocking) ---
            audio = self.listen()
            intro_text = self.transcribe_blocking(audio)
            
            conf_topics = self.router.predict_with_scores(intro_text, threshold=0.3)
            self.skills_queue = [t[0] for t in conf_topics]
            if not self.skills_queue: self.skills_queue = ["Java"]
            self.skills_detected = list(self.skills_queue) # Copy for Mix Round
            
            print(f"   Plan: {self.skills_queue}")
            
            # --- PHASE 2.75: RESUME WARMUP (if resume provided) ---
            if self.resume_enabled:
                self.speak(f"I see you know {', '.join(self.skills_queue[:3])}. Let me ask a few warmup questions while I analyze your resume.")
                self.state = InterviewState.RESUME_WARMUP
                
                # Ask warmup questions while GPT generates resume questions
                warmup_count = 0
                while warmup_count < self.max_warmup_questions and self.is_running:
                    if self.stop_signal:
                        break
                    
                    # Check if resume questions ready
                    if self.resume_generation_complete.is_set() and self.resume_bank.has_questions():
                        print("   [Main] Resume questions ready! Transitioning...")
                        break
                    
                    # Get local warmup question
                    topic = self.skills_queue[0] if self.skills_queue else "General"
                    q, expected = self.get_unique_question(topic)
                    
                    if q:
                        time.sleep(1)
                        self.speak(q)
                        audio = self.listen()
                        
                        self.active_tasks += 1
                        self.processing_queue.put((audio, q, expected, topic))
                        print(f"   -> Warmup answer queued ({self.active_tasks} pending)...")
                        
                        warmup_count += 1
                    else:
                        break
                
                # Transition to resume questions
                if self.resume_bank and self.resume_bank.has_questions():
                    self.state = InterviewState.RESUME_DEEP_DIVE
                    self.questions_asked_count = 0
                    
                    if self.resume_summary:
                        # Optional: Brief acknowledgment of resume
                        self.speak("I've analyzed your resume. Let's dive deeper into your experience.")
                else:
                    # Fallback to normal flow
                    self.state = InterviewState.DEEP_DIVE
                    self.current_topic = self.skills_queue.pop(0) if self.skills_queue else "General"
                    self.speak(f"Let's continue with {self.current_topic}.")
            else:
                # Normal flow (no resume)
                self.speak(f"Great. We will cover {', '.join(self.skills_queue)}.")
                self.current_topic = self.skills_queue.pop(0)
                self.speak(f"Let's start with {self.current_topic}.")
                self.state = InterviewState.DEEP_DIVE
            
            # --- PHASE 2: ASYNC LOOP ---
            while self.is_running:
                # 0. Check Stop Signals (From Background Thread)
                if self.stop_signal:
                    self.speak("Fine, here is your feedback.")
                    self.generate_report()
                    self.is_running = False
                    break
                
                if self.skip_signal:
                    self.skip_signal = False # Reset
                
                # === RESUME DEEP DIVE STATE ===
                if self.state == InterviewState.RESUME_DEEP_DIVE:
                    resume_q = self._get_resume_question()
                    
                    if resume_q:
                        time.sleep(2)
                        
                        # Add transition for variety
                        transitions = [
                            "",
                            "Let me ask you about ",
                            "Regarding your experience, ",
                            "Based on your resume, ",
                        ]
                        prefix = random.choice(transitions) if random.random() < 0.3 else ""
                        
                        full_q = prefix + resume_q["question"] if prefix else resume_q["question"]
                        self.speak(full_q)
                        
                        audio = self.listen()
                        
                        self.active_tasks += 1
                        self.processing_queue.put((
                            audio, 
                            resume_q["question"], 
                            resume_q["expected"], 
                            f"Resume:{resume_q['section']}"
                        ))
                        print(f"   -> Resume answer queued ({self.active_tasks} pending)...")
                        
                        self.questions_asked_count += 1
                        
                        # Track for resume bank
                        if self.resume_bank:
                            # Note: Scoring happens in background processor
                            pass
                    else:
                        # Resume questions exhausted
                        total_asked = self.resume_bank.get_stats()['asked'] if self.resume_bank else 0
                        print(f"   [Main] Resume questions exhausted. Total asked: {total_asked}")
                        
                        if total_asked < 15:
                            # Not enough questions asked - PROMPT USER
                            self.speak("That covers the main points from your resume. What else do you do? Any other technologies or projects you'd like to discuss?")
                            
                            audio = self.listen()
                            response_text = self.transcribe_blocking(audio)
                            print(f"   [User Response] '{response_text}'")
                            
                            # Check for new skills
                            conf_topics = self.router.predict_with_scores(response_text, threshold=0.3)
                            new_skills = [t[0] for t in conf_topics]
                            
                            if new_skills:
                                self.speak(f"Great, let's discuss {', '.join(new_skills)}.")
                                # Add new skills to main queue and switch to DEEP_DIVE
                                # Avoid duplicates
                                added_count = 0
                                for skill in new_skills:
                                    if skill not in self.skills_detected:
                                        self.skills_detected.append(skill)
                                        self.skills_queue.append(skill)
                                        added_count += 1
                                    elif skill not in self.skills_queue:
                                        # Skill known but not currently in queue (maybe asked already?)
                                        # Add it back for re-questioning if explicitly mentioned
                                        self.skills_queue.append(skill)
                                        added_count += 1
                                
                                if added_count > 0:
                                    # Switch to DEEP DIVE on the first new skill
                                    self.state = InterviewState.DEEP_DIVE
                                    self.current_topic = self.skills_queue.pop(0) if self.skills_queue else "General"
                                    self.questions_asked_count = 0
                                    self.speak(f"Let's start with {self.current_topic}.")
                                else:
                                    # Skills were mentioned but we might have covered them or queue logic failed
                                    # Fallback to LOCAL QUESTION BANK on detected skills
                                    print("   [Main] Skills mentioned were already covered. Switching to deep dive on existing skills.")
                                    self.state = InterviewState.DEEP_DIVE
                                    self.current_topic = self.skills_detected[0] if self.skills_detected else "General"
                                    self.questions_asked_count = 0
                                    self.speak(f"Let me ask more about {self.current_topic}.")
                            else:
                                # Condition 2: User said "that's it" or no new skills detected
                                # Use RESUME SKILLS for local question bank
                                print("   [Main] User has no more to add. Using RESUME SKILLS for local questions.")
                                
                                # PRIORITY: Use skills from resume parsing, then interview detection
                                resume_skills = []
                                if self.resume_parsed_data and self.resume_parsed_data.skills:
                                    # Map resume skills to our question bank topics
                                    resume_skills = self._map_resume_skills_to_topics(self.resume_parsed_data.skills)
                                    print(f"   [Main] Resume skills mapped to topics: {resume_skills}")
                                
                                # Combine resume skills + detected skills (resume skills first)
                                combined_skills = []
                                for skill in resume_skills:
                                    if skill not in combined_skills:
                                        combined_skills.append(skill)
                                for skill in self.skills_detected:
                                    if skill not in combined_skills:
                                        combined_skills.append(skill)
                                
                                if combined_skills:
                                    # Update skills_detected to include resume skills
                                    self.skills_detected = combined_skills
                                    self.skills_queue = list(combined_skills)  # Reset queue with all skills
                                    
                                    self.speak(f"Alright. Let me ask a few more questions based on your resume.")
                                    self.state = InterviewState.DEEP_DIVE
                                    self.current_topic = self.skills_queue.pop(0) if self.skills_queue else "General"
                                    self.questions_asked_count = 0
                                    print(f"   [Main] Starting DEEP_DIVE on: {self.current_topic}")
                                else:
                                    # No skills at all (rare case)
                                    self.speak("Let me ask some general technical questions.")
                                    self.state = InterviewState.MIX_ROUND
                                    self.questions_asked_count = 0
                        else:
                            # Enough questions asked (>15)
                            print("   [Main] Sufficient resume coverage. Switching to local question bank.")
                            
                            # Also map resume skills before continuing
                            if self.resume_parsed_data and self.resume_parsed_data.skills:
                                resume_skills = self._map_resume_skills_to_topics(self.resume_parsed_data.skills)
                                for skill in resume_skills:
                                    if skill not in self.skills_detected:
                                        self.skills_detected.append(skill)
                                print(f"   [Main] Skills for local questions: {self.skills_detected}")
                            
                            self.speak("Now let me ask you some more questions from our side.")
                            self.state = InterviewState.DEEP_DIVE
                            self.current_topic = self.skills_detected[0] if self.skills_detected else "General"
                            self.questions_asked_count = 0
                    
                    continue
                
                # 1. Ask Question (DEEP_DIVE or MIX_ROUND)
                if self.state == InterviewState.DEEP_DIVE or self.state == InterviewState.MIX_ROUND:
                    if self.state == InterviewState.DEEP_DIVE:
                        topic = self.current_topic
                    else:
                        # RESTRICTED MIX ROUND: Only ask about skills from resume/interview
                        # NO "General" unless we have no other option
                        if self.skills_detected:
                            pool = self.skills_detected  # Only resume + interview skills
                            topic = random.choice(pool)
                        else:
                            topic = "General"  # Fallback only if nothing detected
                        
                    q, expected = None, None
                    transition_phrase = ""
                    
                    # --- ADAPTIVE LOGIC: Check Context Queue ---
                    from core.question_bank import get_question_by_keyword
                    
                    if not self.context_keywords.empty():
                        last_keyword = self.context_keywords.get()
                        
                        if last_keyword not in self.used_keywords:
                            res = get_question_by_keyword(last_keyword, topic, allowed_topics=self.skills_detected)
                            
                            if res and res[1] not in self.asked_q_hashes:
                                print(f"   🔀 [Adapt] Counter-questioning on '{last_keyword}'")
                                self.used_keywords.add(last_keyword)
                                q, expected = res[1], res[2]
                                self.asked_q_hashes.add(q)
                                # Randomize transition for natural flow
                                transitions = [
                                    f"Going back to what you mentioned about {last_keyword}. ",
                                    f"You touched on {last_keyword} earlier. ",
                                    f"Related to your point about {last_keyword}. ",
                                    f"Speaking of {last_keyword}. "
                                ]
                                transition_phrase = random.choice(transitions)
                        else:
                            print(f"   ⏭️ [Adapt] Skipping already used keyword: '{last_keyword}'")
                    
                    # Default Random if no context match
                    if not q:
                        q, expected = self.get_unique_question(topic)
                    
                    # Handle Exhaustion
                    if not q: 
                        # Topic exhausted or get_unique returned None
                        if self.state == InterviewState.DEEP_DIVE:
                             # Force Move Next Topic
                             self.questions_asked_count = QUESTIONS_PER_TOPIC + 1 
                        else:
                             break # Stop if Mix round exhausted (rare)
                    else:
                        # DELAY: 2 Seconds as requested
                        time.sleep(2)
                        full_q = transition_phrase + q
                        self.speak(full_q)
                        
                        # 2. Record (Blocking)
                        audio = self.listen()
                        
                        # 3. Submit to Background (Instant)
                        self.active_tasks += 1
                        self.processing_queue.put((audio, q, expected, topic))
                        print(f"   -> Answer queued for processing ({self.active_tasks} pending)...")
                        
                        # 4. Decide Next Move (Immediately)
                        self.questions_asked_count += 1
                    
                    # Logic for transitions
                    if self.state == InterviewState.DEEP_DIVE:
                        if self.questions_asked_count >= QUESTIONS_PER_TOPIC:
                            # Move to next topic?
                            if self.skills_queue:
                                self.current_topic = self.skills_queue.pop(0)
                                self.questions_asked_count = 0
                                self.speak(f"Moving on to {self.current_topic}.")
                            else:
                                # No more skills in queue, but we can rotate through detected skills
                                # Find a skill from skills_detected that we haven't exhausted
                                remaining_skills = [s for s in self.skills_detected if s != self.current_topic]
                                if remaining_skills:
                                    self.current_topic = random.choice(remaining_skills)
                                    self.questions_asked_count = 0
                                    self.speak(f"Let me ask more about {self.current_topic}.")
                                else:
                                    # All skills covered, move to final mix round
                                    self.state = InterviewState.MIX_ROUND
                                    self.questions_asked_count = 0
                                    self.speak("Rapid fire round.")
                                
                    elif self.state == InterviewState.MIX_ROUND:
                        if self.questions_asked_count >= 5:  # Increased from 3 to 5
                            # ask final checkout question (handled in finally now)
                            break
                            
        except KeyboardInterrupt:
            print("\n🛑 Interview terminated by user (Ctrl+C)")
            self.stop_signal = True  # Ensure stop signal is set
        except Exception as e:
            print(f"\n❌ Unexpected Error in Interview Loop: {e}")
            import traceback
            traceback.print_exc()
        finally:
            # Skip checkout question - go directly to report generation
            self.speak("Interview complete. Generating feedback...")
            self.generate_report() # Ensure report is ALWAYS generated on exit
            
        # Cleanup
        self.processing_queue.put(None)
        self.executor.shutdown()

    def provide_verbal_feedback(self):
        """Speaks out feedback for weak answers (<20 score)"""
        print("\n📢 Verbal Feedback Phase...")
        weak_answers = [e for e in self.report_card if e['score'] < 30] # Increased threshold slightly to be helpful
        
        if weak_answers:
            self.speak("I noticed some areas for improvement.")
            for entry in weak_answers[:3]: # Limit to top 3 to avoid boring the user
                self.speak(f"Regarding {entry['question']}...")
                self.speak(f"You said: {entry['user_ans']}")
                self.speak(f"A better answer would be: {entry['expected']}")
                time.sleep(1)
        else:
            self.speak("Excellent performance. You showed strong knowledge across all topics.")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="AI Smart Interviewer")
    parser.add_argument(
        "--resume", "-r",
        type=str,
        default=None,
        help="Path to resume file (PDF/DOCX/TXT)"
    )
    args = parser.parse_args()
    
    # Check if resume path provided via command line
    resume_path = args.resume
    
    # Or prompt for resume
    if not resume_path:
        print("\n=== AI SMART INTERVIEWER ===")
        print("Would you like to upload a resume for personalized questions?")
        response = input("Enter resume path (or press ENTER to skip): ").strip()
        if response:
            resume_path = response
    
    c = InterviewController(resume_path=resume_path)
    c.run_loop()
