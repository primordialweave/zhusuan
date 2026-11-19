import importlib.util
import plistlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('macos_packages', Path(__file__).with_name('build_macos_packages.py'))
macos = importlib.util.module_from_spec(spec)
spec.loader.exec_module(macos)


class MacOSPackageTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.app = Path(self.temporary.name)/'zhusuan.app'
        (self.app/'Contents/MacOS').mkdir(parents=True)
        (self.app/'Contents/MacOS/zhusuan').write_bytes(b'fixture executable')
        self.metadata = {'CFBundleIdentifier': 'org.primordialweave.zhusuan',
                         'CFBundleExecutable': 'zhusuan',
                         'CFBundleShortVersionString': '1.0.0', 'CFBundleVersion': '1.0.0'}
        self.write_metadata()

    def write_metadata(self):
        (self.app/'Contents/Info.plist').write_bytes(plistlib.dumps(self.metadata))

    def test_accepts_expected_bundle_identity_and_version(self):
        self.assertEqual(macos.bundle_metadata(self.app, 'v1.0.0'), self.app/'Contents/MacOS/zhusuan')

    def test_accepts_chinese_install_bundle_with_ascii_executable(self):
        renamed = self.app.with_name('珠算.app')
        self.app.rename(renamed)
        self.assertEqual(macos.bundle_metadata(renamed, 'v1.0.0'), renamed/'Contents/MacOS/zhusuan')

    def test_rejects_wrong_identity_version_and_executable(self):
        for key in self.metadata:
            with self.subTest(key=key):
                original = self.metadata[key]
                self.metadata[key] = 'wrong'
                self.write_metadata()
                with self.assertRaises(ValueError):
                    macos.bundle_metadata(self.app, 'v1.0.0')
                self.metadata[key] = original
        self.write_metadata()

    def test_rejects_executable_symlink(self):
        binary = self.app/'Contents/MacOS/zhusuan'
        binary.unlink()
        target = Path(self.temporary.name)/'outside'
        target.write_bytes(b'outside')
        binary.symlink_to(target)
        with self.assertRaises(ValueError):
            macos.bundle_metadata(self.app, 'v1.0.0')

    def test_architecture_validation_rejects_wrong_or_universal_payload(self):
        binary = self.app/'Contents/MacOS/zhusuan'
        for output in [b'x86_64\n', b'x86_64 arm64\n']:
            with patch.object(macos, 'command', return_value=output), self.assertRaises(ValueError):
                macos.verify_architecture(binary, 'arm64')
        with patch.object(macos, 'command', return_value=b'arm64\n'):
            macos.verify_architecture(binary, 'arm64')
        with patch.object(macos, 'command', return_value=b'x86_64\n'):
            macos.verify_architecture(binary, 'amd64')

    def test_rejects_branch_and_prerelease_tags(self):
        for tag in ['main', '1.0.0', 'v1.0.0-beta', 'v01.0.0']:
            with self.subTest(tag=tag), self.assertRaises(ValueError):
                macos.bundle_metadata(self.app, tag)


if __name__ == '__main__':
    unittest.main()
