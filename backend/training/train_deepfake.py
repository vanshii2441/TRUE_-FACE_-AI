import argparse
import random
import time
import sys
from pathlib import Path

# Add the backend directory to Python's module search path.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import cv2
import numpy as np
import torch
from torch import nn
from torch.utils.data import Dataset, DataLoader

from app.models.deepfake_net import DeepfakeNet


# Resolve paths from the repository root, not the current terminal folder.
ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data" / "deepfake"
MODEL_PATH = ROOT / "models" / "deepfake" / "best_model.pth"

IMAGE_SIZE = 128
BATCH_SIZE = 8
EPOCHS = 10
LEARNING_RATE = 0.001

# These labels MUST match deepfake_detector.py:
# 0 = REAL, 1 = DEEPFAKE
CLASS_LABELS = {"real": 0, "fake": 1}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp"}


class DeepfakeDataset(Dataset):
    """Loads real/fake images using the detector's preprocessing convention."""

    def __init__(self, split):
        self.samples = []
        split_dir = DATA_DIR / split

        for class_name, label in CLASS_LABELS.items():
            class_dir = split_dir / class_name

            if not class_dir.is_dir():
                raise FileNotFoundError(
                    f"Required dataset folder is missing: {class_dir}"
                )

            for path in sorted(class_dir.iterdir()):
                if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS:
                    self.samples.append((path, label))

        if not self.samples:
            raise RuntimeError(f"No images found in {split_dir}")

        counts = {
            name: sum(label == value for _, label in self.samples)
            for name, value in CLASS_LABELS.items()
        }
        print(f"{split.capitalize()} dataset: {counts}")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, index):
        image_path, label = self.samples[index]

        image = cv2.imread(str(image_path))
        if image is None:
            raise RuntimeError(f"Could not read image: {image_path}")

        # Match deepfake_detector.py: BGR -> RGB, resize, scale to [0, 1].
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        image = cv2.resize(image, (IMAGE_SIZE, IMAGE_SIZE))
        image = image.astype(np.float32) / 255.0

        # HWC -> CHW for PyTorch.
        image = np.transpose(image, (2, 0, 1)).copy()

        return torch.from_numpy(image), torch.tensor(label, dtype=torch.long)


def run_epoch(model, loader, criterion, device, optimizer=None):
    training = optimizer is not None
    model.train(training)

    total_loss = 0.0
    total_correct = 0
    total_images = 0

    context = torch.enable_grad() if training else torch.no_grad()

    with context:
        for images, labels in loader:
            images = images.to(device)
            labels = labels.to(device)

            if training:
                optimizer.zero_grad(set_to_none=True)

            logits = model(images)
            loss = criterion(logits, labels)

            if training:
                loss.backward()
                optimizer.step()

            batch_size = labels.size(0)
            total_loss += loss.item() * batch_size
            total_correct += (logits.argmax(dim=1) == labels).sum().item()
            total_images += batch_size

    return (
        total_loss / total_images,
        total_correct / total_images,
    )


def main():
    parser = argparse.ArgumentParser(
        description="Train the TRUE FACE AI deepfake CNN."
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Allow replacing an existing deepfake checkpoint.",
    )
    args = parser.parse_args()

    if MODEL_PATH.exists() and not args.overwrite:
        raise SystemExit(
            f"\nCheckpoint already exists: {MODEL_PATH}\n"
            "It was not overwritten. Use --overwrite only if intentional."
        )

    random.seed(42)
    np.random.seed(42)
    torch.manual_seed(42)
    torch.set_num_threads(2)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("\n========== DEEPFAKE CNN TRAINING ==========")
    print(f"Device: {device}")
    print(f"Dataset: {DATA_DIR}")
    print(f"Checkpoint destination: {MODEL_PATH}")
    print("Labels: 0 = REAL, 1 = DEEPFAKE")

    train_dataset = DeepfakeDataset("train")
    validation_dataset = DeepfakeDataset("validation")

    train_loader = DataLoader(
        train_dataset,
        batch_size=BATCH_SIZE,
        shuffle=True,
        num_workers=0,
    )
    validation_loader = DataLoader(
        validation_dataset,
        batch_size=BATCH_SIZE,
        shuffle=False,
        num_workers=0,
    )

    model = DeepfakeNet(num_classes=2).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(
        model.parameters(),
        lr=LEARNING_RATE,
    )

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)

    best_validation_loss = float("inf")
    best_validation_accuracy = 0.0
    best_epoch = 0
    start_time = time.time()

    for epoch in range(1, EPOCHS + 1):
        train_loss, train_accuracy = run_epoch(
            model, train_loader, criterion, device, optimizer
        )
        val_loss, val_accuracy = run_epoch(
            model, validation_loader, criterion, device
        )

        print(
            f"Epoch {epoch:02d}/{EPOCHS} | "
            f"Train Loss: {train_loss:.4f} | "
            f"Train Accuracy: {train_accuracy:.2%} | "
            f"Validation Loss: {val_loss:.4f} | "
            f"Validation Accuracy: {val_accuracy:.2%}"
        )

        # Save the checkpoint with the lowest validation loss.
        if val_loss < best_validation_loss:
            best_validation_loss = val_loss
            best_validation_accuracy = val_accuracy
            best_epoch = epoch

            torch.save(
                {
                    "model_state_dict": model.state_dict(),
                    "architecture": "DeepfakeNet",
                    "num_classes": 2,
                    "class_mapping": CLASS_LABELS,
                    "input_size": IMAGE_SIZE,
                    "epoch": epoch,
                    "validation_loss": val_loss,
                    "validation_accuracy": val_accuracy,
                    "optimizer_state_dict": optimizer.state_dict(),
                },
                MODEL_PATH,
            )

    elapsed = time.time() - start_time

    print("\n========== TRAINING COMPLETE ==========")
    print(f"Best checkpoint epoch: {best_epoch}")
    print(f"Best checkpoint validation loss: {best_validation_loss:.4f}")
    print(
        "Validation accuracy at selected checkpoint: "
        f"{best_validation_accuracy:.2%}"
    )
    print(f"Training time: {elapsed:.1f} seconds")
    print(f"Checkpoint saved: {MODEL_PATH}")
    print(
        "\nIMPORTANT: These metrics use a small synthetic dataset. "
        "They do not establish real-world deepfake detection accuracy."
    )


if __name__ == "__main__":
    main()
