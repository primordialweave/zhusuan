import importlib.util
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import textwrap
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
        windows = json.loads((self.directory/'build/windows/info.json').read_text())
        self.assertEqual(windows['fixed']['file_version'], '1.2.3')
        self.assertEqual(windows['fixed']['product_version'], '1.2.3')
        for translations in windows['info'].values():
            # Windows consumers require a nonempty FileVersion string before accepting
            # a translation's ProductName and FileDescription; numeric fields alone fail.
            self.assertEqual(translations['FileVersion'], '1.2.3')
            self.assertEqual(translations['ProductVersion'], '1.2.3')
            self.assertEqual(translations['ProductName'], '珠算')
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

    def test_missing_native_version_field_does_not_partially_update_metadata(self):
        files = ['frontend/package.json', 'frontend/package-lock.json', 'build/config.yml',
                 'build/linux/nfpm/nfpm.yaml', 'build/darwin/Info.plist',
                 'build/darwin/Info.dev.plist', 'build/windows/info.json']
        for filename in files:
            target = self.directory/filename
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(REPO/filename, target)
        (self.directory/'build/windows/info.json').write_text('{}\n')
        before = {filename: (self.directory/filename).read_bytes() for filename in files}
        with self.assertRaisesRegex(ValueError, 'Version field not found'):
            release.sync_metadata(self.directory, self.tag)
        self.assertEqual(
            {filename: (self.directory/filename).read_bytes() for filename in files}, before,
            'invalid native metadata must not leave the frontend or other platforms bumped',
        )

    def test_verifies_all_platforms_and_produces_one_manifest(self):
        self.populate_assets()
        self.assertEqual(len(release.verify_assets(self.directory, self.tag)), 8)
        self.assertEqual(len((self.directory/'SHA256SUMS').read_text().splitlines()), 8)

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

    def test_prepares_macos_dmg_installers_and_matching_zip_updates(self):
        output = self.directory/'release'
        output.mkdir()
        names = release.names_for_platform(self.tag, 'darwin')
        self.assertEqual(set(names), {
            'zhusuan-v1.2.3-macOS-arm64.dmg',
            'zhusuan-v1.2.3-macOS-amd64.dmg',
            'zhusuan-v1.2.3-macOS-arm64.zip',
            'zhusuan-v1.2.3-macOS-amd64.zip',
        })
        for name in names:
            (output/name).write_bytes(name.encode())
        release.prepare_assets(self.directory, output, self.tag, 'darwin')
        entries = (output/'SHA256SUMS.darwin').read_text().splitlines()
        self.assertEqual(len(entries), 4)
        self.assertEqual({entry.split('  ', 1)[1] for entry in entries}, set(names))

    def test_macos_preparation_requires_every_installer_and_update_architecture(self):
        names = release.names_for_platform(self.tag, 'darwin')
        for index, missing in enumerate(names):
            with self.subTest(missing=missing):
                output = self.directory/f'macos-{index}'
                output.mkdir()
                for name in names:
                    if name != missing:
                        (output/name).write_bytes(b'package payload')
                with self.assertRaisesRegex(ValueError, 'Missing or empty'):
                    release.prepare_assets(self.directory, output, self.tag, 'darwin')
                self.assertFalse((output/'SHA256SUMS.darwin').exists())

    def test_legacy_universal_zip_cannot_replace_architecture_updates(self):
        output = self.directory/'release'
        output.mkdir()
        for name in release.names_for_platform(self.tag, 'darwin'):
            if name.endswith('.dmg'):
                (output/name).write_bytes(b'installer')
        (output/'zhusuan-v1.2.3-macOS-universal.zip').write_bytes(b'legacy update')
        with self.assertRaisesRegex(ValueError, 'Missing or empty'):
            release.prepare_assets(self.directory, output, self.tag, 'darwin')

    def test_changed_macos_installer_fails_aggregate_verification(self):
        self.populate_assets()
        (self.directory/'zhusuan-v1.2.3-macOS-arm64.dmg').write_bytes(b'changed installer')
        with self.assertRaisesRegex(ValueError, 'Checksum mismatch'):
            release.verify_assets(self.directory, self.tag)

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
        self.assertEqual(len(manifest['assets']), 9)
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


