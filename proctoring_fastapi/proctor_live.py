import cv2
import torch
import time
import numpy as np
import os
import sys
import json
import csv
import re
try:
    import mediapipe as mp
except Exception:
    mp = None
import threading
import platform
from collections import deque
from collections import Counter
from datetime import datetime

# ===================== PLATFORM-SAFE BUZZER =====================
# winsound is Windows-only. On Linux/Docker it doesn't exist.
_IS_WINDOWS = platform.system() == "Windows"
if _IS_WINDOWS:
    try:
        import winsound
    except ImportError:
        _IS_WINDOWS = False


# ===================== IMPORT MODEL =====================
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from eye_cnn_model import EyeCNN

# ===================== GLOBAL STATE =====================
current_status = {"status": "SAFE", "reason": "SAFE", "faces_detected": 1, "gaze_direction": "Center", "cellphone_detected": False}
latest_frame = None
running = False
camera_index = None
detection_settings = {
    "dark_environment": True,
    "face_detection": True,
    "gaze_tracking": True,
    "multiple_people": True,
}

session_start_time = None
session_end_time = None
session_id = None
session_metadata = {
    "candidate_name": "",
    "roll_number": "",
    "subject": "",
    "exam_id": "",
}
session_events = []
latest_report_paths = {"json": None, "csv": None, "video": None, "snapshots_dir": None, "snapshots": []}
video_writer = None
video_output_path = None
snapshot_output_dir = None
record_frame_counter = 0

buzzer_active = False
buzzer_thread = None

# ===================== PARAMETERS =====================
GAZE_ALERT_TIMEOUT = 0.9
NO_FACE_TIMEOUT = 0.9
MULTI_FACE_TIMEOUT = 0.9
CONF_THRESHOLD = 0.90
FRAME_SIZE = (640, 480)
MAX_CAMERA_INDEX_TO_TRY = 3
DARK_BRIGHTNESS_THRESHOLD = 45
RECORDING_FPS = 12.0
RECORDING_FRAME_STRIDE = 2
RECORD_WITH_OVERLAY = False
SNAPSHOT_SCALE = 0.75
SNAPSHOT_JPEG_QUALITY = 85

# Camera backends — only meaningful on Windows with local hardware
if _IS_WINDOWS:
    CAMERA_BACKENDS = (cv2.CAP_DSHOW, cv2.CAP_MSMF, cv2.CAP_ANY)
else:
    CAMERA_BACKENDS = (cv2.CAP_ANY,)

violation_start_time = None
active_violation = None

gaze_buffer = deque(maxlen=5)
head_buffer = deque(maxlen=5)

# ===================== MEDIAPIPE (lazy init) =====================
_face_mesh = None
_face_mesh_initialized = False

def get_face_mesh_module():
    if mp is None:
        raise Exception("MediaPipe is not imported. Install mediapipe package.")
    if hasattr(mp, "solutions") and hasattr(mp.solutions, "face_mesh"):
        return mp.solutions.face_mesh
    try:
        from mediapipe.python.solutions import face_mesh
        return face_mesh
    except ImportError:
        raise Exception("MediaPipe FaceMesh is unavailable. Install a compatible mediapipe package.")

def _get_or_init_face_mesh():
    """Lazily initialize MediaPipe FaceMesh once, reuse across frames."""
    global _face_mesh, _face_mesh_initialized
    if _face_mesh_initialized:
        return _face_mesh
    _face_mesh_initialized = True
    try:
        mp_face_mesh = get_face_mesh_module()
        _face_mesh = mp_face_mesh.FaceMesh(
            max_num_faces=5,
            refine_landmarks=True,
            min_detection_confidence=0.4,
            min_tracking_confidence=0.4
        )
    except Exception as e:
        print("MediaPipe FaceMesh init failed:", e)
        _face_mesh = None
    return _face_mesh


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
    global running, session_end_time, _face_mesh, _face_mesh_initialized
    global video_writer
    running = False
    stop_buzzer()

    # Finalize session
    if session_start_time is not None and session_end_time is None:
        session_end_time = time.time()
        _record_event("SESSION_ENDED", current_status["status"], current_status["reason"], "Proctoring session stopped")
        _write_report_files(current_dir)

    # Release video writer
    if video_writer is not None:
        try:
            video_writer.release()
        except Exception:
            pass
        video_writer = None

    # Release face mesh
    if _face_mesh is not None:
        try:
            _face_mesh.close()
        except Exception:
            pass
        _face_mesh = None
        _face_mesh_initialized = False

