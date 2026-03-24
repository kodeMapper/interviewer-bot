"""
Temporary architecture ablation runner for intent classification.
Runs multiple MLP hidden-layer configurations on the existing processed split.
"""

import os
import random
from dataclasses import dataclass

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset


SEED = 42
BATCH_SIZE = 16
LR = 1e-3
WEIGHT_DECAY = 1e-4
MAX_EPOCHS = 80
EARLY_STOP_PATIENCE = 12
DROPOUT = 0.3

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "processed")
RESULTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "plots")
RESULTS_CSV = os.path.join(RESULTS_DIR, "temp_arch_ablation_results.csv")


@dataclass
class RunResult:
    name: str
    hidden_dims: list[int]
    params: int
    best_epoch: int
    val_loss: float
    val_f1: float
    test_exact_match: float
    test_precision: float
    test_recall: float
    test_f1: float


class FlexibleIntentMLP(nn.Module):
    def __init__(self, input_dim: int, hidden_dims: list[int], output_dim: int, dropout: float = 0.3):
        super().__init__()
        layers = []
        prev_dim = input_dim
        for h in hidden_dims:
            layers.extend([
                nn.Linear(prev_dim, h),
                nn.ReLU(),
                nn.Dropout(dropout),
            ])
            prev_dim = h
        layers.append(nn.Linear(prev_dim, output_dim))
        self.network = nn.Sequential(*layers)
        self._init_weights()

    def _init_weights(self):
        for module in self.network:
            if isinstance(module, nn.Linear):
                nn.init.xavier_uniform_(module.weight)
                nn.init.zeros_(module.bias)

    def forward(self, x):
        return self.network(x)


def compute_metrics(predictions: torch.Tensor, targets: torch.Tensor, threshold: float = 0.5):
    preds = (torch.sigmoid(predictions) >= threshold).float()
    exact_match = (preds == targets).all(dim=1).float().mean().item()
    per_label_acc = (preds == targets).float().mean(dim=0)

    tp = (preds * targets).sum(dim=1)
    fp = (preds * (1 - targets)).sum(dim=1)
    fn = ((1 - preds) * targets).sum(dim=1)

    precision = (tp / (tp + fp + 1e-8)).mean().item()
    recall = (tp / (tp + fn + 1e-8)).mean().item()
    f1 = 2 * precision * recall / (precision + recall + 1e-8)

    return {
        "exact_match_acc": exact_match,
        "per_label_acc": per_label_acc.tolist(),
        "precision": precision,
        "recall": recall,
        "f1": f1,
    }


def set_seed(seed: int = 42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def load_processed_data():
    x_train = np.load(os.path.join(DATA_DIR, "X_train.npy"))
    x_val = np.load(os.path.join(DATA_DIR, "X_val.npy"))
    x_test = np.load(os.path.join(DATA_DIR, "X_test.npy"))
    y_train = np.load(os.path.join(DATA_DIR, "y_train.npy"))
    y_val = np.load(os.path.join(DATA_DIR, "y_val.npy"))
    y_test = np.load(os.path.join(DATA_DIR, "y_test.npy"))

    train_ds = TensorDataset(torch.tensor(x_train, dtype=torch.float32), torch.tensor(y_train, dtype=torch.float32))
    val_ds = TensorDataset(torch.tensor(x_val, dtype=torch.float32), torch.tensor(y_val, dtype=torch.float32))
    test_ds = TensorDataset(torch.tensor(x_test, dtype=torch.float32), torch.tensor(y_test, dtype=torch.float32))

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE, shuffle=False)
    test_loader = DataLoader(test_ds, batch_size=BATCH_SIZE, shuffle=False)

    return train_loader, val_loader, test_loader, x_train.shape[1], y_train.shape[1]


def evaluate_model(model, loader, criterion, device):
    model.eval()
    total_loss = 0.0
    all_logits = []
    all_targets = []
    with torch.no_grad():
        for x, y in loader:
            x, y = x.to(device), y.to(device)
            logits = model(x)
            loss = criterion(logits, y)
            total_loss += loss.item()
            all_logits.append(logits)
            all_targets.append(y)

    avg_loss = total_loss / max(1, len(loader))
    logits = torch.cat(all_logits, dim=0)
    targets = torch.cat(all_targets, dim=0)
    metrics = compute_metrics(logits, targets)
    return avg_loss, metrics


