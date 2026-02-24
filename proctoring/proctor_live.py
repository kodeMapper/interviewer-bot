import cv2
import torch
import time
import numpy as np
import os
import sys
import mediapipe as mp
import threading
import winsound
from collections import deque

# ===================== IMPORT MODEL =====================
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from eye_cnn_model import EyeCNN

# ===================== GLOBAL STATE =====================
current_status = {"status": "SAFE", "reason": "SAFE"}
latest_frame = None
running = False
camera_index = None

buzzer_active = False
buzzer_thread = None

# ===================== PARAMETERS =====================
GAZE_ALERT_TIMEOUT = 0.9
NO_FACE_TIMEOUT = 0.9
MULTI_FACE_TIMEOUT = 0.9
CONF_THRESHOLD = 0.90
FRAME_SIZE = (640, 480)

violation_start_time = None
active_violation = None

gaze_buffer = deque(maxlen=5)
head_buffer = deque(maxlen=5)   # 🔥 NEW: smoothing for head pose

# ===================== DEVICE =====================
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

model_path = os.path.join(current_dir, "eye_cnn_final.pth")
model = EyeCNN().to(DEVICE)
model.load_state_dict(torch.load(model_path, map_location=DEVICE))
model.eval()

# ===================== STATUS =====================
def get_status():
    return current_status

def get_frame():
    return latest_frame

def stop_proctoring():
    global running
    running = False
    stop_buzzer()

def set_camera(index):
    global camera_index
    camera_index = index

# ===================== BUZZER =====================
def play_buzzer():
    global buzzer_active
    while buzzer_active:
        winsound.Beep(1000, 300)
        time.sleep(0.1)

def start_buzzer():
    global buzzer_active, buzzer_thread
    if not buzzer_active:
        buzzer_active = True
        buzzer_thread = threading.Thread(target=play_buzzer, daemon=True)
        buzzer_thread.start()

def stop_buzzer():
    global buzzer_active
    buzzer_active = False
    time.sleep(0.05)

# ===================== CAMERA =====================
def open_best_camera():
    if camera_index is not None:
        cap = cv2.VideoCapture(camera_index, cv2.CAP_DSHOW)
        if cap.isOpened():
            return cap
        cap.release()

    for idx in range(1, 5):
        cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
        if cap.isOpened():
            print(f"External camera opened at index {idx}")
            return cap
        cap.release()

    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    if cap.isOpened():
        print("Laptop camera opened")
        return cap

    return None

# ===================== HEAD POSE DETECTION =====================
def detect_head_pose(landmarks, frame_w, frame_h):

    nose = landmarks.landmark[1]
    left_eye = landmarks.landmark[33]
    right_eye = landmarks.landmark[263]

    nose_x = nose.x * frame_w
    nose_y = nose.y * frame_h

    left_eye_x = left_eye.x * frame_w
    left_eye_y = left_eye.y * frame_h

    right_eye_x = right_eye.x * frame_w
    right_eye_y = right_eye.y * frame_h

    eye_center_x = (left_eye_x + right_eye_x) / 2
    eye_center_y = (left_eye_y + right_eye_y) / 2

    face_height = abs(
        landmarks.landmark[152].y * frame_h -
        landmarks.landmark[10].y * frame_h
    )

    offset_x = nose_x - eye_center_x
    offset_y = nose_y - eye_center_y

    horizontal_ratio = offset_x / face_height
    vertical_ratio = offset_y / face_height

    # -------- Horizontal (stable already) --------
    if horizontal_ratio > 0.12:
        return "HEAD RIGHT"
    elif horizontal_ratio < -0.12:
        return "HEAD LEFT"

    # -------- Vertical (LESS sensitive now) --------

    # Dead zone for normal posture
    if -0.10 < vertical_ratio < 0.30:
        return None

    # Real down movement (phone usage)
    if vertical_ratio >= 0.30:
        return "HEAD DOWN"

    # Real up movement
    if vertical_ratio <= -0.30:
        return "HEAD UP"

    return None

