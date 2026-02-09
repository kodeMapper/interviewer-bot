import cv2
import torch
import time
import numpy as np
import os
import sys

# Ensure script directory is in sys.path so we can import local modules (eye_cnn_model)
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from collections import deque
from eye_cnn_model import EyeCNN
import threading
import winsound  # For buzzer sound on Windows

# ===================== GLOBAL SHARED STATE =====================
current_status = {"status": "SAFE", "reason": "SAFE"}
latest_frame = None
running = True   # 🔥 Always running from start
camera_index = 0  # Default to internal camera
buzzer_active = False  # 🔥 Track buzzer state
buzzer_thread = None  # 🔥 Thread for buzzer sound

def get_status():
    return current_status

def get_frame():
    global latest_frame
    return latest_frame

def stop_proctoring():
    global running, buzzer_active
    running = False
    buzzer_active = False  # 🔥 Stop buzzer when stopping proctoring
    print("Stopping proctoring...")

def set_camera(index):
    global camera_index
    camera_index = index
    print(f"Camera switched to index {index}")

# ===================== DEVICE =====================
# Auto-detect CUDA, fallback to CPU if loading fails
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

try:
    print(f"[PROCTOR] Attempting to load EyeCNN model on {DEVICE}...")
    model_path = os.path.join(current_dir, "eye_cnn_final.pth")
    model = EyeCNN().to(DEVICE)
    model.load_state_dict(torch.load(model_path, map_location=DEVICE))
    model.eval()
    print(f"[PROCTOR] Success! Model loaded on {DEVICE}")

except Exception as e:
    print(f"[PROCTOR] ⚠️ Failed to load on {DEVICE}: {e}")
    if DEVICE == "cuda":
        print("[PROCTOR] 🔄 Falling back to CPU...")
        DEVICE = "cpu"
        model = EyeCNN().to(DEVICE)
        model.load_state_dict(torch.load(model_path, map_location=DEVICE))
        model.eval()
        print(f"[PROCTOR] Success! Model loaded on fallback {DEVICE}")
    else:
        # If it failed on CPU, we really have a problem
        raise e

face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

# ===================== PARAMETERS =====================
PRED_HISTORY = deque(maxlen=20)
CHEAT_RATIO_THRESHOLD = 0.70
CONF_THRESHOLD = 0.90

DARK_THRESHOLD = 45
LOOK_AWAY_TIMEOUT = 3.5  # 🔥 Alert if not looking for 3-4 seconds

# ===================== MODEL =====================
def predict_face(face_img):
    face_img = face_img / 255.0
    tensor = torch.tensor(face_img).unsqueeze(0).unsqueeze(0).float().to(DEVICE)

    with torch.no_grad():
        output = model(tensor)
        probs = torch.softmax(output, dim=1)
        conf, pred = torch.max(probs, 1)

    if conf.item() < CONF_THRESHOLD:
        return 0

    return pred.item()

# ===================== BUZZER SOUND FUNCTION =====================
def play_buzzer():
    """Play continuous buzzer sound until buzzer_active is False"""
    global buzzer_active
    try:
        while buzzer_active:
            # 🔥 Play buzzer: frequency=1000Hz, duration=500ms
            winsound.Beep(1000, 500)
            time.sleep(0.1)  # Small gap between beeps
    except Exception as e:
        print(f"Buzzer error: {e}")

def start_buzzer():
    """Start buzzer in background thread"""
    global buzzer_active, buzzer_thread
    if not buzzer_active:
        buzzer_active = True
        buzzer_thread = threading.Thread(target=play_buzzer, daemon=True)
        buzzer_thread.start()
        print("🔔 BUZZER STARTED - ALERT!")

def stop_buzzer():
    """Stop the buzzer sound"""
    global buzzer_active
    if buzzer_active:
        buzzer_active = False
        print("✅ Buzzer stopped - candidate back on screen")

# ===================== MAIN ENGINE =====================
def start_proctoring():
    global running, current_status, latest_frame, camera_index

    print("Starting Camera Stream...")

    # Use the selected camera index
    cap = cv2.VideoCapture(camera_index, cv2.CAP_DSHOW)
    
    if not cap.isOpened():
        print(f"ERROR: Camera {camera_index} not accessible, trying fallback...")
        # Try other indices
        for idx in [0, 1, 2, 3]:
            if idx == camera_index:
                continue
            cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
            if cap.isOpened():
                print(f"Connected to fallback camera {idx}")
                break
    
    if not cap.isOpened():
        print("ERROR: No camera accessible")
        current_status["status"] = "ALERT"
        current_status["reason"] = "CAMERA NOT ACCESSIBLE"
        return

    # 🔥 TIMER FOR LOOK AWAY DETECTION
    look_away_start = None

    while running:
        time.sleep(0.02)

        ret, frame = cap.read()
        if not ret:
            continue

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        mean_brightness = np.mean(gray)

        # Check if looking at camera
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)
        is_looking = len(faces) == 1  # Only 1 face = looking at camera

        # 🔥 LOOK AWAY TIMER LOGIC
        if not is_looking:
            if look_away_start is None:
                look_away_start = time.time()
                print("User looking away...")
            
            elapsed = time.time() - look_away_start
            if elapsed > LOOK_AWAY_TIMEOUT:
                current_status["status"] = "ALERT"
                current_status["reason"] = f"NOT LOOKING ({elapsed:.1f}s)"
                start_buzzer()  # 🔥 Start buzzer when alert triggered
        else:
            # Reset timer when looking at camera
            if look_away_start is not None:
                elapsed = time.time() - look_away_start
                print(f"Back to camera (was away {elapsed:.1f}s)")
            look_away_start = None
            current_status["status"] = "SAFE"
            current_status["reason"] = "SAFE"
            stop_buzzer()  # 🔥 Stop buzzer when looking back

        # 🔥 IMPORTANT – FRAME ALWAYS UPDATED
        latest_frame = frame.copy()

    cap.release()
    print("Camera Stopped")
