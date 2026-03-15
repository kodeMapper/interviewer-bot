# SecureProctor AI — System Explanation

This document describes the SecureProctor AI proctoring system in depth: architecture, components, data flow, model, alerting (including the buzzer), configuration, and how it supports interview/exam monitoring.

---

## 1. System Overview

The system monitors a candidate's camera feed in real time and enforces looking-at-screen rules. If the candidate looks away for longer than a configured timeout (default 3.5s), the system raises a visual alert and starts a continuous buzzer sound until the candidate looks back.

High-level components:

- Frontend: `index.html`, `app.js`, UI to display live feed, status, and logs.
- Backend: Flask server (`server.py` / `app.py`) that exposes endpoints for status, video frames, and control.
- AI Proctoring Engine: `proctor_live.py` — captures camera frames, runs detection logic, updates status, and manages buzzer.
- Model: `eye_cnn_model.py` — CNN used to classify whether the subject is "looking" or "not looking".

---

## 2. Frontend (Browser)

- Provides a simple UI with:
  - Live camera feed display
  - Status indicator (SAFE / ALERT)
  - Camera selection and Start/Stop controls
  - Violation log with timestamps

- Main logic in `app.js`:
  - Poll `/status` periodically (1s) to update indicator and logs
  - Refresh single-frame endpoint `/frame` at ~30 FPS to show live image
  - Routes available: `/start`, `/stop`, `/status`, `/frame`, `/video_feed`, `/cameras`, `/set_camera/<index>`

---

## 3. Backend (Flask server)

- Responsible for:
  - Hosting the web UI and static files
  - Launching/stopping the proctoring thread
  - Streaming frames (MJPEG) or single-frame snapshots
  - Returning JSON status for the UI

- Threading model:
  - Flask main thread handles HTTP requests
  - A background proctoring thread runs `start_proctoring()` from `proctor_live.py`
  - The buzzer runs in a daemon thread so audio playback doesn't block detection

---

## 4. AI Proctoring Engine (`proctor_live.py`)

### Primary responsibilities

- Capture frames from the selected camera at ~30 FPS
- Detect faces using OpenCV Haar Cascade
- Apply simple logic to decide whether the candidate is "looking"
- Manage a look-away timer and trigger alerts
- Start/stop a buzzer sound when alerts are active
- Expose current frame and status to the Flask server

### Core detection loop (conceptual)

1. Read frame from camera
2. Convert to grayscale for fast processing
3. Detect faces: `face_cascade.detectMultiScale(gray, 1.3, 5)`
4. Determine `is_looking`:
   - `True` if exactly 1 face detected
   - `False` otherwise (no face, multiple faces, or off-center)
5. If `is_looking == False`:
   - Start or continue `look_away_start`
   - If elapsed > `LOOK_AWAY_TIMEOUT` (3.5s): set status to ALERT and `start_buzzer()`
6. If `is_looking == True`:
   - Reset `look_away_start`
   - Set status to SAFE and call `stop_buzzer()`

### Buzzer behavior

- Implemented for Windows using `winsound.Beep()` in a separate daemon thread.
- `start_buzzer()` sets a `buzzer_active` flag and starts `play_buzzer()` in a thread.
- `play_buzzer()` loops while `buzzer_active` is `True`, repeatedly beeping (1000Hz, 500ms), with short gaps.
- `stop_buzzer()` clears the flag; the thread exits gracefully.

---

## 5. Deep Learning Model (`eye_cnn_model.py`)

- Architecture summary:
  - Input: grayscale image (64×64)
  - Conv1: 1 → 6 filters, kernel 5
  - Pooling
  - Conv2: 6 → 16 filters, kernel 5
  - Pooling
  - Flatten → FC layers (120, 84) → output 2 classes (good/bad)
  - Dropout 0.3 applied before FC layers

- Training pipeline (in repo):
  - Pretrain on `external_dataset` (15 epochs, Adam lr=0.001)
  - Fine-tune on local `dataset` (10 epochs, Adam lr=0.0003)
  - Save weights: `pretrained_eye_cnn.pth` and `eye_cnn_final.pth`

Note: Current training scripts print loss but do not compute/record accuracy — consider adding validation and metrics tracking.

---

## 6. Data Flow & End-to-End Journey

1. Candidate opens UI and selects camera
2. Start proctoring → Flask starts the proctor thread
3. Proctor engine reads frames, runs detection, updates `current_status` and `latest_frame`
4. Browser polls `/status` and refreshes `/frame`; it displays live feed and status
5. If look-away time exceeds threshold: UI shows RED alert and buzzer sounds until candidate looks back

---

## 7. Configuration & Key Parameters

| Parameter           |       Default | Purpose                                       |
| ------------------- | ------------: | --------------------------------------------- |
| `LOOK_AWAY_TIMEOUT` | 3.5 (seconds) | Delay before alert triggers                   |
| `CONF_THRESHOLD`    |          0.90 | Minimum model confidence to accept prediction |
| `camera_index`      |             1 | Default camera index (external USB)           |
| `Refresh Rate`      |       ~30 FPS | Camera capture rate                           |
| `Status Poll`       |      1 second | Browser polling frequency                     |
| `Buzzer Frequency`  |       1000 Hz | Pitch of beep (Windows `winsound`)            |

Adjust these in `proctor_live.py` as needed for your environment.

---

## 8. Interview Flow / How to Use

1. Start server: run the Flask app (e.g., `python server.py` or `python app.py`) on the host machine.
2. Open http://localhost:5000 in the candidate's browser.
3. Select camera if needed and click **Start Proctoring**.
4. System begins monitoring; candidate must keep looking at screen.
5. If candidate looks away > timeout, UI goes RED and buzzer sounds until they return.
6. All violations are logged in the UI with timestamps.

---

## 9. Practical Notes & Suggestions for Improvement

- Add validation and accuracy reporting to training scripts to measure performance.
- Improve the ML model: use deeper CNN or transfer learning (e.g., ResNet18 adapted to 1-channel input) for better accuracy.
- Add data augmentation and balance classes in datasets.
- Replace Haar cascade face-only heuristic with a gaze-estimation model for more precise look detection.
- Make buzzer cross-platform: on Linux/Mac use `playsound` or `pyaudio` with a short WAV file; currently `winsound` is Windows-only.
- Log violations to disk (file or DB) for audit and review.

---

## 10. Short Summary

SecureProctor AI locally captures video, runs a CNN+face-detection-based check to ensure the candidate is looking at the screen, and triggers a persistent buzzer and red alert after a short timeout to immediately notify the candidate. It is web-based, runs locally, and keeps a simple violation log in the UI.

---

File created: `proctoring/PROCTORING_SYSTEM_EXPLAINED.md`
