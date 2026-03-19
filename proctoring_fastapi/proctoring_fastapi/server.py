from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
import threading
import logging
import cv2
import time
import os
import uvicorn
import zipfile

from proctor_live import (
    start_proctoring,
    stop_proctoring,
    get_status,
    get_frame,
    set_camera,
    get_settings,
    update_settings,
    get_latest_report_paths,
    get_session_metadata,
    set_session_metadata,
)


class DetectionSettingsPayload(BaseModel):
    dark_environment: bool
    face_detection: bool
    gaze_tracking: bool
    multiple_people: bool


class SessionMetadataPayload(BaseModel):
    candidate_name: str = ""
    roll_number: str = ""
    subject: str = ""
    exam_id: str = ""

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
HOST = "127.0.0.1"
PORT = 5000
OPEN_URL = f"http://{HOST}:{PORT}"
NAME_TAG = "ॐ RITESH ॐ"

logger = logging.getLogger("proctoring.api")

proctor_thread = None
CAMERA_BACKENDS = (cv2.CAP_DSHOW, cv2.CAP_MSMF, cv2.CAP_ANY)


def probe_camera(index: int) -> bool:
    for backend in CAMERA_BACKENDS:
        cap = cv2.VideoCapture(index, backend)
        if cap.isOpened():
            for _ in range(6):
                ret, frame = cap.read()
                if ret and frame is not None and frame.size > 0:
                    cap.release()
                    return True
                time.sleep(0.02)
        cap.release()
    return False

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
        logger.info("Proctor thread started")
    else:
        logger.info("Proctor thread already running")


def log_startup_banner():
    border = "=" * 58
    logger.info(border)
    logger.info("                 ✨ %s ✨", NAME_TAG)
    logger.info("                   SecureProctor")
    logger.info(border)


@app.on_event("startup")
def on_startup():
    log_startup_banner()
    logger.info("SecureProctor API started")
    logger.info("Frontend URL: %s", OPEN_URL)
    logger.info("API docs URL: %s/docs", OPEN_URL)
    logger.info("Status endpoint: %s/status", OPEN_URL)


# =========================
# ROUTES
# =========================
@app.get("/")
def home():
    return FileResponse(os.path.join(BASE_DIR, "index.html"))


@app.get("/status")
def status():
    return JSONResponse(content=get_status())


@app.get("/settings")
def settings_get():
    return JSONResponse(content=get_settings())


@app.post("/settings")
def settings_update(payload: DetectionSettingsPayload):
    logger.info("Updating detection settings: %s", payload.model_dump())
    updated = update_settings(payload.model_dump())
    return JSONResponse(content=updated)


@app.get("/session/meta")
def session_meta_get():
    return JSONResponse(content=get_session_metadata())


@app.post("/session/meta")
def session_meta_set(payload: SessionMetadataPayload):
    logger.info("Updating session metadata")
    updated = set_session_metadata(payload.model_dump())
    return JSONResponse(content=updated)


@app.get("/start")
def start():
    logger.info("/start called")
    start_background_proctor()
    return JSONResponse(content={"message": "Proctoring started"})


@app.get("/stop")
def stop():
    global proctor_thread
    logger.info("/stop called")
    stop_proctoring()

    if proctor_thread is not None and proctor_thread.is_alive():
        proctor_thread.join(timeout=3.0)

    latest_reports = get_latest_report_paths()
    has_report = bool(latest_reports.get("json") or latest_reports.get("csv") or latest_reports.get("video"))
    snapshot_files = [os.path.basename(path) for path in latest_reports.get("snapshots", [])]

    return JSONResponse(content={
        "message": "Proctoring stopped",
        "report_ready": has_report,
        "reports": {
            "json": os.path.basename(latest_reports["json"]) if latest_reports.get("json") else None,
            "csv": os.path.basename(latest_reports["csv"]) if latest_reports.get("csv") else None,
            "video": os.path.basename(latest_reports["video"]) if latest_reports.get("video") else None,
            "snapshots": snapshot_files,
            "snapshot_urls": [f"/report/download/snapshot/{name}" for name in snapshot_files],
            "package": "/report/download/package" if has_report else None,
        }
    })


@app.get("/report/latest")
def report_latest():
    latest_reports = get_latest_report_paths()
    snapshot_files = [os.path.basename(path) for path in latest_reports.get("snapshots", [])]
    return JSONResponse(content={
        "json": os.path.basename(latest_reports["json"]) if latest_reports.get("json") else None,
        "csv": os.path.basename(latest_reports["csv"]) if latest_reports.get("csv") else None,
        "video": os.path.basename(latest_reports["video"]) if latest_reports.get("video") else None,
        "snapshots": snapshot_files,
        "download": {
            "json": "/report/download/json" if latest_reports.get("json") else None,
            "csv": "/report/download/csv" if latest_reports.get("csv") else None,
            "video": "/report/download/video" if latest_reports.get("video") else None,
            "snapshots": [f"/report/download/snapshot/{name}" for name in snapshot_files],
            "package": "/report/download/package" if (latest_reports.get("json") or latest_reports.get("csv") or latest_reports.get("video")) else None,
        }
    })


