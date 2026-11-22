param(
    [Parameter(Mandatory = $true)][string]$PreviousInstaller,
    [Parameter(Mandatory = $true)][string]$PublishedInstaller,
    [Parameter(Mandatory = $true)][string]$Installer,
    [string]$OutputDirectory = (Join-Path $env:RUNNER_TEMP 'zhusuan-shell-upgrade')
)

$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT' -or $env:GITHUB_ACTIONS -ne 'true') {
    throw 'Shell upgrade acceptance runs only in a disposable Windows GitHub runner.'
}
if (-not [Environment]::UserInteractive) {
    throw 'Shell upgrade acceptance requires an interactive desktop and cannot be skipped.'
}
if ([string]::IsNullOrWhiteSpace($env:RUNNER_TEMP)) { throw 'RUNNER_TEMP is required.' }

$registration = 'Software\Microsoft\Windows\CurrentVersion\Uninstall\PrimordialWeaveZhusuan'
$registryPath = 'HKCU:\' + $registration
$machineRegistryPath = 'HKLM:\' + $registration
$productName = [string][char]0x73E0 + [char]0x7B97
$desktopLink = Join-Path ([Environment]::GetFolderPath('Desktop')) ($productName + '.lnk')
$startLink = Join-Path ([Environment]::GetFolderPath('Programs')) ($productName + '.lnk')
if ((Test-Path -LiteralPath $registryPath) -or (Test-Path -LiteralPath $machineRegistryPath) -or
    (Test-Path -LiteralPath $desktopLink) -or (Test-Path -LiteralPath $startLink)) {
    throw 'The runner already contains a zhusuan installation or shortcut; nothing was changed.'
}

$probePath = Join-Path $PSScriptRoot 'windows-taskbar-smoke.ps1'
if (-not (Test-Path -LiteralPath $probePath -PathType Leaf)) { throw 'Taskbar probe script is missing.' }
$phaseInputs = @(
    @{ Name = '01-previous-1.1.0'; Installer = (Resolve-Path -LiteralPath $PreviousInstaller).Path; ExpectedVersion = '1.1.0'; RecordOnly = $true },
    @{ Name = '02-published-1.2.0'; Installer = (Resolve-Path -LiteralPath $PublishedInstaller).Path; ExpectedVersion = '1.2.0'; RecordOnly = $true },
    @{ Name = '03-fixed-candidate'; Installer = (Resolve-Path -LiteralPath $Installer).Path; ExpectedVersion = $null; RecordOnly = $false }
)
$artifacts = [System.IO.Path]::GetFullPath($OutputDirectory)
if ((Test-Path -LiteralPath $artifacts) -and @(Get-ChildItem -LiteralPath $artifacts -Force).Count -gt 0) {
    throw 'The requested diagnostics directory is not empty; existing artifacts were preserved.'
}
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$fixtureId = [Guid]::NewGuid().ToString('N')
$target = Join-Path $env:RUNNER_TEMP ('zhusuan shell upgrade installation ' + $fixtureId)
$privateRoot = Join-Path $env:RUNNER_TEMP ('zhusuan-shell-private-' + $fixtureId)
$ownerMarker = Join-Path $target '.zhusuan-shell-upgrade-owner'
$executable = Join-Path $target 'zhusuan.exe'
$links = @($desktopLink, $startLink)

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;

