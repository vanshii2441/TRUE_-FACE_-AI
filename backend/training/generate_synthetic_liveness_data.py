"""
TRUE FACE AI — Synthetic Liveness Dataset Generator

Generates synthetic real face crops (natural gradients, subtle noise)
and spoof face crops (printed dot patterns, scanline artifacts, moiré noise, specular reflections)
to facilitate model training and integration testing.
"""

import os
import random
import numpy as np
import cv2


def generate_real_face_crop(width: int = 128, height: int = 128) -> np.ndarray:
    """Generate synthetic real face texture with organic skin tone gradient and subtle noise."""
    # Base skin tone in RGB
    skin_colors = [
        (230, 190, 160),
        (210, 160, 130),
        (180, 130, 100),
        (140, 90, 65),
        (90, 55, 35),
    ]
    base_color = random.choice(skin_colors)

    img = np.zeros((height, width, 3), dtype=np.uint8)
    for c in range(3):
        img[:, :, c] = base_color[c]

    # Create radial gradient centered near middle
    cx, cy = width // 2 + random.randint(-10, 10), height // 2 + random.randint(-10, 10)
    y, x = np.ogrid[:height, :width]
    dist_from_center = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    max_dist = np.sqrt((width / 2) ** 2 + (height / 2) ** 2)

    grad = 1.0 - 0.25 * (dist_from_center / max_dist)
    img = (img.astype(np.float32) * grad[:, :, np.newaxis]).clip(0, 255).astype(np.uint8)

    # Subtle gaussian noise (skin texture)
    noise = np.random.normal(0, 3, (height, width, 3))
    img = (img.astype(np.float32) + noise).clip(0, 255).astype(np.uint8)

    return img


def generate_spoof_face_crop(width: int = 128, height: int = 128) -> np.ndarray:
    """Generate synthetic spoof face texture with printed grid lines, scanlines, or moiré reflections."""
    base = generate_real_face_crop(width, height)
    spoof_type = random.choice(["print_mesh", "screen_scanlines", "specular_reflection"])

    if spoof_type == "print_mesh":
        # Print halftone / dot mesh grid
        grid = np.zeros((height, width), dtype=np.float32)
        grid[::4, :] = 0.3
        grid[:, ::4] = 0.3
        base = (base.astype(np.float32) * (1.0 - grid[:, :, np.newaxis])).clip(0, 255).astype(np.uint8)

    elif spoof_type == "screen_scanlines":
        # Horizontal scanlines & color distortion
        scanlines = np.ones((height, width, 3), dtype=np.float32)
        scanlines[::3, :, :] = 0.6
        base = (base.astype(np.float32) * scanlines).clip(0, 255).astype(np.uint8)

    elif spoof_type == "specular_reflection":
        # Screen glare / flash reflection hotspot
        rx, ry = random.randint(20, width - 20), random.randint(20, height - 20)
        y, x = np.ogrid[:height, :width]
        glare = np.exp(-((x - rx) ** 2 + (y - ry) ** 2) / 300.0) * 200
        base = (base.astype(np.float32) + glare[:, :, np.newaxis]).clip(0, 255).astype(np.uint8)

    return base


def create_dataset(output_dir: str = "data/liveness", num_train: int = 100, num_val: int = 30) -> None:
    """Create train and validation splits of synthetic liveness images."""
    splits = {
        "train": (num_train, num_train),
        "validation": (num_val, num_val),
    }

    for split, (n_real, n_spoof) in splits.items():
        real_dir = os.path.join(output_dir, split, "real")
        spoof_dir = os.path.join(output_dir, split, "spoof")
        os.makedirs(real_dir, exist_ok=True)
        os.makedirs(spoof_dir, exist_ok=True)

        for i in range(n_real):
            img = generate_real_face_crop()
            cv2.imwrite(os.path.join(real_dir, f"real_{i:04d}.jpg"), img)

        for i in range(n_spoof):
            img = generate_spoof_face_crop()
            cv2.imwrite(os.path.join(spoof_dir, f"spoof_{i:04d}.jpg"), img)

    print(f"Generated synthetic dataset at '{output_dir}':")
    print(f"   - train: {num_train} real, {num_train} spoof")
    print(f"   - validation: {num_val} real, {num_val} spoof")


if __name__ == "__main__":
    create_dataset()
