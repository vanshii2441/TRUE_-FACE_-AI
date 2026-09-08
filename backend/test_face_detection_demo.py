"""
TRUE FACE AI — Face Detection Demo Script

A command-line tool to test face detection on a single image.

Usage:
    python test_face_detection_demo.py --image path/to/photo.jpg
    python test_face_detection_demo.py --image photo.jpg --output result.jpg
    python test_face_detection_demo.py --image photo.jpg --threshold 0.8

The script will:
  1. Load the input image
  2. Run MTCNN face detection
  3. Print detection results to the console
  4. Save an annotated image with bounding boxes drawn
"""

import argparse
import logging
import sys
from pathlib import Path

# Ensure the backend root is on the Python path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.services.face_detector import FaceDetector
from app.services.image_utils import (
    ImageValidationError,
    draw_bounding_boxes,
    load_image_from_path,
    save_image,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)-8s │ %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="TRUE FACE AI — Face Detection Demo",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python test_face_detection_demo.py --image photo.jpg\n"
            "  python test_face_detection_demo.py --image photo.jpg --output result.jpg\n"
            "  python test_face_detection_demo.py --image photo.jpg --threshold 0.8\n"
        ),
    )
    parser.add_argument(
        "--image",
        type=str,
        required=True,
        help="Path to the input image file",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Path to save the annotated output image (default: <input>_detected.<ext>)",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=0.90,
        help="Minimum detection confidence threshold (default: 0.90)",
    )

    args = parser.parse_args()

    # ── Load image ─────────────────────────────────────────────
    image_path = Path(args.image)
    logger.info("Loading image: %s", image_path)

    try:
        image = load_image_from_path(image_path)
    except ImageValidationError as e:
        logger.error("Failed to load image: %s", e)
        sys.exit(1)

    h, w = image.shape[:2]
    logger.info("Image loaded: %dx%d pixels", w, h)

    # ── Detect faces ───────────────────────────────────────────
    logger.info("Initializing face detector (threshold=%.2f)...", args.threshold)
    detector = FaceDetector(confidence_threshold=args.threshold)

    logger.info("Running face detection...")
    detections = detector.detect(image)

    # ── Print results ──────────────────────────────────────────
    print("\n" + "=" * 60)
    print(f"  TRUE FACE AI — Face Detection Results")
    print("=" * 60)
    print(f"  Image:       {image_path.name}")
    print(f"  Dimensions:  {w} x {h}")
    print(f"  Threshold:   {args.threshold:.2f}")
    print(f"  Faces found: {len(detections)}")
    print("-" * 60)

    if not detections:
        print("  No faces detected above the confidence threshold.")
    else:
        for i, det in enumerate(detections, 1):
            x1, y1, x2, y2 = det["bbox"]
            conf = det["confidence"]
            face_w = x2 - x1
            face_h = y2 - y1
            print(
                f"  Face {i}: "
                f"bbox=[{x1}, {y1}, {x2}, {y2}]  "
                f"size={face_w}x{face_h}  "
                f"confidence={conf:.4f}"
            )

    print("=" * 60 + "\n")

    # ── Save annotated image ───────────────────────────────────
    if detections:
        annotated = draw_bounding_boxes(image, detections)

        if args.output:
            output_path = Path(args.output)
        else:
            output_path = image_path.parent / f"{image_path.stem}_detected{image_path.suffix}"

        save_image(annotated, output_path)
        logger.info("Annotated image saved to: %s", output_path)
    else:
        logger.info("No faces to annotate — skipping output image.")


if __name__ == "__main__":
    main()