[ComImport, Guid("00021401-0000-0000-C000-000000000046")]
internal class ZhusuanUpgradeShellLink { }
[ComImport, Guid("000214F9-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IZhusuanUpgradeShellLinkW {
    [PreserveSig] int GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder path, int capacity, IntPtr data, uint flags);
    [PreserveSig] int GetIDList(out IntPtr list);
    [PreserveSig] int SetIDList(IntPtr list);
    [PreserveSig] int GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder text, int capacity);
    [PreserveSig] int SetDescription([MarshalAs(UnmanagedType.LPWStr)] string text);
    [PreserveSig] int GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder text, int capacity);
}
public static class ZhusuanUpgradePaths {
    public static string[] Read(string path) {
        object instance = new ZhusuanUpgradeShellLink();
        try {
            ((IPersistFile)instance).Load(path, 0);
            var target = new StringBuilder(32768);
            var directory = new StringBuilder(32768);
            Marshal.ThrowExceptionForHR(((IZhusuanUpgradeShellLinkW)instance).GetPath(target, target.Capacity, IntPtr.Zero, 4));
            Marshal.ThrowExceptionForHR(((IZhusuanUpgradeShellLinkW)instance).GetWorkingDirectory(directory, directory.Capacity));
            if (target.Length == 0) throw new InvalidOperationException("Shortcut target is empty.");
            return new[] { target.ToString(), directory.ToString() };
        } finally { Marshal.FinalReleaseComObject(instance); }
    }
}
'@

