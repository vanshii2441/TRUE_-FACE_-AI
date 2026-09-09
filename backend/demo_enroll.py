"""
TRUE FACE AI — Face Enrollment CLI Demo

Usage:
    python demo_enroll.py --user-id USR001 --name "Alice Smith" --image path/to/photo.jpg
"""

import argparse
import sys
import time
import cv2

from app.services.face_detector import get_face_detector
from app.services.face_embedding import get_face_embedder
from app.services.vector_store import get_vector_store


def main():
    parser = argparse.ArgumentParser(description="Enroll a user face into TRUE FACE AI database.")
    parser.add_argument("--user-id", required=True, help="Unique string identifier for the user")
    parser.add_argument("--name", required=True, help="Full display name of the user")
    parser.add_argument("--image", required=True, help="Path to input image file containing face")
    args = parser.parse_args()

    print(f"\n🛡️ TRUE FACE AI — Enrolling User [{args.user_id}: {args.name}]")
    print(f"📷 Image Path: {args.image}\n")

    t_start = time.perf_counter()

    # Load image
    img_bgr = cv2.imread(args.image)
    if img_bgr is None:
        print(f"❌ Error: Could not read image file '{args.image}'")
        sys.exit(1)

    # 1. Detection
    print("1️⃣ Detecting face (MTCNN)...")
    t0 = time.perf_counter()
    detector = get_face_detector()
    detections = detector.detect_and_crop(img_bgr)
    t1 = time.perf_counter()
    det_ms = (t1 - t0) * 1000.0

    if len(detections) == 0:
        print("❌ Error: No face detected in image.")
        sys.exit(1)
    if len(detections) > 1:
        print(f"❌ Error: Multiple faces ({len(detections)}) detected. Image must contain exactly 1 face.")
        sys.exit(1)

    det = detections[0]
    face_crop = det["crop"]
    print(f"   ✓ Face detected (confidence: {det['confidence']:.4f}, bbox: {det['bbox']}) [{det_ms:.1f} ms]")

    # 2. Embedding
    print("2️⃣ Generating facial embedding (InceptionResnetV1 / 512d)...")
    t0 = time.perf_counter()
    embedder = get_face_embedder()
    vec = embedder.generate_embedding(face_crop)
    t1 = time.perf_counter()
    emb_ms = (t1 - t0) * 1000.0
    print(f"   ✓ Generated L2-normalized {vec.shape[0]}-d vector [{emb_ms:.1f} ms]")

    # 3. Vector Database Indexing
    print("3️⃣ Indexing vector into FAISS database...")
    t0 = time.perf_counter()
    vector_store = get_vector_store()
    faiss_id = vector_store.add_face(
        user_id=args.user_id,
        name=args.name,
        embedding=vec,
    )
    t1 = time.perf_counter()
    idx_ms = (t1 - t0) * 1000.0
    print(f"   ✓ Indexed vector into FAISS at internal ID {faiss_id} [{idx_ms:.1f} ms]")

    total_ms = (time.perf_counter() - t_start) * 1000.0

    print("\n✅ Enrollment Complete!")
    print(f"   - User ID:      {args.user_id}")
    print(f"   - Name:         {args.name}")
    print(f"   - FAISS ID:     {faiss_id}")
    print(f"   - Total Count:  {vector_store.count()} enrolled faces")
    print(f"   - Total Latency: {total_ms:.1f} ms\n")


if __name__ == "__main__":
    main()
