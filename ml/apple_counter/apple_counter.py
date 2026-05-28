import argparse
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

import cv2
import numpy as np


Box = tuple[int, int, int, int]
Point = tuple[int, int]


@dataclass
class TrackedObject:
    box: Box
    centroid: Point
    missing_frames: int = 0


@dataclass
class CentroidTracker:
    max_distance: float = 55.0
    max_missing: int = 4
    next_id: int = 1
    tracks: dict[int, TrackedObject] = field(default_factory=dict)

    def update(self, boxes: Iterable[Box]) -> dict[int, TrackedObject]:
        boxes = list(boxes)
        centroids = [_centroid(box) for box in boxes]

        if not self.tracks:
            for box, centroid in zip(boxes, centroids):
                self._register(box, centroid)
            return self.tracks

        unmatched_track_ids = set(self.tracks)
        unmatched_detection_ids = set(range(len(boxes)))
        candidates: list[tuple[float, int, int]] = []

        for track_id, track in self.tracks.items():
            for detection_id, centroid in enumerate(centroids):
                distance = _distance(track.centroid, centroid)
                if distance <= self.max_distance:
                    candidates.append((distance, track_id, detection_id))

        for _, track_id, detection_id in sorted(candidates):
            if track_id not in unmatched_track_ids or detection_id not in unmatched_detection_ids:
                continue
            self.tracks[track_id] = TrackedObject(
                box=boxes[detection_id],
                centroid=centroids[detection_id],
            )
            unmatched_track_ids.remove(track_id)
            unmatched_detection_ids.remove(detection_id)

        for track_id in list(unmatched_track_ids):
            track = self.tracks[track_id]
            track.missing_frames += 1
            if track.missing_frames > self.max_missing:
                del self.tracks[track_id]

        for detection_id in sorted(unmatched_detection_ids):
            self._register(boxes[detection_id], centroids[detection_id])

        return self.tracks

    def _register(self, box: Box, centroid: Point) -> None:
        self.tracks[self.next_id] = TrackedObject(box=box, centroid=centroid)
        self.next_id += 1


@dataclass
class LineCounter:
    y: int
    count: int = 0
    previous_y: dict[int, int] = field(default_factory=dict)
    counted_ids: set[int] = field(default_factory=set)

    def update(self, track_centroids: dict[int, Point]) -> None:
        for track_id, (_, y) in track_centroids.items():
            previous_y = self.previous_y.get(track_id)
            if (
                previous_y is not None
                and track_id not in self.counted_ids
                and previous_y < self.y <= y
            ):
                self.count += 1
                self.counted_ids.add(track_id)
            self.previous_y[track_id] = y


def detect_apples(
    frame: np.ndarray,
    roi: tuple[int, int, int, int] | None = None,
    mask_polygon: list[Point] | None = None,
    min_area: int = 120,
) -> list[Box]:
    mask = build_apple_mask(frame)

    if roi is not None:
        x1, y1, x2, y2 = roi
        roi_mask = np.zeros(mask.shape, dtype=np.uint8)
        roi_mask[y1:y2, x1:x2] = 255
        mask = cv2.bitwise_and(mask, roi_mask)

    if mask_polygon is not None:
        polygon_mask = np.zeros(mask.shape, dtype=np.uint8)
        cv2.fillPoly(polygon_mask, [np.array(mask_polygon, dtype=np.int32)], 255)
        mask = cv2.bitwise_and(mask, polygon_mask)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes: list[Box] = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < min_area:
            continue
        boxes.extend(split_contour_into_apple_boxes(contour, min_area=min_area))

    return suppress_duplicate_boxes(sorted(boxes, key=lambda box: (box[1], box[0])))


