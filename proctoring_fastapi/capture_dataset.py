import cv2
import os

# ================= HAAR CASCADE PATHS =================
FACE_CASCADE_PATH = "haarcascades/haarcascade_frontalface_default.xml"

face_cascade = cv2.CascadeClassifier(FACE_CASCADE_PATH)

if face_cascade.empty():
    print("❌ ERROR: Haar cascade file not found.")
    print("Make sure this file exists:")
    print(FACE_CASCADE_PATH)
    exit()

# ================= LABEL INPUT =================
label = input("Enter label (good / bad): ").strip().lower()

if label not in ["good", "bad"]:
    print("❌ ERROR: Label must be 'good' or 'bad'")
    exit()

save_dir = f"dataset/{label}"
os.makedirs(save_dir, exist_ok=True)

# ================= CAMERA SELECTION =================
print("🔍 Scanning available cameras...")

available_cameras = []

for i in range(5):
    cap_test = cv2.VideoCapture(i, cv2.CAP_DSHOW)
    if cap_test.isOpened():
        ret, frame = cap_test.read()
        if ret and frame is not None:
            available_cameras.append(i)
            print(f"Camera index {i} detected.")
        cap_test.release()

if not available_cameras:
    print("❌ ERROR: No cameras detected.")
    exit()

print("\nAvailable camera indexes:", available_cameras)
cam_index = int(input("👉 Enter the camera index you want to use: "))

cap = cv2.VideoCapture(cam_index, cv2.CAP_DSHOW)

if not cap.isOpened():
    print("❌ ERROR: Could not open selected camera.")
    exit()

print(f"✅ Using camera index {cam_index}")

# ================= DATA CAPTURE LOOP =================
count = 0
TARGET_COUNT = 200

print("\n🎥 Dataset capture started.")
print("Look at the screen (good) or away (bad).")
print("Press ESC to stop early.\n")

while count < TARGET_COUNT:
    ret, frame = cap.read()

    if not ret or frame is None:
        print("⚠ Camera frame not received. Retrying...")
        continue

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    faces = face_cascade.detectMultiScale(gray, 1.3, 5)

    for (x, y, w, h) in faces:
        face_img = gray[y:y + h, x:x + w]
        face_img = cv2.resize(face_img, (64, 64))

        path = f"{save_dir}/{count}.jpg"
        cv2.imwrite(path, face_img)
        count += 1

        cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
        cv2.putText(frame, f"{count}/{TARGET_COUNT}",
                    (10, 30), cv2.FONT_HERSHEY_SIMPLEX,
                    1, (0, 255, 0), 2)

    cv2.imshow("Dataset Capture", frame)

    if cv2.waitKey(1) == 27:
        print("⏹ Capture stopped by user.")
        break

# ================= CLEANUP =================
cap.release()
cv2.destroyAllWindows()

print(f"\n✅ Dataset capture completed: {count} images saved to {save_dir}")
