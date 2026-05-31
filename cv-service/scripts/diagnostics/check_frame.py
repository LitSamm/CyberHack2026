import cv2
import numpy as np

for i in range(2):
    cap = cv2.VideoCapture(i)
    if cap.isOpened():
        ret, frame = cap.read()
        if ret:
            print(f"Index {i}: frame shape {frame.shape}, mean {np.mean(frame)}, max {np.max(frame)}, min {np.min(frame)}")
        cap.release()
