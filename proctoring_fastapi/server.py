from typing import List, Literal, Optional

import cv2
import logging
import os
import threading
import time
import uvicorn
import zipfile
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response, StreamingResponse
from pydantic import BaseModel, Field

from proctor_live import (
    get_frame,
    get_latest_report_paths,
    get_session_metadata,
    get_settings,
    get_status,
    set_camera,
    set_session_metadata,
    start_proctoring,
    stop_proctoring,
    update_settings,
)


class DetectionSettingsPayload(BaseModel):
    dark_environment: bool = Field(..., description="Enable dark-environment alerts")
    face_detection: bool = Field(..., description="Enable no-face detection")
    gaze_tracking: bool = Field(..., description="Enable gaze and head-pose monitoring")
    multiple_people: bool = Field(..., description="Enable multiple-face detection")


class SessionMetadataPayload(BaseModel):
    candidate_name: str = Field(default="", description="Candidate full name")
    roll_number: str = Field(default="", description="Candidate roll or registration number")
    subject: str = Field(default="", description="Exam subject or interview track")
    exam_id: str = Field(default="", description="Exam or session identifier")


class StatusResponse(BaseModel):
    status: str = Field(..., examples=["SAFE"])
    reason: str = Field(..., examples=["SAFE"])


class MessageResponse(BaseModel):
    message: str


class CameraListResponse(BaseModel):
    cameras: List[int] = Field(default_factory=list)


class CameraSelectionResponse(MessageResponse):
    camera: int


class ReportArtifactBundle(BaseModel):
    json: Optional[str] = None
    csv: Optional[str] = None
    video: Optional[str] = None
    snapshots: List[str] = Field(default_factory=list)
    snapshot_urls: List[str] = Field(default_factory=list)
    package: Optional[str] = None


class StopResponse(BaseModel):
    message: str
    report_ready: bool
    reports: ReportArtifactBundle


class ReportDownloadLinks(BaseModel):
    json: Optional[str] = None
    csv: Optional[str] = None
    video: Optional[str] = None
    snapshots: List[str] = Field(default_factory=list)
    package: Optional[str] = None


class LatestReportResponse(BaseModel):
    json: Optional[str] = None
    csv: Optional[str] = None
    video: Optional[str] = None
    snapshots: List[str] = Field(default_factory=list)
    download: ReportDownloadLinks


class ErrorResponse(BaseModel):
    error: str


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
HOST = "127.0.0.1"
PORT = 5000
OPEN_URL = f"http://{HOST}:{PORT}"
INTERVIEW_API_URL = os.getenv("INTERVIEW_API_URL", "http://localhost:5001")
ML_SERVICE_URL = os.getenv("ML_SERVICE_URL", "http://localhost:8000")
DOCS_HUB_PATH = "/api-docs"
NAME_TAG = "SkillWise"

OPENAPI_TAGS = [
    {
        "name": "Runtime",
        "description": "Live proctoring health, control, and current detection status.",
    },
    {
        "name": "Configuration",
        "description": "Detection toggles and session metadata used in reports.",
    },
    {
        "name": "Reports",
        "description": "Latest report lookup and downloadable report artifacts.",
    },
    {
        "name": "Camera",
        "description": "Camera discovery and active device selection.",
    },
    {
        "name": "Streaming",
        "description": "Live MJPEG feed and single-frame capture endpoints.",
    },
]

API_DESCRIPTION = f"""
SkillWise Proctoring System — real-time webcam monitoring with CNN gaze detection, head-pose tracking, and violation reporting.

Use this Swagger UI to test live proctoring controls, session metadata, camera selection,
stream endpoints, and generated report downloads.

Additional SkillWise services:
- Docs Hub: `{DOCS_HUB_PATH}`
- Interviewer Bot: `{INTERVIEW_API_URL}/api/docs`
- ML Service: `{ML_SERVICE_URL}/docs`

Recommended local ports:
- Proctoring System: `5000`
- Interviewer Bot: `5001`
- ML Service: `8000`
"""