@app.get("/report/download/{report_type}")
def report_download(report_type: str):
    if report_type == "package":
        latest_reports = get_latest_report_paths()
        source_paths = []

        for key in ("json", "csv", "video"):
            path = latest_reports.get(key)
            if path and os.path.exists(path):
                source_paths.append(path)

        for snap_path in latest_reports.get("snapshots", []):
            if snap_path and os.path.exists(snap_path):
                source_paths.append(snap_path)

        if not source_paths:
            return Response(status_code=404)

        reports_dir = os.path.join(BASE_DIR, "reports")
        packages_dir = os.path.join(reports_dir, "packages")
        os.makedirs(packages_dir, exist_ok=True)

        base_name = "report_package"
        json_path = latest_reports.get("json")
        if json_path:
            base_name = os.path.splitext(os.path.basename(json_path))[0]

        package_path = os.path.join(packages_dir, f"{base_name}_package.zip")

        with zipfile.ZipFile(package_path, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
            for src in source_paths:
                rel_path = os.path.relpath(src, reports_dir)
                zip_file.write(src, arcname=rel_path)

        return FileResponse(package_path, filename=os.path.basename(package_path))

    latest_reports = get_latest_report_paths()
    path = latest_reports.get(report_type)
    if not path or not os.path.exists(path):
        return Response(status_code=404)
    return FileResponse(path, filename=os.path.basename(path))


@app.get("/report/download/package")
def report_download_package():
    latest_reports = get_latest_report_paths()
    source_paths = []

    for key in ("json", "csv", "video"):
        path = latest_reports.get(key)
        if path and os.path.exists(path):
            source_paths.append(path)

    for snap_path in latest_reports.get("snapshots", []):
        if snap_path and os.path.exists(snap_path):
            source_paths.append(snap_path)

    if not source_paths:
        return Response(status_code=404)

    reports_dir = os.path.join(BASE_DIR, "reports")
    packages_dir = os.path.join(reports_dir, "packages")
    os.makedirs(packages_dir, exist_ok=True)

    base_name = "report_package"
    json_path = latest_reports.get("json")
    if json_path:
        base_name = os.path.splitext(os.path.basename(json_path))[0]

    package_path = os.path.join(packages_dir, f"{base_name}_package.zip")

    with zipfile.ZipFile(package_path, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
        for src in source_paths:
            rel_path = os.path.relpath(src, reports_dir)
            zip_file.write(src, arcname=rel_path)

    return FileResponse(package_path, filename=os.path.basename(package_path))


@app.get("/report/download/snapshot/{filename}")
def report_download_snapshot(filename: str):
    latest_reports = get_latest_report_paths()
    snapshots_dir = latest_reports.get("snapshots_dir")
    if not snapshots_dir:
        return Response(status_code=404)

    safe_name = os.path.basename(filename)
    path = os.path.join(snapshots_dir, safe_name)
    if not os.path.exists(path):
        return Response(status_code=404)
    return FileResponse(path, filename=safe_name)


# =========================
# CAMERA SELECTION
# =========================
@app.get("/cameras")
def get_cameras():
    logger.info("Scanning available cameras...")
    available = []
    for idx in range(11):
        if probe_camera(idx):
            available.append(idx)
    logger.info("Camera scan complete. Found: %s", available)
    return JSONResponse(content={"cameras": available})


@app.get("/set_camera/{camera_index}")
def set_camera_route(camera_index):
    logger.info("Switching to camera index %s", camera_index)
    set_camera(camera_index)
    return JSONResponse(content={
        "message": f"Camera switched to {camera_index}",
        "camera": camera_index
    })


# =========================
# MJPEG VIDEO STREAM
# =========================
@app.get("/video_feed")
def video_feed():
    logger.info("/video_feed stream opened")

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

    return StreamingResponse(
        generate(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


# =========================
# SINGLE FRAME ROUTE
# =========================
@app.get("/frame")
def frame():
    frame = get_frame()
    if frame is None:
        return Response(status_code=204)

    ret, jpeg = cv2.imencode(".jpg", frame)
    if not ret:
        return Response(status_code=204)

    return Response(content=jpeg.tobytes(), media_type="image/jpeg")


@app.get("/favicon.ico")
def favicon():
    icon_path = os.path.join(BASE_DIR, "favicon.ico")
    if os.path.isfile(icon_path):
        return FileResponse(icon_path)
    return Response(status_code=204)


@app.get("/{path:path}")
def static_files(path):
    file_path = os.path.join(BASE_DIR, path)
    if not os.path.isfile(file_path):
        return JSONResponse(content={"error": "Not found"}, status_code=404)
    return FileResponse(file_path)


# =========================
# MAIN
# =========================
if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s"
    )
    logger.info("Starting SecureProctor server...")
    logger.info("Open in browser: %s", OPEN_URL)
    uvicorn.run(app, host=HOST, port=PORT)

