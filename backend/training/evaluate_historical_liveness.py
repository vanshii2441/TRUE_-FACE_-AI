import os
import sys
from pathlib import Path

import torch
from torch import nn
from torch.utils.data import DataLoader

# Add the repository root and backend directory to Python's import path
PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = PROJECT_ROOT / "backend"

sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(BACKEND_DIR))

from training.train_liveness import evaluate
from app.dataset.liveness_dataset import LivenessDataset
from app.models.liveness_net import LivenessNet

data_root = (
    Path(os.environ["TEMP"])
    / "trueface-old-validation"
    / "data"
    / "liveness"
)

dataset = LivenessDataset(
    root_dir=str(data_root),
    split="validation",
    input_size=128,
)

loader = DataLoader(
    dataset,
    batch_size=16,
    shuffle=False,
    num_workers=0,
)

checkpoint_path = PROJECT_ROOT / "models" / "liveness" / "best_model.pth"
checkpoint = torch.load(
    checkpoint_path,
    map_location="cpu",
    weights_only=True,
)

model = LivenessNet(num_classes=2)
model.load_state_dict(checkpoint["model_state_dict"])

loss, metrics = evaluate(
    model,
    loader,
    nn.CrossEntropyLoss(),
    torch.device("cpu"),
)

print("\nHISTORICAL VALIDATION RESULTS")
print("Images:", len(dataset))
print("Saved checkpoint accuracy:", checkpoint.get("val_accuracy"))
print("Historical dataset accuracy:", metrics["accuracy"])
print("Validation loss:", round(loss, 4))
print("Metrics:", metrics)