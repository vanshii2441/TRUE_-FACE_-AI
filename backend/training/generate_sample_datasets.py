"""
TRUE FACE AI — Master Sample Dataset Generator

Generates high-quality sample datasets for TRUE FACE AI:
1. Sample Face Images (data/samples/) - Sample faces for enrollment & 1:N recognition testing
2. Liveness Detection Dataset (data/liveness/) - Real vs Spoof (printed, screen glare, scanlines)
3. Deepfake Detection Dataset (data/deepfake/) - Real vs Fake (boundary blur, warping, chromatic shift)
"""

import os
import random
import numpy as np
import cv2


def draw_synthetic_face(
    width: int = 224,
    height: int = 224,
    skin_tone: tuple = (220, 180, 150),
    hair_color: tuple = (30, 25, 20),
    eye_color: tuple = (80, 50, 30),
    expression_offset: float = 0.0,
    seed: int = None
) -> np.ndarray:
    """Renders a structured face image with head contour, hair, eyebrows, eyes, nose, lips and lighting."""
    if seed is not None:
        np.random.seed(seed)
        random.seed(seed)

    img = np.full((height, width, 3), (240, 242, 245), dtype=np.uint8)  # Clean background

    cx, cy = width // 2, height // 2
    face_w, face_h = int(width * 0.35), int(height * 0.42)

    # 1. Face contour (Oval)
    cv2.ellipse(img, (cx, cy + 5), (face_w, face_h), 0, 0, 360, skin_tone, -1)

    # Face shading / 3D gradient
    y_grid, x_grid = np.ogrid[:height, :width]
    dist = np.sqrt(((x_grid - cx) / face_w) ** 2 + ((y_grid - cy) / face_h) ** 2)
    mask = (dist <= 1.0).astype(np.float32)
    shading = 1.0 - 0.2 * dist * mask
    img = (img.astype(np.float32) * shading[:, :, np.newaxis]).clip(0, 255).astype(np.uint8)

    # 2. Hair (Top head polygon)
    hair_pts = np.array([
        [cx - face_w - 5, cy - int(face_h * 0.3)],
        [cx - face_w, cy - face_h - 15],
        [cx, cy - face_h - 25],
        [cx + face_w, cy - face_h - 15],
        [cx + face_w + 5, cy - int(face_h * 0.3)],
        [cx + int(face_w * 0.6), cy - int(face_h * 0.5)],
        [cx, cy - int(face_h * 0.6)],
        [cx - int(face_w * 0.6), cy - int(face_h * 0.5)],
    ], np.int32)
    cv2.fillPoly(img, [hair_pts], hair_color)

    # 3. Eyes
    eye_y = cy - int(face_h * 0.15)
    eye_x_off = int(face_w * 0.45)
    eye_r = int(width * 0.05)

    for ex in [cx - eye_x_off, cx + eye_x_off]:
        # Sclera (White)
        cv2.ellipse(img, (ex, eye_y), (eye_r + 2, eye_r - 2), 0, 0, 360, (255, 255, 255), -1)
        # Iris
        cv2.circle(img, (ex, eye_y), int(eye_r * 0.6), eye_color, -1)
        # Pupil
        cv2.circle(img, (ex, eye_y), int(eye_r * 0.3), (10, 10, 10), -1)
        # Highlight reflection
        cv2.circle(img, (ex - 2, eye_y - 2), int(eye_r * 0.15), (255, 255, 255), -1)

    # 4. Eyebrows
    brow_y = eye_y - int(face_h * 0.15)
    cv2.line(img, (cx - eye_x_off - eye_r, brow_y), (cx - eye_x_off + eye_r, brow_y - 2), hair_color, 3)
    cv2.line(img, (cx + eye_x_off - eye_r, brow_y - 2), (cx + eye_x_off + eye_r, brow_y), hair_color, 3)

    # 5. Nose
    nose_top = (cx, eye_y + 5)
    nose_bot = (cx, eye_y + int(face_h * 0.3))
    nose_left = (cx - int(face_w * 0.15), nose_bot[1] + 3)
    nose_right = (cx + int(face_w * 0.15), nose_bot[1] + 3)
    nose_color = (max(0, skin_tone[0] - 30), max(0, skin_tone[1] - 30), max(0, skin_tone[2] - 30))
    cv2.line(img, nose_top, nose_bot, nose_color, 2)
    cv2.line(img, nose_bot, nose_left, nose_color, 2)
    cv2.line(img, nose_bot, nose_right, nose_color, 2)

    # 6. Lips / Mouth
    mouth_y = cy + int(face_h * 0.45)
    mouth_w = int(face_w * 0.4)
    lip_color = (min(255, skin_tone[0] + 40), max(0, skin_tone[1] - 30), max(0, skin_tone[2] - 20))
    cv2.ellipse(img, (cx, mouth_y), (mouth_w, int(8 + expression_offset)), 0, 0, 360, lip_color, -1)

    # Organic skin noise texture
    noise = np.random.normal(0, 2.5, (height, width, 3))
    img = (img.astype(np.float32) + noise).clip(0, 255).astype(np.uint8)

    return img


