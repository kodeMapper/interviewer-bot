"""
Temporary optimizer and batch-size sweep for the selected best architecture.

Design:
- Fixed architecture: 384 -> 128 -> 7 (single hidden layer)
- Optimizers: SGD(momentum), Adam, RMSprop, AdamW
- Batch sizes: 8, 16, 32
- Seeds: 42, 7, 123

Outputs:
- backend/ml/plots/temp_optimizer_batch_sweep_runs.csv (all runs)
- backend/ml/plots/temp_optimizer_batch_sweep_summary.csv (mean/std summary)
"""

from __future__ import annotations

import csv
import os
import random
from dataclasses import dataclass

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset


SEEDS = [42, 7, 123]
BATCH_SIZES = [8, 16, 32]
OPTIMIZERS = ["sgd", "adam", "rmsprop", "adamw"]

LR = 1e-3
WEIGHT_DECAY = 1e-4
MAX_EPOCHS = 60
EARLY_STOP_PATIENCE = 10
DROPOUT = 0.3

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "processed")
PLOTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "plots")
RUNS_CSV = os.path.join(PLOTS_DIR, "temp_optimizer_batch_sweep_runs.csv")
SUMMARY_CSV = os.path.join(PLOTS_DIR, "temp_optimizer_batch_sweep_summary.csv")


@dataclass
class RunResult:
    optimizer: str
    batch_size: int
    seed: int
    params: int
    best_epoch: int
    val_loss: float
    val_f1: float
    test_exact: float
    test_precision: float
    test_recall: float
    test_f1: float


def set_seed(seed: int):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


class FixedMLP(nn.Module):
    """Fixed architecture: 384 -> 128 -> 7."""

    def __init__(self, input_dim: int, output_dim: int, dropout: float = 0.3):
        super().__init__()
        self.network = nn.Sequential(
            nn.Linear(input_dim, 128),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(128, output_dim),
        )
        self._init_weights()

    def _init_weights(self):
        for m in self.network:
            if isinstance(m, nn.Linear):
                nn.init.xavier_uniform_(m.weight)
                nn.init.zeros_(m.bias)

    def forward(self, x):
        return self.network(x)


def compute_metrics(predictions: torch.Tensor, targets: torch.Tensor, threshold: float = 0.5):
    preds = (torch.sigmoid(predictions) >= threshold).float()
    exact_match = (preds == targets).all(dim=1).float().mean().item()

    tp = (preds * targets).sum(dim=1)
    fp = (preds * (1 - targets)).sum(dim=1)
    fn = ((1 - preds) * targets).sum(dim=1)

    precision = (tp / (tp + fp + 1e-8)).mean().item()
    recall = (tp / (tp + fn + 1e-8)).mean().item()
    f1 = 2 * precision * recall / (precision + recall + 1e-8)

    return {
        "exact_match_acc": exact_match,
        "precision": precision,
        "recall": recall,
        "f1": f1,
    }


def load_arrays():
    x_train = np.load(os.path.join(DATA_DIR, "X_train.npy"))
    x_val = np.load(os.path.join(DATA_DIR, "X_val.npy"))
    x_test = np.load(os.path.join(DATA_DIR, "X_test.npy"))
    y_train = np.load(os.path.join(DATA_DIR, "y_train.npy"))
    y_val = np.load(os.path.join(DATA_DIR, "y_val.npy"))
    y_test = np.load(os.path.join(DATA_DIR, "y_test.npy"))
    return x_train, y_train, x_val, y_val, x_test, y_test


def make_loaders(batch_size: int, seed: int):
    x_train, y_train, x_val, y_val, x_test, y_test = load_arrays()

    train_ds = TensorDataset(torch.tensor(x_train, dtype=torch.float32), torch.tensor(y_train, dtype=torch.float32))
    val_ds = TensorDataset(torch.tensor(x_val, dtype=torch.float32), torch.tensor(y_val, dtype=torch.float32))
    test_ds = TensorDataset(torch.tensor(x_test, dtype=torch.float32), torch.tensor(y_test, dtype=torch.float32))

    generator = torch.Generator().manual_seed(seed)
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, generator=generator)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)
    test_loader = DataLoader(test_ds, batch_size=batch_size, shuffle=False)

    return train_loader, val_loader, test_loader, x_train.shape[1], y_train.shape[1]


