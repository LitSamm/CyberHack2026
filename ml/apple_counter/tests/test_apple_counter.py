import cv2
import numpy as np

from pathlib import Path

from ml.apple_counter.apple_counter import (
    LineCounter,
    build_h264_command,
    detect_apples,
    suppress_duplicate_boxes,
)


def test_line_counter_counts_downward_crossing_once_per_track():
    counter = LineCounter(y=100)

    counter.update({7: (80, 80)})
    assert counter.count == 0

    counter.update({7: (84, 105)})
    assert counter.count == 1

    counter.update({7: (88, 130)})
    assert counter.count == 1


def test_line_counter_ignores_tracks_that_start_below_line():
    counter = LineCounter(y=100)

    counter.update({9: (40, 125)})
    counter.update({9: (42, 150)})

    assert counter.count == 0


def test_detect_apples_filters_tiny_noise_inside_roi():
    frame = np.zeros((160, 220, 3), dtype=np.uint8)
    cv2.circle(frame, (90, 90), 18, (35, 165, 220), -1)
    cv2.circle(frame, (145, 85), 2, (35, 165, 220), -1)

    detections = detect_apples(frame, roi=(40, 40, 170, 140), min_area=150)

    assert len(detections) == 1
    x, y, w, h = detections[0]
    assert 65 <= x <= 75
    assert 65 <= y <= 75
    assert 30 <= w <= 40
    assert 30 <= h <= 40


def test_detect_apples_respects_polygon_mask():
    frame = np.zeros((160, 220, 3), dtype=np.uint8)
    cv2.circle(frame, (70, 90), 18, (35, 165, 220), -1)
    cv2.circle(frame, (160, 90), 18, (35, 165, 220), -1)

    detections = detect_apples(
        frame,
        mask_polygon=[(20, 40), (110, 40), (110, 140), (20, 140)],
        min_area=150,
    )

    assert len(detections) == 1
    x, y, _, _ = detections[0]
    assert x < 100


def test_detect_apples_splits_touching_apples_in_one_blob():
    frame = np.zeros((180, 260, 3), dtype=np.uint8)
    apple_color = (35, 165, 220)
    cv2.circle(frame, (95, 95), 28, apple_color, -1)
    cv2.circle(frame, (140, 95), 28, apple_color, -1)

    detections = detect_apples(frame, min_area=150)

    assert len(detections) == 2
    centers = sorted(x + w // 2 for x, _, w, _ in detections)
    assert centers[0] < 115
    assert centers[1] > 120


def test_suppress_duplicate_boxes_removes_overlapping_detections():
    boxes = [
        (10, 10, 42, 42),
        (13, 12, 40, 40),
        (18, 16, 36, 36),
        (25, 25, 20, 20),
        (90, 10, 38, 38),
    ]

    assert suppress_duplicate_boxes(boxes) == [(10, 10, 42, 42), (90, 10, 38, 38)]


def test_build_h264_command_uses_browser_friendly_video_settings():
    command = build_h264_command(
        "ffmpeg",
        Path("/tmp/input.mp4"),
        Path("/tmp/output.mp4"),
    )

    assert command[:4] == ["ffmpeg", "-y", "-hide_banner", "-loglevel"]
    assert "-c:v" in command
    assert "libx264" in command
    assert "-pix_fmt" in command
    assert "yuv420p" in command
    assert "-movflags" in command
    assert "+faststart" in command
