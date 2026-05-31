import base64
import csv
import io
from dataclasses import dataclass

import cv2
import numpy as np


@dataclass(frozen=True)
class ScreeningThresholds:
    outlier_distance: float = 38.0
    minimum_anomaly_area: int = 70
    contamination_ratio: float = 0.006


class PowderScreeningAnalyzer:
    def __init__(self, thresholds=ScreeningThresholds()):
        self.thresholds = thresholds

    def analyze(self, image):
        if image is None or image.size == 0:
            raise ValueError("Image is empty or could not be decoded")

        resized = self._resize(image)
        blurred = cv2.GaussianBlur(resized, (5, 5), 0)
        lab = cv2.cvtColor(blurred, cv2.COLOR_BGR2LAB).astype(np.float32)
        gray = cv2.cvtColor(blurred, cv2.COLOR_BGR2GRAY)

        median_color = np.median(lab.reshape(-1, 3), axis=0)
        color_distance = np.linalg.norm(lab - median_color, axis=2)
        anomaly_mask = (color_distance > self.thresholds.outlier_distance).astype(np.uint8) * 255
        anomaly_mask = cv2.morphologyEx(anomaly_mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        anomaly_mask = cv2.morphologyEx(anomaly_mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))

        contours, _ = cv2.findContours(anomaly_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        contours = [contour for contour in contours if cv2.contourArea(contour) >= self.thresholds.minimum_anomaly_area]
        filtered_mask = np.zeros_like(anomaly_mask)
        cv2.drawContours(filtered_mask, contours, -1, 255, -1)

        anomaly_ratio = float(np.count_nonzero(filtered_mask) / filtered_mask.size)
        contamination_flag = anomaly_ratio >= self.thresholds.contamination_ratio
        color_grade = self._grade_color(color_distance)
        consistency_grade = self._grade_consistency(gray)
        recommendation = "review" if contamination_flag or color_grade <= 2 or consistency_grade <= 2 else "approve"
        confidence = self._confidence(color_distance, consistency_grade, anomaly_ratio)

        annotated = resized.copy()
        cv2.drawContours(annotated, contours, -1, (0, 0, 255), 2)
        cv2.putText(
            annotated,
            f"Visual anomaly: {anomaly_ratio * 100:.2f}%",
            (12, 26),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.62,
            (0, 0, 255) if contamination_flag else (0, 150, 0),
            2,
            cv2.LINE_AA,
        )

        return {
            "color_grade": color_grade,
            "consistency_grade": consistency_grade,
            "contamination_flag": contamination_flag,
            "confidence": confidence,
            "recommendation": recommendation,
            "anomaly_ratio": round(anomaly_ratio, 5),
            "explanation": self._explanation(color_grade, consistency_grade, contamination_flag, anomaly_ratio),
            "annotated_image": self._encode_jpeg(annotated),
        }

    @staticmethod
    def _resize(image):
        height, width = image.shape[:2]
        if width <= 720:
            return image.copy()
        scale = 720 / width
        return cv2.resize(image, (720, int(height * scale)), interpolation=cv2.INTER_AREA)

    @staticmethod
    def _grade_color(color_distance):
        spread = float(np.percentile(color_distance, 75))
        if spread < 6:
            return 5
        if spread < 11:
            return 4
        if spread < 18:
            return 3
        if spread < 28:
            return 2
        return 1

    @staticmethod
    def _grade_consistency(gray):
        local_mean = cv2.GaussianBlur(gray.astype(np.float32), (0, 0), 9)
        variation = float(np.mean(np.abs(gray.astype(np.float32) - local_mean)))
        if variation < 3:
            return 5
        if variation < 6:
            return 4
        if variation < 10:
            return 3
        if variation < 16:
            return 2
        return 1

    @staticmethod
    def _confidence(color_distance, consistency_grade, anomaly_ratio):
        spread = float(np.percentile(color_distance, 75))
        signal = min(1.0, (spread / 20) + anomaly_ratio * 8 + (5 - consistency_grade) * 0.08)
        return round(0.72 + signal * 0.24, 3)

    @staticmethod
    def _explanation(color_grade, consistency_grade, contamination_flag, anomaly_ratio):
        anomaly_text = (
            f"Anomali visual {anomaly_ratio * 100:.2f}% terdeteksi; perlu review operator."
            if contamination_flag
            else "Tidak ada anomali visual signifikan."
        )
        return f"Grade warna {color_grade}/5. Keseragaman tekstur {consistency_grade}/5. {anomaly_text}"

    @staticmethod
    def _encode_jpeg(image):
        ok, encoded = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 88])
        if not ok:
            raise ValueError("Annotated preview could not be encoded")
        return f"data:image/jpeg;base64,{base64.b64encode(encoded).decode('ascii')}"


def decode_image(payload):
    array = np.frombuffer(payload, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Uploaded file is not a readable image")
    return image


def summarize_hosi_csv(payload):
    text = payload.decode("utf-8-sig")
    rows = list(csv.DictReader(io.StringIO(text)))
    if not rows:
        raise ValueError("HOSI CSV must include a header and at least one data row")

    wavelength_key = next((key for key in rows[0] if key.lower() in {"wavelength", "wavelength_nm", "nm"}), None)
    reflectance_key = next((key for key in rows[0] if key.lower() in {"reflectance", "intensity", "value"}), None)
    if not wavelength_key or not reflectance_key:
        raise ValueError("HOSI CSV requires wavelength_nm and reflectance columns")

    try:
        wavelengths = np.array([float(row[wavelength_key]) for row in rows], dtype=np.float32)
        reflectance = np.array([float(row[reflectance_key]) for row in rows], dtype=np.float32)
    except (TypeError, ValueError) as exc:
        raise ValueError("HOSI CSV contains non-numeric spectrum values") from exc

    return {
        "mode": "hosi_summary",
        "sample_count": int(len(rows)),
        "wavelength_min_nm": round(float(wavelengths.min()), 2),
        "wavelength_max_nm": round(float(wavelengths.max()), 2),
        "reflectance_mean": round(float(reflectance.mean()), 5),
        "reflectance_std": round(float(reflectance.std()), 5),
        "explanation": "HOSI CSV validated. Summary only; no trained hyperspectral classifier is active.",
    }

