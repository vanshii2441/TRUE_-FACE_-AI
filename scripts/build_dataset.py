"""Build the training dataset in data/ from the bundled real LFW subset.

Layout produced (all 64x64 grayscale PNGs; file names start with the source id,
which the trainer uses to keep one face's variants on the same side of the split):

    data/real/       real faces (natural lighting / shift / noise variations)
    data/nonface/    real non-face patches from the same LFW subset
    data/spoof/      simulated print and screen-replay attacks of the real faces
    data/deepfake/   simulated face-swap / smoothing / warp manipulations

Use your own data by replacing the folders with real images (same layout).

    python scripts/build_dataset.py [--variants 4] [--seed 7]
"""
import argparse
import shutil
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend import synth  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--variants", type=int, default=4)
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    rng = np.random.default_rng(args.seed)
    raw = np.load(ROOT / "backend" / "assets" / "lfw_subset.npy")
    base = [cv2.resize((a * 255).astype(np.uint8), (synth.SIZE, synth.SIZE),
                       interpolation=cv2.INTER_CUBIC) for a in raw]
    faces, nonfaces = base[:100], base[100:]

    out = ROOT / "data"
    for name in ("real", "nonface", "spoof", "deepfake"):
        shutil.rmtree(out / name, ignore_errors=True)
        (out / name).mkdir(parents=True, exist_ok=True)

    def save(folder, stem, img):
        cv2.imwrite(str(out / folder / f"{stem}.png"), img)

    for i, face in enumerate(faces):
        for v in range(args.variants):
            stem = f"f{i:03d}_v{v}"
            save("real", stem, synth.augment_real(face, rng))
            save("spoof", stem, synth.augment_real(synth.simulate_spoof(face, rng), rng))
            donor = faces[int(rng.choice([j for j in range(len(faces)) if j != i]))]
            save("deepfake", stem, synth.augment_real(synth.simulate_deepfake(face, donor, rng), rng))
    for i, patch in enumerate(nonfaces):
        for v in range(args.variants):
            save("nonface", f"n{i:03d}_v{v}", synth.augment_real(patch, rng))

    counts = {p.name: len(list(p.glob("*.png"))) for p in out.iterdir() if p.is_dir()}
    print("Dataset written to", out, counts)


if __name__ == "__main__":
    main()
