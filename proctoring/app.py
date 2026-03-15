from flask import Flask, jsonify, send_from_directory, Response
from flask_cors import CORS
import threading
import cv2
import time

from proctor_live import start_proctoring, stop_proctoring, get_status, get_frame

app = Flask(__name__)
CORS(app)

# 🔥 START CAMERA THREAD IMMEDIATELY WHEN SERVER RUNS
camera_thread = threading.Thread(target=start_proctoring, daemon=True)
camera_thread.start()

@app.route("/")
def home():
    return send_from_directory(".", "index.html")

@app.route("/status")
def status():
    return jsonify(get_status())

@app.route("/stop")
def stop():
    stop_proctoring()
    return jsonify({"message": "Camera stopped"})

# 🔥 VIDEO STREAM ROUTE
@app.route("/video_feed")
def video_feed():
    def generate():
        while True:
            frame = get_frame()
            if frame is None:
                time.sleep(0.05)
                continue

            _, jpeg = cv2.imencode(".jpg", frame)
            frame_bytes = jpeg.tobytes()

            yield (b"--frame\r\n"
                   b"Content-Type: image/jpeg\r\n\r\n" +
                   frame_bytes + b"\r\n")

    return Response(generate(),
                    mimetype="multipart/x-mixed-replace; boundary=frame")

@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(".", path)

if __name__ == "__main__":
    app.run(port=5000, debug=True, threaded=True)
