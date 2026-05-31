import cv2
import numpy as np

from powder_screening import PowderScreeningAnalyzer, summarize_hosi_csv


def make_powder_image(color=(165, 185, 205), noise=3):
    rng = np.random.default_rng(7)
    image = np.full((240, 320, 3), color, dtype=np.int16)
    image += rng.normal(0, noise, image.shape).astype(np.int16)
    return np.clip(image, 0, 255).astype(np.uint8)


def test_uniform_powder_is_consistent_without_visible_contamination():
    result = PowderScreeningAnalyzer().analyze(make_powder_image())

    assert result["consistency_grade"] >= 4
    assert result["contamination_flag"] is False
    assert 0.0 <= result["confidence"] <= 1.0
    assert result["recommendation"] == "approve"
    assert result["annotated_image"]


def test_high_texture_variation_reduces_consistency_grade():
    image = make_powder_image()
    for y in range(0, image.shape[0], 16):
        cv2.rectangle(image, (0, y), (image.shape[1], y + 7), (100, 120, 140), -1)

    result = PowderScreeningAnalyzer().analyze(image)

    assert result["consistency_grade"] <= 3


def test_contrasting_spots_are_flagged_as_visual_anomalies():
    image = make_powder_image()
    cv2.circle(image, (80, 80), 16, (15, 20, 25), -1)
    cv2.circle(image, (230, 150), 13, (10, 15, 20), -1)

    result = PowderScreeningAnalyzer().analyze(image)

    assert result["contamination_flag"] is True
    assert result["recommendation"] == "review"
    assert result["anomaly_ratio"] > 0


def test_hosi_csv_summary_validates_spectrum_columns():
    result = summarize_hosi_csv(b"wavelength_nm,reflectance\n400,0.2\n500,0.4\n")

    assert result["mode"] == "hosi_summary"
    assert result["sample_count"] == 2
    assert result["reflectance_mean"] == 0.3
