#!/usr/bin/env python3
"""Create architecture-specific DMG installers and ZIP update payloads on macOS."""
import argparse
import os
import plistlib
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ARCHITECTURES = {'arm64': 'arm64', 'amd64': 'x86_64'}


def command(*args):
    return subprocess.run([str(arg) for arg in args], check=True, capture_output=True, timeout=600).stdout


def bundle_metadata(app, tag):
    if not re.fullmatch(r'v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', tag):
        raise ValueError('tag must be vMAJOR.MINOR.PATCH')
    if app.name not in ['zhusuan.app', '珠算.app'] or not app.is_dir() or app.is_symlink():
        raise ValueError('input must be a 珠算.app or legacy zhusuan.app bundle directory')
    with (app/'Contents/Info.plist').open('rb') as file:
        metadata = plistlib.load(file)
    expected = {'CFBundleIdentifier': 'org.primordialweave.zhusuan',
                'CFBundleExecutable': 'zhusuan',
                'CFBundleShortVersionString': tag[1:], 'CFBundleVersion': tag[1:]}
    for key, value in expected.items():
        if metadata.get(key) != value:
            raise ValueError(f'{key} must be {value}, got {metadata.get(key)!r}')
    binary = app/'Contents/MacOS/zhusuan'
    if not binary.is_file() or binary.is_symlink():
        raise ValueError('bundle executable must be a regular file')
    return binary


def verify_architecture(binary, arch):
    actual = command('/usr/bin/lipo', binary, '-archs').decode().strip().split()
    if actual != [ARCHITECTURES[arch]]:
        raise ValueError(f'expected only {ARCHITECTURES[arch]}, got {actual}')


def verify_dmg(dmg, work, tag, arch):
    command('/usr/bin/hdiutil', 'verify', '-quiet', dmg)
    mount = work/'mounted'; mount.mkdir()
    attached = False
    try:
        command('/usr/bin/hdiutil', 'attach', '-readonly', '-nobrowse', '-mountpoint', mount, dmg)
        attached = True
        if not (mount/'Applications').is_symlink() or os.readlink(mount/'Applications') != '/Applications':
            raise ValueError('DMG must contain the Applications installation shortcut')
        binary = bundle_metadata(mount/'珠算.app', tag)
        verify_architecture(binary, arch)
        command('/usr/bin/codesign', '--verify', '--deep', '--strict', mount/'珠算.app')
    finally:
        if attached:
            command('/usr/bin/hdiutil', 'detach', mount)


def build_packages(app, arch, tag, output, overwrite=False):
    if sys.platform != 'darwin':
        raise ValueError('macOS packaging requires a macOS host')
    binary = bundle_metadata(app, tag)
    source_arches = command('/usr/bin/lipo', binary, '-archs').decode().strip().split()
    if ARCHITECTURES[arch] not in source_arches:
        raise ValueError(f'input executable lacks {ARCHITECTURES[arch]}')
    output.mkdir(parents=True, exist_ok=True)
    prefix = f'zhusuan-{tag}-macOS-{arch}'
    targets = [output/(prefix+'.dmg'), output/(prefix+'.zip')]
    if not overwrite and any(target.exists() for target in targets):
        raise ValueError('output already exists; use a clean output directory')
    with tempfile.TemporaryDirectory(prefix='.zhusuan-package-', dir=output) as temporary:
        work = Path(temporary); installer = work/'installer'; installer.mkdir()
        staged = installer/'珠算.app'
        command('/usr/bin/ditto', app, staged)
        staged_binary = staged/'Contents/MacOS/zhusuan'
        if len(source_arches) > 1:
            thin = work/'executable'
            command('/usr/bin/lipo', staged_binary, '-thin', ARCHITECTURES[arch], '-output', thin)
            os.chmod(thin, staged_binary.stat().st_mode & 0o777)
            os.replace(thin, staged_binary)
            # Thinning changes a copied bundle only; current distribution uses ad-hoc signing.
            command('/usr/bin/codesign', '--force', '--deep', '--sign', '-', staged)
        verify_architecture(staged_binary, arch)
        bundle_metadata(staged, tag)
        command('/usr/bin/codesign', '--verify', '--deep', '--strict', staged)
        (installer/'Applications').symlink_to('/Applications')
        dmg = work/(prefix+'.dmg'); archive = work/(prefix+'.zip')
        command('/usr/bin/hdiutil', 'create', '-volname', '珠算', '-fs', 'HFS+',
                '-srcfolder', installer, '-format', 'UDZO', '-nospotlight', dmg)
        verify_dmg(dmg, work, tag, arch)
        # ZIP root stays ASCII for already installed 1.0 updaters.
        update = work/'update'; update.mkdir()
        update_app = update/'zhusuan.app'
        command('/usr/bin/ditto', staged, update_app)
        command('/usr/bin/ditto', '-c', '-k', '--sequesterRsrc', '--keepParent', update_app, archive)
        if not dmg.stat().st_size or not archive.stat().st_size:
            raise ValueError('packager produced an empty artifact')
        for source, target in zip([dmg, archive], targets):
            os.replace(source, target)
    return targets


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--app', type=Path, required=True)
    parser.add_argument('--arch', choices=ARCHITECTURES, required=True)
    parser.add_argument('--tag', required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--overwrite', action='store_true', help='Replace generated package files after verification')
    args = parser.parse_args()
    for path in build_packages(args.app.resolve(), args.arch, args.tag, args.output.resolve(), args.overwrite):
        print(path)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        detail = error.stderr.decode(errors='replace') if isinstance(error, subprocess.CalledProcessError) and error.stderr else str(error)
        print(detail, file=sys.stderr)
        sys.exit(1)
