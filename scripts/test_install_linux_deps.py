import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


class LinuxDependencyMirrorTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='zhusuan-apt-fixture-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.keyring = self.root / 'ubuntu-archive-keyring.gpg'
        self.keyring.touch()
        self.script = self.root / 'install-linux-deps.sh'
        source = Path(__file__).with_name('install-linux-deps.sh').read_text()
        self.script.write_text(source.replace(
            'keyring=/usr/share/keyrings/ubuntu-archive-keyring.gpg',
            f'keyring="{self.keyring}"',
        ))
        self.commands = self.root / 'commands.jsonl'
        stub = self.root / 'command-stub'
        stub.write_text('''#!/usr/bin/env python3
import json, os, pathlib, subprocess, sys
name = pathlib.Path(sys.argv[0]).name
args = sys.argv[1:]
event = {'name': name, 'args': args}
if name == 'apt-get':
    sources = next(arg.split('=', 1)[1] for arg in args if arg.startswith('Dir::Etc::sourcelist='))
    event['sources'] = pathlib.Path(sources).read_text()
with open(os.environ['ZHUSUAN_APT_COMMANDS'], 'a') as output:
    output.write(json.dumps(event) + '\\n')
if name == 'sudo':
    sys.exit(subprocess.call(args))
if name == 'timeout':
    assert args[0] == '--kill-after=5s' and args[1] in ['50s', '130s', '180s']
    sys.exit(subprocess.call(args[2:]))
failure = os.environ['ZHUSUAN_APT_FAILURE']
azure = 'azure.archive.ubuntu.com' in event['sources']
update = 'update' in args
download = '--download-only' in args
if failure == 'all-update' and update:
    sys.exit(124)
if azure and ((failure == 'azure-update' and update) or (failure == 'azure-download' and download)):
    sys.exit(124)
if failure == 'install' and '--no-download' in args:
    sys.exit(100)
''')
        stub.chmod(0o755)
        for name in ['sudo', 'timeout', 'apt-get']:
            (self.root / name).symlink_to(stub)

    def run_fixture(self, failure=''):
        env = dict(os.environ, PATH=f'{self.root}:{os.environ["PATH"]}',
                   ZHUSUAN_APT_COMMANDS=str(self.commands), ZHUSUAN_APT_FAILURE=failure)
        result = subprocess.run(['bash', str(self.script), 'rpm'], env=env,
                                capture_output=True, text=True, timeout=10)
        events = [json.loads(line) for line in self.commands.read_text().splitlines()] if self.commands.exists() else []
        apt = [event for event in events if event['name'] == 'apt-get']
        for event in apt:
            self.assertIn('Suites: noble noble-updates noble-backports noble-security', event['sources'])
            self.assertIn('Components: main restricted universe multiverse', event['sources'])
            self.assertIn(f'Signed-By: {self.keyring}', event['sources'])
            self.assertIn('Dir::Etc::sourceparts=-', event['args'])
            self.assertIn('APT::Update::Error-Mode=any', event['args'])
            self.assertNotIn('--allow-unauthenticated', event['args'])
            if 'install' in event['args']:
                self.assertIn('--no-install-recommends', event['args'])
                self.assertEqual(event['args'][-4:], [
                    'libgtk-4-dev', 'libwebkitgtk-6.0-dev', 'build-essential', 'rpm',
                ])
                self.assertNotIn('libgtk-3-dev', event['args'])
                self.assertNotIn('libwebkit2gtk-4.1-dev', event['args'])
            sources = next(arg.split('=', 1)[1] for arg in event['args'] if arg.startswith('Dir::Etc::sourcelist='))
            self.assertFalse(Path(sources).exists(), 'temporary sources must be removed')
        budget = sum(int(event['args'][1][:-1]) + 5 for event in events if event['name'] == 'timeout')
        self.assertLessEqual(budget, 565)
        return result, apt

    def test_azure_success_downloads_before_installing_without_network(self):
        result, apt = self.run_fixture()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(apt), 3)
        self.assertTrue(all('azure.archive.ubuntu.com' in event['sources'] for event in apt))
        self.assertIn('--download-only', apt[1]['args'])
        self.assertIn('--no-download', apt[2]['args'])

    def test_update_timeout_switches_to_canonical(self):
        result, apt = self.run_fixture('azure-update')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(apt), 4)
        self.assertIn('https://archive.ubuntu.com/ubuntu/', apt[1]['sources'])
        self.assertIn('Mirror failed or timed out', result.stderr)

    def test_package_timeout_switches_to_canonical_before_dpkg(self):
        result, apt = self.run_fixture('azure-download')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(apt), 5)
        self.assertIn('https://archive.ubuntu.com/ubuntu/', apt[2]['sources'])
        self.assertEqual(sum('--no-download' in event['args'] for event in apt), 1)

    def test_both_mirrors_fail_without_starting_installation(self):
        result, apt = self.run_fixture('all-update')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(len(apt), 2)
        self.assertTrue(all('update' in event['args'] for event in apt))
        self.assertIn('either official Ubuntu mirror', result.stderr)

    def test_local_install_failure_is_returned_without_retrying_dpkg(self):
        result, apt = self.run_fixture('install')
        self.assertEqual(result.returncode, 100)
        self.assertEqual(len(apt), 3)

    def test_missing_archive_keyring_fails_before_any_command(self):
        self.keyring.unlink()
        result, apt = self.run_fixture()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(apt, [])
        self.assertIn('Ubuntu archive keyring is missing', result.stderr)


if __name__ == '__main__':
    unittest.main()
