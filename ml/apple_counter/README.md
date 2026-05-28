# Apple Counter ML Feature

OpenCV-based apple conveyor counter. This module detects apples by color, splits merged blobs with distance-transform peaks, tracks centroids, counts apples crossing a horizontal line, and writes an annotated H.264 MP4.

## Setup

```bash
cd /tmp/CyberHack2026
python -m venv .venv-ml
source .venv-ml/bin/activate
pip install -r ml/apple_counter/requirements.txt
```

`ffmpeg` is optional but recommended. If available, the generated MP4 is transcoded to H.264 for broader player/browser compatibility.

## Run

```bash
python ml/apple_counter/apple_counter.py \
  --input "/tmp/Apples sorted by the machine on conveyor in a fruit packing warehouse - HIDDEN THINGS (360p, h264).mp4" \
  --output /tmp/apple_counter_output.mp4
```

Useful tuning flags:

```bash
--line-y 280
--roi 0,0,640,360
--min-area 120
--max-distance 55
--max-missing 4
```

## Test

```bash
python -m pytest ml/apple_counter/tests -q
```
