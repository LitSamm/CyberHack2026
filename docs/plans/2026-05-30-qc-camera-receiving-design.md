# QC Camera Receiving Station Design

## Purpose

Replace per-material AI image upload with a camera-based receiving station on the QC dashboard. The station counts apples crossing a conveyor line and creates one incoming-material record per receiving session.

## Workflow

1. Operator chooses supplier, material name, and unit.
2. Operator selects `Video Demo` or `Webcam Live`.
3. Python OpenCV starts a receiving session and counts tracked apples crossing the line.
4. The QC dashboard displays the annotated feed, current count, elapsed time, and session state.
5. Operator stops the session and reviews the count.
6. Operator confirms the session.
7. AromOS inserts one `incoming_materials` row with `qc_status = pending`.
8. The row appears in the existing QC queue for manual approve/reject.

## Scope

- Video demo mode uses the repository-root conveyor MP4.
- Webcam mode uses `cv2.VideoCapture(0)` on the local demo laptop.
- Only one camera session may run at a time.
- The current apple counter remains the ML implementation.
- No new database table is required for the hackathon demo.
- Receiving metadata is written into the incoming-material notes and audit log.

## Failure Handling

- Reject start requests while a session is already running.
- Reject webcam mode if the device cannot be opened.
- Reject queue submission if count is zero.
- Show Python-service offline errors in the dashboard.
- Keep video demo mode available as fallback for webcam failures.

## Non-goals

- Automatic supplier recognition.
- Automatic material-name recognition.
- Cloud webcam capture.
- Persisted frame-by-frame telemetry.
