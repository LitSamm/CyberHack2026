import os
import shutil
import tempfile
from pathlib import Path

import cv2

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from receiving_session import ReceivingSessionController, SessionAlreadyRunning
from powder_screening import PowderScreeningAnalyzer, decode_image, summarize_hosi_csv


ROOT_DIR = Path(__file__).resolve().parent.parent

# Allow override via env var for flexible deployment
_env_video = os.environ.get("DEMO_VIDEO_PATH")
DEMO_VIDEO = Path(_env_video) if _env_video else (
    ROOT_DIR / "Apples sorted by the machine on conveyor in a fruit packing warehouse - HIDDEN THINGS (360p, h264).mp4"
)

# Temp dir for uploaded videos
UPLOAD_DIR = Path(tempfile.gettempdir()) / "aromos_cv_uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(title="AromOS Receiving Camera Service")
controller = ReceivingSessionController()
powder_analyzer = PowderScreeningAnalyzer()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/receiving/video/start")
async def start_video():
    if not DEMO_VIDEO.exists():
        raise HTTPException(status_code=404, detail=f"Demo conveyor video was not found at {DEMO_VIDEO}")
    try:
        return controller.start_video(DEMO_VIDEO)
    except SessionAlreadyRunning as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/receiving/video/upload")
async def upload_and_start_video(file: UploadFile = File(...)):
    """Upload a video file and immediately start a receiving session with it."""
    dest = UPLOAD_DIR / (file.filename or "demo.mp4")
    try:
        with dest.open("wb") as f:
            shutil.copyfileobj(file.file, f)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save video: {exc}") from exc

    # Also set as the active demo video for future /receiving/video/start calls
    global DEMO_VIDEO
    DEMO_VIDEO = dest

    try:
        controller.reset()
        return controller.start_video(dest)
    except SessionAlreadyRunning as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/receiving/browser/start")
async def start_browser():
    """Start a receiving session driven by frames pushed from the browser."""
    try:
        controller.reset()
        return controller.start_browser()
    except SessionAlreadyRunning as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/receiving/frame/push")
async def push_frame(file: UploadFile = File(...)):
    """Accept a JPEG frame from the browser, process it, return updated status."""
    data = await file.read()
    return controller.push_frame(data)


@app.post("/receiving/webcam/start")
async def start_webcam(device: int = 0):
    try:
        return controller.start_webcam(device=device)
    except SessionAlreadyRunning as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/receiving/stop")
async def stop_receiving():
    return controller.stop()


@app.post("/receiving/reset")
async def reset_receiving():
    return controller.reset()


@app.get("/receiving/status")
async def receiving_status():
    return controller.status()


@app.get("/receiving/stream")
async def receiving_stream():
    return StreamingResponse(
        controller.mjpeg_stream(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@app.post("/powder/analyze/upload")
async def analyze_powder_upload(file: UploadFile = File(...)):
    try:
        return powder_analyzer.analyze(decode_image(await file.read()))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/powder/analyze/webcam")
async def analyze_powder_webcam(device: int = 0):
    capture = cv2.VideoCapture(device)
    try:
        ok, frame = capture.read()
    finally:
        capture.release()
    if not ok or frame is None:
        raise HTTPException(status_code=422, detail=f"Could not capture webcam frame from device {device}")
    return powder_analyzer.analyze(frame)


@app.post("/powder/hosi/summary")
async def summarize_hosi_upload(file: UploadFile = File(...)):
    try:
        return summarize_hosi_csv(await file.read())
    except (UnicodeDecodeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
