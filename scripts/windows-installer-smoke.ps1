param([Parameter(Mandatory=$true)][string]$Installer)
$ErrorActionPreference = 'Stop'
$registration = 'Software\Microsoft\Windows\CurrentVersion\Uninstall\PrimordialWeaveZhusuan'
$key = 'HKCU:\' + $registration
$machineKey = 'HKLM:\' + $registration
$legacyRegistration = 'Software\Microsoft\Windows\CurrentVersion\Uninstall\FruitsAIOrange'
$legacyKey = 'HKCU:\' + $legacyRegistration
$legacyMachineKey = 'HKLM:\' + $legacyRegistration
foreach ($registrationKey in @($key, $machineKey, $legacyKey, $legacyMachineKey)) {
    if (Test-Path $registrationKey) { throw 'Smoke test requires a clean CI runner without Orange or zhusuan registration.' }
}
$target = Join-Path $env:RUNNER_TEMP 'zhusuan installer smoke with spaces'
$legacyTarget = Join-Path $env:RUNNER_TEMP 'Orange original installation'
$machineTarget = Join-Path $env:RUNNER_TEMP 'zhusuan prior machine installation'
$defaultTarget = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'PrimordialWeave\zhusuan'
$desktop = [Environment]::GetFolderPath('Desktop')
$startMenu = [Environment]::GetFolderPath('Programs')
$productName = [string][char]0x73E0 + [char]0x7B97
$shortcut = Join-Path $desktop ($productName + '.lnk')
$startShortcut = Join-Path $startMenu ($productName + '.lnk')
$legacyShortcut = Join-Path $desktop 'Orange.lnk'
if ((Test-Path $defaultTarget) -or (Test-Path $legacyShortcut) -or (Test-Path $shortcut)) {
    throw 'Smoke test requires clean owned directories and shortcuts.'
}
$installerPath = (Resolve-Path $Installer).Path
function Run-Installer([string]$arguments) {
    $process = Start-Process -FilePath $installerPath -ArgumentList $arguments -PassThru -Wait
    return $process.ExitCode
}
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;

[ComImport, Guid("00021401-0000-0000-C000-000000000046")]
internal class ZhusuanShellLink { }

[ComImport, Guid("000214F9-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IZhusuanShellLinkW {
    [PreserveSig] int GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder path, int capacity, IntPtr findData, uint flags);
    [PreserveSig] int GetIDList(out IntPtr itemList);
    [PreserveSig] int SetIDList(IntPtr itemList);
    [PreserveSig] int GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder description, int capacity);
    [PreserveSig] int SetDescription([MarshalAs(UnmanagedType.LPWStr)] string description);
    [PreserveSig] int GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder directory, int capacity);
    [PreserveSig] int SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string directory);
    [PreserveSig] int GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder arguments, int capacity);
    [PreserveSig] int SetArguments([MarshalAs(UnmanagedType.LPWStr)] string arguments);
    [PreserveSig] int GetHotkey(out short hotkey);
    [PreserveSig] int SetHotkey(short hotkey);
    [PreserveSig] int GetShowCmd(out int showCommand);
    [PreserveSig] int SetShowCmd(int showCommand);
    [PreserveSig] int GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder iconPath, int capacity, out int iconIndex);
    [PreserveSig] int SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string iconPath, int iconIndex);
    [PreserveSig] int SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string path, uint reserved);
    [PreserveSig] int Resolve(IntPtr window, uint flags);
    [PreserveSig] int SetPath([MarshalAs(UnmanagedType.LPWStr)] string path);
}

