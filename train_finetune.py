import torch
from torch.utils.data import DataLoader
from eye_cnn_model import EyeCNN
from dataset_loader import EyeDataset

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

dataset = EyeDataset("dataset")
loader = DataLoader(dataset, batch_size=16, shuffle=True)

model = EyeCNN().to(DEVICE)
model.load_state_dict(torch.load("pretrained_eye_cnn.pth", map_location=DEVICE))

optimizer = torch.optim.Adam(model.parameters(), lr=0.0003)
criterion = torch.nn.CrossEntropyLoss()

print("🔁 Stage 2: Fine-tuning on webcam dataset...")

for epoch in range(10):
    total_loss = 0

    for images, labels in loader:
        images, labels = images.to(DEVICE), labels.to(DEVICE)

        outputs = model(images)
        loss = criterion(outputs, labels)

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        total_loss += loss.item()

    print(f"Epoch {epoch+1}, Loss: {total_loss/len(loader):.4f}")

torch.save(model.state_dict(), "eye_cnn_final.pth")
print("✅ Final model saved as eye_cnn_final.pth")
