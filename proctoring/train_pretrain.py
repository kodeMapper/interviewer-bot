import torch
from torch.utils.data import DataLoader
from eye_cnn_model import EyeCNN
from dataset_loader import EyeDataset

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

dataset = EyeDataset("external_dataset")
loader = DataLoader(dataset, batch_size=32, shuffle=True)

model = EyeCNN().to(DEVICE)
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
criterion = torch.nn.CrossEntropyLoss()

print("🔁 Stage 1: Pretraining on external dataset...")

for epoch in range(15):
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

torch.save(model.state_dict(), "pretrained_eye_cnn.pth")
print("✅ Pretrained model saved as pretrained_eye_cnn.pth")
