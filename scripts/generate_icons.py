#!/usr/bin/env python3
"""Derive platform icons from one PNG without changing the source artwork."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
IOS_BACKGROUND = (200, 228, 211, 255)


def fit(source, width, height, opaque=False, round_icon=False):
    image = Image.new('RGBA', (width, height), IOS_BACKGROUND if opaque else (0, 0, 0, 0))
    content = source.copy()
    content.thumbnail((width, height), Image.Resampling.LANCZOS)
    image.alpha_composite(content, ((width - content.width) // 2, (height - content.height) // 2))
    if round_icon:
        mask = Image.new('L', (width * 4, height * 4), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, width * 4 - 1, height * 4 - 1), fill=255)
        mask = mask.resize((width, height), Image.Resampling.LANCZOS)
        image.putalpha(ImageChops.multiply(image.getchannel('A'), mask))
    return image.convert('RGB') if opaque else image


def save(image, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)


def generate(source_path, native=True):
    with Image.open(source_path) as image:
        source = image.convert('RGBA')
    if source.width != source.height:
        raise ValueError('The master icon must be square.')
    master = ROOT / 'build/appicon.png'
    if source_path.resolve() != master.resolve():
        shutil.copy2(source_path, master)

    web = fit(source, 256, 256)
    for name in ('zhusuan.png', 'orange.png', 'orange-new.png'):
        save(web, ROOT / 'frontend/public' / name)
    web.save(ROOT / 'frontend/public/favicon.ico', format='ICO',
             sizes=[(size, size) for size in (16, 32, 48, 64, 128, 256)])

    windows = {'AppIcon.png': (256, 256), 'Square44x44Logo.png': (44, 44),
               'Square150x150Logo.png': (150, 150), 'StoreLogo.png': (50, 50),
               'Wide310x150Logo.png': (310, 150), 'SplashScreen.png': (620, 300)}
    for name, dimensions in windows.items():
        save(fit(source, *dimensions), ROOT / 'build/windows/msix/Assets' / name)

    for size in (128, 256, 512):
        save(fit(source, size, size), ROOT / f'build/linux/icons/{size}/zhusuan.png')

    densities = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
    for density, size in densities.items():
        folder = ROOT / f'build/android/app/src/main/res/mipmap-{density}'
        save(fit(source, size, size), folder / 'ic_launcher.png')
        save(fit(source, size, size, round_icon=True), folder / 'ic_launcher_round.png')

    catalog = json.loads((ROOT / 'build/ios/Assets.xcassets').read_text())
    iconset = ROOT / 'build/ios/AppIcon.appiconset'
    iconset.mkdir(parents=True, exist_ok=True)
    (iconset / 'Contents.json').write_text(json.dumps(catalog, indent=2) + '\n')
    generated = set()
    for entry in catalog['images']:
        name = entry['filename']
        if name in generated:
            continue
        dimension = round(float(entry['size'].split('x')[0]) * float(entry['scale'].rstrip('x')))
        save(fit(source, dimension, dimension, opaque=True), iconset / name)
        generated.add(name)
    save(fit(source, 1024, 1024, opaque=True), ROOT / 'build/ios/icon.png')

    if native:
        subprocess.run(['wails3', 'generate', 'icons', '-input', str(master),
                        '-macfilename', str(ROOT / 'build/darwin/icons.icns'),
                        '-windowsfilename', str(ROOT / 'build/windows/icon.ico')], check=True)
    print('Generated macOS/Windows/Web/Linux/Android and opaque iOS icons from', source_path.name)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=Path, default=ROOT / 'build/appicon.png')
    parser.add_argument('--skip-native', action='store_true', help='Skip Wails ICNS/ICO conversion.')
    args = parser.parse_args()
    generate(args.input, not args.skip_native)
