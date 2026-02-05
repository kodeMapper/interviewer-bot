from flask import Flask, jsonify, send_from_directory, Response, request
from flask_cors import CORS
import threading
import cv2
from proctor_live import start_proctoring, stop_proctoring, get_status, get_frame, set_camera

app = Flask(__name__)
CORS(app)

proctor_thread = None

@app.route("/")
def home():
    return send_from_directory(".", "index.html")

@app.route("/status")
def status():
    return jsonify(get_status())

@app.route("/start")
def start():
    global proctor_thread

    if proctor_thread and proctor_thread.is_alive():
        return jsonify({"message": "Already running"})

    proctor_thread = threading.Thread(target=start_proctoring, daemon=True)
    proctor_thread.start()

    return jsonify({"message": "Proctoring started"})

@app.route("/stop")
def stop():
    stop_proctoring()
    return jsonify({"message": "Proctoring stopped"})

# 🔥 CAMERA SELECTION ROUTES
@app.route("/cameras")
def get_cameras():
    """Get available cameras"""
    available = []
    for idx in range(5):
        cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
        if cap.isOpened():
            cap.release()
            available.append(idx)
    return jsonify({"cameras": available})

@app.route("/set_camera/<int:camera_index>")
def set_camera_route(camera_index):
    """Switch to a specific camera"""
    set_camera(camera_index)
    return jsonify({"message": f"Camera switched to {camera_index}", "camera": camera_index})

# 🔥 VIDEO STREAM ROUTE - MJPEG
@app.route("/video_feed")
def video_feed():
    def generate():
        while True:
            frame = get_frame()
            if frame is None:
                continue

            _, jpeg = cv2.imencode(".jpg", frame)
            frame_bytes = jpeg.tobytes()

            yield (b"--frame\r\n"
                   b"Content-Type: image/jpeg\r\n\r\n" +
                   frame_bytes + b"\r\n")

    return Response(generate(),
                    mimetype="multipart/x-mixed-replace; boundary=frame")

# 🔥 SINGLE FRAME ROUTE - For img tag refresh
@app.route("/frame")
def frame():
    frame = get_frame()
    if frame is None:
        return "", 204
    
    _, jpeg = cv2.imencode(".jpg", frame)
    return jpeg.tobytes(), 200, {"Content-Type": "image/jpeg"}

@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(".", path)

if __name__ == "__main__":
    app.run(port=5000, debug=True, threaded=True)


