import time
import cv2
try:
    import mediapipe as mp
except Exception:
    mp = None

CAMERA_INDEX = None  # Set an int (e.g., 0/1) to force a specific camera.
MAX_CAMERA_INDEX_TO_TRY = 10
PREFER_EXTERNAL_CAMERA = True  # Try indices 1..N first, keep index 0 as fallback.
SKIP_INTERNAL_INDEX_0 = True  # In auto mode, skip laptop cam index 0.
FRAME_SIZE = (640, 480)
MAX_CONSECUTIVE_READ_FAILS = 30
RECONNECT_DELAY_SEC = 0.5
CAMERA_BACKENDS = (cv2.CAP_DSHOW, cv2.CAP_MSMF, cv2.CAP_ANY)


def open_camera(index: int) -> cv2.VideoCapture | None:
    for backend in CAMERA_BACKENDS:
        cap = cv2.VideoCapture(index, backend)
        if cap.isOpened():
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_SIZE[0])
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_SIZE[1])
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            # Validate that camera really returns frames.
            for _ in range(5):
                ret, frame = cap.read()
                if ret and frame is not None:
                    return cap
                time.sleep(0.02)
        cap.release()
    return None


def find_and_open_camera(
    preferred_index: int | None = None,
    max_index: int = MAX_CAMERA_INDEX_TO_TRY,
) -> tuple[cv2.VideoCapture | None, int | None]:
    if preferred_index is not None:
        indexes_to_try = [preferred_index]
        for idx in range(max_index + 1):
            if idx != preferred_index:
                indexes_to_try.append(idx)
    elif PREFER_EXTERNAL_CAMERA:
        indexes_to_try = list(range(1, max_index + 1))
        if not SKIP_INTERNAL_INDEX_0:
            indexes_to_try.append(0)
    else:
        indexes_to_try = list(range(max_index + 1))

    print(f"Trying camera indices: {indexes_to_try}")
    for idx in indexes_to_try:
        print(f"Checking webcam index {idx}...")
        cap = open_camera(idx)
        if cap is not None:
            print(f"Connected to webcam on index: {idx}")
            return cap, idx
        print(f"Index {idx} not available.")

    return None, None


def main() -> None:
    cap, active_camera_index = find_and_open_camera(CAMERA_INDEX)
    if cap is None:
        print("Error: Could not find any working webcam.")
        return

    face_detection = None
    use_mediapipe = True

    try:
        if mp is None:
            raise RuntimeError("MediaPipe import failed")
        mp_face_detection = mp.solutions.face_detection
        face_detection = mp_face_detection.FaceDetection(
            model_selection=0,
            min_detection_confidence=0.6,
        )
    except Exception as e:
        use_mediapipe = False
        print(f"MediaPipe unavailable, using OpenCV fallback: {e}")

    face_cascade = None
    if not use_mediapipe:
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        face_cascade = cv2.CascadeClassifier(cascade_path)
        if face_cascade.empty():
            print("Error: Failed to initialize OpenCV face detector.")
            cap.release()
            return

    try:
        read_fail_count = 0

        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                read_fail_count += 1
                if read_fail_count >= MAX_CONSECUTIVE_READ_FAILS:
                    print("Camera read failed repeatedly. Reconnecting...")
                    cap.release()
                    time.sleep(RECONNECT_DELAY_SEC)
                    cap = open_camera(active_camera_index)

                    # If same index reconnect fails, rescan all ports.
                    if cap is None:
                        cap, active_camera_index = find_and_open_camera(
                            max_index=MAX_CAMERA_INDEX_TO_TRY
                        )

                    read_fail_count = 0
                    if cap is None:
                        print("Error: Could not reconnect to any webcam.")
                        break

                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break
                continue

            read_fail_count = 0

            frame = cv2.resize(frame, FRAME_SIZE)

            face_count = 0
            h, w, _ = frame.shape
            if use_mediapipe:
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = face_detection.process(rgb_frame)
                if results.detections:
                    face_count = len(results.detections)
                    for detection in results.detections:
                        bbox = detection.location_data.relative_bounding_box

                        x = max(0, int(bbox.xmin * w))
                        y = max(0, int(bbox.ymin * h))
                        width = max(0, int(bbox.width * w))
                        height = max(0, int(bbox.height * h))
                        x2 = min(w - 1, x + width)
                        y2 = min(h - 1, y + height)

                        cv2.rectangle(frame, (x, y), (x2, y2), (0, 255, 0), 2)
            else:
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                faces = face_cascade.detectMultiScale(
                    gray,
                    scaleFactor=1.1,
                    minNeighbors=5,
                    minSize=(60, 60),
                )
                face_count = len(faces)
                for (x, y, width, height) in faces:
                    x2 = min(w - 1, x + width)
                    y2 = min(h - 1, y + height)
                    cv2.rectangle(frame, (x, y), (x2, y2), (0, 255, 0), 2)

            cv2.putText(
                frame,
                f"Faces Detected: {face_count}",
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                1,
                (255, 0, 0),
                2,
            )

            if face_count > 1:
                cv2.putText(
                    frame,
                    "ALERT: MULTIPLE FACES!",
                    (20, 80),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1,
                    (0, 0, 255),
                    3,
                )

            cv2.imshow("Multi Face Detection", frame)

            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    finally:
        if face_detection is not None:
            face_detection.close()
        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()

