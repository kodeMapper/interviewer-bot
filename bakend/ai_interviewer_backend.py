# ==================================================
# BACKEND-ONLY AI INTERVIEWER
# QUESTIONS LOADED FROM FILE
# ==================================================

import sounddevice as sd
import numpy as np
import whisper
import win32com.client
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from question_bank import JAVA_QUESTIONS, DBMS_QUESTIONS

# ================= WINDOWS VOICE =================
speaker = win32com.client.Dispatch("SAPI.SpVoice")

def speak(text):
    print("INTERVIEWER:", text)
    speaker.Speak(text)

# ================= CONFIG =================
SAMPLE_RATE = 16000

# ================= LOAD MODELS =================
print("Loading Whisper model...")
whisper_model = whisper.load_model("medium")

print("Loading semantic similarity model...")
similarity_model = SentenceTransformer("all-MiniLM-L6-v2")

# ================= RECORD AUDIO =================
def record_audio():
    audio = []

    def callback(indata, frames, time_info, status):
        audio.append(indata.copy())

    stream = sd.InputStream(
        samplerate=SAMPLE_RATE,
        channels=1,
        callback=callback
    )

    stream.start()
    input("🎤 Recording... press ENTER to stop\n")
    stream.stop()
    stream.close()

    return np.concatenate(audio, axis=0).flatten()

# ================= TRANSCRIBE =================
def transcribe(audio):
    result = whisper_model.transcribe(
        audio,
        language="en",
        fp16=False,
        verbose=False
    )
    return result["text"].strip()

# ================= EVALUATE ANSWER =================
def is_correct(user, correct):
    if not user:
        return False

    emb1 = similarity_model.encode([user])
    emb2 = similarity_model.encode([correct])

    score = cosine_similarity(emb1, emb2)[0][0]
    print("Similarity score:", round(score, 2))

    return score >= 0.6

# ================= INTERVIEW FLOW =================
def conduct_interview(subject, questions):
    speak(f"Starting {subject} interview.")

    for question, answer in questions:
        speak(question)
        input("➡️ Press ENTER to start answering\n")

        audio = record_audio()
        user_answer = transcribe(audio)

        print("YOU SAID:", user_answer)

        if is_correct(user_answer, answer):
            speak("Correct.")
        else:
            speak("That is incorrect.")
            speak("The correct answer is.")
            speak(answer)

        speak("Next question.")

    speak(f"{subject} interview completed.")

# ================= MAIN =================
if __name__ == "__main__":
    speak("Welcome to the AI Interviewer.")
    speak("This interview will be completely voice based.")

    conduct_interview("Java", JAVA_QUESTIONS)
    conduct_interview("DBMS", DBMS_QUESTIONS)

    speak("Interview finished. Thank you.")
