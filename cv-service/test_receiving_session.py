import time

import cv2
import numpy as np
import pytest

from receiving_session import ReceivingSessionController, SessionAlreadyRunning


class FakeCapture:
    def __init__(self, frames):
        self.frames = list(frames)
        self.released = False

    def isOpened(self):
        return True

    def read(self):
        if not self.frames:
            return False, None
        return True, self.frames.pop(0)

    def release(self):
        self.released = True


def wait_until_stopped(controller):
    for _ in range(100):
        if controller.status()["state"] == "stopped":
            return
        time.sleep(0.01)
    raise AssertionError("session did not stop")


def test_video_session_counts_crossing_objects_and_stops_at_end_of_file():
    frames = []
    for y in [45, 55, 68, 82]:
        frame = np.zeros((120, 160, 3), dtype=np.uint8)
        cv2.circle(frame, (80, y), 16, (35, 165, 220), -1)
        frames.append(frame)

    controller = ReceivingSessionController(
        capture_factory=lambda _: FakeCapture(frames),
        line_y=70,
        mask_polygon=[],
    )

    controller.start_video("demo.mp4")
    wait_until_stopped(controller)

    status = controller.status()
    assert status["mode"] == "video"
    assert status["count"] == 1
    assert status["state"] == "stopped"


def test_running_session_rejects_second_start():
    frame = np.zeros((120, 160, 3), dtype=np.uint8)
    frames = [frame.copy() for _ in range(200)]
    controller = ReceivingSessionController(
        capture_factory=lambda _: FakeCapture(frames),
        frame_delay=0.01,
        mask_polygon=[],
    )

    controller.start_video("demo.mp4")

    with pytest.raises(SessionAlreadyRunning):
        controller.start_webcam()

    controller.stop()


def test_reset_returns_session_to_idle():
    frame = np.zeros((120, 160, 3), dtype=np.uint8)
    controller = ReceivingSessionController(
        capture_factory=lambda _: FakeCapture([frame]),
        mask_polygon=[],
    )

    controller.start_video("demo.mp4")
    wait_until_stopped(controller)
    controller.reset()

    assert controller.status() == {
        "session_id": None,
        "mode": None,
        "state": "idle",
        "count": 0,
        "elapsed_seconds": 0,
        "error": None,
    }