def build_apple_mask(frame: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    red_low = cv2.inRange(hsv, (0, 55, 70), (13, 255, 255))
    red_high = cv2.inRange(hsv, (168, 55, 70), (180, 255, 255))
    yellow_orange = cv2.inRange(hsv, (14, 45, 95), (43, 255, 255))
    mask = cv2.bitwise_or(cv2.bitwise_or(red_low, red_high), yellow_orange)

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    return mask


def split_contour_into_apple_boxes(contour: np.ndarray, min_area: int) -> list[Box]:
    x, y, w, h = cv2.boundingRect(contour)
    if h == 0:
        return []

    aspect = w / h
    if not 0.45 <= aspect <= 4.5:
        return []

    contour_area = cv2.contourArea(contour)
    component_mask = np.zeros((h, w), dtype=np.uint8)
    cv2.drawContours(component_mask, [contour - (x, y)], -1, 255, -1)

    peaks = find_distance_peaks(component_mask)
    if len(peaks) <= 1:
        if 0.45 <= aspect <= 2.3:
            return [(x, y, w, h)]
        return []

    equivalent_radius = float(np.sqrt((contour_area / len(peaks)) / np.pi))
    boxes: list[Box] = []
    for peak_x, peak_y, local_radius in peaks:
        radius = max(local_radius * 1.45, equivalent_radius * 1.05, 8.0)
        size = int(round(radius * 2))
        box_x = max(0, int(round(x + peak_x - radius)))
        box_y = max(0, int(round(y + peak_y - radius)))
        box_w = max(1, min(size, x + w - box_x))
        box_h = max(1, min(size, y + h - box_y))
        if box_w * box_h >= min_area:
            boxes.append((box_x, box_y, box_w, box_h))

    return boxes


def find_distance_peaks(component_mask: np.ndarray) -> list[tuple[int, int, float]]:
    distance = cv2.distanceTransform(component_mask, cv2.DIST_L2, 5)
    max_distance = float(distance.max())
    if max_distance < 5.0:
        return []

    peak_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (21, 21))
    local_max = cv2.dilate(distance, peak_kernel)
    peak_mask = (distance == local_max) & (distance >= max_distance * 0.50)
    peak_mask = peak_mask.astype(np.uint8)

    count, labels, _, centroids = cv2.connectedComponentsWithStats(peak_mask)
    peaks: list[tuple[int, int, float]] = []
    for label in range(1, count):
        xs = np.where(labels == label)[1]
        ys = np.where(labels == label)[0]
        if len(xs) == 0:
            continue
        centroid_x, centroid_y = centroids[label]
        peak_x = int(round(centroid_x))
        peak_y = int(round(centroid_y))
        radius = float(distance[ys, xs].max())
        peaks.append((peak_x, peak_y, radius))

    return peaks


def suppress_duplicate_boxes(boxes: list[Box], iou_threshold: float = 0.35) -> list[Box]:
    kept: list[Box] = []
    for box in sorted(boxes, key=lambda item: item[2] * item[3], reverse=True):
        if any(box_iou(box, kept_box) > iou_threshold or centers_are_too_close(box, kept_box) for kept_box in kept):
            continue
        kept.append(box)
    return sorted(kept, key=lambda box: (box[1], box[0]))


def centers_are_too_close(a: Box, b: Box) -> bool:
    ax, ay = _centroid(a)
    bx, by = _centroid(b)
    min_diameter = min(a[2], a[3], b[2], b[3])
    return _distance((ax, ay), (bx, by)) < max(12.0, min(26.0, min_diameter * 0.45))


def box_iou(a: Box, b: Box) -> float:
    ax1, ay1, aw, ah = a
    bx1, by1, bw, bh = b
    ax2, ay2 = ax1 + aw, ay1 + ah
    bx2, by2 = bx1 + bw, by1 + bh

    intersection_w = max(0, min(ax2, bx2) - max(ax1, bx1))
    intersection_h = max(0, min(ay2, by2) - max(ay1, by1))
    intersection = intersection_w * intersection_h
    if intersection == 0:
        return 0.0

    union = aw * ah + bw * bh - intersection
    return intersection / union