def train_one_arch(name, hidden_dims, train_loader, val_loader, test_loader, input_dim, output_dim, device):
    model = FlexibleIntentMLP(input_dim=input_dim, hidden_dims=hidden_dims, output_dim=output_dim, dropout=DROPOUT).to(device)
    criterion = nn.BCEWithLogitsLoss()
    optimizer = optim.Adam(model.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="min", factor=0.5, patience=5)

    best_state = None
    best_val_loss = float("inf")
    best_epoch = 0
    stale_epochs = 0

    for epoch in range(1, MAX_EPOCHS + 1):
        model.train()
        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            optimizer.zero_grad()
            logits = model(x)
            loss = criterion(logits, y)
            loss.backward()
            optimizer.step()

        val_loss, val_metrics = evaluate_model(model, val_loader, criterion, device)
        scheduler.step(val_loss)

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
            best_epoch = epoch
            stale_epochs = 0
        else:
            stale_epochs += 1

        if stale_epochs >= EARLY_STOP_PATIENCE:
            break

    if best_state is not None:
        model.load_state_dict(best_state)

    val_loss, val_metrics = evaluate_model(model, val_loader, criterion, device)
    test_loss, test_metrics = evaluate_model(model, test_loader, criterion, device)

    params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    return RunResult(
        name=name,
        hidden_dims=hidden_dims,
        params=params,
        best_epoch=best_epoch,
        val_loss=val_loss,
        val_f1=val_metrics["f1"],
        test_exact_match=test_metrics["exact_match_acc"],
        test_precision=test_metrics["precision"],
        test_recall=test_metrics["recall"],
        test_f1=test_metrics["f1"],
    )


def save_results(results: list[RunResult]):
    os.makedirs(RESULTS_DIR, exist_ok=True)
    with open(RESULTS_CSV, "w", encoding="utf-8") as f:
        f.write("name,hidden_dims,params,best_epoch,val_loss,val_f1,test_exact_match,test_precision,test_recall,test_f1\n")
        for r in results:
            f.write(
                f"{r.name},\"{r.hidden_dims}\",{r.params},{r.best_epoch},{r.val_loss:.6f},{r.val_f1:.6f},"
                f"{r.test_exact_match:.6f},{r.test_precision:.6f},{r.test_recall:.6f},{r.test_f1:.6f}\n"
            )


def main():
    set_seed(SEED)
    device = "cuda" if torch.cuda.is_available() else "cpu"

    train_loader, val_loader, test_loader, input_dim, output_dim = load_processed_data()

    archs = [
        ("A0_384_7_linear", []),
        ("A1_384_32_7", [32]),
        ("A2_384_48_7", [48]),
        ("A_384_64_7", [64]),
        ("A3_384_80_7", [80]),
        ("A4_384_64_32_7", [64, 32]),
        ("A5_384_96_32_7", [96, 32]),
        ("B_384_128_64_7_current", [128, 64]),
        ("B1_384_128_32_7", [128, 32]),
        ("B2_384_160_80_7", [160, 80]),
        ("C_384_256_128_64_7", [256, 128, 64]),
        ("D_384_128_7", [128]),
        ("D1_384_160_7", [160]),
        ("D2_384_192_7", [192]),
        ("E0_384_256_7", [256]),
        ("E_384_256_64_7", [256, 64]),
        ("F_384_512_256_128_64_7", [512, 256, 128, 64]),
        ("G_384_96_48_7", [96, 48]),
        ("H_384_192_96_48_7", [192, 96, 48]),
    ]

    print("=== TEMP ARCHITECTURE ABLATION ===")
    print(f"device={device} train={len(train_loader.dataset)} val={len(val_loader.dataset)} test={len(test_loader.dataset)}")

    results = []
    for name, hidden_dims in archs:
        # Keep runs comparable by resetting randomness and data-loader shuffle state.
        set_seed(SEED)
        train_loader, val_loader, test_loader, input_dim, output_dim = load_processed_data()
        print(f"\n[RUN] {name} hidden_dims={hidden_dims}")
        result = train_one_arch(name, hidden_dims, train_loader, val_loader, test_loader, input_dim, output_dim, device)
        results.append(result)
        print(
            f"best_epoch={result.best_epoch} params={result.params} "
            f"val_f1={result.val_f1:.4f} test_exact={result.test_exact_match:.4f} test_f1={result.test_f1:.4f}"
        )

    results = sorted(results, key=lambda r: (r.test_f1, r.test_exact_match), reverse=True)

    print("\n=== RANKED RESULTS (by test_f1, then exact_match) ===")
    for i, r in enumerate(results, 1):
        print(
            f"{i:02d}. {r.name:28s} params={r.params:7d} "
            f"test_f1={r.test_f1:.4f} test_exact={r.test_exact_match:.4f} val_f1={r.val_f1:.4f}"
        )

    save_results(results)
    print(f"\nSaved CSV: {RESULTS_CSV}")


if __name__ == "__main__":
    main()
