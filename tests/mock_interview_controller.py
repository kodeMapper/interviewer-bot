import sys
import os
import time
import queue
import numpy as np

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.core.interview_controller import InterviewController
from backend.core.interview_controller import InterviewState # Import State

class MockInterviewController(InterviewController):
    def __init__(self, scenario_name, scenario_data):
        self.scenario_name = scenario_name
        self.script = scenario_data["script"] # List of strings to "say"
        self.script_index = 0
        
        # Disable Real TTS/STT Init calls to save time/resources
        # We Mock the init
        print(f"\n[TEST INIT] Starting Mock Interview: {scenario_name}")
        
        # Manually init what we need
        self.processing_queue = queue.Queue()
        self.active_tasks = 0
        self.lock = import_threading_lock()
        
        # Init Brains (Real logic, mocked IO)
        from backend.ml.training.intent_predictor import IntentPredictor
        from backend.core.answer_evaluator import AnswerEvaluator
        self.router = IntentPredictor()
        self.judge = AnswerEvaluator()
        
        self.context_keywords = queue.Queue()
        self.stop_signal = False
        self.skip_signal = False
        self.stop_phrases = ["stop interview", "terminate", "end session", "abort"]
        self.skip_phrases = ["don't know", "skip", "no idea", "pass", "next question"]
        
        self.state = InterviewState.INTRO
        self.skills_queue = []
        self.current_topic = ""
        self.questions_asked_count = 0
        self.asked_q_hashes = set()
        self.report_card = []
        self.is_running = False
        
        # Start Worker
        from concurrent.futures import ThreadPoolExecutor
        self.executor = ThreadPoolExecutor(max_workers=1)
        self.executor.submit(self._background_processor)
        
    def _set_indian_voice(self):
        pass # No Audio
        
    def speak(self, text):
        # Override to just print
        print(f"🤖 [BOT]: {text}")
        
    def listen(self):
        # Override to return dummy audio immediately
        # We don't wait for user input
        time.sleep(1) # Simulate talking time
        return np.array([0], dtype=np.float32)
        
    def _transcribe_internal(self, audio):
        # Override to return next line from script
        if self.script_index < len(self.script):
            ans = self.script[self.script_index]
            self.script_index += 1
            print(f"👤 [MOCK CANDIDATE]: {ans}")
            return ans
        else:
            print("👤 [MOCK CANDIDATE]: (Silence/No more script)")
            return "..."

    def transcribe_blocking(self, audio):
        return self._transcribe_internal(audio)

def import_threading_lock():
    import threading
    return threading.Lock()
