#!/usr/bin/env python3
"""Normalize Windows icon artwork and verify its checked-in source without Pillow."""
import argparse
import hashlib
import json
import os
import struct
import tempfile
import zlib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WINDOWS_ICON_SIZES = (16, 20, 24, 32, 40, 48, 60, 64, 72, 80, 96, 128, 256)
WINDOWS_OPTICAL_RATIO = 0.93
RECIPE_VERSION = 1
PNG_SIGNATURE = b'\x89PNG\r\n\x1a\n'
REGENERATE_HINT = 'Regenerate with python3 scripts/build_windows_icon.py --generate.'


def _regular_file(path):
    path = Path(path)
    if path.is_symlink() or not path.is_file():
        raise ValueError(f'Windows icon input must be a regular, non-symlink file: {path}')
    return path


def _png_dimensions(path):
    path = _regular_file(path)
    with path.open('rb') as file:
        header = file.read(33)
    if (len(header) != 33 or header[:8] != PNG_SIGNATURE or
            header[8:16] != b'\x00\x00\x00\rIHDR' or
            zlib.crc32(header[12:29]) != struct.unpack('>I', header[29:33])[0]):
        raise ValueError(f'Windows icon artwork has an invalid PNG header: {path}')
    width, height = struct.unpack('>II', header[16:24])
    if width != height or width < 256:
        raise ValueError(f'Windows icon artwork must be square and at least 256 pixels: {path}')
    return width, height


def _checksum(path):
    digest = hashlib.sha256()
    with _regular_file(path).open('rb') as file:
        for block in iter(lambda: file.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def _stamp_path(output):
    return Path(output).with_suffix('.source.json')


def _check_separate_paths(source, output):
    if Path(source).resolve() == Path(output).resolve():
        raise ValueError('Windows normalized output must not overwrite the original artwork.')


def _expected_stamp(source, output):
    _check_separate_paths(source, output)
    source_size = _png_dimensions(source)
    output_size = _png_dimensions(output)
    if output_size != source_size:
        raise ValueError('Windows normalized artwork must retain the original canvas dimensions.')
    return {
        'recipe_version': RECIPE_VERSION,
        'optical_ratio': WINDOWS_OPTICAL_RATIO,
        'input_sha256': _checksum(source),
        'output_sha256': _checksum(output),
        'generator_sha256': _checksum(Path(__file__).resolve()),
        'input_size': list(source_size),
        'output_size': list(output_size),
    }


def verify_windows_source(source, output):
    """Reject stale sources, output or recipe stamps using only the standard library."""
    expected = _expected_stamp(source, output)
    stamp = _stamp_path(output)
    try:
        recorded = json.loads(_regular_file(stamp).read_text(encoding='utf-8'))
    except (OSError, ValueError) as error:
        raise ValueError(f'Windows icon source stamp is missing or invalid. {REGENERATE_HINT}') from error
    # Canonical JSON also distinguishes incorrect value types such as True versus version 1.
    if json.dumps(recorded, sort_keys=True) != json.dumps(expected, sort_keys=True):
        raise ValueError(f'Windows icon source stamp is stale. {REGENERATE_HINT}')
    return expected


def _pillow_image():
    try:
        from PIL import Image
    except ImportError as error:
        raise ValueError('Regenerating Windows artwork requires Pillow; install scripts/requirements-icons.txt.') from error
    return Image


def normalize_windows_artwork(source_image):
    """Keep every nonzero-alpha source pixel within a centered 93% optical extent."""
    Image = _pillow_image()
    source = source_image.convert('RGBA')
    width, height = source.size
    if width != height or width < 256:
        raise ValueError('Windows icon artwork must be square and at least 256 pixels.')
    bounds = source.getchannel('A').getbbox()
    if bounds is None:
        raise ValueError('Windows icon artwork must contain visible pixels.')
    content = source.crop(bounds)
    extent = round(width * WINDOWS_OPTICAL_RATIO)
    scale = extent / max(content.size)
    content_size = (max(1, round(content.width * scale)), max(1, round(content.height * scale)))
    scaled = content.resize(content_size, Image.Resampling.LANCZOS)
    result = Image.new('RGBA', source.size, (0, 0, 0, 0))
    result.alpha_composite(scaled, ((width - scaled.width) // 2, (height - scaled.height) // 2))
    return result


def build_windows_source(source, output):
    """Regenerate the normalized PNG and write a source/recipe/output verification stamp."""
    source, output = Path(source), Path(output)
    _check_separate_paths(source, output)
    _png_dimensions(source)
    stamp = _stamp_path(output)
    for target in (output, stamp):
        if target.is_symlink() or (target.exists() and not target.is_file()):
            raise ValueError(f'Windows icon output must be a regular, non-symlink file: {target}')
    Image = _pillow_image()
    with Image.open(source) as original:
        normalized = normalize_windows_artwork(original)
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.windows-icon-', dir=output.parent) as temporary:
        encoded = Path(temporary) / 'artwork.png'
        normalized.save(encoded, format='PNG', optimize=True)
        os.replace(encoded, output)
        metadata = _expected_stamp(source, output)
        encoded_stamp = Path(temporary) / 'source.json'
        encoded_stamp.write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
        os.replace(encoded_stamp, stamp)
    return metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, default=ROOT / 'build/appicon.png')
    parser.add_argument('--output', type=Path, default=ROOT / 'build/appicon-windows.png')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--generate', action='store_true', help='Regenerate artwork with Pillow.')
    mode.add_argument('--verify', action='store_true', help='Verify checked-in artwork without Pillow (default).')
    args = parser.parse_args()
    try:
        if args.generate:
            build_windows_source(args.input, args.output)
            print(f'Generated Windows icon source: {args.output}')
        else:
            verify_windows_source(args.input, args.output)
            print(f'Verified Windows icon source: {args.output}')
    except (OSError, ValueError) as error:
        parser.exit(1, f'{error}\n')


if __name__ == '__main__':
    main()
