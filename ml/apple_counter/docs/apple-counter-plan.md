# Apple Counter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an OpenCV-only script that creates an annotated MP4 for the provided apple conveyor video.

**Architecture:** Add an importable `scripts/apple_counter.py` module with HSV/ROI detection, a small centroid tracker, line-crossing counting, and a CLI. Keep the old cement-bag scripts untouched because they depend on YOLO, ByteTrack, and Supervision packages that are absent in this environment.

**Tech Stack:** Python, OpenCV, NumPy, pytest.

---

### Task 1: Counting Core

**Files:**
- Create: `tests/test_apple_counter.py`
- Create: `scripts/apple_counter.py`

**Step 1: Write failing tests**

Cover `LineCounter` crossing behavior and `detect_apples` filtering small noise.

**Step 2: Run tests to verify failure**

Run: `python -m pytest tests/test_apple_counter.py -q`

Expected: import failure because `scripts.apple_counter` does not exist yet.

**Step 3: Implement minimal module**

Add `TrackedObject`, `CentroidTracker`, `LineCounter`, `detect_apples`, and `process_video`.

**Step 4: Run focused tests**

Run: `python -m pytest tests/test_apple_counter.py -q`

Expected: all focused tests pass.

### Task 2: Video Output

**Files:**
- Modify: `README.md`

**Step 1: Run script on target video**

Run: `python scripts/apple_counter.py --input "<video>" --output /tmp/apple_counter_output.mp4`

Expected: MP4 is written and the final count is printed.

**Step 2: Inspect generated output metadata**

Run: `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration -of default=noprint_wrappers=1 /tmp/apple_counter_output.mp4`

Expected: output is 640x360 with a duration close to the source video.

**Step 3: Document usage**

Add a README section for the apple video command.
