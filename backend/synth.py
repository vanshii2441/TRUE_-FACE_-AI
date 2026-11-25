"""Synthetic presentation-attack and manipulation generators.

No public spoof/deepfake dataset can be downloaded in this build environment, so
attack samples are *simulated* from real LFW faces. They approximate:

* print attacks  - low contrast, lifted blacks, blur, halftone-like texture
* screen replays - gamma shift, moire banding, scan-lines, diagonal glare
* face swaps     - a donor face blended in with a feathered mask and tone mismatch
* over-smoothed  - GAN-style skin smoothing inside the face region
* warped faces   - local geometric distortion of the inner face

These are proxies for experimentation, not a substitute for real attack data.
For production, drop real data into data/spoof and data/deepfake (see README).
"""
import cv2
import numpy as np

SIZE = 64


def _clip(img):
    return np.clip(img, 0, 255).astype(np.uint8)


def augment_real(img: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Natural capture variation: lighting, small shifts, sensor noise, mirroring."""
    out = img.astype(np.float32)
    if rng.random() < 0.5:
        out = out[:, ::-1]
    gamma = rng.uniform(0.8, 1.25)
    out = 255 * (out / 255) ** gamma
    out = (out - 128) * rng.uniform(0.85, 1.2) + 128 + rng.uniform(-18, 18)
    tx, ty = rng.uniform(-2.5, 2.5, 2)
    m = np.float32([[1, 0, tx], [0, 1, ty]])
    out = cv2.warpAffine(out, m, (SIZE, SIZE), borderMode=cv2.BORDER_REFLECT)
    if rng.random() < 0.4:
        out = cv2.GaussianBlur(out, (0, 0), rng.uniform(0.3, 0.8))
    out = out + rng.normal(0, rng.uniform(0, 3.5), out.shape)
    return _clip(out)


def simulate_print(img: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    out = img.astype(np.float32)
    out = (out - 128) * rng.uniform(0.55, 0.8) + 128 + rng.uniform(5, 30)   # flat, lifted blacks
    out = cv2.GaussianBlur(out, (0, 0), rng.uniform(0.9, 1.6))
    period = rng.uniform(2.2, 3.6)                                          # halftone texture
    yy, xx = np.indices(out.shape)
    dots = np.sin(2 * np.pi * xx / period) * np.sin(2 * np.pi * yy / period)
    out += dots * rng.uniform(2, 6)
    out += rng.normal(0, rng.uniform(1.5, 4), out.shape)
    return _clip(out)


def simulate_screen(img: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    out = img.astype(np.float32)
    out = 255 * (out / 255) ** rng.uniform(0.6, 0.85)                       # backlit gamma
    yy, xx = np.indices(out.shape)
    ang = rng.uniform(0, np.pi)
    freq = rng.uniform(0.35, 0.75)                                          # moire banding
    out += np.sin(freq * (xx * np.cos(ang) + yy * np.sin(ang))) * rng.uniform(6, 16)
    out[:: int(rng.integers(3, 5))] *= rng.uniform(0.86, 0.95)              # scan-lines
    glare = np.clip(1 - np.abs((xx + yy) / (2 * SIZE) - rng.uniform(0.2, 0.8)) * 3.2, 0, 1)
    out += glare * rng.uniform(25, 70)                                      # diagonal glare
    out = cv2.GaussianBlur(out, (0, 0), rng.uniform(0.5, 1.1))
    return _clip(out)


def simulate_spoof(img: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    kind = simulate_print if rng.random() < 0.5 else simulate_screen
    return kind(img, rng)


def _feather_mask(rng: np.random.Generator) -> np.ndarray:
    mask = np.zeros((SIZE, SIZE), np.float32)
    c = (int(SIZE * rng.uniform(0.46, 0.54)), int(SIZE * rng.uniform(0.48, 0.58)))
    axes = (int(SIZE * rng.uniform(0.24, 0.34)), int(SIZE * rng.uniform(0.30, 0.40)))
    cv2.ellipse(mask, c, axes, 0, 0, 360, 1.0, -1)
    return cv2.GaussianBlur(mask, (0, 0), rng.uniform(1.5, 3.5))


def simulate_deepfake(img: np.ndarray, donor: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    mask = _feather_mask(rng)
    base = img.astype(np.float32)
    mode = rng.choice(["swap", "smooth", "warp", "swap"])
    if mode == "swap":
        d = donor.astype(np.float32)
        d = d + (base[mask > 0.5].mean() - d[mask > 0.5].mean()) * rng.uniform(0.0, 0.9)
        d = cv2.GaussianBlur(d, (0, 0), rng.uniform(0.4, 1.1))
        out = base * (1 - mask) + d * mask
    elif mode == "smooth":
        sm = cv2.bilateralFilter(base, 7, 40, 7)
        sm = cv2.GaussianBlur(sm, (0, 0), rng.uniform(1.0, 1.8))
        out = base * (1 - mask) + sm * mask
    else:
        yy, xx = np.indices(base.shape, dtype=np.float32)
        amp, f = rng.uniform(1.2, 2.6), rng.uniform(0.12, 0.25)
        map_x = xx + (amp * np.sin(f * yy + rng.uniform(0, 6)) * mask)
        map_y = yy + (amp * np.cos(f * xx + rng.uniform(0, 6)) * mask)
        out = cv2.remap(base, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    return _clip(out)
