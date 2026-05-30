# QC Camera Receiving Station Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add video-demo and local-webcam ML receiving sessions to `/qc`, creating one pending incoming-material row from each confirmed session.

**Architecture:** Extract a reusable OpenCV receiving-session controller into `cv-service/receiving_session.py`. Expose session lifecycle and MJPEG stream endpoints from FastAPI. Replace QC per-item AI upload with a camera station that calls the service and confirms the resulting aggregate count into Supabase.

**Tech Stack:** Python, FastAPI, OpenCV, Next.js, React, Supabase.

---

### Task 1: Receiving Session Controller

**Files:**
- Create: `cv-service/receiving_session.py`
- Create: `cv-service/test_receiving_session.py`

**Steps:**
1. Write lifecycle tests for idle, start, stop, reset, and single-active-session enforcement.
2. Run `python -m pytest cv-service/test_receiving_session.py -q` and confirm failure.
3. Implement the controller with thread-safe state and injectable capture factory.
4. Run the test and confirm pass.

### Task 2: FastAPI Camera Endpoints

**Files:**
- Modify: `cv-service/cv_server.py`

**Steps:**
1. Add video start, webcam start, stop, reset, status, and MJPEG stream endpoints.
2. Point video demo mode to the repository-root conveyor MP4.
3. Preserve `/analyze` only if still referenced; otherwise delete it.
4. Run Python import checks.

### Task 3: QC Camera Receiving UI

**Files:**
- Modify: `frontend/src/app/qc/page.tsx`

**Steps:**
1. Remove per-material Scan AI action and its modal state.
2. Add camera-station mode selector, supplier/material form, feed, count, status, and lifecycle actions.
3. Confirm a stopped session into one `incoming_materials` row and one audit row.
4. Refresh the existing QC queue after confirmation.

### Task 4: Verification

**Steps:**
1. Run `python -m pytest ml/apple_counter/tests cv-service/test_receiving_session.py -q`.
2. Run `NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-anon-key npm run build` in `frontend`.
3. Run `python -m py_compile cv-service/cv_server.py cv-service/receiving_session.py`.
