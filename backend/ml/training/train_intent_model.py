"""
Training Script for Intent Classifier
Covers Syllabus Modules 2, 3: Backpropagation, Optimization (SGD vs Adam)
"""

import os
import sys
import json
import time
import numpy as np
import matplotlib.pyplot as plt
import torch
import torch.nn as nn
import torch.optim as optim
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data.data_loader import load_raw_data, preprocess_and_split, create_dataloaders, TOPIC_LABELS
from models.intent_classifier import IntentClassifier, get_model_summary

# ==================== CONFIG ====================
MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "models", "saved")
PLOTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "plots")

# Training Hyperparameters
CONFIG = {
    "batch_size": 16,
    "learning_rate": 0.001,
    "epochs": 100,
    "early_stopping_patience": 15,
    "dropout_rate": 0.3,
    "weight_decay": 1e-4,  # L2 Regularization (Module 6)
    "threshold": 0.5,  # For multi-label prediction
}


# ==================== METRICS ====================
def compute_metrics(predictions: torch.Tensor, targets: torch.Tensor, threshold: float = 0.5):
    """
    Compute multi-label classification metrics.
    
    Returns:
        dict with accuracy, precision, recall, f1 (all per-sample averaged)
    """
    # Convert logits to binary predictions
    preds = (torch.sigmoid(predictions) >= threshold).float()
    
    # Exact match accuracy (all labels must match)
    exact_match = (preds == targets).all(dim=1).float().mean().item()
    
    # Per-label accuracy (average across labels)
    per_label_acc = (preds == targets).float().mean(dim=0)
    
    # Precision, Recall, F1 (sample-averaged)
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
        "f1": f1
    }


# ==================== TRAINING LOOP ====================
def train_epoch(model, dataloader, criterion, optimizer, device):
    """Train for one epoch"""
    model.train()
    total_loss = 0
    all_preds = []
    all_targets = []
    
    for batch_x, batch_y in dataloader:
        batch_x, batch_y = batch_x.to(device), batch_y.to(device)
        
        # Forward pass
        optimizer.zero_grad()
        outputs = model(batch_x)
        loss = criterion(outputs, batch_y)
        
        # Backward pass (Backpropagation - Module 2)
        loss.backward()
        optimizer.step()
        
        total_loss += loss.item()
        all_preds.append(outputs.detach())
        all_targets.append(batch_y.detach())
    
    avg_loss = total_loss / len(dataloader)
    all_preds = torch.cat(all_preds, dim=0)
    all_targets = torch.cat(all_targets, dim=0)
    metrics = compute_metrics(all_preds, all_targets)
    
    return avg_loss, metrics


def evaluate(model, dataloader, criterion, device):
    """Evaluate on validation/test set"""
    model.eval()
    total_loss = 0
    all_preds = []
    all_targets = []
    
    with torch.no_grad():
        for batch_x, batch_y in dataloader:
            batch_x, batch_y = batch_x.to(device), batch_y.to(device)
            outputs = model(batch_x)
            loss = criterion(outputs, batch_y)
            
            total_loss += loss.item()
            all_preds.append(outputs)
            all_targets.append(batch_y)
    
    avg_loss = total_loss / len(dataloader)
    all_preds = torch.cat(all_preds, dim=0)
    all_targets = torch.cat(all_targets, dim=0)
    metrics = compute_metrics(all_preds, all_targets)
    
    return avg_loss, metrics


