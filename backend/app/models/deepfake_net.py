"""
TRUE FACE AI — PyTorch CNN Model for Face Deepfake Detection

Architecture: DeepfakeNet
A multi-scale convolutional neural network trained to detect AI-generated,
manipulated, or synthetic faces (Deepfakes, FaceSwap, GAN/Diffusion outputs).
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class DeepfakeNet(nn.Module):
    """
    Convolutional neural network for binary face deepfake classification.

    Input shape: (Batch, 3, H, W) where default H=W=128
    Output shape: (Batch, 2) corresponding to logits for [REAL, DEEPFAKE]
    """

    def __init__(self, num_classes: int = 2) -> None:
        super().__init__()
        self.num_classes = num_classes

        # Feature extraction blocks with residual-style depth
        self.block1 = nn.Sequential(
            nn.Conv2d(3, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.Conv2d(32, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),  # 128 -> 64
        )

        self.block2 = nn.Sequential(
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.Conv2d(64, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),  # 64 -> 32
        )

        self.block3 = nn.Sequential(
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.Conv2d(128, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2),  # 32 -> 16
        )

        self.block4 = nn.Sequential(
            nn.Conv2d(128, 256, kernel_size=3, padding=1),
            nn.BatchNorm2d(256),
            nn.ReLU(inplace=True),
            nn.AdaptiveAvgPool2d((4, 4)),  # Fixed spatial pooling (4, 4)
        )

        # Classifier head
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(256 * 4 * 4, 512),
            nn.BatchNorm1d(512),
            nn.ReLU(inplace=True),
            nn.Dropout(p=0.5),
            nn.Linear(512, self.num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass.

        Args:
            x: Input tensor of shape (B, 3, H, W).

        Returns:
            Logits tensor of shape (B, 2) where class 0=REAL, class 1=DEEPFAKE.
        """
        x = self.block1(x)
        x = self.block2(x)
        x = self.block3(x)
        x = self.block4(x)
        logits = self.classifier(x)
        return logits

    def predict_proba(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass returning Softmax probabilities.

        Returns:
            Probabilities tensor of shape (B, 2) where col 0=P(REAL), col 1=P(DEEPFAKE).
        """
        logits = self.forward(x)
        return F.softmax(logits, dim=1)
