#!/usr/bin/env python3
"""Build the 烟雨江南 scene assets from the approved workbench prototype.

The prototype is a flattened 1487x1058 mock-up with the window controls, the
payment summary and the Dock painted into it. This script removes that UI,
then derives the four runtime assets:

  scene.webp           UI-free still, 2x upscaled, used by the workbench
  scene-business.webp  small pre-blurred backdrop for the business pages
  scene-frost.webp     tiny, heavily blurred still painted inside frosted panels
  scene-masks.webp     R = water depth weight, G = willow sway weight

Usage (from frontend/):
  python3 scripts/build-jiangnan-scene.py

Requires Pillow, NumPy and SciPy. Re-run only when the prototype changes; the
outputs are committed.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage, sparse
from scipy.sparse.linalg import spsolve

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "docs/prototypes/01-workbench.png"
OUTPUT = ROOT / "frontend/src/assets/jiangnan"

# Painted-in UI, in source pixels: (left, top, right, bottom, corner radius).
WINDOW_CONTROLS = (2, 2, 72, 32, 8)
SUMMARY_PILL = (530, 758, 956, 894, 68)
DOCK = (386, 898, 1102, 1034, 68)

# Where the water meets stone or bank, left to right, in source pixels.
WATERLINE = [(0, 672), (318, 646), (600, 634), (800, 626), (1000, 621), (1487, 618)]


def rounded_mask(size: tuple[int, int], box: tuple[int, int, int, int, int]) -> np.ndarray:
    mask = Image.new("L", size, 0)
    left, top, right, bottom, radius = box
    ImageDraw.Draw(mask).rounded_rectangle((left, top, right, bottom), radius=radius, fill=255)
    return np.asarray(mask) > 0


def harmonic_fill(image: np.ndarray, hole: np.ndarray) -> np.ndarray:
    """Solve Laplace's equation inside the hole so its tone follows the surrounding pixels."""
    height, width = hole.shape
    index = -np.ones(hole.shape, dtype=np.int64)
    ys, xs = np.nonzero(hole)
    index[ys, xs] = np.arange(len(ys))

    rows, cols, values = [], [], []
    rhs = np.zeros((len(ys), image.shape[2]))
    for row, (y, x) in enumerate(zip(ys, xs)):
        neighbours = 0
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if not (0 <= ny < height and 0 <= nx < width):
                continue
            neighbours += 1
            if hole[ny, nx]:
                rows.append(row)
                cols.append(index[ny, nx])
                values.append(-1.0)
            else:
                rhs[row] += image[ny, nx]
        rows.append(row)
        cols.append(row)
        values.append(float(neighbours))

    system = sparse.csr_matrix((values, (rows, cols)), shape=(len(ys), len(ys)))
    filled = image.copy()
    for channel in range(image.shape[2]):
        filled[ys, xs, channel] = spsolve(system, rhs[:, channel])
    return filled


def water_texture(image: np.ndarray, box: tuple[int, int, int, int, int]) -> np.ndarray:
    """Borrow ripple detail from the water either side of a hole, mirrored inwards."""
    left, top, right, bottom, _ = box
    half = (right - left + 1) // 2
    detail = image - ndimage.gaussian_filter(image, sigma=(9, 9, 0))

    from_left = detail[top:bottom, left - half : left][:, ::-1]
    from_right = detail[top:bottom, right : right + half][:, ::-1]
    width = right - left
    patch = np.zeros((bottom - top, width, image.shape[2]))
    patch[:, : from_left.shape[1]] = from_left
    patch[:, width - from_right.shape[1] :] = from_right

    # Cross-fade the two mirrored halves where they meet.
    seam = 48
    centre = width // 2
    ramp = np.clip((np.arange(width) - (centre - seam / 2)) / seam, 0, 1)[None, :, None]
    left_full = np.zeros_like(patch)
    right_full = np.zeros_like(patch)
    left_full[:, : from_left.shape[1]] = from_left
    left_full[:, from_left.shape[1] :] = from_left[:, : width - from_left.shape[1]][:, ::-1]
    right_full[:, width - from_right.shape[1] :] = from_right
    right_full[:, : width - from_right.shape[1]] = from_right[:, -(width - from_right.shape[1]) :][
        :, ::-1
    ]
    patch = left_full * (1 - ramp) + right_full * ramp

    texture = np.zeros_like(image)
    texture[top:bottom, left:right] = patch
    return texture