def process_video(
    input_path: str | Path,
    output_path: str | Path,
    *,
    roi: tuple[int, int, int, int] | None = None,
    mask_polygon: list[Point] | None = None,
    line_y: int | None = None,
    min_area: int = 120,
    max_distance: float = 55.0,
    max_missing: int = 4,
    preview: bool = False,
) -> int:
    input_path = Path(input_path)
    output_path = Path(output_path)
    cap = cv2.VideoCapture(str(input_path))
    if not cap.isOpened():
        raise FileNotFoundError(f"Could not open video: {input_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if roi is None:
        roi = (0, 0, width, height)
    if mask_polygon is None:
        mask_polygon = default_conveyor_polygon(width, height)
    if line_y is None:
        line_y = int(height * 0.78)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    writer = cv2.VideoWriter(
        str(output_path),
        cv2.VideoWriter_fourcc(*"mp4v"),
        fps,
        (width, height),
    )
    if not writer.isOpened():
        cap.release()
        raise OSError(f"Could not create output video: {output_path}")

    tracker = CentroidTracker(max_distance=max_distance, max_missing=max_missing)
    counter = LineCounter(y=line_y)
    frame_index = 0

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break

            boxes = detect_apples(frame, roi=roi, mask_polygon=mask_polygon, min_area=min_area)
            tracks = tracker.update(boxes)
            counter.update({track_id: track.centroid for track_id, track in tracks.items()})
            annotated = annotate_frame(frame, tracks, counter, roi=roi, mask_polygon=mask_polygon)
            writer.write(annotated)
            frame_index += 1

            if preview:
                cv2.imshow("Apple Counter", annotated)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break
    finally:
        cap.release()
        writer.release()
        if preview:
            cv2.destroyAllWindows()

    converted_to_h264 = transcode_to_h264(output_path)

    print(f"Processed {frame_index} frames")
    print(f"Apple count: {counter.count}")
    if converted_to_h264:
        print("Codec: h264")
    print(f"Output: {output_path}")
    return counter.count


def annotate_frame(
    frame: np.ndarray,
    tracks: dict[int, TrackedObject],
    counter: LineCounter,
    *,
    roi: tuple[int, int, int, int],
    mask_polygon: list[Point] | None = None,
) -> np.ndarray:
    annotated = frame.copy()
    x1, y1, x2, y2 = roi
    cv2.rectangle(annotated, (x1, y1), (x2 - 1, y2 - 1), (90, 200, 255), 1)
    cv2.line(annotated, (x1, counter.y), (x2 - 1, counter.y), (255, 80, 80), 2)
    if mask_polygon is not None:
        cv2.polylines(annotated, [np.array(mask_polygon, dtype=np.int32)], True, (90, 200, 255), 2)

    for track_id, track in tracks.items():
        x, y, w, h = track.box
        cx, cy = track.centroid
        cv2.rectangle(annotated, (x, y), (x + w, y + h), (50, 220, 80), 2)
        cv2.circle(annotated, (cx, cy), 3, (255, 255, 255), -1)
        cv2.putText(
            annotated,
            f"#{track_id}",
            (x, max(18, y - 5)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.45,
            (255, 255, 255),
            1,
            cv2.LINE_AA,
        )

    cv2.rectangle(annotated, (12, 12), (168, 58), (0, 0, 0), -1)
    cv2.putText(
        annotated,
        f"Apples: {counter.count}",
        (22, 43),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 255),
        2,
        cv2.LINE_AA,
    )
    return annotated


def parse_roi(value: str) -> tuple[int, int, int, int]:
    parts = [int(part.strip()) for part in value.split(",")]
    if len(parts) != 4:
        raise argparse.ArgumentTypeError("ROI must use x1,y1,x2,y2")
    x1, y1, x2, y2 = parts
    if x2 <= x1 or y2 <= y1:
        raise argparse.ArgumentTypeError("ROI max values must be greater than min values")
    return x1, y1, x2, y2


def transcode_to_h264(output_path: Path) -> bool:
    if output_path.suffix.lower() != ".mp4":
        return False

    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        return False

    temp_output = output_path.with_name(f"{output_path.stem}.h264.tmp{output_path.suffix}")
    command = build_h264_command(ffmpeg, output_path, temp_output)
    subprocess.run(command, check=True)
    temp_output.replace(output_path)
    return True


def build_h264_command(ffmpeg: str, input_path: Path, output_path: Path) -> list[str]:
    return [
        ffmpeg,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(input_path),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(output_path),
    ]


def default_conveyor_polygon(width: int, height: int) -> list[Point]:
    return [
        (0, int(height * 0.66)),
        (0, height - 1),
        (int(width * 0.80), height - 1),
        (width - 1, int(height * 0.45)),
        (int(width * 0.92), int(height * 0.34)),
        (int(width * 0.64), int(height * 0.31)),
        (int(width * 0.31), int(height * 0.37)),
        (int(width * 0.31), int(height * 0.61)),
    ]


def _centroid(box: Box) -> Point:
    x, y, w, h = box
    return x + w // 2, y + h // 2


def _distance(a: Point, b: Point) -> float:
    return float(np.hypot(a[0] - b[0], a[1] - b[1]))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Count apples on the conveyor and write an annotated MP4.")
    parser.add_argument("--input", required=True, help="Input video path")
    parser.add_argument("--output", required=True, help="Annotated output MP4 path")
    parser.add_argument("--roi", type=parse_roi, help="Detection ROI as x1,y1,x2,y2")
    parser.add_argument("--line-y", type=int, help="Horizontal counting line y coordinate")
    parser.add_argument("--min-area", type=int, default=120, help="Minimum apple blob area")
    parser.add_argument("--max-distance", type=float, default=55.0, help="Maximum tracker match distance")
    parser.add_argument("--max-missing", type=int, default=4, help="Frames to keep unmatched tracks")
    parser.add_argument("--preview", action="store_true", help="Show OpenCV preview window")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    process_video(
        args.input,
        args.output,
        roi=args.roi,
        mask_polygon=None,
        line_y=args.line_y,
        min_area=args.min_area,
        max_distance=args.max_distance,
        max_missing=args.max_missing,
        preview=args.preview,
    )


if __name__ == "__main__":
    main()
