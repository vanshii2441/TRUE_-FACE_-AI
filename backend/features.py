"""Hand-built image features for the liveness, deepfake and face-check classifiers.

All features are computed on a 64x64 grayscale face (see utils.normalise_face).
"""
import cv2
import numpy as np
from skimage.feature import hog, local_binary_pattern

_LBP_P, _LBP_R = 8, 1
_LBP_BINS = _LBP_P + 2


def _lbp_hist(gray: np.ndarray, grid: int = 2) -> list:
    lbp = local_binary_pattern(gray, _LBP_P, _LBP_R, method="uniform")
    h, w = lbp.shape
    out = []
    for gy in range(grid):
        for gx in range(grid):
            cell = lbp[gy * h // grid:(gy + 1) * h // grid, gx * w // grid:(gx + 1) * w // grid]
            hist, _ = np.histogram(cell, bins=_LBP_BINS, range=(0, _LBP_BINS))
            out.extend(hist / max(1, hist.sum()))
    return out


def _fft_bands(gray: np.ndarray, bands: int = 6) -> list:
    f = np.fft.fftshift(np.abs(np.fft.fft2(gray.astype(np.float32) - gray.mean())))
    h, w = gray.shape
    yy, xx = np.indices((h, w))
    r = np.hypot(yy - h / 2, xx - w / 2)
    r_max = r.max()
    total = f.sum() + 1e-6
    feats = []
    for i in range(bands):
        mask = (r >= r_max * i / bands) & (r < r_max * (i + 1) / bands)
        feats.append(np.log1p(f[mask].sum() / total * 100))
    return feats


def extract_features(gray64: np.ndarray) -> np.ndarray:
    """Return a 1-D float32 feature vector for a 64x64 uint8 grayscale face."""
    g = gray64.astype(np.float32)
    feats = []

    # Intensity distribution and contrast
    p5, p25, p50, p75, p95 = np.percentile(g, [5, 25, 50, 75, 95])
    hist, _ = np.histogram(gray64, bins=32, range=(0, 256))
    prob = hist / hist.sum()
    entropy = -np.sum(prob[prob > 0] * np.log2(prob[prob > 0]))
    feats += [g.mean(), g.std(), p5, p25, p50, p75, p95, p95 - p5, entropy,
              (g > 240).mean(), (g < 15).mean()]

    # Illumination gradients (glare and flat lighting)
    h, w = g.shape
    feats += [g[:, :w // 2].mean() - g[:, w // 2:].mean(),
              g[:h // 2].mean() - g[h // 2:].mean(),
              g[h // 4:3 * h // 4, w // 4:3 * w // 4].mean() - g.mean()]

    # Sharpness and edge statistics
    lap = cv2.Laplacian(gray64, cv2.CV_32F)
    gx = cv2.Sobel(gray64, cv2.CV_32F, 1, 0)
    gy = cv2.Sobel(gray64, cv2.CV_32F, 0, 1)
    mag = np.hypot(gx, gy)
    feats += [lap.var(), np.abs(lap).mean(), mag.mean(), mag.std(), np.percentile(mag, 95)]

    # Local noise level
    blur = cv2.GaussianBlur(g, (0, 0), 1.2)
    resid = g - blur
    feats += [resid.std(), np.abs(resid).mean()]

    # Left/right symmetry (manipulated faces break it differently from real ones)
    left, right = g[:, :w // 2], np.fliplr(g[:, w - w // 2:])
    feats.append(np.abs(left - right).mean())

    # Local consistency: manipulated regions differ from their surroundings in noise,
    # sharpness and tone. Measured per 4x4 patch plus inner-vs-outer face ratios.
    lap_abs = np.abs(lap)
    grid_noise, grid_sharp, grid_mean = [], [], []
    for gy in range(4):
        for gx in range(4):
            sl = (slice(gy * h // 4, (gy + 1) * h // 4), slice(gx * w // 4, (gx + 1) * w // 4))
            grid_noise.append(resid[sl].std())
            grid_sharp.append(lap_abs[sl].mean())
            grid_mean.append(g[sl].mean())
    feats += grid_noise + grid_sharp
    gm = np.array(grid_mean)
    feats += [np.std(grid_noise), np.std(grid_sharp), np.std(gm)]
    inner = np.zeros((h, w), bool)
    inner[h // 5:4 * h // 5, w // 5:4 * w // 5] = True
    inner_edge = inner & ~cv2.erode(inner.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
    feats += [resid[inner].std() / (resid[~inner].std() + 1e-3),
              lap_abs[inner].mean() / (lap_abs[~inner].mean() + 1e-3),
              g[inner].mean() - g[~inner].mean(),
              mag[inner_edge].mean() / (mag[inner].mean() + 1e-3)]

    # Frequency energy, texture and shape descriptors
    feats += _fft_bands(gray64)
    feats += _lbp_hist(gray64)
    feats += list(hog(gray64, orientations=6, pixels_per_cell=(16, 16), cells_per_block=(1, 1),
                      feature_vector=True))
    return np.asarray(feats, dtype=np.float32)
