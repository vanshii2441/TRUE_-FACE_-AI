"""
TRUE FACE AI — Liveness Dataset Pipeline

PyTorch Dataset loader for training, validation, and evaluation of passive liveness models.
Supports standard directory layout:
    data/liveness/
    ├── train/
    │   ├── real/
    │   └── spoof/
    ├── validation/
    │   ├── real/
    │   └── spoof/
    └── test/
        ├── real/
        └── spoof/
"""

import os
import logging
from typing import Callable, Tuple
from PIL import Image
import torch
from torch.utils.data import Dataset
from torchvision import transforms

logger = logging.getLogger(__name__)

# Class labels mapping
CLASS_MAP = {"real": 0, "spoof": 1}
LABEL_MAP = {0: "REAL", 1: "SPOOF"}


def get_default_transforms(
    input_size: int = 128,
    is_train: bool = True,
) -> transforms.Compose:
    """
    Get image preprocessing & augmentation transforms.

    Args:
        input_size: Image target height and width.
        is_train: Apply data augmentations (flips, color jitter, rotation) if True.

    Returns:
        torchvision transforms Pipeline
    """
    if is_train:
        return transforms.Compose([
            transforms.Resize((input_size, input_size)),
            transforms.RandomHorizontalFlip(p=0.5),
            transforms.RandomRotation(degrees=15),
            transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
    else:
        return transforms.Compose([
            transforms.Resize((input_size, input_size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])


class LivenessDataset(Dataset):
    """
    PyTorch Dataset for face liveness classification.
    Loads images from a split directory (e.g. data/liveness/train).
    """

    SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

    def __init__(
        self,
        root_dir: str,
        split: str = "train",
        input_size: int = 128,
        transform: Callable | None = None,
    ) -> None:
        """
        Initialize LivenessDataset.

        Args:
            root_dir: Root directory containing split subdirectories or path directly to split.
            split: One of 'train', 'validation', 'test'.
            input_size: Target image square dimension.
            transform: Optional custom torchvision transform.
        """
        self.root_dir = root_dir
        self.split = split.lower()
        self.input_size = input_size

        # Determine target directory
        if os.path.exists(os.path.join(root_dir, self.split)):
            self.split_dir = os.path.join(root_dir, self.split)
        else:
            self.split_dir = root_dir

        self.transform = transform or get_default_transforms(
            input_size=self.input_size,
            is_train=(self.split == "train"),
        )

        self.samples: list[Tuple[str, int]] = []
        self._load_samples()

    def _load_samples(self) -> None:
        """Scan split directory for real and spoof image files."""
        if not os.path.exists(self.split_dir):
            logger.warning("Liveness dataset directory does not exist: %s", self.split_dir)
            return

        for class_name, label in CLASS_MAP.items():
            class_dir = os.path.join(self.split_dir, class_name)
            if not os.path.isdir(class_dir):
                continue

            for entry in os.scandir(class_dir):
                if entry.is_file():
                    ext = os.path.splitext(entry.name)[1].lower()
                    if ext in self.SUPPORTED_EXTENSIONS:
                        self.samples.append((entry.path, label))

        logger.info(
            "LivenessDataset loaded split '%s' from %s: %d sample(s) found.",
            self.split,
            self.split_dir,
            len(self.samples),
        )

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int]:
        img_path, label = self.samples[idx]
        try:
            image = Image.open(img_path).convert("RGB")
        except Exception as e:
            logger.error("Failed to load image %s: %s", img_path, e)
            raise IOError(f"Could not load image at {img_path}: {e}") from e

        if self.transform:
            image = self.transform(image)

        return image, label
