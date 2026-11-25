"""Measure LBPH distances for genuine probes vs impostors to help choose RECOGNITION_MAX_DISTANCE.

Enrols one person (the scikit-image sample portrait) from lightly varied photos, then compares:
  * genuine probes: new variations of that person (lighting, shift, blur, mirror)
  * impostors: the 100 LFW faces from the bundled dataset, upsampled to webcam-like size

    python scripts/calibrate_recognition.py
"""
import sys
import tempfile
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend.face_detector import FaceDetector  # noqa: E402
from backend.recognizer import Recognizer  # noqa: E402


def vary(img, rng):
    out = img.astype(np.float32)
    out = (out - 128) * rng.uniform(0.8, 1.25) + 128 + rng.uniform(-25, 25)
    m = cv2.getRotationMatrix2D((img.shape[1] / 2, img.shape[0] / 2), rng.uniform(-6, 6), rng.uniform(0.94, 1.06))
    out = cv2.warpAffine(out, m, (img.shape[1], img.shape[0]), borderMode=cv2.BORDER_REFLECT)
    if rng.random() < 0.5:
        out = cv2.GaussianBlur(out, (0, 0), rng.uniform(0.5, 1.5))
    out += rng.normal(0, 3, out.shape)
    if rng.random() < 0.3:
        out = out[:, ::-1]
    return np.clip(out, 0, 255).astype(np.uint8)


def main():
    from skimage import data
    rng = np.random.default_rng(1)
    portrait = cv2.cvtColor(data.astronaut(), cv2.COLOR_RGB2BGR)
    det = FaceDetector()
    box = det.detect(portrait)[0]
    face = det.crop(portrait, box, 1.3)

    rec = Recognizer(Path(tempfile.mkdtemp()) / "faces", max_distance=75)
    rec.save_samples(1, [vary(face, rng) for _ in range(5)])

    genuine = [rec.match(vary(face, rng))[1] for _ in range(200)]
    lfw = np.load(ROOT / "backend" / "assets" / "lfw_subset.npy")[:100]
    impostor = []
    for a in lfw:
        big = cv2.resize((a * 255).astype(np.uint8), (125, 125), interpolation=cv2.INTER_CUBIC)
        impostor.append(rec.match(big)[1])

    g, i = np.array(genuine), np.array(impostor)
    print(f"genuine  distance: mean={g.mean():.1f} p95={np.percentile(g, 95):.1f} max={g.max():.1f}")
    print(f"impostor distance: mean={i.mean():.1f} p5={np.percentile(i, 5):.1f} min={i.min():.1f}")
    for t in (50, 60, 70, 75, 80, 90, 100):
        print(f"threshold {t:>3}: genuine accepted {np.mean(g <= t):.1%}, impostors accepted {np.mean(i <= t):.1%}")


if __name__ == "__main__":
    main()