def create_optimizer(name: str, params):
    lname = name.lower()
    if lname == "sgd":
        return optim.SGD(params, lr=LR, momentum=0.9, weight_decay=WEIGHT_DECAY)
    if lname == "adam":
        return optim.Adam(params, lr=LR, weight_decay=WEIGHT_DECAY)
    if lname == "rmsprop":
        return optim.RMSprop(params, lr=LR, weight_decay=WEIGHT_DECAY)
    if lname == "adamw":
        return optim.AdamW(params, lr=LR, weight_decay=WEIGHT_DECAY)
    raise ValueError(f"Unknown optimizer: {name}")


def evaluate(model, loader, criterion, device):
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


def run_one(optimizer_name: str, batch_size: int, seed: int, device: str) -> RunResult:
    set_seed(seed)
    train_loader, val_loader, test_loader, input_dim, output_dim = make_loaders(batch_size, seed)

    model = FixedMLP(input_dim=input_dim, output_dim=output_dim, dropout=DROPOUT).to(device)
    criterion = nn.BCEWithLogitsLoss()
    optimizer = create_optimizer(optimizer_name, model.parameters())
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="min", factor=0.5, patience=4)

    best_state = None
    best_val_loss = float("inf")
    best_epoch = 0
    stale = 0

    for epoch in range(1, MAX_EPOCHS + 1):
        model.train()
        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            optimizer.zero_grad()
            logits = model(x)
            loss = criterion(logits, y)
            loss.backward()
            optimizer.step()

        val_loss, _ = evaluate(model, val_loader, criterion, device)
        scheduler.step(val_loss)

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
            best_epoch = epoch
            stale = 0
        else:
            stale += 1

        if stale >= EARLY_STOP_PATIENCE:
            break

    if best_state is not None:
        model.load_state_dict(best_state)

    val_loss, val_metrics = evaluate(model, val_loader, criterion, device)
    _, test_metrics = evaluate(model, test_loader, criterion, device)

    params = sum(p.numel() for p in model.parameters() if p.requires_grad)

    return RunResult(
        optimizer=optimizer_name,
        batch_size=batch_size,
        seed=seed,
        params=params,
        best_epoch=best_epoch,
        val_loss=val_loss,
        val_f1=val_metrics["f1"],
        test_exact=test_metrics["exact_match_acc"],
        test_precision=test_metrics["precision"],
        test_recall=test_metrics["recall"],
        test_f1=test_metrics["f1"],
    )


def save_runs_csv(rows: list[RunResult]):
    os.makedirs(PLOTS_DIR, exist_ok=True)
    with open(RUNS_CSV, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "optimizer",
            "batch_size",
            "seed",
            "params",
            "best_epoch",
            "val_loss",
            "val_f1",
            "test_exact",
            "test_precision",
            "test_recall",
            "test_f1",
        ])
        for r in rows:
            writer.writerow([
                r.optimizer,
                r.batch_size,
                r.seed,
                r.params,
                r.best_epoch,
                f"{r.val_loss:.6f}",
                f"{r.val_f1:.6f}",
                f"{r.test_exact:.6f}",
                f"{r.test_precision:.6f}",
                f"{r.test_recall:.6f}",
                f"{r.test_f1:.6f}",
            ])


