"""
Interview Controller (Async V4)
Zero-Latency Architecture:
1. Main Thread: Speaks & Records. Pushes audio to Queue.
2. Background Thread: Transcribes (Whisper) & Judges.
3. Result: Next question is asked IMMEDIATELY after recording stops.
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

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml.training.intent_predictor import IntentPredictor
from core.question_bank import get_all_questions
from core.answer_evaluator import AnswerEvaluator

# ================= CONFIG =================
WHISPER_MODEL_SIZE = "medium"  # User requested exact match to old system
SAMPLE_RATE = 16000
QUESTIONS_PER_TOPIC = 5

class InterviewState(Enum):
    INTRO = auto()
    DEEP_DIVE = auto()
    MIX_ROUND = auto()
    FINISHED = auto()

class InterviewController:
    def __init__(self):
        print("\n[INIT] Initializing AI Interviewer (Async Mode)...")
        
        # 1. TTS
        self.speaker = win32com.client.Dispatch("SAPI.SpVoice")
        self.speaker.Rate = 0
        self._set_indian_voice()
        print("✅ TTS Ready")
        
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
        
        # Session State
        self.state = InterviewState.INTRO
        self.skills_queue = []
        self.current_topic = ""
        self.questions_asked_count = 0
        self.asked_q_hashes = set()
        self.report_card = []
        self.is_running = False
        
        # Start Background Worker
        self.executor = ThreadPoolExecutor(max_workers=1)
        self.executor.submit(self._background_processor)

    def _set_indian_voice(self):
        voices = self.speaker.GetVoices()
        for i in range(voices.Count):
            voice = voices.Item(i)
            desc = voice.GetDescription()
            if any(x in desc for x in ["India", "Heera", "Veena", "Ravi"]):
                self.speaker.Voice = voice
                break

    def _background_processor(self):
        """Consumer Thread: Transcribes and Judges"""
        print("   [Background Worker Started]")
        while True:
            try:
                task = self.processing_queue.get()
                if task is None: break # Sentinel to stop
                
                audio, question, expected, topic = task
                
                # 1. Transcribe
                text = self._transcribe_internal(audio)
                
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
        print(f"🤖 BOT: {text}")
        self.speaker.Speak(text)

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
        options = get_all_questions(topic)
        random.shuffle(options)
        for q, ans in options:
            if q not in self.asked_q_hashes:
                self.asked_q_hashes.add(q)
                return q, ans
        return "Tell me more about what you know.", "General knowledge."

    def generate_report(self):
        print("⏳ Waiting for pending transcriptions...")
        self.processing_queue.join() # Wait for all background tasks
        
        filename = "interview_feedback.txt"
        with open(filename, "w", encoding="utf-8") as f:
            f.write("AI INTERVIEW FEEDBACK REPORT\n")
            f.write("============================\n\n")
            
            total_score = 0
            for idx, entry in enumerate(self.report_card):
                f.write(f"Q{idx+1} [{entry['topic']}]: {entry['question']}\n")
                f.write(f"   You Said: {entry['user_ans']}\n")
                f.write(f"   Expected: {entry['expected']}\n")
                f.write(f"   Score: {entry['score']}/100\n\n")
                total_score += entry['score']
            
            avg = total_score / len(self.report_card) if self.report_card else 0
            f.write(f"FINAL SCORE: {int(avg)}/100\n")
            
        print(f"\n📄 Report generated: {filename}")
        os.system(f"start {filename}")
        
        # Verbal Feedback
        self.provide_verbal_feedback()

    def run_loop(self):
        try:
            self.is_running = True
            print("\n=== AI INTERVIEWER (Async Mode) ===\n")
            
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
            self.speak(f"Great. We will cover {', '.join(self.skills_queue)}.")
            
            # Prepare first topic
            self.current_topic = self.skills_queue.pop(0)
            self.speak(f"Let's start with {self.current_topic}.")
            self.state = InterviewState.DEEP_DIVE
            
            # --- PHASE 2: ASYNC LOOP ---
            while self.is_running:
                # 1. Ask Question
                if self.state == InterviewState.DEEP_DIVE or self.state == InterviewState.MIX_ROUND:
                    if self.state == InterviewState.DEEP_DIVE:
                        topic = self.current_topic
                    else:
                        # RESTRICTED MIX ROUND: Only ask about known skills + General logic
                        pool = self.skills_detected + ["General"] # e.g. ["Java", "General"]
                        topic = random.choice(pool)
                        # Ensure we don't ask meaningless "General" questions if the bank doesn't support it well, 
                        # but for now we rely on the bank having the topic or falling back.
                        # Actually safe fallback: If topic not in bank, it returns a generic Q.
                        
                    q, expected = self.get_unique_question(topic)
                    
                    # DELAY: 2 Seconds as requested
                    time.sleep(2)
                    self.speak(q)
                    
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
                                self.state = InterviewState.MIX_ROUND
                                self.questions_asked_count = 0
                                self.speak("Rapid fire round.")
                                
                    elif self.state == InterviewState.MIX_ROUND:
                        if self.questions_asked_count >= 3:
                            self.speak("Interview complete. Generating report.")
                            self.generate_report()
                            break
                            
        except KeyboardInterrupt:
            print("\n🛑 Terminated")
            self.generate_report()
            
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
    c = InterviewController()
    c.run_loop()