app = FastAPI(
    title="SkillWise — Proctoring System",
    description=API_DESCRIPTION,
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=OPENAPI_TAGS,
    swagger_ui_parameters={
        "displayRequestDuration": True,
        "docExpansion": "list",
        "defaultModelsExpandDepth": 2,
        "filter": True,
        "tryItOutEnabled": True,
    },
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


def start_background_proctor():
    global proctor_thread
    if proctor_thread is None or not proctor_thread.is_alive():
        proctor_thread = threading.Thread(target=start_proctoring, daemon=True)
        proctor_thread.start()
        logger.info("Proctor thread started")
    else:
        logger.info("Proctor thread already running")


def log_startup_banner():
    border = "=" * 58
    logger.info(border)
    logger.info("                 ✨ %s ✨", NAME_TAG)
    logger.info("              Proctoring System")
    logger.info(border)


def build_docs_hub_html() -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SkillWise — API Docs Hub</title>
  <style>
    :root {{
      color-scheme: dark;
      --bg: #08111f;
      --panel: rgba(10, 22, 39, 0.86);
      --panel-border: rgba(148, 163, 184, 0.22);
      --text: #e2e8f0;
      --muted: #94a3b8;
      --accent: #38bdf8;
      --success: #34d399;
      --shadow: 0 28px 60px rgba(2, 8, 23, 0.45);
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      min-height: 100vh;
      font-family: "Segoe UI", Arial, sans-serif;
      background:
        radial-gradient(circle at top, rgba(14, 165, 233, 0.22), transparent 40%),
        linear-gradient(160deg, #020617 0%, var(--bg) 55%, #07192c 100%);
      color: var(--text);
    }}
    main {{
      max-width: 1100px;
      margin: 0 auto;
      padding: 56px 24px 72px;
    }}
    .hero {{
      background: var(--panel);
      border: 1px solid var(--panel-border);
      border-radius: 28px;
      padding: 32px;
      box-shadow: var(--shadow);
      backdrop-filter: blur(18px);
    }}
    .eyebrow {{
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--success);
      font-size: 0.85rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }}
    h1 {{
      margin: 16px 0 12px;
      font-size: clamp(2rem, 4vw, 3.3rem);
      line-height: 1.05;
    }}
    p {{
      margin: 0;
      color: var(--muted);
      line-height: 1.7;
      font-size: 1rem;
      max-width: 760px;
    }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 18px;
      margin-top: 28px;
    }}
    .card {{
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 22px;
      border-radius: 22px;
      text-decoration: none;
      color: inherit;
      background: rgba(15, 23, 42, 0.82);
      border: 1px solid rgba(148, 163, 184, 0.16);
      transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
    }}
    .card:hover {{
      transform: translateY(-4px);
      border-color: rgba(56, 189, 248, 0.4);
      background: rgba(15, 23, 42, 0.94);
    }}
    .card h2 {{
      margin: 0;
      font-size: 1.15rem;
    }}
    .card span {{
      color: var(--accent);
      font-weight: 600;
    }}
    .meta {{
      margin-top: 28px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
    }}
    .meta-block {{
      padding: 18px 20px;
      border-radius: 18px;
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(148, 163, 184, 0.14);
    }}
    .meta-block strong {{
      display: block;
      margin-bottom: 8px;
      font-size: 0.95rem;
    }}
    code {{
      font-family: Consolas, monospace;
      color: #bae6fd;
    }}
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <div class="eyebrow">SkillWise Platform</div>
      <h1>SkillWise API Docs Hub</h1>
      <p>
        Unified documentation portal for all SkillWise services. Each card below opens the
        Swagger UI for the respective backend, keeping file uploads, streaming, and downloads
        same-origin for reliable local development.
      </p>
      <div class="grid">
        <a class="card" href="/docs" target="_blank" rel="noopener noreferrer">
          <span>FastAPI Swagger</span>
          <h2>Proctoring System</h2>
          <p>Camera control, session metadata, live stream endpoints, and report artifacts.</p>
        </a>
        <a class="card" href="{INTERVIEW_API_URL}/api/docs" target="_blank" rel="noopener noreferrer">
          <span>Express Swagger</span>
          <h2>Interviewer Bot</h2>
          <p>Interview sessions, question bank, resume upload, analytics, and proctoring proxy routes.</p>
        </a>
        <a class="card" href="{ML_SERVICE_URL}/docs" target="_blank" rel="noopener noreferrer">
          <span>FastAPI Swagger</span>
          <h2>ML Service</h2>
          <p>Intent prediction, answer evaluation, health checks, and model diagnostics.</p>
        </a>
      </div>
      <div class="meta">
        <div class="meta-block">
          <strong>Recommended Ports</strong>
          <div><code>5000</code> Proctoring System</div>
          <div><code>5001</code> Interviewer Bot</div>
          <div><code>8000</code> ML Service</div>
        </div>
        <div class="meta-block">
          <strong>Testing Notes</strong>
          <div>Open the Swagger page for the service you want to exercise.</div>
          <div>Start each backend before using "Try it out".</div>
          <div>MJPEG stream routes work best in a browser tab when needed.</div>
        </div>
      </div>
    </section>
  </main>
