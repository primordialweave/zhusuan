#!/usr/bin/env python3
"""Prepare release metadata and fail closed when an update asset is missing or changed."""
import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path


def version_for_tag(tag):
    match = re.fullmatch(r'v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', tag)
    if not match or any(int(part) > 65535 for part in match.groups()):
        raise ValueError('Release tag must be vMAJOR.MINOR.PATCH (Windows components <= 65535)')
    return tag[1:]


def replace_required(path, pattern, replacement):
    text = path.read_text(encoding='utf-8')
    updated, count = re.subn(pattern, replacement, text)
    if count == 0:
        raise ValueError(f'Version field not found in {path}')
    path.write_text(updated, encoding='utf-8')


def sync_metadata(root, tag):
    version = version_for_tag(tag)
    parts = [int(part) for part in version.split('.')]
    android = root/'build/android/app/build.gradle'
    code = parts[0] * 1000000 + parts[1] * 1000 + parts[2]
    if android.exists() and (code > 2100000000 or parts[1] >= 1000 or parts[2] >= 1000):
        raise ValueError('Android version components exceed the supported versionCode range')
    for filename in ['frontend/package.json', 'frontend/package-lock.json']:
        path = root / filename
        document = json.loads(path.read_text(encoding='utf-8'))
        document['version'] = version
        if filename.endswith('package-lock.json'):
            document['packages']['']['version'] = version
        path.write_text(json.dumps(document, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    replace_required(root/'build/config.yml', r'(?m)^(  version: )"[^"]+"', rf'\g<1>"{version}"')
    constants = root/'internal/constants/constants.go'
    if constants.exists():
        replace_required(constants, r'const AppVersion = "[^"]+"', f'const AppVersion = "{version}"')
    replace_required(root/'build/linux/nfpm/nfpm.yaml', r'(?m)^(version: )"[^"]+"', rf'\g<1>"{version}"')
    for filename in ['build/darwin/Info.plist', 'build/darwin/Info.dev.plist']:
        for key in ['CFBundleShortVersionString', 'CFBundleVersion']:
            replace_required(root/filename, rf'(<key>{key}</key>\s*<string>)[^<]*(</string>)', rf'\g<1>{version}\g<2>')
    for key in ['file_version', 'ProductVersion']:
        replace_required(root/'build/windows/info.json', rf'("{key}":\s*")[^"]+("\s*)', rf'\g<1>{version}\g<2>')
    for filename in ['build/ios/Info.plist', 'build/ios/Info.dev.plist']:
        if (root/filename).exists():
            for key in ['CFBundleShortVersionString', 'CFBundleVersion']:
                replace_required(root/filename, rf'(<key>{key}</key>\s*<string>)[^<]*(</string>)', rf'\g<1>{version}\g<2>')
    for filename in ['build/windows/msix/template.xml', 'build/windows/msix/app_manifest.xml']:
        if (root/filename).exists():
            replace_required(root/filename, r'\bVersion="\d+\.\d+\.\d+\.\d+"', f'Version="{version}.0"')
    if android.exists():
        replace_required(android, r'versionName\s+"[^"]+"', f'versionName "{version}"')
        replace_required(android, r'versionCode\s+\d+', f'versionCode {code}')
    return version


def names_for_platform(tag, platform):
    version_for_tag(tag)
    return {
        'darwin': [
            f'zhusuan-{tag}-macOS-arm64.dmg',
            f'zhusuan-{tag}-macOS-amd64.dmg',
            f'zhusuan-{tag}-macOS-arm64.zip',
            f'zhusuan-{tag}-macOS-amd64.zip',
        ],
        'windows': [f'zhusuan-{tag}-windows-amd64-installer.exe'],
        'linux': [f'zhusuan-{tag}-linux-x86_64.AppImage', f'zhusuan-{tag}-linux-amd64.deb', f'zhusuan-{tag}-linux-amd64.rpm'],
    }[platform]


def checksum(path):
    digest = hashlib.sha256()
    with path.open('rb') as file:
        for block in iter(lambda: file.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def require_asset(path):
    if not path.is_file() or path.is_symlink() or path.stat().st_size == 0:
        raise ValueError(f'Missing or empty release asset: {path}')


def write_checksums(directory, filenames, filename='SHA256SUMS'):
    for asset in filenames:
        require_asset(directory/asset)
    (directory/filename).write_text(''.join(f'{checksum(directory/asset)}  {asset}\n' for asset in sorted(filenames)), encoding='utf-8')


def prepare_assets(source, output, tag, platform):
    output.mkdir(parents=True, exist_ok=True)
    names = names_for_platform(tag, platform)
    if platform == 'darwin':
        # Native packaging creates both manual installers and compatible updater ZIPs.
        for name in names:
            require_asset(output/name)
    elif platform == 'windows':
        require_asset(source/'zhusuan-amd64-installer.exe')
        shutil.copy2(source/'zhusuan-amd64-installer.exe', output/names[0])
    else:
        for extension, target in zip(['.AppImage', '.deb', '.rpm'], names):
            candidates = list(source.glob(f'*{extension}'))
            if len(candidates) != 1:
                raise ValueError(f'Expected exactly one {extension} asset, found {len(candidates)}')
            require_asset(candidates[0])
            shutil.copy2(candidates[0], output/target)
    write_checksums(output, names, f'SHA256SUMS.{platform}')


def verify_assets(directory, tag):
    all_names = []
    for platform in ['darwin', 'windows', 'linux']:
        names = names_for_platform(tag, platform)
        manifest = directory/f'SHA256SUMS.{platform}'
        require_asset(manifest)
        recorded = {}
        for line in manifest.read_text(encoding='utf-8').splitlines():
            match = re.fullmatch(r'([0-9a-f]{64})  ([^/\\]+)', line)
            if not match or match[2] in recorded:
                raise ValueError(f'Invalid or duplicate checksum entry in {manifest}')
            recorded[match[2]] = match[1]
        if set(recorded) != set(names):
            raise ValueError(f'Unexpected asset list in {manifest}')
        for name in names:
            require_asset(directory/name)
            if checksum(directory/name) != recorded[name]:
                raise ValueError(f'Checksum mismatch: {name}')
        all_names.extend(names)
    actual = {path.name for path in directory.iterdir() if path.name.startswith('zhusuan-')}
    if actual != set(all_names):
        raise ValueError('Unexpected or missing release assets in aggregate directory')
    write_checksums(directory, all_names)
    return all_names


def update_manifest_data(directory, tag, repository, notes):
    version_for_tag(tag)
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repository) or any(part in {'.', '..'} for part in repository.split('/')):
        raise ValueError('Repository must be a GitHub owner/repository name')
    all_names = verify_assets(directory, tag) + ['SHA256SUMS']
    require_asset(notes)
    return {
        'tag_name': tag,
        'html_url': f'https://github.com/{repository}/releases/tag/{tag}',
        'body': notes.read_text(encoding='utf-8'),
        'draft': False,
        'prerelease': False,
        'assets': [{
            'name': name,
            'browser_download_url': f'https://github.com/{repository}/releases/download/{tag}/{name}',
            'size': (directory/name).stat().st_size,
            'digest': f'sha256:{checksum(directory/name)}',
        } for name in sorted(all_names)],
    }


def write_update_manifest(directory, tag, repository, notes):
    data = update_manifest_data(directory, tag, repository, notes)
    (directory/'update.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def verify_update_manifest(directory, tag, repository, notes):
    path = directory/'update.json'
    require_asset(path)
    expected = update_manifest_data(directory, tag, repository, notes)
    if json.loads(path.read_text(encoding='utf-8')) != expected:
        raise ValueError('Update manifest does not match the verified version, URLs and asset digests')


def release_notes(root, tag, output):
    version = version_for_tag(tag)
    changelog = root/'CHANGELOG.md'
    text = changelog.read_text(encoding='utf-8') if changelog.exists() else ''
    match = re.search(rf'(?ms)^## \[{re.escape(version)}\][^\n]*\n(.*?)(?=^## \[|\Z)', text)
    body = match[1].strip() if match else ''
    output.write_text((body or f'zhusuan {tag}\n\nSee CHANGELOG.md for details.') + '\n', encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    sub = parser.add_subparsers(dest='command', required=True)
    metadata = sub.add_parser('metadata')
    metadata.add_argument('tag')
    assets = sub.add_parser('assets')
    assets.add_argument('tag')
    assets.add_argument('platform', choices=['darwin', 'windows', 'linux'])
    assets.add_argument('--source', type=Path, default=Path('bin'))
    assets.add_argument('--output', type=Path, default=Path('release'))
    verify = sub.add_parser('verify')
    verify.add_argument('tag')
    verify.add_argument('--directory', type=Path, default=Path('release'))
    verify.add_argument('--manifest', action='store_true')
    verify.add_argument('--repository', default='primordialweave/zhusuan')
    verify.add_argument('--notes', type=Path, default=Path('RELEASE_NOTES.md'))
    manifest = sub.add_parser('manifest')
    manifest.add_argument('tag')
    manifest.add_argument('--directory', type=Path, default=Path('release'))
    manifest.add_argument('--repository', default='primordialweave/zhusuan')
    manifest.add_argument('--notes', type=Path, default=Path('RELEASE_NOTES.md'))
    notes = sub.add_parser('notes')
    notes.add_argument('tag')
    notes.add_argument('--output', type=Path, default=Path('RELEASE_NOTES.md'))
    args = parser.parse_args()
    if args.command == 'metadata':
        print(sync_metadata(args.root, args.tag))
    elif args.command == 'assets':
        prepare_assets(args.source, args.output, args.tag, args.platform)
    elif args.command == 'verify':
        print('\n'.join(verify_assets(args.directory, args.tag)))
        if args.manifest:
            verify_update_manifest(args.directory, args.tag, args.repository, args.notes)
    elif args.command == 'manifest':
        write_update_manifest(args.directory, args.tag, args.repository, args.notes)
    else:
        release_notes(args.root, args.tag, args.output)


if __name__ == '__main__':
    main()