def set_camera(index):
    global camera_index
    camera_index = index


def get_settings():
    return detection_settings.copy()


def update_settings(new_settings):
    for key in detection_settings.keys():
        if key in new_settings:
            detection_settings[key] = bool(new_settings[key])
    return get_settings()


def get_latest_report_paths():
    return latest_report_paths.copy()


def get_session_metadata():
    return session_metadata.copy()


def set_session_metadata(new_metadata):
    for key in session_metadata.keys():
        if key in new_metadata:
            session_metadata[key] = str(new_metadata[key]).strip()
    return get_session_metadata()


def _now_iso():
    return datetime.now().isoformat(timespec="seconds")


def _ensure_reports_dirs(base_dir):
    reports_dir = os.path.join(base_dir, "reports")
    videos_dir = os.path.join(reports_dir, "videos")
    snapshots_dir = os.path.join(reports_dir, "snapshots")
    os.makedirs(videos_dir, exist_ok=True)
    os.makedirs(snapshots_dir, exist_ok=True)
    return reports_dir, videos_dir, snapshots_dir


def _record_event(event_type, status, reason, note="", snapshot_file=None):
    offset_seconds = 0
    if session_start_time is not None:
        offset_seconds = int(max(0, time.time() - session_start_time))

    event = {
        "timestamp": _now_iso(),
        "offset_seconds": offset_seconds,
        "event_type": event_type,
        "status": status,
        "reason": reason,
        "note": note,
        "snapshot_file": snapshot_file,
    }
    session_events.append(event)


def _capture_snapshot(frame, reason):
    if frame is None or snapshot_output_dir is None or session_id is None:
        return None

    safe_reason = re.sub(r"[^a-zA-Z0-9]+", "_", str(reason)).strip("_").lower() or "alert"
    filename = f"{session_id}_{safe_reason}_{int(time.time())}.jpg"
    full_path = os.path.join(snapshot_output_dir, filename)

    snapshot_frame = frame
    if SNAPSHOT_SCALE < 1.0:
        resized_width = max(1, int(frame.shape[1] * SNAPSHOT_SCALE))
        resized_height = max(1, int(frame.shape[0] * SNAPSHOT_SCALE))
        snapshot_frame = cv2.resize(frame, (resized_width, resized_height))

    ok = cv2.imwrite(
        full_path,
        snapshot_frame,
        [int(cv2.IMWRITE_JPEG_QUALITY), SNAPSHOT_JPEG_QUALITY]
    )
    if not ok:
        return None
    return filename


def _build_report_payload():
    if session_start_time is None:
        duration_seconds = 0
    elif session_end_time is None:
        duration_seconds = int(time.time() - session_start_time)
    else:
        duration_seconds = int(session_end_time - session_start_time)

    alert_reasons = [e["reason"] for e in session_events if e["status"] == "ALERT"]
    reason_counts = dict(Counter(alert_reasons))

    return {
        "session_id": session_id,
        "started_at": datetime.fromtimestamp(session_start_time).isoformat(timespec="seconds") if session_start_time else None,
        "ended_at": datetime.fromtimestamp(session_end_time).isoformat(timespec="seconds") if session_end_time else None,
        "session_metadata": get_session_metadata(),
        "duration_seconds": duration_seconds,
        "total_events": len(session_events),
        "total_alert_events": len(alert_reasons),
        "alert_reason_counts": reason_counts,
        "camera_index": camera_index,
        "detection_settings": get_settings(),
        "video_file": os.path.basename(video_output_path) if video_output_path else None,
        "snapshot_files": [e["snapshot_file"] for e in session_events if e.get("snapshot_file")],
        "events": session_events,
    }


