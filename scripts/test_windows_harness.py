import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

REPO = Path(__file__).resolve().parents[1]
PWSH = os.environ.get('ZHUSUAN_PWSH') or shutil.which('pwsh')


def published_download_block():
    lines = (REPO/'.github/workflows/windows-installer-check.yml').read_text().splitlines()
    start = next(i for i, line in enumerate(lines) if 'name: Download published upgrade fixtures' in line)
    start = next(i for i in range(start, len(lines)) if lines[i].strip() == 'run: |') + 1
    end = next(i for i in range(start, len(lines)) if lines[i].startswith('      - '))
    return '\n'.join(line[10:] for line in lines[start:end])


class WindowsHarnessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not PWSH:
            raise unittest.SkipTest('PowerShell is needed for fixture helper/AST validation; set ZHUSUAN_PWSH')

    def run_helper(self, filename, function, body, extra_env=None):
        with tempfile.TemporaryDirectory(prefix='zhusuan-ps-fixture-') as temporary:
            root = Path(temporary)
            driver = root/'verify.ps1'
            driver.write_text('''$ErrorActionPreference = 'Stop'
$tokens = $null; $errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($env:ZHUSUAN_TEST_SOURCE, [ref]$tokens, [ref]$errors)
if ($errors.Count -ne 0) { throw 'Source PowerShell syntax is invalid.' }
$functions = @($ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $env:ZHUSUAN_TEST_FUNCTION }, $true))
if ($functions.Count -ne 1) { throw 'Requested isolated helper is missing or duplicated.' }
. ([scriptblock]::Create($functions[0].Extent.Text))
''' + body, encoding='utf-8')
            env = dict(os.environ, ZHUSUAN_TEST_SOURCE=str(REPO/'scripts'/filename),
                       ZHUSUAN_TEST_FUNCTION=function, ZHUSUAN_TEST_PRIVATE_ROOT=str(root/'profile'))
            if extra_env:
                env.update(extra_env)
            result = subprocess.run([PWSH, '-NoProfile', '-NonInteractive', '-File', str(driver)],
                                    env=env, capture_output=True, text=True, timeout=20)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            return json.loads(result.stdout.strip())

    def test_published_version_and_digest_follow_the_selected_tag(self):
        result = self.run_helper('windows-shell-upgrade-smoke.ps1', 'Get-PublishedFixtureDefinition', '''
@(
  (Get-PublishedFixtureDefinition 'v1.3.1' ('A' * 64)),
  (Get-PublishedFixtureDefinition 'v1.1.0' '')
) | ConvertTo-Json -Compress
''')
        self.assertEqual(result[0], {'Tag': 'v1.3.1', 'ExpectedVersion': '1.3.1', 'PublishedSHA256': 'a'*64})
        self.assertEqual(result[1]['ExpectedVersion'], '1.1.0')
        self.assertEqual(result[1]['PublishedSHA256'], '08a58fb008a0439e4d7ecd215cf1f202248167662e11284fe842a41bb35ddb78')

    def test_missing_new_digest_and_changed_legacy_digest_fail_closed(self):
        result = self.run_helper('windows-shell-upgrade-smoke.ps1', 'Get-PublishedFixtureDefinition', '''
$failures = @()
foreach ($case in @(@('v1.3.1', ''), @('v1.2.0', ('0' * 64)), @('v01.3.1', ('a' * 64)))) {
  try { Get-PublishedFixtureDefinition $case[0] $case[1] | Out-Null; throw 'Fixture unexpectedly accepted.' }
  catch { $failures += $_.Exception.Message }
}
$failures | ConvertTo-Json -Compress
''')
        self.assertIn('trusted published installer SHA256', result[0])
        self.assertIn('pinned immutable installer SHA256', result[1])
        self.assertIn('stable vMAJOR.MINOR.PATCH', result[2])

    def test_close_policy_is_written_to_the_isolated_profile(self):
        result = self.run_helper('windows-window-smoke.ps1', 'Write-PrivateQuitClosePolicy', '''
$path = Write-PrivateQuitClosePolicy $env:ZHUSUAN_TEST_PRIVATE_ROOT
$preferences = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
@{ relativePath = [System.IO.Path]::GetRelativePath($env:ZHUSUAN_TEST_PRIVATE_ROOT, $path); closeAction = $preferences.closeAction; files = @(Get-ChildItem -LiteralPath $env:ZHUSUAN_TEST_PRIVATE_ROOT -Recurse -File).Count } | ConvertTo-Json -Compress
''')
        self.assertEqual(Path(result['relativePath']).as_posix(), 'primordialweave/zhusuan/desktop-preferences.json')
        self.assertEqual(result['closeAction'], 'quit')
        self.assertEqual(result['files'], 1)

    def test_published_downloader_bridge_is_valid_powershell(self):
        with tempfile.TemporaryDirectory(prefix='zhusuan-ps-parse-') as temporary:
            driver = Path(temporary)/'parse.ps1'
            driver.write_text('''$tokens = $null; $errors = $null
[void][System.Management.Automation.Language.Parser]::ParseInput($env:ZHUSUAN_TEST_DOWNLOAD, [ref]$tokens, [ref]$errors)
if ($errors.Count -ne 0) { $errors | Out-String | Write-Error; exit 1 }
''', encoding='utf-8')
            result = subprocess.run([PWSH, '-NoProfile', '-NonInteractive', '-File', str(driver)],
                                    env=dict(os.environ, ZHUSUAN_TEST_DOWNLOAD=published_download_block()),
                                    capture_output=True, text=True, timeout=20)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def run_download_fixture(self, mode):
        with tempfile.TemporaryDirectory(prefix='zhusuan-download-fixture-') as temporary:
            root = Path(temporary)
            driver = root/'download.ps1'
            driver.write_text('''$ErrorActionPreference = 'Stop'
function gh {
  $arguments = @($args)
  $global:LASTEXITCODE = 0
  $payload = [System.Text.Encoding]::UTF8.GetBytes('trusted fixture installer')
  if ($arguments[0] -eq 'api') {
    $tag = $arguments[1].Split('/')[-1]
    $digest = 'sha256:' + $env:ZHUSUAN_TEST_SHA256
    if ($env:ZHUSUAN_TEST_MODE -eq 'fallback') { $digest = $null }
    if ($env:ZHUSUAN_TEST_MODE -eq 'tampered') { $digest = 'sha256:' + ('0' * 64) }
    @{ draft = $false; prerelease = $false; tag_name = $tag; assets = @(@{ name = "zhusuan-$tag-windows-amd64-installer.exe"; digest = $digest }) } | ConvertTo-Json -Compress -Depth 4
    return
  }
  if ($arguments[0] -ne 'release' -or $arguments[1] -ne 'download') { throw 'Unexpected GH command in isolated fixture.' }
  $tag = $arguments[2]
  $pattern = $arguments[[Array]::IndexOf($arguments, '--pattern') + 1]
  $directory = $arguments[[Array]::IndexOf($arguments, '--dir') + 1]
  if ($pattern -eq 'SHA256SUMS') {
    [System.IO.File]::WriteAllText((Join-Path $directory 'SHA256SUMS'), $env:ZHUSUAN_TEST_SHA256 + "  zhusuan-$tag-windows-amd64-installer.exe`n")
  } else {
    [System.IO.File]::WriteAllBytes((Join-Path $directory $pattern), $payload)
  }
}
''' + published_download_block() + '''
$exported = @{}
foreach ($line in Get-Content -LiteralPath $env:GITHUB_ENV) {
  $parts = $line.Split('=', 2); $exported[$parts[0]] = $parts[1]
}
$exported | ConvertTo-Json -Compress
''', encoding='utf-8')
            digest = hashlib.sha256(b'trusted fixture installer').hexdigest()
            env = dict(os.environ, RUNNER_TEMP=str(root), GITHUB_ENV=str(root/'github.env'),
                       GITHUB_REPOSITORY='fixture/repository', PREVIOUS_INSTALLER_TAG='v1.3.1',
                       PUBLISHED_INSTALLER_TAG='v1.4.0', ZHUSUAN_TEST_MODE=mode, ZHUSUAN_TEST_SHA256=digest)
            result = subprocess.run([PWSH, '-NoProfile', '-NonInteractive', '-File', str(driver)],
                                    env=env, capture_output=True, text=True, timeout=20)
            return result, digest, (root/'github.env').exists()

    def test_downloader_exports_verified_server_digests_for_selected_tags(self):
        result, digest, exported = self.run_download_fixture('digest')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        values = json.loads(result.stdout.strip())
        self.assertTrue(exported)
        self.assertEqual(values['PREVIOUS_INSTALLER_SHA256'], digest)
        self.assertEqual(values['PUBLISHED_INSTALLER_SHA256'], digest)
        self.assertTrue(values['PREVIOUS_INSTALLER'].endswith('zhusuan-v1.3.1-windows-amd64-installer.exe'))
        self.assertTrue(values['PUBLISHED_INSTALLER'].endswith('zhusuan-v1.4.0-windows-amd64-installer.exe'))

    def test_downloader_uses_the_published_checksum_when_server_digest_is_missing(self):
        result, digest, exported = self.run_download_fixture('fallback')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertTrue(exported)
        self.assertEqual(json.loads(result.stdout.strip())['PUBLISHED_INSTALLER_SHA256'], digest)

    def test_downloader_rejects_modified_bytes_before_exporting_fixture_provenance(self):
        result, _, exported = self.run_download_fixture('tampered')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('immutable release digest', result.stderr)
        self.assertFalse(exported)


if __name__ == '__main__':
    unittest.main()