def train_model(
    model,
    train_loader,
    val_loader,
    optimizer_type: str = "adam",
    epochs: int = CONFIG["epochs"],
    lr: float = CONFIG["learning_rate"],
    weight_decay: float = CONFIG["weight_decay"],
    patience: int = CONFIG["early_stopping_patience"],
    device: str = "cuda" if torch.cuda.is_available() else "cpu"
):
    """
    Full training loop with early stopping.
    
    Module 3 Coverage: Compares SGD vs Adam optimizers
    """
    model = model.to(device)
    
    # Loss function: BCEWithLogitsLoss for multi-label
    criterion = nn.BCEWithLogitsLoss()
    
    # Optimizer selection (Module 3: Optimization)
    if optimizer_type.lower() == "adam":
        optimizer = optim.Adam(model.parameters(), lr=lr, weight_decay=weight_decay)
    elif optimizer_type.lower() == "sgd":
        optimizer = optim.SGD(model.parameters(), lr=lr, momentum=0.9, weight_decay=weight_decay)
    elif optimizer_type.lower() == "rmsprop":
        optimizer = optim.RMSprop(model.parameters(), lr=lr, weight_decay=weight_decay)
    else:
        raise ValueError(f"Unknown optimizer: {optimizer_type}")
    
    # Learning rate scheduler
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode='min', factor=0.5, patience=5, verbose=True
    )
    
    # History for plotting
    history = {
        "train_loss": [], "val_loss": [],
        "train_f1": [], "val_f1": [],
        "train_acc": [], "val_acc": []
    }
    
    best_val_loss = float('inf')
    best_model_state = None
    epochs_without_improvement = 0
    
    print(f"\n{'='*60}")
    print(f"TRAINING with {optimizer_type.upper()} optimizer")
    print(f"Device: {device} | LR: {lr} | Epochs: {epochs}")
    print(f"{'='*60}\n")
    
    start_time = time.time()
    
    for epoch in range(epochs):
        # Train
        train_loss, train_metrics = train_epoch(model, train_loader, criterion, optimizer, device)
        
        # Validate
        val_loss, val_metrics = evaluate(model, val_loader, criterion, device)
        
        # Update scheduler
        scheduler.step(val_loss)
        
        # Record history
        history["train_loss"].append(train_loss)
        history["val_loss"].append(val_loss)
        history["train_f1"].append(train_metrics["f1"])
        history["val_f1"].append(val_metrics["f1"])
        history["train_acc"].append(train_metrics["exact_match_acc"])
        history["val_acc"].append(val_metrics["exact_match_acc"])
        
        # Early stopping check
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_model_state = model.state_dict().copy()
            epochs_without_improvement = 0
        else:
            epochs_without_improvement += 1
        
        # Print progress every 10 epochs
        if (epoch + 1) % 10 == 0 or epoch == 0:
            print(f"Epoch [{epoch+1:3d}/{epochs}] | "
                  f"Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f} | "
                  f"Train F1: {train_metrics['f1']:.3f} | Val F1: {val_metrics['f1']:.3f}")
        
        # Early stopping
        if epochs_without_improvement >= patience:
            print(f"\n⚠️ Early stopping at epoch {epoch+1} (no improvement for {patience} epochs)")
            break
    
    # Restore best model
    if best_model_state:
        model.load_state_dict(best_model_state)
    
    elapsed = time.time() - start_time
    print(f"\n✅ Training complete in {elapsed:.1f}s")
    print(f"   Best Validation Loss: {best_val_loss:.4f}")
    
    return model, history


# ==================== VISUALIZATION ====================
def plot_training_curves(histories: dict, save_path: str = None):
    """
    Plot training curves for optimizer comparison.
    Shows loss and F1 score for each optimizer.
    """
    fig, axes = plt.subplots(2, 2, figsize=(12, 10))
    
    colors = {"adam": "#2ecc71", "sgd": "#e74c3c", "rmsprop": "#3498db"}
    
    # Loss plots
    for name, history in histories.items():
        color = colors.get(name.lower(), "#333333")
        epochs = range(1, len(history["train_loss"]) + 1)
        
        axes[0, 0].plot(epochs, history["train_loss"], label=f'{name} (Train)', 
                        color=color, linestyle='-', linewidth=2)
        axes[0, 0].plot(epochs, history["val_loss"], label=f'{name} (Val)', 
                        color=color, linestyle='--', linewidth=2)
    
    axes[0, 0].set_title("Loss Curves", fontsize=14, fontweight='bold')
    axes[0, 0].set_xlabel("Epoch")
    axes[0, 0].set_ylabel("BCE Loss")
    axes[0, 0].legend()
    axes[0, 0].grid(True, alpha=0.3)
    
    # F1 plots
    for name, history in histories.items():
        color = colors.get(name.lower(), "#333333")
        epochs = range(1, len(history["train_f1"]) + 1)
        
        axes[0, 1].plot(epochs, history["train_f1"], label=f'{name} (Train)',
                        color=color, linestyle='-', linewidth=2)
        axes[0, 1].plot(epochs, history["val_f1"], label=f'{name} (Val)',
                        color=color, linestyle='--', linewidth=2)
    
    axes[0, 1].set_title("F1 Score", fontsize=14, fontweight='bold')
    axes[0, 1].set_xlabel("Epoch")
    axes[0, 1].set_ylabel("F1 Score")
    axes[0, 1].legend()
    axes[0, 1].grid(True, alpha=0.3)
    
    # Accuracy plots
    for name, history in histories.items():
        color = colors.get(name.lower(), "#333333")
        epochs = range(1, len(history["train_acc"]) + 1)
        
        axes[1, 0].plot(epochs, history["train_acc"], label=f'{name} (Train)',
                        color=color, linestyle='-', linewidth=2)
        axes[1, 0].plot(epochs, history["val_acc"], label=f'{name} (Val)',
                        color=color, linestyle='--', linewidth=2)
    
    axes[1, 0].set_title("Exact Match Accuracy", fontsize=14, fontweight='bold')
    axes[1, 0].set_xlabel("Epoch")
    axes[1, 0].set_ylabel("Accuracy")
    axes[1, 0].legend()
    axes[1, 0].grid(True, alpha=0.3)
    
    # Final comparison bar chart
    final_metrics = {}
    for name, history in histories.items():
        final_metrics[name] = {
            "val_loss": history["val_loss"][-1],
            "val_f1": history["val_f1"][-1],
            "val_acc": history["val_acc"][-1]
        }
    
    x = np.arange(len(final_metrics))
    width = 0.25
    
    axes[1, 1].bar(x - width, [m["val_loss"] for m in final_metrics.values()], 
                   width, label='Val Loss', color='#e74c3c', alpha=0.8)
    axes[1, 1].bar(x, [m["val_f1"] for m in final_metrics.values()], 
                   width, label='Val F1', color='#2ecc71', alpha=0.8)
    axes[1, 1].bar(x + width, [m["val_acc"] for m in final_metrics.values()], 
                   width, label='Val Acc', color='#3498db', alpha=0.8)
    
    axes[1, 1].set_title("Final Metrics Comparison", fontsize=14, fontweight='bold')
    axes[1, 1].set_xticks(x)
    axes[1, 1].set_xticklabels(list(final_metrics.keys()))
    axes[1, 1].legend()
    axes[1, 1].grid(True, alpha=0.3, axis='y')
    
    plt.tight_layout()
    
    if save_path:
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        print(f"📊 Plot saved to {save_path}")
    
    plt.show()


