import sys
from pathlib import Path

import torch
from torch.utils.data import DataLoader

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_DIR.parent

sys.path.insert(0, str(BACKEND_DIR))

from app.config import settings
from app.dataset.liveness_dataset import (
    LivenessDataset,
    get_default_transforms,
)
from app.models.liveness_net import LivenessNet


def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    data_root = PROJECT_ROOT / "data" / "liveness"
    checkpoint_path = PROJECT_ROOT / settings.liveness_model_path

    if not (data_root / "validation").is_dir():
        raise FileNotFoundError(
            f"Validation folder not found: {data_root / 'validation'}"
        )

    if not checkpoint_path.is_file():
        raise FileNotFoundError(
            f"CNN checkpoint not found: {checkpoint_path}"
        )

    transform = get_default_transforms(
        input_size=settings.liveness_input_size,
        is_train=False,
    )

    dataset = LivenessDataset(
        root_dir=str(data_root),
        split="validation",
        input_size=settings.liveness_input_size,
        transform=transform,
    )

    if len(dataset) == 0:
        raise RuntimeError(f"No validation images found in {data_root}")

    loader = DataLoader(dataset, batch_size=16, shuffle=False)

    model = LivenessNet(num_classes=2).to(device)

    checkpoint = torch.load(
        checkpoint_path,
        map_location=device,
        weights_only=True,
    )

    if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
        model.load_state_dict(checkpoint["model_state_dict"])
    else:
        model.load_state_dict(checkpoint)

    model.eval()

    # Rows = actual class; columns = predicted class
    # Class 0 = REAL, class 1 = SPOOF
    confusion = torch.zeros((2, 2), dtype=torch.int64)
    confusion_argmax = torch.zeros((2, 2), dtype=torch.int64)

    threshold = settings.liveness_threshold

    with torch.no_grad():
        for images, labels in loader:
            images = images.to(device)
            labels = labels.long().cpu()

            probabilities = torch.softmax(model(images), dim=1)
            real_scores = probabilities[:, 0].cpu()

            # Same threshold rule as the liveness detector
            predictions = (real_scores < threshold).long()
            argmax_predictions = probabilities.argmax(dim=1).cpu()

            for actual, predicted, argmax_pred in zip(
                labels, predictions, argmax_predictions
            ):
                confusion[int(actual), int(predicted)] += 1
                confusion_argmax[int(actual), int(argmax_pred)] += 1

    real_correct = int(confusion[0, 0])
    real_rejected = int(confusion[0, 1])
    spoof_accepted = int(confusion[1, 0])
    spoof_correct = int(confusion[1, 1])

    total = int(confusion.sum())
    accuracy = (real_correct + spoof_correct) / total

    real_precision = (
        real_correct / (real_correct + spoof_accepted)
        if real_correct + spoof_accepted else 0.0
    )
    real_recall = (
        real_correct / (real_correct + real_rejected)
        if real_correct + real_rejected else 0.0
    )
    spoof_precision = (
        spoof_correct / (spoof_correct + real_rejected)
        if spoof_correct + real_rejected else 0.0
    )
    spoof_recall = (
        spoof_correct / (spoof_correct + spoof_accepted)
        if spoof_correct + spoof_accepted else 0.0
    )

    far = (
        spoof_accepted / (spoof_accepted + spoof_correct)
        if spoof_accepted + spoof_correct else 0.0
    )
    frr = (
        real_rejected / (real_correct + real_rejected)
        if real_correct + real_rejected else 0.0
    )

    print("\n========== LIVENESS CNN EVALUATION ==========")
    print(f"Checkpoint: {checkpoint_path}")
    print(f"Device: {device}")
    print(f"Validation images: {total}")
    print(f"Threshold: {threshold:.2f}")

    print("\nConfusion Matrix")
    print("                 Predicted REAL  Predicted SPOOF")
    print(f"Actual REAL          {real_correct:5d}           {real_rejected:5d}")
    print(f"Actual SPOOF         {spoof_accepted:5d}           {spoof_correct:5d}")
    
    print("\nTraining-style argmax evaluation")
    print("                 Predicted REAL  Predicted SPOOF")
    print(
       f"Actual REAL          {int(confusion_argmax[0, 0]):5d}"
       f"           {int(confusion_argmax[0, 1]):5d}"
    )
    print(
       f"Actual SPOOF         {int(confusion_argmax[1, 0]):5d}"
       f"           {int(confusion_argmax[1, 1]):5d}"
    )
    argmax_accuracy = (
       int(confusion_argmax[0, 0] + confusion_argmax[1, 1]) / total
    )
    print(f"Argmax accuracy: {argmax_accuracy:.4f} ({argmax_accuracy * 100:.2f}%)")    

    print("\nMetrics")
    print(f"Accuracy:        {accuracy:.4f} ({accuracy * 100:.2f}%)")
    print(f"REAL precision:  {real_precision:.4f}")
    print(f"REAL recall:     {real_recall:.4f}")
    print(f"SPOOF precision: {spoof_precision:.4f}")
    print(f"SPOOF recall:    {spoof_recall:.4f}")
    print(f"FAR:             {far:.4f} ({far * 100:.2f}%)")
    print(f"FRR:             {frr:.4f} ({frr * 100:.2f}%)")

    print("\nNote: Validation results do not guarantee real-world performance.")


if __name__ == "__main__":
    main()
