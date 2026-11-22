import hashlib
import importlib.util
import json
import struct
import tempfile
import unittest
import zlib
from pathlib import Path
from unittest.mock import patch


spec = importlib.util.spec_from_file_location('windows_icon', Path(__file__).with_name('build_windows_icon.py'))
windows_icon = importlib.util.module_from_spec(spec)
spec.loader.exec_module(windows_icon)


def png_fixture(width=256, height=256, marker=b''):
    def chunk(kind, payload):
        body = kind + payload
        return struct.pack('>I', len(payload)) + body + struct.pack('>I', zlib.crc32(body))
    header = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    pixels = b'\x00' + b'\x10\x80\x40\xff' * width
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header) +
            chunk(b'tEXt', b'fixture\x00' + marker) +
            chunk(b'IDAT', zlib.compress(pixels * height)) + chunk(b'IEND', b''))


class WindowsIconTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='windows-icon-test-')
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.source = self.directory / 'appicon.png'
        self.output = self.directory / 'appicon-windows.png'
        self.stamp = self.directory / 'appicon-windows.source.json'
        self.source.write_bytes(png_fixture(marker=b'original'))
        self.output.write_bytes(png_fixture(marker=b'normalized'))
        self.metadata = {
            'recipe_version': 1,
            'optical_ratio': 0.93,
            'input_sha256': hashlib.sha256(self.source.read_bytes()).hexdigest(),
            'output_sha256': hashlib.sha256(self.output.read_bytes()).hexdigest(),
            'generator_sha256': hashlib.sha256(Path(windows_icon.__file__).read_bytes()).hexdigest(),
            'input_size': [256, 256],
            'output_size': [256, 256],
        }
        self.write_stamp()

    def write_stamp(self):
        self.stamp.write_text(json.dumps(self.metadata), encoding='utf-8')

    def test_valid_stamp_is_verified_without_importing_pillow(self):
        original_import = __import__
        def no_pillow(name, *args, **kwargs):
            if name == 'PIL' or name.startswith('PIL.'):
                raise AssertionError('Verification attempted to import Pillow')
            return original_import(name, *args, **kwargs)
        with patch('builtins.__import__', side_effect=no_pillow):
            self.assertEqual(windows_icon.verify_windows_source(self.source, self.output), self.metadata)

    def test_changed_original_artwork_invalidates_stamp(self):
        self.source.write_bytes(png_fixture(marker=b'new original'))
        with self.assertRaisesRegex(ValueError, 'stale'):
            windows_icon.verify_windows_source(self.source, self.output)

    def test_changed_normalized_artwork_invalidates_stamp(self):
        self.output.write_bytes(png_fixture(marker=b'changed normalized'))
        with self.assertRaisesRegex(ValueError, 'stale'):
            windows_icon.verify_windows_source(self.source, self.output)

    def test_stale_recipe_ratio_generator_or_dimensions_are_rejected(self):
        for key, value in [('recipe_version', 0), ('optical_ratio', 0.85),
                           ('generator_sha256', '0' * 64), ('output_size', [512, 512]),
                           ('recipe_version', True)]:
            with self.subTest(key=key, value=value):
                recorded = dict(self.metadata, **{key: value})
                self.stamp.write_text(json.dumps(recorded), encoding='utf-8')
                with self.assertRaisesRegex(ValueError, 'stale'):
                    windows_icon.verify_windows_source(self.source, self.output)

    def test_missing_or_invalid_stamp_has_regeneration_guidance(self):
        self.stamp.unlink()
        with self.assertRaisesRegex(ValueError, '--generate'):
            windows_icon.verify_windows_source(self.source, self.output)
        self.stamp.write_text('{not json', encoding='utf-8')
        with self.assertRaisesRegex(ValueError, '--generate'):
            windows_icon.verify_windows_source(self.source, self.output)

    def test_non_square_small_or_changed_canvas_is_rejected(self):
        for width, height, message in [(256, 512, 'square'), (128, 128, '256'),
                                       (512, 512, 'retain')]:
            with self.subTest(width=width, height=height):
                self.output.write_bytes(png_fixture(width, height))
                with self.assertRaisesRegex(ValueError, message):
                    windows_icon.verify_windows_source(self.source, self.output)

    def test_corrupted_png_header_is_rejected(self):
        self.output.write_bytes(b'not a PNG')
        with self.assertRaisesRegex(ValueError, 'PNG header'):
            windows_icon.verify_windows_source(self.source, self.output)
        damaged = bytearray(png_fixture())
        damaged[20] ^= 1
        self.output.write_bytes(damaged)
        with self.assertRaisesRegex(ValueError, 'PNG header'):
            windows_icon.verify_windows_source(self.source, self.output)

    def test_symlink_source_output_or_stamp_is_rejected(self):
        for path in (self.source, self.output, self.stamp):
            with self.subTest(path=path.name):
                original = path.read_bytes()
                target = self.directory / ('linked-' + path.name)
                target.write_bytes(original)
                path.unlink()
                path.symlink_to(target)
                with self.assertRaises(ValueError):
                    windows_icon.verify_windows_source(self.source, self.output)
                path.unlink()
                path.write_bytes(original)

    def test_output_cannot_replace_original_master(self):
        with self.assertRaisesRegex(ValueError, 'overwrite'):
            windows_icon.verify_windows_source(self.source, self.source)
        with self.assertRaisesRegex(ValueError, 'overwrite'):
            windows_icon.build_windows_source(self.source, self.source)

    def test_regeneration_loads_pillow_lazily_and_keeps_existing_output_on_import_failure(self):
        before = self.output.read_bytes()
        original_import = __import__
        def no_pillow(name, *args, **kwargs):
            if name == 'PIL' or name.startswith('PIL.'):
                raise ImportError('Pillow intentionally unavailable')
            return original_import(name, *args, **kwargs)
        with patch('builtins.__import__', side_effect=no_pillow):
            with self.assertRaisesRegex(ValueError, 'requires Pillow'):
                windows_icon.build_windows_source(self.source, self.output)
        self.assertEqual(self.output.read_bytes(), before)

    def test_windows_frame_sizes_include_native_dpi_sizes(self):
        self.assertEqual(windows_icon.WINDOWS_ICON_SIZES,
                         (16, 20, 24, 32, 40, 48, 60, 64, 72, 80, 96, 128, 256))


if __name__ == '__main__':
    unittest.main()