class UploadedDraftGateTests(unittest.TestCase):
    def run_gate(self, mode='matching', database_id='455412186'):
        if not shutil.which('bash') or os.name == 'nt':
            self.skipTest('the publish workflow gate runs in a POSIX GitHub runner')
        with tempfile.TemporaryDirectory(prefix='zhusuan-draft-gate-') as temporary:
            root = Path(temporary)
            assets = root/'release'
            assets.mkdir()
            tag = 'v1.4.0'
            names = [name for platform in ['darwin', 'windows', 'linux']
                     for name in release.names_for_platform(tag, platform)] + ['SHA256SUMS', 'update.json']
            for name in names:
                (assets/name).write_bytes(('fixture payload '+name).encode())
            response = {'id': 455412186, 'tag_name': tag, 'draft': True, 'assets': [
                {'name': name, 'size': (assets/name).stat().st_size,
                 'digest': 'sha256:'+hashlib.sha256((assets/name).read_bytes()).hexdigest()}
                for name in names]}
            if mode == 'missing':
                response['assets'].pop()
            elif mode == 'size':
                response['assets'][0]['size'] += 1
            elif mode == 'digest':
                response['assets'][0]['digest'] = 'sha256:'+'0'*64
            elif mode == 'published':
                response['draft'] = False
            response_path = root/'response.json'
            response_path.write_text(json.dumps(response))
            calls = root/'calls.jsonl'
            bin_dir = root/'bin'
            bin_dir.mkdir()
            stub = bin_dir/'gh'
            stub.write_text(f'#!{sys.executable}\n'+'''import json, os, pathlib, sys
args = sys.argv[1:]
with open(os.environ['GH_GATE_CALLS'], 'a') as output:
    output.write(json.dumps(args) + '\\n')
if args[:2] == ['release', 'view']:
    print(os.environ['GH_GATE_RELEASE_ID'])
elif args[0] == 'api' and args[1].endswith('/releases/455412186'):
    print(pathlib.Path(os.environ['GH_GATE_RESPONSE']).read_text())
elif args[:2] == ['release', 'edit']:
    pass
else:
    print('HTTP 404: draft tag endpoint is unavailable', file=sys.stderr)
    sys.exit(1)
''')
            stub.chmod(0o755)
            lines = (REPO/'.github/workflows/release.yml').read_text().splitlines()
            start = next(i for i, line in enumerate(lines) if 'name: Verify uploaded assets before publishing' in line)
            start = next(i for i in range(start, len(lines)) if lines[i].strip() == 'run: |') + 1
            end = next((i for i in range(start, len(lines)) if lines[i].startswith('      - ')), len(lines))
            driver = root/'gate.sh'
            driver.write_text(textwrap.dedent('\n'.join(lines[start:end]))+'\n')
            env = dict(os.environ, PATH=f'{bin_dir}{os.pathsep}{os.environ["PATH"]}',
                       GITHUB_REPOSITORY='fixture/repository', RELEASE_TAG=tag,
                       GH_GATE_CALLS=str(calls), GH_GATE_RESPONSE=str(response_path),
                       GH_GATE_RELEASE_ID=database_id)
            result = subprocess.run(['bash', '--noprofile', '--norc', '-e', '-o', 'pipefail', str(driver)],
                                    cwd=root, env=env, capture_output=True, text=True, timeout=20)
            requests = [json.loads(line) for line in calls.read_text().splitlines()]
            return result, requests

    def test_draft_can_publish_through_database_id_when_tag_endpoint_returns_404(self):
        result, requests = self.run_gate()
        self.assertEqual(result.returncode, 0, result.stdout+result.stderr)
        self.assertTrue(any(call[0] == 'api' and call[1].endswith('/releases/455412186') for call in requests))
        self.assertTrue(any(call[:2] == ['release', 'edit'] for call in requests))

    def test_changed_asset_identity_and_published_release_block_publication(self):
        for mode in ['missing', 'size', 'digest', 'published']:
            with self.subTest(mode=mode):
                result, requests = self.run_gate(mode)
                self.assertNotEqual(result.returncode, 0)
                self.assertTrue(any(call[0] == 'api' and call[1].endswith('/releases/455412186') for call in requests))
                self.assertIn('Uploaded draft names, sizes, or digests', result.stderr)
                self.assertFalse(any(call[:2] == ['release', 'edit'] for call in requests))

    def test_invalid_database_id_fails_before_querying_assets_or_publishing(self):
        result, requests = self.run_gate(database_id='null')
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(any(call[0] == 'api' or call[:2] == ['release', 'edit'] for call in requests))


if __name__ == '__main__':
    unittest.main()
