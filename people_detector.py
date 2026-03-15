import torch
from ultralytics import YOLO
import cv2

class PeopleDetector:
    def __init__(self, model_path="yolov8n.pt", device="cpu"):
        self.model = YOLO(model_path)
        self.device = device

    def detect_people(self, frame, conf_threshold=0.5, min_box_area=5000):
        # frame: numpy array (BGR)
        results = self.model(frame)
        people = []
        for r in results:
            for box in r.boxes:
                cls = int(box.cls[0])
                score = float(box.conf[0]) if hasattr(box, 'conf') else 1.0
                # COCO class 0 is 'person'
                if cls == 0 and score >= conf_threshold:
                    xyxy = box.xyxy[0].cpu().numpy()
                    x1, y1, x2, y2 = xyxy
                    area = (x2 - x1) * (y2 - y1)
                    if area >= min_box_area:
                        people.append(xyxy)
        return people