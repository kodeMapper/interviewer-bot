from flask import Flask, jsonify, send_from_directory, Response
from flask_cors import CORS
import threading
import cv2
import time
import os

from proctor_live import (
    start_proctoring,
    stop_proctoring,
    get_status,
    get_frame,
    set_camera
)

app = Flask(__name__)
CORS(app)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

proctor_thread = None

# =========================
# AUTO START PROCTOR THREAD
# =========================
def start_background_proctor():
    global proctor_thread
    if proctor_thread is None or not proctor_thread.is_alive():
        proctor_thread = threading.Thread(
            target=start_proctoring,
            daemon=True
        )
        proctor_thread.start()
        print("Proctor thread started")


# =========================
# ROUTES
# =========================
@app.route("/")
def home():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/status")
def status():
    return jsonify(get_status())


@app.route("/start")
def start():
    start_background_proctor()
    return jsonify({"message": "Proctoring started"})


@app.route("/stop")
def stop():
    stop_proctoring()
    return jsonify({"message": "Proctoring stopped"})


# =========================
# CAMERA SELECTION
# =========================
@app.route("/cameras")
def get_cameras():
    available = []
    for idx in range(5):
        cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
        if cap.isOpened():
            cap.release()
            available.append(idx)
    return jsonify({"cameras": available})


@app.route("/set_camera/<int:camera_index>")
def set_camera_route(camera_index):
    set_camera(camera_index)
    return jsonify({
        "message": f"Camera switched to {camera_index}",
        "camera": camera_index
    })


# =========================
# MJPEG VIDEO STREAM
# =========================
@app.route("/video_feed")
def video_feed():

    def generate():
        while True:
            frame = get_frame()

            if frame is None:
                time.sleep(0.05)  # prevent freeze
                continue

            ret, jpeg = cv2.imencode(".jpg", frame)
            if not ret:
                continue

            frame_bytes = jpeg.tobytes()

            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" +
                frame_bytes +
                b"\r\n"
            )

            time.sleep(0.03)  # ~30 FPS control

    return Response(
        generate(),
        mimetype="multipart/x-mixed-replace; boundary=frame"
    )


# =========================
# SINGLE FRAME ROUTE
# =========================
@app.route("/frame")
def frame():
    frame = get_frame()
    if frame is None:
        return "", 204

    ret, jpeg = cv2.imencode(".jpg", frame)
    if not ret:
        return "", 204

    return jpeg.tobytes(), 200, {"Content-Type": "image/jpeg"}


@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(BASE_DIR, path)


# =========================
# MAIN
# =========================
if __name__ == "__main__":
    app.run(port=5000, debug=False, threaded=True)

