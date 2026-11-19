#!/usr/bin/env python3
"""Cut the card artwork for the sign-in and not-found pages out of their prototypes.

Both prototypes paint a plum sprig in the card's top-right corner and a range of ink-wash
hills along its bottom edge, straight onto the frosted glass. There are no layered sources,
so this script lifts each piece off the (nearly flat) glass as an image with an alpha
channel:

  card-plum.webp   the plum sprig, from 06-login.png
  card-hills.webp  the hills, from 07-404.png

Alpha comes from how far a pixel is from the glass colour around it; colour is un-blended
from that glass so the pieces sit on any pane, including the 夜雨 one.

Usage (from frontend/):
  python3 scripts/build-scene-page-art.py

Requires Pillow, NumPy and SciPy. Re-run only when the prototypes change; the outputs are
committed.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
PROTOTYPES = ROOT / "docs/prototypes"
OUTPUT = ROOT / "frontend/src/assets/jiangnan"


def load(name: str, box: tuple[int, int, int, int]) -> np.ndarray:
    return np.asarray(Image.open(PROTOTYPES / name).convert("RGB").crop(box)).astype(float)


def glass_field(pixels: np.ndarray, flat: np.ndarray) -> np.ndarray:
    """A plane per channel fitted to the pixels known to be bare glass."""
    height, width, _ = pixels.shape
    ys, xs = np.nonzero(flat)
    design = np.column_stack([xs, ys, np.ones_like(xs)])
    grid_y, grid_x = np.mgrid[0:height, 0:width]
    field = np.empty_like(pixels)
    for channel in range(3):
        coefficients, *_ = np.linalg.lstsq(design, pixels[ys, xs, channel], rcond=None)
        field[..., channel] = coefficients[0] * grid_x + coefficients[1] * grid_y + coefficients[2]
    return field


def lift(pixels: np.ndarray, glass: np.ndarray, low: float, high: float) -> np.ndarray:
    """RGBA: alpha from the distance to the glass, colour with the glass taken back out."""
    distance = np.sqrt(((pixels - glass) ** 2).sum(axis=2))
    alpha = np.clip((distance - low) / (high - low), 0, 1)
    safe = np.maximum(alpha, 0.05)[..., None]
    colour = np.clip((pixels - (1 - safe) * glass) / safe, 0, 255)
    return np.dstack([colour, alpha * 255])


def feather(rgba: np.ndarray, left: int = 0, top: int = 0, right: int = 0, bottom: int = 0) -> None:
    """Fade the alpha towards the given edges so the crop never shows as a straight line."""
    height, width, _ = rgba.shape
    ramp = np.ones((height, width))
    if left:
        ramp *= np.clip(np.arange(width) / left, 0, 1)[None, :]
    if right:
        ramp *= np.clip((width - 1 - np.arange(width)) / right, 0, 1)[None, :]
    if top:
        ramp *= np.clip(np.arange(height) / top, 0, 1)[:, None]
    if bottom:
        ramp *= np.clip((height - 1 - np.arange(height)) / bottom, 0, 1)[:, None]
    rgba[..., 3] *= ramp


def save(rgba: np.ndarray, name: str, width: int | None = None, quality: int = 82) -> None:
    image = Image.fromarray(np.round(rgba).astype(np.uint8))
    if width:
        image = image.resize((width, round(image.height * width / image.width)), Image.LANCZOS)
    image.save(OUTPUT / name, "WEBP", quality=quality, method=6)
    print(f"{name}: {image.size[0]}x{image.size[1]}, {(OUTPUT / name).stat().st_size / 1024:.1f} KB")


def build_plum() -> None:
    # Inside the card, stopping short of its rim on the right and of its corner on top.
    pixels = load("06-login.png", (1318, 152, 1498, 312))
    rough = np.sqrt(((pixels - np.median(pixels.reshape(-1, 3), axis=0)) ** 2).sum(axis=2))
    glass = glass_field(pixels, ndimage.binary_erosion(rough < 9, iterations=3))
    rgba = lift(pixels, glass, low=9, high=30)
    # Drop the faint hill watermark behind the sprig: it is large, soft and low in alpha.
    solid = ndimage.binary_dilation(rgba[..., 3] > 150, iterations=3)
    rgba[..., 3] *= ndimage.gaussian_filter(solid.astype(float), 1.2)
    feather(rgba, left=10, top=6, bottom=10)
    save(rgba, "card-plum.webp")


def build_hills() -> None:
    # The full width between the rims, from just above the highest peak to the bottom rim.
    pixels = load("07-404.png", (866, 758, 1500, 872))
    # Bare glass shows above the valley in the middle of the range.
    glass_colour = np.median(pixels[:26, 230:410].reshape(-1, 3), axis=0)
    rgba = lift(pixels, np.broadcast_to(glass_colour, pixels.shape), low=5, high=30)
    rgba[..., 3] = ndimage.gaussian_filter(rgba[..., 3], 0.8)
    feather(rgba, top=8)
    # A soft wash: one device pixel per CSS pixel is plenty.
    save(rgba, "card-hills.webp", width=432, quality=74)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    build_plum()
    build_hills()


if __name__ == "__main__":
    main()
