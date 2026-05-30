from __future__ import annotations

import threading
import time
import uuid
import sys
from collections.abc import Callable, Iterator
from pathlib import Path

import cv2

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from ml.apple_counter.apple_counter import (
    CentroidTracker,
    LineCounter,
    annotate_frame,
    default_conveyor_polygon,
    detect_apples,
)


class SessionAlreadyRunning(RuntimeError):
    pass


class CaptureUnavailable(RuntimeError):
    pass


class ReceivingSessionController:
    def __init__(
        self,
        *,
        capture_factory: Callable[[str | int], object] = cv2.VideoCapture,
        line_y: int | None = None,
        mask_polygon: list[tuple[int, int]] | None = None,
        frame_delay: float = 0.03,
    ) -> None:
        self.capture_factory = capture_factory
        self.configured_line_y = line_y
        self.configured_mask_polygon = mask_polygon
        self.frame_delay = frame_delay
        self.lock = threading.Lock()
        self.stop_event = threading.Event()
        self.worker: threading.Thread | None = None
        self.latest_jpeg: bytes | None = None
        self.reset()

    def start_video(self, path: str | Path) -> dict:
        return self._start("video", str(path))

    def start_webcam(self, device: int = 0) -> dict:
        return self._start("webcam", device)

    def stop(self) -> dict:
        self.stop_event.set()
        worker = self.worker
        if worker and worker.is_alive():
            worker.join(timeout=2)
        with self.lock:
            if self.state == "running":
                self.state = "stopped"
        return self.status()

    def reset(self) -> dict:
        if getattr(self, "worker", None) and self.worker.is_alive():
            self.stop()
        with getattr(self, "lock", threading.Lock()):
            self.session_id = None
            self.mode = None
            self.state = "idle"
            self.count = 0
            self.started_at: float | None = None
            self.stopped_at: float | None = None
            self.error: str | None = None
            self.latest_jpeg = None
        self.stop_event.clear()
        return self.status()

    def status(self) -> dict:
        with self.lock:
            if self.started_at is None:
                elapsed = 0
            else:
                ended_at = self.stopped_at or time.monotonic()
                elapsed = max(0, round(ended_at - self.started_at, 1))
            return {
                "session_id": self.session_id,
                "mode": self.mode,
                "state": self.state,
                "count": self.count,
                "elapsed_seconds": elapsed,
                "error": self.error,
            }

    def mjpeg_stream(self) -> Iterator[bytes]:
        last_frame: bytes | None = None
        while True:
            with self.lock:
                frame = self.latest_jpeg
                state = self.state
            if frame and frame != last_frame:
                last_frame = frame
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
                )
            if state in {"idle", "stopped", "error"}:
                break
            time.sleep(0.03)

    def _start(self, mode: str, source: str | int) -> dict:
        with self.lock:
            if self.state == "running":
                raise SessionAlreadyRunning("A receiving session is already running")
            self.session_id = f"RCV-{uuid.uuid4().hex[:8].upper()}"
            self.mode = mode
            self.state = "running"
            self.count = 0
            self.error = None
            self.latest_jpeg = None
            self.started_at = time.monotonic()
            self.stopped_at = None
        self.stop_event.clear()
        self.worker = threading.Thread(target=self._process, args=(source,), daemon=True)
        self.worker.start()
        return self.status()

    def _process(self, source: str | int) -> None:
        capture = self.capture_factory(source)
        if not capture.isOpened():
            self._fail("Camera or video source could not be opened")
            return

        tracker = CentroidTracker()
        counter: LineCounter | None = None
        roi: tuple[int, int, int, int] | None = None
        mask_polygon = self.configured_mask_polygon

        try:
            while not self.stop_event.is_set():
                ok, frame = capture.read()
                if not ok:
                    break

                height, width = frame.shape[:2]
                if roi is None:
                    roi = (0, 0, width, height)
                    line_y = self.configured_line_y or int(height * 0.78)
                    counter = LineCounter(y=line_y)
                    if mask_polygon is None:
                        mask_polygon = default_conveyor_polygon(width, height)

                boxes = detect_apples(
                    frame,
                    roi=roi,
                    mask_polygon=mask_polygon or None,
                )
                tracks = tracker.update(boxes)
                counter.update({track_id: track.centroid for track_id, track in tracks.items()})
                annotated = annotate_frame(
                    frame,
                    tracks,
                    counter,
                    roi=roi,
                    mask_polygon=mask_polygon or None,
                )
                encoded, jpeg = cv2.imencode(".jpg", annotated)
                if encoded:
                    with self.lock:
                        self.latest_jpeg = jpeg.tobytes()
                        self.count = counter.count
                if self.frame_delay:
                    time.sleep(self.frame_delay)
        except Exception as exc:
            self._fail(str(exc))
            return
        finally:
            capture.release()

        with self.lock:
            if self.state == "running":
                self.state = "stopped"
                self.stopped_at = time.monotonic()

    def _fail(self, message: str) -> None:
        with self.lock:
            self.state = "error"
            self.error = message
            self.stopped_at = time.monotonic()