public static class ZhusuanSmokePaths {
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, ExactSpelling = true, SetLastError = true)]
    public static extern uint GetLongPathNameW(string path, StringBuilder result, uint size);

    public static string ReadShortcutTarget(string shortcut) {
        object instance = new ZhusuanShellLink();
        try {
            // IPersistFile.Load takes a Unicode filename; STGM_READ is zero.
            ((IPersistFile)instance).Load(shortcut, 0);
            var buffer = new StringBuilder(32768);
            int result = ((IZhusuanShellLinkW)instance).GetPath(buffer, buffer.Capacity, IntPtr.Zero, 4);
            Marshal.ThrowExceptionForHR(result);
            if (result != 0 || buffer.Length == 0) {
                throw new InvalidOperationException("IShellLinkW.GetPath returned no target (HRESULT 0x" + result.ToString("X8") + ").");
            }
            return buffer.ToString();
        } finally {
            if (Marshal.IsComObject(instance)) Marshal.FinalReleaseComObject(instance);
        }
    }
}
'@
function Resolve-ExecutablePath([string]$rawPath) {
    if ([string]::IsNullOrWhiteSpace($rawPath)) { throw 'Shortcut executable path is empty.' }
    $expanded = [Environment]::ExpandEnvironmentVariables($rawPath)
    $hasRoot = $expanded -match '^[A-Za-z]:[\\/]' -or $expanded.StartsWith('\\')
    if ($expanded -match '%[^%]+%' -or -not $hasRoot) {
        throw "Shortcut executable path is unresolved or relative: '$rawPath'."
    }
    $fullPath = [System.IO.Path]::GetFullPath($expanded)
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        throw "Shortcut executable does not exist: '$fullPath'."
    }
    $buffer = New-Object System.Text.StringBuilder 32768
    $length = [ZhusuanSmokePaths]::GetLongPathNameW($fullPath, $buffer, $buffer.Capacity)
    if ($length -eq 0 -or $length -ge $buffer.Capacity) {
        throw "Unable to resolve long executable path '$fullPath' (Win32 error $([Runtime.InteropServices.Marshal]::GetLastWin32Error()))."
    }
    return $buffer.ToString()
}
function Write-ShortcutDiagnostics([string]$link) {
    try {
        $diagnostics = Join-Path $env:RUNNER_TEMP 'zhusuan-installer-diagnostics'
        New-Item -ItemType Directory -Path $diagnostics -Force | Out-Null
        $parent = [System.IO.Path]::GetFileName([System.IO.Path]::GetDirectoryName($link))
        Copy-Item -LiteralPath $link -Destination (Join-Path $diagnostics ($parent + '-shortcut.lnk')) -Force
        $bytes = [System.IO.File]::ReadAllBytes($link)
        $flags = if ($bytes.Length -ge 24) { '0x{0:X8}' -f [BitConverter]::ToUInt32($bytes, 20) } else { '<missing header>' }
        Write-Host "Shortcut diagnostics: path='$link'; bytes=$($bytes.Length); LinkFlags=$flags."
        if ($bytes.Length -le 16384) {
            Write-Host "Shortcut file base64: $([Convert]::ToBase64String($bytes))"
        } else {
            Write-Host 'Shortcut base64 omitted because the file exceeds 16 KiB.'
        }
    } catch {
        Write-Host "Unable to read shortcut binary diagnostics: $_"
    }
    $shellApplication = $null
    $folder = $null
    $item = $null
    try {
        $shellApplication = New-Object -ComObject Shell.Application
        $folder = $shellApplication.Namespace([System.IO.Path]::GetDirectoryName($link))
        $item = $folder.ParseName([System.IO.Path]::GetFileName($link))
        Write-Host "Shell.Application TargetParsingPath='$($item.ExtendedProperty('System.Link.TargetParsingPath'))'."
    } catch {
        Write-Host "Unable to read Shell.Application shortcut diagnostics: $_"
    } finally {
        foreach ($comObject in @($item, $folder, $shellApplication)) {
            if ($null -ne $comObject -and [Runtime.InteropServices.Marshal]::IsComObject($comObject)) {
                [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($comObject)
            }
        }
    }
}
function Uninstall-Owned([string]$directory, [string]$registrationKey) {
    $uninstaller = Join-Path $directory 'uninstall.exe'
    if (Test-Path $uninstaller) {
        Start-Process -FilePath $uninstaller -ArgumentList '/S' -PassThru -Wait | Out-Null
        $deadline = [DateTime]::UtcNow.AddSeconds(15)
        while (((Test-Path $registrationKey) -or (Test-Path (Join-Path $directory 'zhusuan.exe'))) -and [DateTime]::UtcNow -lt $deadline) {
            Start-Sleep -Milliseconds 100
        }
        if ((Test-Path $registrationKey) -or (Test-Path (Join-Path $directory 'zhusuan.exe'))) {
            throw 'Uninstaller did not remove the owned executable and installation record.'
        }
    }
}
function Assert-LegacyRetained {
    if ((Get-FileHash (Join-Path $legacyTarget 'Orange.exe') -Algorithm SHA256).Hash -ne $script:legacyHash) {
        throw 'New installation changed the legacy Orange executable.'
    }
    if ((Get-FileHash (Join-Path $legacyTarget 'uninstall.exe') -Algorithm SHA256).Hash -ne $script:legacyUninstallerHash) {
        throw 'New installation replaced the old Orange uninstaller.'
    }
    if (-not (Test-Path $legacyKey) -or -not (Test-Path $legacyMachineKey) -or -not (Test-Path $legacyShortcut)) {
        throw 'New installation removed old Orange registration or shortcut.'
    }
}
try {
    # An existing Orange must not select the new application's installation path.
    New-Item -ItemType Directory -Path $legacyTarget -Force | Out-Null
    Set-Content -Path (Join-Path $legacyTarget 'Orange.exe') -Value 'legacy Orange executable fixture'
    Set-Content -Path (Join-Path $legacyTarget 'uninstall.exe') -Value 'legacy Orange uninstaller fixture'
    $script:legacyHash = (Get-FileHash (Join-Path $legacyTarget 'Orange.exe') -Algorithm SHA256).Hash
    $script:legacyUninstallerHash = (Get-FileHash (Join-Path $legacyTarget 'uninstall.exe') -Algorithm SHA256).Hash
    foreach ($registrationKey in @($legacyKey, $legacyMachineKey)) {
        New-Item -Path $registrationKey -Force | Out-Null
        New-ItemProperty -Path $registrationKey -Name DisplayName -Value 'Orange' -PropertyType String -Force | Out-Null
        New-ItemProperty -Path $registrationKey -Name InstallLocation -Value $legacyTarget -PropertyType String -Force | Out-Null
    }
    $shell = New-Object -ComObject WScript.Shell
    $oldLink = $shell.CreateShortcut($legacyShortcut)
    $oldLink.TargetPath = Join-Path $legacyTarget 'Orange.exe'
    $oldLink.Save()
    if ((Run-Installer '/S') -ne 0) { throw 'Default per-user installation failed.' }
    $defaultExe = Join-Path $defaultTarget 'zhusuan.exe'
    if (-not (Test-Path $defaultExe)) { throw 'Installer did not use LOCALAPPDATA\PrimordialWeave\zhusuan.' }
    if ((Get-ItemProperty $key).InstallLocation -ne $defaultTarget -or (Test-Path $machineKey)) {
        throw 'Default installation did not remain per-user in HKCU.'
    }
    if ((Get-ItemProperty $key).DisplayName -ne $productName) { throw 'Chinese product name was decoded incorrectly.' }
    foreach ($link in @($shortcut, $startShortcut)) {
        if (-not (Test-Path $link)) { throw 'Chinese current-user shortcut was not created.' }
        $rawTarget = $shell.CreateShortcut($link).TargetPath
        Write-Host "Shortcut '$link': raw='$rawTarget'; expected='$defaultExe'."
        try {
            $nativeTarget = [ZhusuanSmokePaths]::ReadShortcutTarget($link)
        } catch {
            Write-ShortcutDiagnostics $link
            throw
        }
        Write-Host "Shortcut '$link': IShellLinkW raw='$nativeTarget'."
        $normalizedTarget = Resolve-ExecutablePath $nativeTarget
        $normalizedExpected = Resolve-ExecutablePath $defaultExe
        Write-Host "Shortcut '$link': normalized='$normalizedTarget'; normalizedExpected='$normalizedExpected'."
        if (-not [string]::Equals($normalizedTarget, $normalizedExpected, [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Shortcut target does not reference the new per-user executable.'
        }
        if ((Get-FileHash -LiteralPath $normalizedTarget -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $normalizedExpected -Algorithm SHA256).Hash) {
            throw 'Shortcut target content does not match the installed per-user executable.'
        }
    }
    Assert-LegacyRetained
    if ((Run-Installer "/S /UPDATE /D=$legacyTarget") -eq 0) { throw 'Orange-only directory incorrectly accepted an automated zhusuan update.' }
    Assert-LegacyRetained
    Set-Content -Path (Join-Path $defaultTarget 'unrelated-data.txt') -Value 'retained user data'
    Uninstall-Owned $defaultTarget $key
    if (-not (Test-Path (Join-Path $defaultTarget 'unrelated-data.txt'))) { throw 'Uninstaller deleted unrelated data.' }
    Assert-LegacyRetained

    if ((Run-Installer "/S /D=$target") -ne 0) { throw 'Explicit custom per-user installation failed.' }
    $exe = Join-Path $target 'zhusuan.exe'
    if ((Get-ItemProperty $key).InstallLocation -ne $target) { throw 'Explicit path was not persisted.' }
    if ((Run-Installer '/S') -ne 0) { throw 'Existing zhusuan path discovery failed.' }
    if ((Get-ItemProperty $key).InstallLocation -ne $target) { throw 'Reinstallation changed the existing zhusuan path.' }
    Remove-ItemProperty -Path $key -Name InstallLocation
    $installationKey = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($registration, $true)
    if ($null -eq $installationKey) { throw 'User registration could not be opened for writing.' }
    try { $installationKey.DeleteValue('', $false) } finally { $installationKey.Dispose() }
    if ((Run-Installer '/S') -ne 0) { throw 'Existing zhusuan DisplayIcon fallback failed.' }
    if ((Get-ItemProperty $key).InstallLocation -ne $target) { throw 'DisplayIcon recovery changed the zhusuan path.' }
    $before = (Get-FileHash $exe -Algorithm SHA256).Hash
    $lock = [System.IO.File]::Open($exe, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::None)
    try {
        if ((Run-Installer "/S /UPDATE /D=$target") -eq 0) { throw 'Locked zhusuan incorrectly reported successful update.' }
    } finally { $lock.Dispose() }
    if ((Get-FileHash $exe -Algorithm SHA256).Hash -ne $before) { throw 'Failed update changed existing zhusuan.' }
    if ((Run-Installer "/S /UPDATE /D=$target") -ne 0) { throw 'User-directory update failed after unlocking.' }
    if (Test-Path "$exe.update-backup") { throw 'Successful update left an executable backup.' }
    Assert-LegacyRetained

    # Simulate the new 1.0 machine identity in a private writable CI location.
    New-Item -ItemType Directory -Path $machineTarget -Force | Out-Null
    Copy-Item $exe (Join-Path $machineTarget 'zhusuan.exe')
    New-Item -Path $machineKey -Force | Out-Null
    New-ItemProperty -Path $machineKey -Name DisplayName -Value $productName -PropertyType String -Force | Out-Null
    New-ItemProperty -Path $machineKey -Name DisplayVersion -Value '1.0.0' -PropertyType String -Force | Out-Null
    New-ItemProperty -Path $machineKey -Name InstallLocation -Value $machineTarget -PropertyType String -Force | Out-Null
    Uninstall-Owned $target $key
    if ((Run-Installer "/S /UPDATE /D=$machineTarget") -ne 0) { throw 'Existing machine zhusuan update failed in the elevated CI context.' }
    if ((Get-ItemProperty $machineKey).InstallLocation -ne $machineTarget -or (Test-Path $key)) {
        throw 'Machine update changed path or wrote a duplicate user registration.'
    }
    Assert-LegacyRetained
    Uninstall-Owned $machineTarget $machineKey
    Write-Host 'Passed: new LOCALAPPDATA default, retained Orange installation, Unicode user shortcuts/HKCU, existing zhusuan path fallback, locked rollback, per-user update and prior machine update.'
} finally {
    foreach ($registrationKey in @($key, $machineKey, $legacyKey, $legacyMachineKey)) {
        if (Test-Path $registrationKey) { Remove-Item -Path $registrationKey -Recurse -Force }
    }
    foreach ($link in @($shortcut, $startShortcut, $legacyShortcut)) {
        if (Test-Path $link) { Remove-Item -Path $link -Force }
    }
    foreach ($directory in @($target, $legacyTarget, $machineTarget, $defaultTarget)) {
        if (Test-Path $directory) { Remove-Item -Path $directory -Recurse -Force }
    }
}
