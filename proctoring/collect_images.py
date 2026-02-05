import cv2
import os
import time

# ================= CONFIG =================
SAVE_DIR = "my_dataset"
GOOD_DIR = os.path.join(SAVE_DIR, "good")
BAD_DIR = os.path.join(SAVE_DIR, "bad")

CAMERA_INDEX = 1   # Change if external cam index differs
IMAGE_SIZE = (224, 224)
CAPTURE_DELAY = 0.1  # seconds between captures

# ================= SETUP =================
os.makedirs(GOOD_DIR, exist_ok=True)
os.makedirs(BAD_DIR, exist_ok=True)

cap = cv2.VideoCapture(CAMERA_INDEX, cv2.CAP_DSHOW)

if not cap.isOpened():
    print("❌ Camera not opened. Try changing CAMERA_INDEX.")
    exit()

print("====================================")
print("📸 DATA COLLECTION TOOL")
print("====================================")
print("Controls:")
print("  g  → Start capturing GOOD images")
print("  b  → Start capturing BAD images")
print("  s  → Stop capturing")
print("  q  → Quit")
print("====================================")

mode = None
count = 0

while True:
    ret, frame = cap.read()
    if not ret:
        print("⚠ Frame grab failed.")
        continue

    frame_resized = cv2.resize(frame, IMAGE_SIZE)

    label_text = "MODE: NONE"
    color = (255, 255, 255)

    if mode == "good":
        label_text = "MODE: GOOD (0)"
        color = (0, 255, 0)
    elif mode == "bad":
        label_text = "MODE: BAD (1)"
        color = (0, 0, 255)

    cv2.putText(frame, label_text, (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)

    cv2.imshow("Dataset Collector", frame)

    key = cv2.waitKey(1) & 0xFF

    # -------- MODE SWITCH --------
    if key == ord("g"):
        mode = "good"
        print("✅ Switched to GOOD mode")

    elif key == ord("b"):
        mode = "bad"
        print("⚠ Switched to BAD mode")

    elif key == ord("s"):
        mode = None
        print("⏸ Capture stopped")

    elif key == ord("q"):
        print("👋 Exiting")
        break

    # -------- CAPTURE IMAGE --------
    if mode:
        timestamp = int(time.time() * 1000)
        filename = f"{mode}_{timestamp}.jpg"

        save_path = os.path.join(GOOD_DIR if mode == "good" else BAD_DIR, filename)
        cv2.imwrite(save_path, frame_resized)

        count += 1
        print(f"📸 Saved: {save_path}")

        time.sleep(CAPTURE_DELAY)

cap.release()
cv2.destroyAllWindows()

print("====================================")
print(f"✅ Total images captured: {count}")
print("Dataset saved in:", SAVE_DIR)
print("====================================")
