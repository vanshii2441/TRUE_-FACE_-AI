"""
TRUE FACE AI — 1:N Face Recognition CLI Demo

Usage:
    python demo_recognize.py --image path/to/query.jpg [--top-k 5] [--threshold 0.6]
"""

import argparse
import sys
import time
import cv2

from app.services.face_detector import get_face_detector
from app.services.face_embedding import get_face_embedder
from app.services.vector_store import get_vector_store


def main():
    parser = argparse.ArgumentParser(description="Perform 1:N face recognition search using FAISS.")
    parser.add_argument("--image", required=True, help="Path to query image file containing face")
    parser.add_argument("--top-k", type=int, default=5, help="Top K candidates to retrieve")
    parser.add_argument("--threshold", type=float, default=0.60, help="Match threshold (0.0 to 1.0)")
    args = parser.parse_args()

    print("\n🛡️ TRUE FACE AI — 1:N Face Recognition Search")
    print(f"📷 Query Image: {args.image}")
    print(f"⚙️ Config: top_k={args.top_k}, threshold={args.threshold:.2f}\n")

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
        print("❌ Result: NO_FACE_DETECTED — No faces found in query image.")
        sys.exit(0)

    print(f"   ✓ Detected {len(detections)} face(s) [{det_ms:.1f} ms]")
    face_crop = detections[0]["crop"]

    # 2. Embedding
    print("2️⃣ Extracting 512d facial embedding...")
    t0 = time.perf_counter()
    embedder = get_face_embedder()
    query_vec = embedder.generate_embedding(face_crop)
    t1 = time.perf_counter()
    emb_ms = (t1 - t0) * 1000.0
    print(f"   ✓ Extracted 512d query vector [{emb_ms:.1f} ms]")

    # 3. FAISS 1:N Search
    print("3️⃣ Executing 1:N vector search in FAISS...")
    t0 = time.perf_counter()
    vector_store = get_vector_store()
    candidates = vector_store.search(
        query_embedding=query_vec,
        top_k=args.top_k,
        threshold=args.threshold,
    )
    t1 = time.perf_counter()
    srch_ms = (t1 - t0) * 1000.0

    total_ms = (time.perf_counter() - t_start) * 1000.0

    print(f"   ✓ Search completed [{srch_ms:.1f} ms]\n")

    # Output Results
    print("=" * 60)
    if candidates and candidates[0]["is_match"]:
        best = candidates[0]
        print(f"🟢 AUTHENTICATION DECISION: MATCH (AUTHENTICATED)")
        print(f"   - Identified User: {best['name']} ({best['user_id']})")
        print(f"   - Similarity:      {best['similarity']:.4f} (Threshold: {args.threshold:.2f})")
    else:
        print(f"🔴 AUTHENTICATION DECISION: NO MATCH (UNKNOWN USER)")
        if candidates:
            print(f"   - Best Candidate:   {candidates[0]['name']} ({candidates[0]['user_id']})")
            print(f"   - Best Similarity: {candidates[0]['similarity']:.4f} (Below threshold {args.threshold:.2f})")
        else:
            print("   - Vector Database is empty (no enrolled users).")

    print("-" * 60)
    print("Top Candidates:")
    for i, cand in enumerate(candidates, 1):
        match_tag = " [MATCH]" if cand["is_match"] else ""
        print(f"  {i}. {cand['name']:<20} ({cand['user_id']:<8}) │ Score: {cand['similarity']:.4f}{match_tag}")

    print("=" * 60)
    print(f"Latency Breakdown: Detection {det_ms:.1f}ms │ Embedding {emb_ms:.1f}ms │ FAISS {srch_ms:.1f}ms │ Total {total_ms:.1f}ms\n")


if __name__ == "__main__":
    main()