def generate_spoof_face(base_face: np.ndarray, spoof_type: str = "random") -> np.ndarray:
    """Adds spoof artifacts (printed halftone, screen glare, scanlines) to simulate Presentation Attacks."""
    img = base_face.copy()
    h, w = img.shape[:2]

    if spoof_type == "random":
        spoof_type = random.choice(["print_mesh", "screen_scanline", "glare_reflection"])

    if spoof_type == "print_mesh":
        # Printed paper grid artifact
        grid = np.zeros((h, w), dtype=np.float32)
        grid[::3, :] = 0.25
        grid[:, ::3] = 0.25
        img = (img.astype(np.float32) * (1.0 - grid[:, :, np.newaxis])).clip(0, 255).astype(np.uint8)

        # Paper edge frame blur
        cv2.rectangle(img, (0, 0), (w - 1, h - 1), (180, 180, 180), 4)

    elif spoof_type == "screen_scanline":
        # Display screen horizontal scanlines & moire frequency
        scanlines = np.ones((h, w, 3), dtype=np.float32)
        scanlines[::2, :, :] = 0.7
        img = (img.astype(np.float32) * scanlines).clip(0, 255).astype(np.uint8)

        # Color tint / backlight shift
        img[:, :, 0] = np.clip(img[:, :, 0].astype(np.int16) + 15, 0, 255)

    elif spoof_type == "glare_reflection":
        # Screen glare / flash hotspot
        gx, gy = random.randint(int(w * 0.2), int(w * 0.8)), random.randint(int(h * 0.2), int(h * 0.8))
        y, x = np.ogrid[:h, :w]
        glare = np.exp(-((x - gx) ** 2 + (y - gy) ** 2) / 400.0) * 180
        img = (img.astype(np.float32) + glare[:, :, np.newaxis]).clip(0, 255).astype(np.uint8)

    return img


