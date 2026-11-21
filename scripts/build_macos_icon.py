#!/usr/bin/env python3
"""Encode the same transparent Dock artwork into a standard macOS iconset."""
import argparse
import hashlib
import plistlib
import shutil
import subprocess
import tempfile
from pathlib import Path


def resolve_dark_source(source, dark_source=None):
    if dark_source is not None:
        return Path(dark_source)
    candidate = source.with_name(f'{source.stem}-dark{source.suffix}')
    return candidate if candidate.is_file() else None


def catalog_source_digest(source, icon, dark_source=None):
    # A changed composition or dark-appearance artwork must invalidate the checked-in catalog on older Xcode, too.
    resolved_dark = resolve_dark_source(source, dark_source)
    digest = hashlib.sha256()
    digest.update(source.read_bytes())
    digest.update(b'\0')
    digest.update((icon/'icon.json').read_bytes())
    if resolved_dark is not None:
        digest.update(b'\0')
        digest.update(resolved_dark.read_bytes())
    return digest.hexdigest()


def supports_icon_composer():
    try:
        version = subprocess.check_output(['xcrun', 'actool', '--version'], timeout=30)
        metadata = plistlib.loads(version)['com.apple.actool.version']
        return int(metadata['short-bundle-version'].split('.')[0]) >= 26
    except (OSError, subprocess.SubprocessError, ValueError, KeyError):
        return False


def verify_catalog(resource, digest):
    stamp = resource/'Assets.car.source.sha256'
    if not (resource/'Assets.car').is_file() or not stamp.is_file() or stamp.read_text().strip() != digest:
        raise ValueError('Modern icon catalog is missing/stale; regenerate with Xcode 26 or newer')


def build_icon(source, target, dark_source=None):
    target.parent.mkdir(parents=True, exist_ok=True)
    resource = target.parent
    icon = resource/'AppIcon.icon'
    resolved_dark = resolve_dark_source(source, dark_source)
    digest = catalog_source_digest(source, icon, resolved_dark)
    modern = supports_icon_composer()
    if not modern:
        verify_catalog(resource, digest)
    with tempfile.TemporaryDirectory(prefix='zhusuan-icon-') as temporary:
        folder = Path(temporary)/'AppIcon.iconset'; folder.mkdir()
        for size in [16, 32, 128, 256, 512]:
            for scale in [1, 2]:
                suffix = '@2x' if scale == 2 else ''
                path = folder/f'icon_{size}x{size}{suffix}.png'
                subprocess.run(['/usr/bin/sips', '-s', 'format', 'png', '-z', str(size*scale), str(size*scale), str(source), '--out', str(path)], check=True, capture_output=True, timeout=30)
        subprocess.run(['/usr/bin/iconutil', '-c', 'icns', str(folder), '-o', str(target)], check=True, timeout=30)
        if modern:
            (icon/'Assets').mkdir(parents=True, exist_ok=True)
            subprocess.run(['/usr/bin/sips', '-s', 'format', 'png', '-z', '1024', '1024', str(source), '--out', str(icon/'Assets/Artwork.png')], check=True, capture_output=True, timeout=30)
            if resolved_dark is not None:
                subprocess.run(['/usr/bin/sips', '-s', 'format', 'png', '-z', '1024', '1024', str(resolved_dark), '--out', str(icon/'Assets/Artwork-Dark.png')], check=True, capture_output=True, timeout=30)
            compiled = Path(temporary)/'compiled'; compiled.mkdir()
            subprocess.run(['xcrun', 'actool', str(icon), '--compile', str(compiled), '--platform', 'macosx', '--minimum-deployment-target', '15.0', '--app-icon', 'AppIcon', '--include-all-app-icons', '--output-partial-info-plist', str(compiled/'partial.plist')], check=True, capture_output=True, timeout=120)
            shutil.copy2(compiled/'Assets.car', resource/'Assets.car')
            (resource/'Assets.car.source.sha256').write_text(digest+'\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, default=Path('build/appicon.png'))
    parser.add_argument('--dark-input', type=Path, default=None)
    parser.add_argument('--output', type=Path, default=Path('build/darwin/icons.icns'))
    args = parser.parse_args()
    build_icon(args.input.resolve(), args.output.resolve(), args.dark_input.resolve() if args.dark_input else None)
