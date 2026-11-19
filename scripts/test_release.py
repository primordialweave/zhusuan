import importlib.util
import json
import shutil
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('release', Path(__file__).with_name('release.py'))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
REPO = Path(__file__).resolve().parents[1]


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.tag = 'v1.2.3'

    def populate_assets(self):
        for platform in ['darwin', 'windows', 'linux']:
            names = release.names_for_platform(self.tag, platform)
            for name in names:
                (self.directory/name).write_bytes(b'release test payload')
            release.write_checksums(self.directory, names, f'SHA256SUMS.{platform}')

    def test_rejects_branch_names_and_invalid_windows_versions(self):
        for tag in ['main', 'v1.2', 'v01.2.3', 'v1.2.3-beta.1', 'v70000.1.2', 'v1.2.3\nfoo']:
            with self.subTest(tag=tag), self.assertRaises(ValueError):
                release.version_for_tag(tag)

    def test_assets_use_new_brand_and_existing_installer_source(self):
        for platform in ['darwin', 'windows', 'linux']:
            for name in release.names_for_platform(self.tag, platform):
                self.assertTrue(name.startswith('zhusuan-v1.2.3-'))
                self.assertNotIn('Orange', name)
        source = self.directory/'source'
        source.mkdir()
        (source/'zhusuan-amd64-installer.exe').write_bytes(b'new installer')
        output = self.directory/'release'
        release.prepare_assets(source, output, self.tag, 'windows')
        self.assertEqual((output/'zhusuan-v1.2.3-windows-amd64-installer.exe').read_bytes(), b'new installer')

    def test_syncs_frontend_lock_and_all_native_metadata(self):
        files = ['frontend/package.json', 'frontend/package-lock.json', 'build/config.yml', 'build/linux/nfpm/nfpm.yaml', 'build/darwin/Info.plist', 'build/darwin/Info.dev.plist', 'build/windows/info.json', 'build/ios/Info.plist', 'build/ios/Info.dev.plist', 'build/windows/msix/template.xml', 'build/windows/msix/app_manifest.xml', 'build/android/app/build.gradle', 'internal/constants/constants.go']
        for filename in files:
            target = self.directory/filename
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(REPO/filename, target)
        self.assertEqual(release.sync_metadata(self.directory, self.tag), '1.2.3')
        lock = json.loads((self.directory/'frontend/package-lock.json').read_text())
        self.assertEqual(lock['version'], '1.2.3')
        self.assertEqual(lock['packages']['']['version'], '1.2.3')
        for filename in files:
            self.assertIn('1.2.3', (self.directory/filename).read_text())
        self.assertIn('org.primordialweave.zhusuan', (self.directory/'build/darwin/Info.plist').read_text())
        self.assertIn('珠算', (self.directory/'build/config.yml').read_text())
        self.assertIn('versionCode 1002003', (self.directory/'build/android/app/build.gradle').read_text())
        for filename in ['build/windows/msix/template.xml', 'build/windows/msix/app_manifest.xml']:
            text = (self.directory/filename).read_text()
            self.assertIn('Version="1.2.3.0"', text)
            self.assertIn('MinVersion="10.0.17763.0"', text)

    def test_invalid_android_version_does_not_partially_update_metadata(self):
        target = self.directory/'build/android/app/build.gradle'
        target.parent.mkdir(parents=True)
        shutil.copy2(REPO/'build/android/app/build.gradle', target)
        before = target.read_bytes()
        with self.assertRaisesRegex(ValueError, 'Android version'):
            release.sync_metadata(self.directory, 'v1.1000.0')
        self.assertEqual(target.read_bytes(), before)
        self.assertFalse((self.directory/'frontend/package.json').exists())

    def test_verifies_all_platforms_and_produces_one_manifest(self):
        self.populate_assets()
        self.assertEqual(len(release.verify_assets(self.directory, self.tag)), 5)
        self.assertEqual(len((self.directory/'SHA256SUMS').read_text().splitlines()), 5)

    def test_rejects_changed_asset(self):
        self.populate_assets()
        (self.directory/release.names_for_platform(self.tag, 'windows')[0]).write_bytes(b'corrupted download')
        with self.assertRaisesRegex(ValueError, 'Checksum mismatch'):
            release.verify_assets(self.directory, self.tag)

    def test_rejects_missing_platform(self):
        self.populate_assets()
        (self.directory/'SHA256SUMS.linux').unlink()
        with self.assertRaisesRegex(ValueError, 'Missing or empty'):
            release.verify_assets(self.directory, self.tag)

    def test_rejects_unexpected_assets_and_duplicate_manifest_entries(self):
        self.populate_assets()
        extra = self.directory/'zhusuan-unexpected.exe'
        extra.write_bytes(b'extra')
        with self.assertRaisesRegex(ValueError, 'Unexpected or missing'):
            release.verify_assets(self.directory, self.tag)
        extra.unlink()
        manifest = self.directory/'SHA256SUMS.windows'
        manifest.write_text(manifest.read_text()*2)
        with self.assertRaisesRegex(ValueError, 'Invalid or duplicate'):
            release.verify_assets(self.directory, self.tag)

    def test_prepare_fails_when_windows_installer_is_missing(self):
        with self.assertRaisesRegex(ValueError, 'Missing or empty'):
            release.prepare_assets(self.directory, self.directory/'release', self.tag, 'windows')

    def create_manifest(self):
        self.populate_assets()
        notes = self.directory/'RELEASE_NOTES.md'
        notes.write_text('新版更新说明\n', encoding='utf-8')
        release.write_update_manifest(self.directory, self.tag, 'primordialweave/zhusuan', notes)
        return notes, json.loads((self.directory/'update.json').read_text())

    def test_update_manifest_describes_the_verified_release(self):
        notes, manifest = self.create_manifest()
        release.verify_update_manifest(self.directory, self.tag, 'primordialweave/zhusuan', notes)
        self.assertEqual(manifest['tag_name'], self.tag)
        self.assertEqual(manifest['html_url'], 'https://github.com/primordialweave/zhusuan/releases/tag/v1.2.3')
        self.assertEqual(manifest['body'], '新版更新说明\n')
        self.assertFalse(manifest['draft'])
        self.assertFalse(manifest['prerelease'])
        self.assertEqual(len(manifest['assets']), 6)
        self.assertNotIn('update.json', [asset['name'] for asset in manifest['assets']])
        for asset in manifest['assets']:
            path = self.directory/asset['name']
            self.assertEqual(asset['size'], path.stat().st_size)
            self.assertEqual(asset['digest'], 'sha256:' + release.checksum(path))
            self.assertEqual(asset['browser_download_url'], f"https://github.com/primordialweave/zhusuan/releases/download/{self.tag}/{asset['name']}")

    def test_rejects_modified_update_manifest_version_url_and_digest(self):
        for field in ['tag_name', 'html_url', 'digest']:
            with self.subTest(field=field):
                notes, manifest = self.create_manifest()
                if field == 'digest':
                    manifest['assets'][0]['digest'] = 'sha256:' + '0'*64
                else:
                    manifest[field] = 'incorrect'
                (self.directory/'update.json').write_text(json.dumps(manifest))
                with self.assertRaisesRegex(ValueError, 'Update manifest does not match'):
                    release.verify_update_manifest(self.directory, self.tag, 'primordialweave/zhusuan', notes)


if __name__ == '__main__':
    unittest.main()
