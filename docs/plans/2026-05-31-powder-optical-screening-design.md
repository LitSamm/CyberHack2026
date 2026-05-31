# Powder Optical Screening Design

## Goal

Add an OpenCV-assisted screening station for finished extract and powder QC. The feature provides visual recommendations while preserving the QC officer as the final decision maker.

## Scope

- Support image upload and webcam snapshot analysis.
- Return color grade, consistency grade, contamination flag, confidence, visual explanation, and an annotated preview.
- Store AI recommendations separately from manual QC values.
- Provide an optional HOSI CSV adapter that validates scans and summarizes spectral data without claiming a trained hyperspectral classifier.

## Architecture

The existing FastAPI CV service gains an independent powder screening module. The frontend QC modal calls this service only for finished-product QC, applies recommendations to editable manual controls, and submits both the operator decision and AI metadata through the Supabase RPC.

The OpenCV baseline uses:

- HSV color statistics for color grade.
- Local grayscale variation for consistency grade.
- Outlier color distance and contour filtering for visible anomaly screening.

The output is explicitly labelled `AI-assisted optical screening`. It does not claim chemical or microbiological contamination detection.

## Error Handling

- Reject unsupported image types and undecodable files.
- Reject empty webcam frames.
- Reject malformed HOSI CSV input with a clear message.
- Allow manual QC submission when the CV service is unavailable.

## Testing

- Unit test clean, inconsistent, and visibly contaminated synthetic powder images.
- API smoke test image upload and HOSI summary endpoints.
- Run frontend lint and production build.

