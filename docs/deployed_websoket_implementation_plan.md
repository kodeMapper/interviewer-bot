# Implementation Plan: Cloud-Native Proctoring Architecture

We need to transition the proctoring system from a **"Backend-Pull"** architecture (where the server controls the camera) to a **"Frontend-Push"** architecture (where the browser handles the camera and sends images to the server). 

This solves the major Hugging Face cloud limitation, and inherently makes local development vastly more stable (no more hardware fighting between the browser and Python!).

## Proposed Architecture Changes

### 1. Frontend Modifications (React)
The browser will take full ownership of the webcam.
- **[MODIFY] `client/src/context/ProctoringContext.jsx`**
  - Use `navigator.mediaDevices.getUserMedia()` to get a continuous video stream.
  - Set up an interval (e.g., every 1000ms) to capture a snapshot using a hidden `<canvas>`.
  - Send the snapshot image as Base64 to a new `POST` endpoint on the Express server.
- **[MODIFY] `client/src/components/proctoring/ProctoringPanel.jsx`**
  - Replace the `<img src="/api/proctoring/video">` with a native HTML5 `<video autoplay muted>` element.
  - This provides a much smoother (60FPS instead of choppy MJPEG) live feed for the user.

### 2. Expressway Setup (Node.js)
- **[MODIFY] `server/src/adapters/proctoringAdapter.js` & `routes/proctoring.routes.js`**
  - Add a fast proxy endpoint `POST /api/proctoring/process_frame` that routes the image payload directly to FastAPI.
  - Remove the old MJPEG `/api/proctoring/video` proxy setup.

### 3. Backend Enhancements (FastAPI & Python)
The backend will become completely hardware-agnostic.
- **[MODIFY] `proctoring_fastapi/server.py`**
  - Expose a `POST /process_frame` endpoint that accepts an image payload.
- **[MODIFY] `proctoring_fastapi/proctor_live.py`**
  - Strip out `cv2.VideoCapture(...)` and the main `while running:` loop.
  - Convert it into a reactive function `process_single_frame(image_bytes)` that takes an image, runs MediaPipe/CNN gaze tracks, updates the event logs, handles the snapshots, and returns the status (`SAFE` or `ALERT`).

## User Review Required

> [!WARNING]
> **Performance Tradeoff**
> By sending frames from the browser to the cloud, there will be slight latency depending on internet upload speeds. I will compress the snapshots (Resize to ~480p and use JPEG compression in the browser) before sending to ensure low bandwidth usage and fast response times.
>
> Is it acceptable to sample the feed at around **1 snapshot per second** to save bandwidth?

## Verification Plan

### Automated Tests
- N/A

### Manual Verification
1. Launch the updated application locally first. Ensure the camera starts instantly and smoothly in the browser.
2. Watch the terminal logs to verify images are hitting the FastAPI server.
3. Test looking away / using a phone to verify the CNN predictions still trigger alerts and save snapshots properly in the new reactive environment.