def _write_report_files(base_dir):
    report = _build_report_payload()
    reports_dir, _, snapshots_dir = _ensure_reports_dirs(base_dir)

    safe_session_id = session_id or datetime.now().strftime("session_%Y%m%d_%H%M%S")
    json_path = os.path.join(reports_dir, f"{safe_session_id}.json")
    csv_path = os.path.join(reports_dir, f"{safe_session_id}.csv")

    with open(json_path, "w", encoding="utf-8") as json_file:
        json.dump(report, json_file, indent=2)

    with open(csv_path, "w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(
            csv_file,
            fieldnames=["timestamp", "offset_seconds", "event_type", "status", "reason", "note", "snapshot_file"]
        )
        writer.writeheader()
        for event in session_events:
            writer.writerow(event)

    latest_report_paths["json"] = json_path
    latest_report_paths["csv"] = csv_path
    latest_report_paths["video"] = video_output_path
    latest_report_paths["snapshots_dir"] = snapshots_dir
    latest_report_paths["snapshots"] = [
        os.path.join(snapshots_dir, name)
        for name in report["snapshot_files"]
    ]


def _draw_frame_overlay(frame, status_text, reason_text):
    annotated = frame.copy()
    timestamp_text = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    status_line = f"STATUS: {status_text}"
    reason_line = f"REASON: {reason_text}"

    cv2.rectangle(annotated, (8, 8), (420, 90), (0, 0, 0), -1)
    cv2.putText(annotated, timestamp_text, (18, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA)
    cv2.putText(annotated, status_line, (18, 52), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0) if status_text == "SAFE" else (0, 0, 255), 2, cv2.LINE_AA)
    cv2.putText(annotated, reason_line, (18, 74), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (255, 255, 255), 1, cv2.LINE_AA)
    return annotated


def get_face_mesh_module():
    if mp is None:
        raise RuntimeError("MediaPipe import failed")

    try:
        return mp.solutions.face_mesh
    except AttributeError:
        try:
            from mediapipe.python.solutions import face_mesh as face_mesh_module
            return face_mesh_module
        except Exception as e:
            raise RuntimeError(
                "MediaPipe FaceMesh is unavailable. Install a compatible mediapipe package."
            ) from e

# ===================== BUZZER (platform-safe) =====================
def play_buzzer():
    global buzzer_active
    if not _IS_WINDOWS:
        return  # No-op on Linux/Docker
    # Beep twice per alert frame, keeping duration short so it doesn't linger
    for _ in range(2):
        if not buzzer_active:
            break
        winsound.Beep(1000, 150)
        time.sleep(0.05)
    buzzer_active = False

def start_buzzer():
    global buzzer_active, buzzer_thread
    if not _IS_WINDOWS:
        return  # No-op on Linux/Docker
    if not buzzer_active:
        buzzer_active = True
        buzzer_thread = threading.Thread(target=play_buzzer, daemon=True)
        buzzer_thread.start()

def stop_buzzer():
    global buzzer_active
    buzzer_active = False
    if _IS_WINDOWS:
        time.sleep(0.05)

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