</body>
</html>"""


def build_report_package_path() -> Optional[str]:
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
        return None

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

    return package_path


def build_stop_payload() -> StopResponse:
    latest_reports = get_latest_report_paths()
    has_report = bool(latest_reports.get("json") or latest_reports.get("csv") or latest_reports.get("video"))
    snapshot_files = [os.path.basename(path) for path in latest_reports.get("snapshots", [])]
    return StopResponse(
        message="Proctoring stopped",
        report_ready=has_report,
        reports=ReportArtifactBundle(
            json=os.path.basename(latest_reports["json"]) if latest_reports.get("json") else None,
            csv=os.path.basename(latest_reports["csv"]) if latest_reports.get("csv") else None,
            video=os.path.basename(latest_reports["video"]) if latest_reports.get("video") else None,
            snapshots=snapshot_files,
            snapshot_urls=[f"/report/download/snapshot/{name}" for name in snapshot_files],
            package="/report/download/package" if has_report else None,
        ),
    )


@app.on_event("startup")
def on_startup():
    log_startup_banner()
    logger.info("SkillWise — Proctoring System started")
    logger.info("Frontend URL: %s", OPEN_URL)
    logger.info("API docs URL: %s/docs", OPEN_URL)
    logger.info("Docs hub URL: %s%s", OPEN_URL, DOCS_HUB_PATH)
    logger.info("Status endpoint: %s/status", OPEN_URL)


@app.on_event("shutdown")
def on_shutdown():
    logger.info("Shutting down Proctoring System...")
    stop_proctoring()
    global proctor_thread
    if proctor_thread is not None and proctor_thread.is_alive():
        proctor_thread.join(timeout=3.0)


@app.get("/", include_in_schema=False)
def home():
    return FileResponse(os.path.join(BASE_DIR, "index.html"))


@app.get(DOCS_HUB_PATH, response_class=HTMLResponse, include_in_schema=False)
def api_docs_hub():
    return HTMLResponse(content=build_docs_hub_html())


@app.get(
    "/status",
    response_model=StatusResponse,
    tags=["Runtime"],
    summary="Get the current proctoring status",
)
def status():
    return get_status()


@app.get(
    "/settings",
    response_model=DetectionSettingsPayload,
    tags=["Configuration"],
    summary="Get detection settings",
)
def settings_get():
    return get_settings()


@app.post(
    "/settings",
    response_model=DetectionSettingsPayload,
    tags=["Configuration"],
    summary="Update detection settings",
)
def settings_update(payload: DetectionSettingsPayload):
    logger.info("Updating detection settings: %s", payload.model_dump())
    return update_settings(payload.model_dump())


@app.get(
    "/session/meta",
    response_model=SessionMetadataPayload,
    tags=["Configuration"],
    summary="Get session metadata",
)
def session_meta_get():
    return get_session_metadata()


@app.post(
    "/session/meta",
    response_model=SessionMetadataPayload,
    tags=["Configuration"],
    summary="Update session metadata",
)
def session_meta_set(payload: SessionMetadataPayload):
    logger.info("Updating session metadata")
    return set_session_metadata(payload.model_dump())


def _start_proctoring_response() -> MessageResponse:
    logger.info("/start called")
    start_background_proctor()
    return MessageResponse(message="Proctoring started")


@app.get(
    "/start",
    response_model=MessageResponse,
    tags=["Runtime"],
    summary="Start proctoring",
)
def start():
    return _start_proctoring_response()


@app.post("/start", response_model=MessageResponse, include_in_schema=False)
def start_post():
    return _start_proctoring_response()


def _stop_proctoring_response() -> StopResponse:
    global proctor_thread
    logger.info("/stop called")
    stop_proctoring()

    if proctor_thread is not None and proctor_thread.is_alive():
        proctor_thread.join(timeout=3.0)

    return build_stop_payload()


@app.get(
    "/stop",
    response_model=StopResponse,
    tags=["Runtime"],
    summary="Stop proctoring and collect report links",
)
def stop():
    return _stop_proctoring_response()


@app.post("/stop", response_model=StopResponse, include_in_schema=False)
def stop_post():
    return _stop_proctoring_response()


@app.get(
    "/report/latest",
    response_model=LatestReportResponse,
    tags=["Reports"],
    summary="Get the latest report manifest",
)
def report_latest():
    latest_reports = get_latest_report_paths()
    snapshot_files = [os.path.basename(path) for path in latest_reports.get("snapshots", [])]
    has_package = bool(latest_reports.get("json") or latest_reports.get("csv") or latest_reports.get("video"))
    return LatestReportResponse(
        json=os.path.basename(latest_reports["json"]) if latest_reports.get("json") else None,
        csv=os.path.basename(latest_reports["csv"]) if latest_reports.get("csv") else None,
        video=os.path.basename(latest_reports["video"]) if latest_reports.get("video") else None,
        snapshots=snapshot_files,
        download=ReportDownloadLinks(
            json="/report/download/json" if latest_reports.get("json") else None,
            csv="/report/download/csv" if latest_reports.get("csv") else None,
            video="/report/download/video" if latest_reports.get("video") else None,
            snapshots=[f"/report/download/snapshot/{name}" for name in snapshot_files],
            package="/report/download/package" if has_package else None,
        ),
    )


@app.get(
    "/report/download/package",
    response_class=FileResponse,
    tags=["Reports"],
    summary="Download the latest packaged report bundle",
    responses={
        200: {
            "description": "ZIP package containing the latest report assets",
            "content": {"application/zip": {"schema": {"type": "string", "format": "binary"}}},
        },
        404: {"model": ErrorResponse, "description": "No report package is available"},
    },
)
def report_download_package():
    package_path = build_report_package_path()
    if not package_path:
        return JSONResponse(content={"error": "No report package is available yet"}, status_code=404)
    return FileResponse(package_path, filename=os.path.basename(package_path))


@app.get(
    "/report/download/{report_type}",
    response_class=FileResponse,
    tags=["Reports"],
    summary="Download the latest JSON, CSV, or video report artifact",
    responses={
        200: {
            "description": "Requested report artifact",
            "content": {"application/octet-stream": {"schema": {"type": "string", "format": "binary"}}},
        },
        404: {"model": ErrorResponse, "description": "No report artifact is currently available"},
    },
)
def report_download(report_type: Literal["json", "csv", "video"]):
    latest_reports = get_latest_report_paths()
    path = latest_reports.get(report_type)
    if not path or not os.path.exists(path):
        return JSONResponse(content={"error": f"No {report_type} report is available yet"}, status_code=404)
    return FileResponse(path, filename=os.path.basename(path))


@app.get(
    "/report/download/snapshot/{filename}",
    response_class=FileResponse,
    tags=["Reports"],
    summary="Download a snapshot from the latest report",
    responses={
        200: {
            "description": "Requested snapshot image",
            "content": {"image/jpeg": {"schema": {"type": "string", "format": "binary"}}},
        },
        404: {"model": ErrorResponse, "description": "Snapshot was not found"},
    },
)
def report_download_snapshot(filename: str):
    latest_reports = get_latest_report_paths()
    snapshots_dir = latest_reports.get("snapshots_dir")
    if not snapshots_dir:
        return JSONResponse(content={"error": "No report snapshots are available yet"}, status_code=404)

    safe_name = os.path.basename(filename)
    path = os.path.join(snapshots_dir, safe_name)
    if not os.path.exists(path):
        return JSONResponse(content={"error": "Snapshot not found"}, status_code=404)
    return FileResponse(path, filename=safe_name)


@app.get(
    "/cameras",
    response_model=CameraListResponse,
    tags=["Camera"],
    summary="Scan for available cameras",
)
def get_cameras():
    logger.info("Scanning available cameras...")
    available = []
    for idx in range(11):
        if probe_camera(idx):
            available.append(idx)
    logger.info("Camera scan complete. Found: %s", available)
    return CameraListResponse(cameras=available)


@app.get(
    "/set_camera/{camera_index}",
    response_model=CameraSelectionResponse,
    tags=["Camera"],
    summary="Switch the active camera",
)
def set_camera_route(camera_index: int):
    logger.info("Switching to camera index %s", camera_index)
    set_camera(camera_index)
    return CameraSelectionResponse(
        message=f"Camera switched to {camera_index}",
        camera=camera_index,
    )


@app.get(
    "/video_feed",
    tags=["Streaming"],
    summary="Open the live MJPEG stream",
    responses={
        200: {
            "description": "MJPEG video stream",
            "content": {
                "multipart/x-mixed-replace; boundary=frame": {
                    "schema": {"type": "string", "format": "binary"}
                }
            },
        }
    },
)
def video_feed():
    logger.info("/video_feed stream opened")

    def generate():
        while True:
            frame = get_frame()

            if frame is None:
                time.sleep(0.05)
                continue

            ret, jpeg = cv2.imencode(".jpg", frame)
            if not ret:
                continue

            frame_bytes = jpeg.tobytes()

            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
            )

            time.sleep(0.03)

    return StreamingResponse(generate(), media_type="multipart/x-mixed-replace; boundary=frame")


@app.get(
    "/frame",
    tags=["Streaming"],
    summary="Fetch the latest single JPEG frame",
    responses={
        200: {
            "description": "JPEG frame",
            "content": {"image/jpeg": {"schema": {"type": "string", "format": "binary"}}},
        },
        204: {"description": "No frame is currently available"},
    },
)
def frame():
    frame_data = get_frame()
    if frame_data is None:
        return Response(status_code=204)

    ret, jpeg = cv2.imencode(".jpg", frame_data)
    if not ret:
        return Response(status_code=204)

    return Response(content=jpeg.tobytes(), media_type="image/jpeg")


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    icon_path = os.path.join(BASE_DIR, "favicon.ico")
    if os.path.isfile(icon_path):
        return FileResponse(icon_path)
    return Response(status_code=204)


@app.get("/{path:path}", include_in_schema=False)
def static_files(path: str):
    file_path = os.path.join(BASE_DIR, path)
    if not os.path.isfile(file_path):
        return JSONResponse(content={"error": "Not found"}, status_code=404)
    return FileResponse(file_path)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )
    logger.info("Starting SkillWise Proctoring System...")
    logger.info("Open in browser: %s", OPEN_URL)
    uvicorn.run(app, host=HOST, port=PORT)
