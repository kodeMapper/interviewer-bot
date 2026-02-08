import torch
import cv2
import os
from torch.utils.data import Dataset

class EyeDataset(Dataset):
    def __init__(self, base_dir):
        self.data = []

        for label, folder in enumerate(["good", "bad"]):
            path = os.path.join(base_dir, folder)
            for file in os.listdir(path):
                if file.lower().endswith((".png", ".jpg", ".jpeg")):
                    self.data.append((os.path.join(path, file), label))

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        img_path, label = self.data[idx]

        img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
        img = cv2.resize(img, (64, 64))
        img = img / 255.0

        img = torch.tensor(img).unsqueeze(0).float()
        label = torch.tensor(label).long()

        return img, label