# ===================== FRAME ANALYSIS CORE =====================
def _analyze_frame(frame):
    """
    Run the full detection pipeline on a single frame.
    Returns (violation_reason, timeout, current_face_count, current_gaze).
    This is the shared analysis logic used by both the old loop and the new
    process_single_frame() path.
    """
    global head_buffer, gaze_buffer

    violation_reason = None
    timeout = GAZE_ALERT_TIMEOUT
    current_face_count = 1
    current_gaze = "Center"

    # --- Dark environment check ---
    if detection_settings["dark_environment"]:
        gray_for_brightness = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        brightness = float(np.mean(gray_for_brightness))
        if brightness < DARK_BRIGHTNESS_THRESHOLD:
            violation_reason = "DARK ENVIRONMENT"
            timeout = 0.7
            return violation_reason, timeout, current_face_count, current_gaze

    # --- MediaPipe face detection + gaze ---
    face_mesh = _get_or_init_face_mesh()
    if face_mesh is not None:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(rgb)

        face_count = len(results.multi_face_landmarks) if results.multi_face_landmarks else 0
        current_face_count = face_count

        if detection_settings["face_detection"] and face_count == 0:
            violation_reason = "NO FACE"
            timeout = NO_FACE_TIMEOUT

        elif detection_settings["multiple_people"] and face_count > 1:
            violation_reason = "MULTIPLE FACES"
            timeout = MULTI_FACE_TIMEOUT

        else:
            if face_count == 0:
                # No face, but face_detection is disabled — just return safe
                return None, timeout, current_face_count, current_gaze

            landmarks = results.multi_face_landmarks[0]

            head_pose = None
            if detection_settings["gaze_tracking"]:
                head_pose = detect_head_pose(landmarks, FRAME_SIZE[0], FRAME_SIZE[1])

            if head_pose:
                head_buffer.append(head_pose)
                if head_buffer.count(head_pose) >= 3:
                    violation_reason = head_pose
                current_gaze = head_pose.replace("HEAD ", "").capitalize()
            else:
                head_buffer.clear()

                x_coords = [lm.x for lm in landmarks.landmark]
                y_coords = [lm.y for lm in landmarks.landmark]

                x_min = int(max(0, min(x_coords) * FRAME_SIZE[0]))
                x_max = int(min(FRAME_SIZE[0], max(x_coords) * FRAME_SIZE[0]))
                y_min = int(max(0, min(y_coords) * FRAME_SIZE[1]))
                y_max = int(min(FRAME_SIZE[1], max(y_coords) * FRAME_SIZE[1]))

                face_crop = frame[y_min:y_max, x_min:x_max]

                if detection_settings["gaze_tracking"] and face_crop.size > 0:
                    gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
                    gray = cv2.resize(gray, (64, 64))

                    pred = predict_face(gray)
                    gaze_buffer.append(pred)

                    if sum(gaze_buffer) >= 3:
                        violation_reason = "LOOKING AWAY"
                        current_gaze = "Away"
    else:
        # Fallback: OpenCV Haar cascade (no MediaPipe available)
        head_buffer.clear()
        cascade_path = os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml")
        face_detector = cv2.CascadeClassifier(cascade_path)
        if face_detector.empty():
            return "FACE DETECTOR INIT FAILED", 0, 0, current_gaze

        gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_detector.detectMultiScale(
            gray_frame,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(60, 60)
        )

        face_count = len(faces)
        current_face_count = face_count

        if detection_settings["face_detection"] and face_count == 0:
            violation_reason = "NO FACE"
            timeout = NO_FACE_TIMEOUT

        elif detection_settings["multiple_people"] and face_count > 1:
            violation_reason = "MULTIPLE FACES"
            timeout = MULTI_FACE_TIMEOUT

        else:
            if face_count == 0:
                return None, timeout, current_face_count, current_gaze

            x, y, w, h = faces[0]
            face_crop = frame[y:y + h, x:x + w]

            if detection_settings["gaze_tracking"] and face_crop.size > 0:
                gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
                gray = cv2.resize(gray, (64, 64))

                pred = predict_face(gray)
                gaze_buffer.append(pred)

                if sum(gaze_buffer) >= 3:
                    violation_reason = "LOOKING AWAY"
                    current_gaze = "Away"

    return violation_reason, timeout, current_face_count, current_gaze


def _apply_violation_logic(violation_reason, timeout, current_face_count, current_gaze, frame):
    """
    Given analysis results, update global status, fire events/snapshots, handle buzzer.
    Shared by both the old camera loop and the new process_single_frame path.
    """
    global active_violation, violation_start_time

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
    else:
        active_violation = None
        violation_start_time = None
        gaze_buffer.clear()
        current_status["status"] = "SAFE"
        current_status["reason"] = "SAFE"

    current_status["faces_detected"] = current_face_count
    current_status["gaze_direction"] = current_gaze

    # Event logging — only log on status/reason transitions
    prev_status = session_events[-1]["status"] if session_events else "SAFE"
    prev_reason = session_events[-1]["reason"] if session_events else "SAFE"
    current_state_status = current_status["status"]
    current_state_reason = current_status["reason"]

    if current_state_status != prev_status or current_state_reason != prev_reason:
        event_type = "ALERT_TRIGGERED" if current_state_status == "ALERT" else "STATUS_RECOVERED"
        note = "Violation detected" if current_state_status == "ALERT" else "Back to safe state"
        snapshot_file = None
        if event_type == "ALERT_TRIGGERED":
            snapshot_frame = _draw_frame_overlay(frame, current_state_status, current_state_reason)
            snapshot_file = _capture_snapshot(snapshot_frame, current_state_reason)
        _record_event(event_type, current_state_status, current_state_reason, note, snapshot_file=snapshot_file)