# ==================== MAIN ====================
def main():
    """Main training pipeline"""
    
    # Create directories
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(PLOTS_DIR, exist_ok=True)
    
    # Load and preprocess data
    print("="*60)
    print("PHASE 1: DATA LOADING")
    print("="*60)
    
    raw_data = load_raw_data()
    processed = preprocess_and_split(raw_data)
    loaders = create_dataloaders(processed, batch_size=CONFIG["batch_size"])
    
    # Model summary
    print("\n" + "="*60)
    print("PHASE 2: MODEL ARCHITECTURE")
    print("="*60)
    
    model = IntentClassifier(
        input_dim=processed["embedding_dim"],
        output_dim=processed["num_classes"],
        dropout_rate=CONFIG["dropout_rate"]
    )
    print(get_model_summary(model))
    
    # Train with different optimizers (Module 3 comparison)
    print("\n" + "="*60)
    print("PHASE 3: TRAINING (OPTIMIZER COMPARISON)")
    print("="*60)
    
    histories = {}
    best_model = None
    best_optimizer = None
    best_val_f1 = 0
    
    for opt_name in ["Adam", "SGD"]:
        print(f"\n{'='*40}")
        print(f"Training with {opt_name}")
        print(f"{'='*40}")
        
        # Create fresh model for each optimizer
        model = IntentClassifier(
            input_dim=processed["embedding_dim"],
            output_dim=processed["num_classes"],
            dropout_rate=CONFIG["dropout_rate"]
        )
        
        trained_model, history = train_model(
            model,
            loaders["train"],
            loaders["val"],
            optimizer_type=opt_name,
            epochs=CONFIG["epochs"],
            lr=CONFIG["learning_rate"]
        )
        
        histories[opt_name] = history
        
        # Track best model
        final_val_f1 = history["val_f1"][-1]
        if final_val_f1 > best_val_f1:
            best_val_f1 = final_val_f1
            best_model = trained_model
            best_optimizer = opt_name
    
    # Plot comparison
    print("\n" + "="*60)
    print("PHASE 4: VISUALIZATION")
    print("="*60)
    
    plot_path = os.path.join(PLOTS_DIR, "training_curves.png")
    plot_training_curves(histories, save_path=plot_path)
    
    # Final evaluation on test set
    print("\n" + "="*60)
    print("PHASE 5: FINAL EVALUATION (TEST SET)")
    print("="*60)
    
    criterion = nn.BCEWithLogitsLoss()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    
    test_loss, test_metrics = evaluate(best_model, loaders["test"], criterion, device)
    
    print(f"\n🏆 Best Optimizer: {best_optimizer}")
    print(f"\n📊 TEST SET RESULTS:")
    print(f"   Loss: {test_loss:.4f}")
    print(f"   Exact Match Accuracy: {test_metrics['exact_match_acc']:.4f}")
    print(f"   Precision: {test_metrics['precision']:.4f}")
    print(f"   Recall: {test_metrics['recall']:.4f}")
    print(f"   F1 Score: {test_metrics['f1']:.4f}")
    
    print(f"\n   Per-Label Accuracy:")
    for i, label in enumerate(TOPIC_LABELS):
        print(f"      {label}: {test_metrics['per_label_acc'][i]:.4f}")
    
    # Save best model
    model_path = os.path.join(MODELS_DIR, "intent_model.pth")
    torch.save({
        "model_state_dict": best_model.state_dict(),
        "config": {
            "input_dim": processed["embedding_dim"],
            "output_dim": processed["num_classes"],
            "dropout_rate": CONFIG["dropout_rate"],
            "hidden_dim_1": 128,
            "hidden_dim_2": 64
        },
        "label_names": TOPIC_LABELS,
        "optimizer": best_optimizer,
        "test_metrics": test_metrics,
        "trained_at": datetime.now().isoformat()
    }, model_path)
    
    print(f"\n💾 Model saved to {model_path}")
    print("\n✅ Training pipeline complete!")


if __name__ == "__main__":
    main()
