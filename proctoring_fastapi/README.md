# SecureProctor AI

AI-based interview/exam proctoring system with:

- Live webcam monitoring
- Face-count checks (`NO FACE`, `MULTIPLE FACES`)
- Head-pose + gaze checks (`LOOKING AWAY`)
- Real-time web dashboard and violation log
- Audible alert (buzzer) on violations

This project runs locally and serves a browser UI from FastAPI.

## Features

- External camera support with robust backend probing (`DSHOW`, `MSMF`, `ANY`)
- Camera selection from UI (`/cameras`, `/set_camera/<index>`)
- Real-time status polling and MJPEG video stream
- Alert engine with timeout smoothing
- Trained CNN model support from local weights (`eye_cnn_final.pth`)
- MediaPipe + automatic OpenCV fallback when MediaPipe fails

## Project Structure

- `server.py`: Main FastAPI server (recommended entrypoint)
- `proctor_live.py`: Core proctoring engine
- `index.html`, `style.css`, `app.js`: Frontend dashboard
- `eye_cnn_model.py`: CNN model definition
- `eye_cnn_final.pth`: Final trained gaze model used during proctoring
- `pretrained_eye_cnn.pth`: Stage-1 pretrained weights
- `dataset_loader.py`, `train_pretrain.py`, `train_finetune.py`: Training pipeline
- `people_detector.py`: YOLO-based multi-person utility
- `capture_dataset.py`, `collect_images.py`: Dataset collection utilities
- `docs/PROCTORING_FULL_DEEP_DIVE.md`: Extended architecture explanation

## Requirements

Install all dependencies:

```bash
pip install -r requirements.txt
```

Main dependencies:

- FastAPI
- uvicorn
- pydantic
- Flask
- flask-cors
- opencv-python
- torch
- numpy
- mediapipe
- ultralytics

## Quick Start (Windows CMD)

```cmd
cd /d C:\Users\acer\Desktop\DL Project\proctoring_fastapi
python -m pip install -r requirements.txt
python server.py
```

Open:

- `http://127.0.0.1:5000`
- `http://127.0.0.1:5000/docs`
- `http://127.0.0.1:5000/api-docs`

## How to Use

1. Open UI in browser.
2. Wait for camera list to load.
3. Select your external camera index.
4. Click **Start Proctoring**.
5. Monitor `SAFE/ALERT` state and violation log.

## API Documentation

- `http://127.0.0.1:5000/docs` - SecureProctor FastAPI Swagger
- `http://127.0.0.1:5000/redoc` - SecureProctor ReDoc
- `http://127.0.0.1:5000/api-docs` - Docs hub with links to the other local APIs
- `http://localhost:5001/api/docs` - Express interview backend Swagger
- `http://localhost:8000/docs` - ML service Swagger

## Recommended Local Ports

- `5000` - SecureProctor FastAPI
- `5001` - Express interview backend
- `8000` - ML service

## API Endpoints

### Core Control

- `GET /start` → start proctoring thread
- `GET /stop` → stop proctoring thread
- `GET /status` → current status JSON (`SAFE` or `ALERT` + reason)

### Camera

- `GET /cameras` → list camera indices that can actually provide frames
- `GET /set_camera/<index>` → switch active camera

### Video

- `GET /video_feed` → MJPEG stream
- `GET /frame` → single JPEG frame

## Detection Logic (Current)

### Face / Presence

- `NO FACE` when no face is detected
- `MULTIPLE FACES` when more than one face is detected

### Head Pose + Gaze

- Uses MediaPipe FaceMesh when available
- Computes head orientation (`HEAD LEFT/RIGHT/UP/DOWN`)
- Uses CNN (`eye_cnn_final.pth`) for gaze-like classification from face crop
- Triggers `LOOKING AWAY` when smoothed predictions cross threshold

### MediaPipe Fallback

If MediaPipe import/init fails:

- System falls back to OpenCV Haar face detection
- Proctoring continues (no crash)
- `NO FACE`, `MULTIPLE FACES`, and CNN-based `LOOKING AWAY` still work
- Head-pose checks are unavailable in fallback mode

## Model Usage

`proctor_live.py` loads:

- Model class: `EyeCNN` from `eye_cnn_model.py`
- Weights: `eye_cnn_final.pth` from the same folder

So yes, your local trained model is used at runtime.

## Training Pipeline

### Stage 1: Pretraining

```bash
python train_pretrain.py
```

Outputs `pretrained_eye_cnn.pth`.

### Stage 2: Fine-tuning

```bash
python train_finetune.py
```

Loads pretrained weights and writes `eye_cnn_final.pth`.

## Dataset Utilities

### Capture face crops to `dataset/good` and `dataset/bad`

```bash
python capture_dataset.py
```

### Collect full-frame images into `my_dataset`

```bash
python collect_images.py
```

## Troubleshooting

### External camera not opening

- Close Zoom/Teams/Meet/OBS or any app locking webcam.
- Check available cameras:
  - Open `http://127.0.0.1:5000/cameras`
- Set camera manually:
  - `http://127.0.0.1:5000/set_camera/1` (replace index)
- Keep webcam connected before starting server.

### MediaPipe error (`module 'mediapipe' has no attribute 'solutions'`)

- Install dependencies from `requirements.txt`.
- Runtime now automatically falls back to OpenCV if MediaPipe fails.

### `Import "flask" could not be resolved` in editor

- Usually VS Code interpreter mismatch.
- Select the same interpreter where you installed requirements.

## Notes

- `server.py` is the preferred backend entrypoint.
- `app.py` is an older Flask server variant kept for compatibility.
- Buzzer uses `winsound`, so alert sound is Windows-oriented.

## License

No license file is currently included in this repository.