# ===================== CNN GAZE =====================
def predict_face(face_img):
    try:
        face_img = face_img / 255.0
        tensor = torch.tensor(face_img).unsqueeze(0).unsqueeze(0).float().to(DEVICE)
        with torch.no_grad():
            output = model(tensor)
            probs = torch.softmax(output, dim=1)
            conf, pred = torch.max(probs, 1)
        if conf.item() < CONF_THRESHOLD:
            return 0
        return pred.item()
    except:
        return 1

# ===================== MAIN ENGINE =====================
def start_proctoring():
    global running, latest_frame
    global violation_start_time, active_violation

    running = True
    stop_buzzer()

    cap = open_best_camera()
    if cap is None:
        current_status["status"] = "ALERT"
        current_status["reason"] = "CAMERA NOT ACCESSIBLE"
        start_buzzer()
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_SIZE[0])
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_SIZE[1])
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    for _ in range(5):
        cap.read()

    mp_face_mesh = mp.solutions.face_mesh

    with mp_face_mesh.FaceMesh(
        max_num_faces=2,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    ) as face_mesh:

        while running:
            ret, frame = cap.read()
            if not ret:
                continue

            frame = cv2.resize(frame, FRAME_SIZE)

            try:
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = face_mesh.process(rgb)

                violation_reason = None
                timeout = GAZE_ALERT_TIMEOUT

                face_count = len(results.multi_face_landmarks) if results.multi_face_landmarks else 0

                if face_count == 0:
                    violation_reason = "NO FACE"
                    timeout = NO_FACE_TIMEOUT

                elif face_count > 1:
                    violation_reason = "MULTIPLE FACES"
                    timeout = MULTI_FACE_TIMEOUT

                else:
                    landmarks = results.multi_face_landmarks[0]

                    head_pose = detect_head_pose(landmarks, FRAME_SIZE[0], FRAME_SIZE[1])

                    if head_pose:
                        head_buffer.append(head_pose)

                        # Require consistent frames (reduces false positives)
                        if head_buffer.count(head_pose) >= 3:
                            violation_reason = head_pose
                    else:
                        head_buffer.clear()

                        # CNN gaze fallback
                        x_coords = [lm.x for lm in landmarks.landmark]
                        y_coords = [lm.y for lm in landmarks.landmark]

                        x_min = int(min(x_coords) * FRAME_SIZE[0])
                        x_max = int(max(x_coords) * FRAME_SIZE[0])
                        y_min = int(min(y_coords) * FRAME_SIZE[1])
                        y_max = int(max(y_coords) * FRAME_SIZE[1])

                        face_crop = frame[y_min:y_max, x_min:x_max]

                        if face_crop.size > 0:
                            gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
                            gray = cv2.resize(gray, (64, 64))

                            pred = predict_face(gray)
                            gaze_buffer.append(pred)

                            if sum(gaze_buffer) >= 3:
                                violation_reason = "LOOKING AWAY"

                # ================= ALERT ENGINE =================
                if violation_reason:

                    if "HEAD" in violation_reason:
                        violation_key = "HEAD_POSE"
                    elif "LOOKING" in violation_reason:
                        violation_key = "GAZE"
                    else:
                        violation_key = violation_reason

                    if active_violation != violation_key:
                        active_violation = violation_key
                        violation_start_time = time.time()

                    elapsed = time.time() - violation_start_time

                    if elapsed >= timeout:
                        current_status["status"] = "ALERT"
                        current_status["reason"] = violation_reason
                        start_buzzer()

                else:
                    active_violation = None
                    violation_start_time = None
                    gaze_buffer.clear()
                    current_status["status"] = "SAFE"
                    current_status["reason"] = "SAFE"
                    stop_buzzer()

            except Exception as e:
                print("Processing error:", e)

            latest_frame = frame.copy()
            time.sleep(0.01)

    cap.release()
    stop_buzzer()