# ===================== FRONTEND-PUSH: process_single_frame =====================
def process_single_frame(image_bytes):
    """
    Called by the POST /process_frame endpoint.
    Receives raw image bytes from the browser, decodes, runs the full
    detection pipeline, updates global state, and returns the current status.
    """
    global latest_frame, record_frame_counter, video_writer

    if not running:
        return {"status": "STOPPED", "reason": "Proctoring not active"}

    # Decode image bytes to OpenCV frame
    np_arr = np.frombuffer(image_bytes, np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if frame is None:
        return {"status": "ERROR", "reason": "Failed to decode image"}

    # Resize to standard processing size
    frame = cv2.resize(frame, FRAME_SIZE)

    try:
        violation_reason, timeout, current_face_count, current_gaze = _analyze_frame(frame)
        _apply_violation_logic(violation_reason, timeout, current_face_count, current_gaze, frame)
    except Exception as e:
        print("Frame processing error:", e)

    # Record to video if writer is active
    if video_writer is not None:
        record_frame_counter += 1
        if record_frame_counter % RECORDING_FRAME_STRIDE == 0:
            if RECORD_WITH_OVERLAY:
                output_frame = _draw_frame_overlay(frame, current_status["status"], current_status["reason"])
            else:
                output_frame = frame
            video_writer.write(output_frame)

    latest_frame = frame.copy()

    return {
        "status": current_status["status"],
        "reason": current_status["reason"],
        "faces_detected": current_status["faces_detected"],
        "gaze_direction": current_status["gaze_direction"],
        "cellphone_detected": current_status["cellphone_detected"],
    }


# ===================== SESSION LIFECYCLE =====================
def start_proctoring():
    """
    Initialize a new proctoring session.
    In frontend-push mode, this just sets up session state.
    Frames arrive later via process_single_frame().
    """
    global running, latest_frame
    global violation_start_time, active_violation
    global session_start_time, session_end_time, session_id, session_events
    global video_writer, video_output_path, snapshot_output_dir, record_frame_counter
    global _face_mesh, _face_mesh_initialized

    running = True
    stop_buzzer()

    session_start_time = time.time()
    session_end_time = None
    session_id = datetime.now().strftime("session_%Y%m%d_%H%M%S")
    session_events = []
    latest_report_paths["json"] = None
    latest_report_paths["csv"] = None
    latest_report_paths["video"] = None
    latest_report_paths["snapshots_dir"] = None
    latest_report_paths["snapshots"] = []
    snapshot_output_dir = None
    record_frame_counter = 0
    violation_start_time = None
    active_violation = None
    gaze_buffer.clear()
    head_buffer.clear()
    latest_frame = None

    # Reset face mesh for fresh session
    _face_mesh = None
    _face_mesh_initialized = False

    _record_event("SESSION_STARTED", "SAFE", "SAFE", "Proctoring session started")

    # Setup report output directories and video writer
    _, videos_dir, snapshots_dir = _ensure_reports_dirs(current_dir)
    snapshot_output_dir = snapshots_dir
    video_output_path = os.path.join(videos_dir, f"{session_id}.mp4")
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    video_writer = cv2.VideoWriter(video_output_path, fourcc, RECORDING_FPS, FRAME_SIZE)
    if not video_writer.isOpened():
        video_writer = None
        video_output_path = None
        _record_event("VIDEO_RECORDING", "SAFE", "SAFE", "Video writer initialization failed")
    else:
        _record_event("VIDEO_RECORDING", "SAFE", "SAFE", "Video recording started")