def generate_deepfake_face(base_face: np.ndarray, fake_type: str = "random") -> np.ndarray:
    """Adds deepfake manipulation artifacts (boundary blur, warping, chromatic shift)."""
    img = base_face.copy()
    h, w = img.shape[:2]

    if fake_type == "random":
        fake_type = random.choice(["boundary_blur", "chromatic_shift", "warping"])

    if fake_type == "boundary_blur":
        # Face swap boundary ring blur
        mask = np.zeros((h, w), dtype=np.float32)
        cv2.ellipse(mask, (w // 2, h // 2), (w // 3, h // 3), 0, 0, 360, 1.0, -1)
        mask = cv2.GaussianBlur(mask, (25, 25), 0)

        fake_center = cv2.applyColorMap(img, cv2.COLORMAP_COOL)
        img = (img.astype(np.float32) * (1.0 - mask[:, :, np.newaxis]) +
               fake_center.astype(np.float32) * mask[:, :, np.newaxis]).clip(0, 255).astype(np.uint8)

    elif fake_type == "chromatic_shift":
        # Channel misalignment (DeepFake neural texture artifact)
        b, g, r = cv2.split(img)
        r_shift = np.roll(r, shift=6, axis=1)
        b_shift = np.roll(b, shift=-6, axis=0)
        img = cv2.merge([b_shift, g, r_shift])

    elif fake_type == "warping":
        # Periodic wave spatial warping
        y, x = np.ogrid[:h, :w]
        wave = (np.sin(x / 8.0) * 12.0).astype(np.float32)
        grid = np.repeat(wave[:, :, np.newaxis], 3, axis=2)
        img = (img.astype(np.float32) + grid).clip(0, 255).astype(np.uint8)

    return img


def generate_all_datasets(base_dir: str = "data") -> None:
    """Generates complete sample datasets for TRUE FACE AI."""
    print("[+] Generating TRUE FACE AI Sample Datasets...")

    # 1. Sample Face Profiles for Enrollment & Recognition
    samples_dir = os.path.join(base_dir, "samples")
    os.makedirs(samples_dir, exist_ok=True)

    people = [
        {"name": "alice", "skin": (225, 185, 155), "hair": (40, 30, 20), "eye": (70, 45, 25)},
        {"name": "bob", "skin": (195, 145, 115), "hair": (20, 20, 20), "eye": (40, 30, 20)},
        {"name": "charlie", "skin": (160, 110, 80), "hair": (15, 15, 15), "eye": (30, 20, 10)},
        {"name": "david", "skin": (235, 195, 165), "hair": (100, 60, 30), "eye": (50, 80, 110)},
        {"name": "eva", "skin": (130, 85, 55), "hair": (25, 25, 25), "eye": (35, 25, 15)},
    ]

    for p in people:
        person_dir = os.path.join(samples_dir, p["name"])
        os.makedirs(person_dir, exist_ok=True)
        for i in range(3):
            face = draw_synthetic_face(
                width=224, height=224,
                skin_tone=p["skin"], hair_color=p["hair"], eye_color=p["eye"],
                expression_offset=i * 2.0, seed=100 + i
            )
            cv2.imwrite(os.path.join(person_dir, f"sample_{i+1}.jpg"), face)

    print(f"  [+] Enrolled Sample Profiles created at '{samples_dir}' (5 persons x 3 images)")

    # 2. Liveness Detection Dataset
    liveness_dir = os.path.join(base_dir, "liveness")
    splits = {"train": 40, "validation": 10}
    for split, count in splits.items():
        r_dir = os.path.join(liveness_dir, split, "real")
        s_dir = os.path.join(liveness_dir, split, "spoof")
        os.makedirs(r_dir, exist_ok=True)
        os.makedirs(s_dir, exist_ok=True)

        for idx in range(count):
            skin = random.choice([(220, 180, 150), (190, 140, 110), (150, 100, 70)])
            real_img = draw_synthetic_face(width=128, height=128, skin_tone=skin)
            spoof_img = generate_spoof_face(real_img)

            cv2.imwrite(os.path.join(r_dir, f"real_{idx:04d}.jpg"), real_img)
            cv2.imwrite(os.path.join(s_dir, f"spoof_{idx:04d}.jpg"), spoof_img)

    print(f"  [+] Liveness Dataset created at '{liveness_dir}' (Train: 40 real/spoof, Val: 10 real/spoof)")

    # 3. Deepfake Detection Dataset
    deepfake_dir = os.path.join(base_dir, "deepfake")
    for split, count in splits.items():
        r_dir = os.path.join(deepfake_dir, split, "real")
        f_dir = os.path.join(deepfake_dir, split, "fake")
        os.makedirs(r_dir, exist_ok=True)
        os.makedirs(f_dir, exist_ok=True)

        for idx in range(count):
            skin = random.choice([(225, 185, 155), (195, 145, 115), (160, 110, 80)])
            real_img = draw_synthetic_face(width=224, height=224, skin_tone=skin)
            fake_img = generate_deepfake_face(real_img)

            cv2.imwrite(os.path.join(r_dir, f"real_{idx:04d}.jpg"), real_img)
            cv2.imwrite(os.path.join(f_dir, f"fake_{idx:04d}.jpg"), fake_img)

    print(f"  [+] Deepfake Dataset created at '{deepfake_dir}' (Train: 40 real/fake, Val: 10 real/fake)")
    print("[+] Dataset generation complete!")


if __name__ == "__main__":
    generate_all_datasets()
