import importlib.util
import plistlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('macos_icon', Path(__file__).with_name('build_macos_icon.py'))
macos_icon = importlib.util.module_from_spec(spec)
spec.loader.exec_module(macos_icon)


class MacOSIconTests(unittest.TestCase):
    def test_older_xcode_accepts_only_catalog_for_current_artwork_and_composition(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            source = directory/'appicon.png'
            source.write_bytes(b'original artwork')
            icon = directory/'AppIcon.icon'
            icon.mkdir()
            manifest = icon/'icon.json'
            manifest.write_text('{"fill":"none","scale":1.18}')
            (directory/'Assets.car').write_bytes(b'compiled icon catalog')
            (directory/'Assets.car.source.sha256').write_text(macos_icon.catalog_source_digest(source, icon))
            macos_icon.verify_catalog(directory, macos_icon.catalog_source_digest(source, icon))
            source.write_bytes(b'changed artwork')
            with self.assertRaisesRegex(ValueError, 'missing/stale'):
                macos_icon.verify_catalog(directory, macos_icon.catalog_source_digest(source, icon))
            source.write_bytes(b'original artwork')
            manifest.write_text('{"fill":"none","scale":1}')
            with self.assertRaisesRegex(ValueError, 'missing/stale'):
                macos_icon.verify_catalog(directory, macos_icon.catalog_source_digest(source, icon))

    def test_missing_catalog_stamp_has_an_actionable_error(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            (directory/'Assets.car').write_bytes(b'catalog without provenance')
            with self.assertRaisesRegex(ValueError, 'regenerate with Xcode 26'):
                macos_icon.verify_catalog(directory, 'expected source digest')

    def test_detects_icon_composer_support_for_current_and_future_xcode(self):
        for version, supported in [('16.4', False), ('26.0', True), ('27.2', True), ('28.0', True)]:
            with self.subTest(version=version):
                output = plistlib.dumps({'com.apple.actool.version': {'short-bundle-version': version}})
                with patch.object(macos_icon.subprocess, 'check_output', return_value=output):
                    self.assertEqual(macos_icon.supports_icon_composer(), supported)

    def test_unknown_xcode_output_uses_verified_checked_in_catalog(self):
        with patch.object(macos_icon.subprocess, 'check_output', return_value=b'unrecognized output'):
            self.assertFalse(macos_icon.supports_icon_composer())


if __name__ == '__main__':
    unittest.main()