def summarize(rows: list[RunResult]):
    groups: dict[tuple[str, int], list[RunResult]] = {}
    for r in rows:
        key = (r.optimizer, r.batch_size)
        groups.setdefault(key, []).append(r)

    summary_rows = []
    for (opt, bs), items in groups.items():
        arr_val_loss = np.array([x.val_loss for x in items], dtype=float)
        arr_val_f1 = np.array([x.val_f1 for x in items], dtype=float)
        arr_test_exact = np.array([x.test_exact for x in items], dtype=float)
        arr_test_f1 = np.array([x.test_f1 for x in items], dtype=float)
        arr_best_epoch = np.array([x.best_epoch for x in items], dtype=float)

        summary_rows.append(
            {
                "optimizer": opt,
                "batch_size": bs,
                "runs": len(items),
                "params": items[0].params,
                "mean_best_epoch": float(arr_best_epoch.mean()),
                "std_best_epoch": float(arr_best_epoch.std(ddof=0)),
                "mean_val_loss": float(arr_val_loss.mean()),
                "std_val_loss": float(arr_val_loss.std(ddof=0)),
                "mean_val_f1": float(arr_val_f1.mean()),
                "std_val_f1": float(arr_val_f1.std(ddof=0)),
                "mean_test_exact": float(arr_test_exact.mean()),
                "std_test_exact": float(arr_test_exact.std(ddof=0)),
                "mean_test_f1": float(arr_test_f1.mean()),
                "std_test_f1": float(arr_test_f1.std(ddof=0)),
            }
        )

    summary_rows.sort(
        key=lambda x: (x["mean_test_f1"], x["mean_test_exact"], -x["mean_best_epoch"]),
        reverse=True,
    )

    with open(SUMMARY_CSV, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "rank",
            "optimizer",
            "batch_size",
            "runs",
            "params",
            "mean_best_epoch",
            "std_best_epoch",
            "mean_val_loss",
            "std_val_loss",
            "mean_val_f1",
            "std_val_f1",
            "mean_test_exact",
            "std_test_exact",
            "mean_test_f1",
            "std_test_f1",
        ])
        for i, r in enumerate(summary_rows, start=1):
            writer.writerow([
                i,
                r["optimizer"],
                r["batch_size"],
                r["runs"],
                r["params"],
                f"{r['mean_best_epoch']:.3f}",
                f"{r['std_best_epoch']:.3f}",
                f"{r['mean_val_loss']:.6f}",
                f"{r['std_val_loss']:.6f}",
                f"{r['mean_val_f1']:.6f}",
                f"{r['std_val_f1']:.6f}",
                f"{r['mean_test_exact']:.6f}",
                f"{r['std_test_exact']:.6f}",
                f"{r['mean_test_f1']:.6f}",
                f"{r['std_test_f1']:.6f}",
            ])

    return summary_rows


def main():
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print("=== TEMP OPTIMIZER x BATCH SWEEP (FIXED 384->128->7) ===")
    print(f"device={device} optimizers={OPTIMIZERS} batch_sizes={BATCH_SIZES} seeds={SEEDS}")

    all_runs: list[RunResult] = []
    total = len(OPTIMIZERS) * len(BATCH_SIZES) * len(SEEDS)
    idx = 0

    for opt in OPTIMIZERS:
        for bs in BATCH_SIZES:
            for seed in SEEDS:
                idx += 1
                print(f"\n[RUN {idx}/{total}] opt={opt} batch={bs} seed={seed}")
                rr = run_one(optimizer_name=opt, batch_size=bs, seed=seed, device=device)
                all_runs.append(rr)
                print(
                    f"best_epoch={rr.best_epoch} val_loss={rr.val_loss:.4f} val_f1={rr.val_f1:.4f} "
                    f"test_exact={rr.test_exact:.4f} test_f1={rr.test_f1:.4f}"
                )

    save_runs_csv(all_runs)
    summary = summarize(all_runs)

    print("\n=== SUMMARY (mean across seeds, ranked) ===")
    for i, r in enumerate(summary, start=1):
        print(
            f"{i:02d}. opt={r['optimizer']:7s} batch={r['batch_size']:2d} "
            f"mean_test_f1={r['mean_test_f1']:.4f} +- {r['std_test_f1']:.4f} "
            f"mean_exact={r['mean_test_exact']:.4f} +- {r['std_test_exact']:.4f} "
            f"mean_epoch={r['mean_best_epoch']:.1f}"
        )

    print(f"\nSaved runs: {RUNS_CSV}")
    print(f"Saved summary: {SUMMARY_CSV}")


if __name__ == "__main__":
    main()