def remove_ui(image: np.ndarray) -> np.ndarray:
    size = (image.shape[1], image.shape[0])
    result = image.copy()

    controls = rounded_mask(size, WINDOW_CONTROLS)
    result = harmonic_fill(result, controls)

    for box in (SUMMARY_PILL, DOCK):
        hole = rounded_mask(size, box)
        texture = water_texture(image, box)
        result = harmonic_fill(result, hole)
        feather = ndimage.gaussian_filter(hole.astype(float), sigma=3)[..., None]
        result += texture * feather * hole[..., None]

    return np.clip(result, 0, 255)


def waterline_at(xs: np.ndarray) -> np.ndarray:
    points = np.asarray(WATERLINE, dtype=float)
    return np.interp(xs, points[:, 0], points[:, 1])


def build_masks(image: np.ndarray) -> Image.Image:
    height, width, _ = image.shape
    ys, xs = np.mgrid[0:height, 0:width].astype(float)
    red, blue = image[..., 0], image[..., 2]

    # Leaves are warmer than fog or water, so red-minus-blue isolates them.
    leaf = np.clip((red - blue - 5) / 16, 0, 1)

    depth = np.clip((ys - waterline_at(xs)) / 70, 0, 1)
    hanging = ndimage.gaussian_filter(leaf * (xs > 980), sigma=4)
    water = depth * (1 - np.clip(hanging * 2.2, 0, 1))

    # The willow fills the upper right; twigs barely move near the boughs and swing at the tips.
    reach = np.clip((xs - 820) / 160, 0, 1) * np.clip((760 - ys) / 80, 0, 1)
    droop = np.clip((ys - 40) / 520, 0, 1) ** 1.3
    bank_shrubs = (ys > 520) & (xs < 1050)
    willow = ndimage.gaussian_filter(leaf * reach * ~bank_shrubs, sigma=5)
    willow = np.clip(willow * 2.4, 0, 1) * droop

    masks = np.zeros((height, width, 3), dtype=np.uint8)
    masks[..., 0] = np.round(water * 255)
    masks[..., 1] = np.round(willow * 255)
    half = (width // 2, height // 2)
    return Image.fromarray(masks).resize(half, Image.LANCZOS)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    source = np.asarray(Image.open(SOURCE).convert("RGB")).astype(float)
    clean = remove_ui(source)
    still = Image.fromarray(np.round(clean).astype(np.uint8))

    scene = still.resize((still.width * 2, still.height * 2), Image.LANCZOS)
    scene = scene.filter(ImageFilter.UnsharpMask(radius=1.6, percent=45, threshold=2))
    scene.save(OUTPUT / "scene.webp", "WEBP", quality=80, method=6)

    business = still.resize((1280, round(1280 * still.height / still.width)), Image.LANCZOS)
    business = business.filter(ImageFilter.GaussianBlur(2.2))
    business.save(OUTPUT / "scene-business.webp", "WEBP", quality=72, method=6)

    # Frosted panels show this at the same crop as the sharp still instead of blurring live.
    # 320 px wide with a 5 px blur reads as a 24 px blur once it is stretched over a window.
    frost = still.resize((320, round(320 * still.height / still.width)), Image.LANCZOS)
    frost = frost.filter(ImageFilter.GaussianBlur(5))
    frost.save(OUTPUT / "scene-frost.webp", "WEBP", quality=70, method=6)

    build_masks(clean).save(OUTPUT / "scene-masks.webp", "WEBP", lossless=True, method=6)

    for name in ("scene.webp", "scene-business.webp", "scene-frost.webp", "scene-masks.webp"):
        print(f"{name}: {(OUTPUT / name).stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