function Paths-Equal([string]$first, [string]$second) {
    if ([string]::IsNullOrWhiteSpace($first) -or [string]::IsNullOrWhiteSpace($second)) { return $false }
    $left = [System.IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($first)).TrimEnd('\')
    $right = [System.IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($second)).TrimEnd('\')
    return [string]::Equals($left, $right, [StringComparison]::OrdinalIgnoreCase)
}
function Fixture-Owned {
    return (Test-Path -LiteralPath $ownerMarker -PathType Leaf) -and
        [System.IO.File]::ReadAllText($ownerMarker) -eq $fixtureId
}
function Registration-Owned {
    if (-not (Fixture-Owned) -or -not (Test-Path -LiteralPath $registryPath)) { return $false }
    return Paths-Equal (Get-ItemProperty -LiteralPath $registryPath).InstallLocation $target
}
function Get-OwnedProcesses {
    if (-not (Fixture-Owned)) { return @() }
    return @(Get-CimInstance Win32_Process -Filter "Name='zhusuan.exe'" | Where-Object {
        $_.ExecutablePath -and (Paths-Equal $_.ExecutablePath $executable)
    })
}
function Run-OwnedInstaller([string]$path, [string]$arguments, [string]$logPath) {
    $start = [System.Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $path
    $start.Arguments = $arguments
    $start.WorkingDirectory = $target
    $start.UseShellExecute = $false
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $start
    $stdout = $null
    $stderr = $null
    try {
        if (-not $process.Start()) { throw 'The owned installer process did not start.' }
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(120000)) {
            $process.Kill($true)
            [void]$process.WaitForExit(10000)
            throw 'The owned installer exceeded its two-minute bound.'
        }
        return $process.ExitCode
    } finally {
        try {
            $outputText = if ($stdout -and $stdout.IsCompleted) { $stdout.GetAwaiter().GetResult() } else { '' }
            $errorText = if ($stderr -and $stderr.IsCompleted) { $stderr.GetAwaiter().GetResult() } else { '' }
            [System.IO.File]::WriteAllText($logPath, $outputText + $errorText)
        } catch { Write-Warning ('Unable to save owned installer output: ' + $_.Exception.Message) }
        $process.Dispose()
    }
}
function Write-PrivateEnvironment([string]$phaseDirectory) {
    $bytes = [byte[]]::new(48)
    $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $random.GetBytes($bytes) } finally { $random.Dispose() }
    $configRoot = (Join-Path $privateRoot 'config').Replace('\', '/')
    $databasePath = (Join-Path $privateRoot 'shell-check.db').Replace('\', '/')
    $logPath = (Join-Path $phaseDirectory 'application.log').Replace('\', '/')
    # ZHUSUAN_CONFIG_ROOT also places the application's WebView2 data under this private tree.
    $lines = @(
        'ENV=development', 'RUNTIME_MODE=desktop', 'DB_TYPE=sqlite',
        ('DB_PATH="' + $databasePath + '"'), ('ZHUSUAN_CONFIG_ROOT="' + $configRoot + '"'),
        'ENABLE_API_SERVER=false', 'LOG_ENABLE=false', 'LOG_LEVEL=warn',
        ('LOG_PATH="' + $logPath + '"'), ('JWT_SECRET=' + [Convert]::ToBase64String($bytes))
    )
    [System.IO.File]::WriteAllLines((Join-Path $target '.env'), $lines, [System.Text.UTF8Encoding]::new($false))
}

$report = [ordered]@{
    passed = $false; target = $target; phases = @(); error = $null; cleanup = $null
    explorerRestarted = $false; iconCacheDeleted = $false; uninstalledBetweenPhases = $false
}
$cleanupErrors = [System.Collections.Generic.List[string]]::new()
try {
    New-Item -ItemType Directory -Path $target | Out-Null
    [System.IO.File]::WriteAllText($ownerMarker, $fixtureId)
    New-Item -ItemType Directory -Path $privateRoot | Out-Null
    foreach ($phase in $phaseInputs) {
        if (@(Get-OwnedProcesses).Count -ne 0) { throw 'The prior owned application process is still running.' }
        $phaseDirectory = Join-Path $artifacts $phase.Name
        New-Item -ItemType Directory -Path $phaseDirectory | Out-Null
        $exitCode = Run-OwnedInstaller $phase.Installer ('/S /D=' + $target) (Join-Path $phaseDirectory 'installer.log')
        if ($exitCode -ne 0) { throw "Installer phase '$($phase.Name)' failed with exit code $exitCode." }
        if (-not (Test-Path -LiteralPath $executable -PathType Leaf) -or -not (Registration-Owned)) {
            throw "Installer phase '$($phase.Name)' did not create the owned registered executable."
        }
        $version = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($executable)
        if ($phase.ExpectedVersion -and $version.ProductVersion -ne $phase.ExpectedVersion) {
            throw "Installer phase '$($phase.Name)' contains an unexpected ProductVersion."
        }
        if ($version.ProductName -ne $productName) { throw 'Installed PE ProductName is not Unicode zhusuan.' }
        foreach ($link in $links) {
            if (-not (Test-Path -LiteralPath $link -PathType Leaf)) { throw 'The installed shortcut is missing.' }
            $identity = [ZhusuanUpgradePaths]::Read($link)
            if (-not (Paths-Equal $identity[0] $executable) -or -not (Paths-Equal $identity[1] $target)) {
                throw 'The installed shortcut does not target the owned executable/working directory.'
            }
        }
        Write-PrivateEnvironment $phaseDirectory
        $phaseRecord = [ordered]@{
            name = $phase.Name; recordOnly = $phase.RecordOnly; installerExitCode = $exitCode
            installerSHA256 = (Get-FileHash -LiteralPath $phase.Installer -Algorithm SHA256).Hash
            executableSHA256 = (Get-FileHash -LiteralPath $executable -Algorithm SHA256).Hash
            productVersion = $version.ProductVersion; displayVersion = (Get-ItemProperty -LiteralPath $registryPath).DisplayVersion
            sameInstallDirectory = $target; probe = $null
        }
        $report.phases += $phaseRecord
        $report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $artifacts 'shell-upgrade-verification.json') -Encoding utf8
        $probeArguments = @{ Executable = $executable; LaunchShortcut = $desktopLink; OutputDirectory = $phaseDirectory }
        if ($phase.RecordOnly) { $probeArguments.RecordOnly = $true }
        $probeReport = Join-Path $phaseDirectory 'taskbar-verification.json'
        try {
            & $probePath @probeArguments
        } finally {
            if (Test-Path -LiteralPath $probeReport -PathType Leaf) {
                $phaseRecord.probe = Get-Content -LiteralPath $probeReport -Raw | ConvertFrom-Json
            }
        }
        if (-not (Test-Path -LiteralPath $probeReport -PathType Leaf)) { throw 'The taskbar probe did not save its observation.' }
        if (-not $phaseRecord.probe.passed) { throw 'The taskbar phase did not capture a valid native popup.' }
        if (-not $phase.RecordOnly -and (-not $phaseRecord.probe.labelCorrect -or $phaseRecord.probe.recordOnly)) {
            throw 'The fixed candidate did not pass the normal taskbar label assertion.'
        }
        if (@(Get-OwnedProcesses).Count -ne 0) { throw 'The taskbar probe left its owned application running.' }
    }
    if ($report.phases[1].executableSHA256 -eq $report.phases[2].executableSHA256) {
        throw 'The fixed candidate has the same application payload as published v1.2.0.'
    }
    $report.passed = $true
    Write-Host 'Passed three same-path installed taskbar phases without restarting Explorer or clearing icon caches.'
} catch {
    $report.error = $_.Exception.Message
    throw
} finally {
    $cleanup = [ordered]@{ uninstallerExitCode = $null; fallbackRegistryRemoved = $false; fallbackLinksRemoved = @(); fixtureRemoved = $false }
    try {
        foreach ($ownedProcess in @(Get-OwnedProcesses)) { Stop-Process -Id $ownedProcess.ProcessId -Force -ErrorAction Stop }
        $processDeadline = [DateTime]::UtcNow.AddSeconds(10)
        while (@(Get-OwnedProcesses).Count -gt 0 -and [DateTime]::UtcNow -lt $processDeadline) {
            Start-Sleep -Milliseconds 100
        }
        if (@(Get-OwnedProcesses).Count -gt 0) { throw 'An owned application is still running; cleanup refused to uninstall it.' }
        if (Fixture-Owned) {
            $uninstaller = Join-Path $target 'uninstall.exe'
            if ((Test-Path -LiteralPath $uninstaller -PathType Leaf) -and (Registration-Owned)) {
                $cleanup.uninstallerExitCode = Run-OwnedInstaller $uninstaller '/S' (Join-Path $artifacts 'uninstaller.log')
                $deadline = [DateTime]::UtcNow.AddSeconds(15)
                while (((Test-Path -LiteralPath $registryPath) -or (Test-Path -LiteralPath $executable)) -and [DateTime]::UtcNow -lt $deadline) {
                    Start-Sleep -Milliseconds 100
                }
            }
            # Only the fresh fixture's exact registered path and Unicode link targets prove ownership.
            if (Test-Path -LiteralPath $registryPath) {
                if (-not (Registration-Owned)) { throw 'Cleanup refused a registration that no longer belongs to the fixture.' }
                Remove-Item -LiteralPath $registryPath -Recurse -Force
                $cleanup.fallbackRegistryRemoved = $true
            }
            foreach ($link in $links) {
                if (Test-Path -LiteralPath $link) {
                    $identity = [ZhusuanUpgradePaths]::Read($link)
                    if (-not (Paths-Equal $identity[0] $executable)) { throw 'Cleanup refused a shortcut that no longer targets the fixture.' }
                    Remove-Item -LiteralPath $link -Force
                    $cleanup.fallbackLinksRemoved += $link
                }
            }
            Remove-Item -LiteralPath $target -Recurse -Force
            $cleanup.fixtureRemoved = $true
        }
    } catch { $cleanupErrors.Add($_.Exception.Message) }
    try { if (Test-Path -LiteralPath $privateRoot) { Remove-Item -LiteralPath $privateRoot -Recurse -Force } } catch { $cleanupErrors.Add($_.Exception.Message) }
    $cleanup.errors = @($cleanupErrors)
    $report.cleanup = $cleanup
    if ($cleanupErrors.Count -gt 0) { $report.passed = $false }
    $report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $artifacts 'shell-upgrade-verification.json') -Encoding utf8
    if ($cleanupErrors.Count -gt 0) {
        if (-not $report.error) { throw ('Owned fixture cleanup failed: ' + ($cleanupErrors -join '; ')) }
        Write-Warning ('Owned fixture cleanup also failed: ' + ($cleanupErrors -join '; '))
    }
}
