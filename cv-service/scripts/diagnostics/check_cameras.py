import cv2
import sys

def test_cameras():
    backends = [
        ("cv2.CAP_ANY", cv2.CAP_ANY),
        ("cv2.CAP_DSHOW", cv2.CAP_DSHOW),
        ("cv2.CAP_MSMF", cv2.CAP_MSMF),
    ]
    
    for name, backend in backends:
        print(f"Testing backend {name}...")
        for i in range(2):
            try:
                cap = cv2.VideoCapture(i, backend)
                if cap.isOpened():
                    ret, frame = cap.read()
                    if ret:
                        print(f"  -> SUCCESS: index {i} with {name} (frame shape: {frame.shape})")
                    else:
                        print(f"  -> OPENED BUT NO FRAME: index {i} with {name}")
                else:
                    print(f"  -> FAILED TO OPEN: index {i} with {name}")
                cap.release()
            except Exception as e:
                print(f"  -> EXCEPTION on index {i} with {name}: {e}")

if __name__ == "__main__":
    test_cameras()
