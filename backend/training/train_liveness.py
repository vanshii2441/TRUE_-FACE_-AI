"""
TRUE FACE AI — Passive Liveness CNN Training Script

Trains LivenessNet model to classify real face presentations vs presentation attacks.

Usage:
    python training/train_liveness.py --data-dir data/liveness --epochs 20 --batch-size 32 --lr 0.001
"""

import argparse
import json
import logging
import os
import sys
import time
from typing import Dict, Any

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader

# Add backend directory to sys.path if running as script
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.models.liveness_net import LivenessNet
from app.dataset.liveness_dataset import LivenessDataset

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("train_liveness")


def calculate_metrics(y_true: list[int], y_pred: list[int]) -> Dict[str, Any]:
    """
    Calculate classification metrics: Accuracy, Precision, Recall, F1-Score, and Confusion Matrix.
    Class 0 = REAL, Class 1 = SPOOF.
    """
    tp = sum(1 for gt, pred in zip(y_true, y_pred) if gt == 0 and pred == 0)  # Real predicted as Real
    tn = sum(1 for gt, pred in zip(y_true, y_pred) if gt == 1 and pred == 1)  # Spoof predicted as Spoof
    fp = sum(1 for gt, pred in zip(y_true, y_pred) if gt == 1 and pred == 0)  # Spoof predicted as Real
    fn = sum(1 for gt, pred in zip(y_true, y_pred) if gt == 0 and pred == 1)  # Real predicted as Spoof

    total = len(y_true)
    accuracy = (tp + tn) / total if total > 0 else 0.0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

    confusion_matrix = {
        "true_real_pred_real (TP)": tp,
        "true_spoof_pred_spoof (TN)": tn,
        "true_spoof_pred_real (FP)": fp,
        "true_real_pred_spoof (FN)": fn,
    }

    return {
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1, 4),
        "confusion_matrix": confusion_matrix,
    }


def train_one_epoch(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    optimizer: optim.Optimizer,
    device: torch.device,
) -> tuple[float, float]:
    """Run one training epoch."""
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    for images, labels in loader:
        images, labels = images.to(device), labels.to(device)
        optimizer.zero_grad()

        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        running_loss += loss.item() * images.size(0)
        _, preds = torch.max(outputs, 1)
        correct += (preds == labels).sum().item()
        total += labels.size(0)

    epoch_loss = running_loss / total if total > 0 else 0.0
    epoch_acc = correct / total if total > 0 else 0.0
    return epoch_loss, epoch_acc


def evaluate(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
) -> tuple[float, Dict[str, Any]]:
    """Evaluate model on validation or test dataset."""
    model.eval()
    running_loss = 0.0
    y_true: list[int] = []
    y_pred: list[int] = []

    with torch.no_grad():
        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            loss = criterion(outputs, labels)

            running_loss += loss.item() * images.size(0)
            _, preds = torch.max(outputs, 1)

            y_true.extend(labels.cpu().tolist())
            y_pred.extend(preds.cpu().tolist())

    total = len(y_true)
    val_loss = running_loss / total if total > 0 else 0.0
    metrics = calculate_metrics(y_true, y_pred)
    return val_loss, metrics


def main():
    parser = argparse.ArgumentParser(description="Train LivenessNet CNN for face passive anti-spoofing.")
    parser.add_argument("--data-dir", type=str, default="data/liveness", help="Path to liveness dataset root")
    parser.add_argument("--epochs", type=int, default=20, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size for training")
    parser.add_argument("--lr", type=float, default=0.001, help="Learning rate")
    parser.add_argument("--input-size", type=int, default=128, help="Target image resolution (square)")
    parser.add_argument("--save-dir", type=str, default="models/liveness", help="Directory to save model checkpoint")
    args = parser.parse_args()

    print("\nTRUE FACE AI — Passive Liveness CNN Model Training")
    print(f"Dataset Directory: {args.data_dir}")
    print(f"Hyperparameters: Epochs={args.epochs}, Batch Size={args.batch_size}, LR={args.lr}, Resolution={args.input_size}x{args.input_size}\n")

    # Verify dataset directories
    train_dataset = LivenessDataset(root_dir=args.data_dir, split="train", input_size=args.input_size)
    val_dataset = LivenessDataset(root_dir=args.data_dir, split="validation", input_size=args.input_size)

    if len(train_dataset) == 0:
        logger.error(
            "Training dataset is empty at '%s/train'. Please populate dataset with 'real/' and 'spoof/' images.",
            args.data_dir,
        )
        sys.exit(1)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info("Using device: %s", device)

    train_loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=args.batch_size, shuffle=False, num_workers=0)

    model = LivenessNet(num_classes=2).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=args.lr)

    best_val_acc = 0.0
    best_model_path = os.path.join(args.save_dir, "best_model.pth")
    config_path = os.path.join(args.save_dir, "config.json")
    os.makedirs(args.save_dir, exist_ok=True)

    start_time = time.time()

    for epoch in range(1, args.epochs + 1):
        train_loss, train_acc = train_one_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_metrics = evaluate(model, val_loader, criterion, device) if len(val_dataset) > 0 else (0.0, {"accuracy": 0.0})

        val_acc = val_metrics.get("accuracy", 0.0)
        logger.info(
            "Epoch [%d/%d] | Train Loss: %.4f | Train Acc: %.4f | Val Loss: %.4f | Val Acc: %.4f",
            epoch,
            args.epochs,
            train_loss,
            train_acc,
            val_loss,
            val_acc,
        )

        # Save best model checkpoint
        if val_acc >= best_val_acc:
            best_val_acc = val_acc
            torch.save(
                {
                    "epoch": epoch,
                    "model_state_dict": model.state_dict(),
                    "optimizer_state_dict": optimizer.state_dict(),
                    "val_accuracy": val_acc,
                    "val_metrics": val_metrics,
                },
                best_model_path,
            )
            logger.info("Saved best model checkpoint to %s (Val Acc: %.4f)", best_model_path, val_acc)

    elapsed = time.time() - start_time
    print(f"\nTraining Completed in {elapsed:.1f} seconds. Best Val Accuracy: {best_val_acc:.4f}")

    # Save training configuration
    train_config = {
        "architecture": "LivenessNet",
        "epochs": args.epochs,
        "batch_size": args.batch_size,
        "learning_rate": args.lr,
        "input_size": args.input_size,
        "best_val_accuracy": best_val_acc,
        "training_time_seconds": round(elapsed, 2),
        "data_dir": args.data_dir,
    }
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(train_config, f, indent=2)
    logger.info("Saved training configuration to %s", config_path)


if __name__ == "__main__":
    main()
