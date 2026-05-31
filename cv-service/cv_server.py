from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from receiving_session import ReceivingSessionController, SessionAlreadyRunning


ROOT_DIR = Path(__file__).resolve().parent.parent
DEMO_VIDEO = ROOT_DIR / "Apples sorted by the machine on conveyor in a fruit packing warehouse - HIDDEN THINGS (360p, h264).mp4"

app = FastAPI(title="AromOS Receiving Camera Service")
controller = ReceivingSessionController()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/receiving/video/start")
async def start_video():
    if not DEMO_VIDEO.exists():
        raise HTTPException(status_code=404, detail="Demo conveyor video was not found")
    try:
        return controller.start_video(DEMO_VIDEO)
    except SessionAlreadyRunning as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
