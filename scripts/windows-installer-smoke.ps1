param(
    [Parameter(Mandatory=$true)][string]$Installer,
    [string]$PreviousInstaller
)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT' -or $env:GITHUB_ACTIONS -ne 'true') {
    throw 'Installation smoke runs only in an isolated GitHub Windows runner.'
}
Add-Type -AssemblyName System.Drawing
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
$moveTarget = Join-Path $env:RUNNER_TEMP 'zhusuan rejected explicit move'
$defaultTarget = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'PrimordialWeave\zhusuan'
$desktop = [Environment]::GetFolderPath('Desktop')
$startMenu = [Environment]::GetFolderPath('Programs')
$productName = [string][char]0x73E0 + [char]0x7B97
$shortcut = Join-Path $desktop ($productName + '.lnk')
$startShortcut = Join-Path $startMenu ($productName + '.lnk')
$commonShortcut = Join-Path ([Environment]::GetFolderPath('CommonDesktopDirectory')) ($productName + '.lnk')
$commonStartShortcut = Join-Path ([Environment]::GetFolderPath('CommonPrograms')) ($productName + '.lnk')
$legacyShortcut = Join-Path $desktop 'Orange.lnk'
if ((Test-Path $defaultTarget) -or (Test-Path $target) -or (Test-Path $legacyTarget) -or
    (Test-Path $machineTarget) -or (Test-Path $moveTarget) -or
    (Test-Path $legacyShortcut) -or (Test-Path $shortcut) -or
    (Test-Path $startShortcut) -or (Test-Path $commonShortcut) -or (Test-Path $commonStartShortcut)) {
    throw 'Smoke test requires clean owned directories and shortcuts.'
}
$installerPath = (Resolve-Path $Installer).Path
$sourceIconPath = (Resolve-Path (Join-Path $PSScriptRoot '../build/windows/icon.ico')).Path
$diagnostics = Join-Path $env:RUNNER_TEMP 'zhusuan-installer-diagnostics'
New-Item -ItemType Directory -Path $diagnostics -Force | Out-Null
function Run-Installer([string]$arguments, [string]$path = $installerPath) {
    Write-Host "Running installer: '$path' $arguments"
    $process = Start-Process -FilePath $path -ArgumentList $arguments -PassThru -Wait
    Write-Host "Installer exit code: $($process.ExitCode)"
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
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct ShellFileInfo {
        public IntPtr Icon;
        public int IconIndex;
        public uint Attributes;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string DisplayName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 80)] public string TypeName;
    }
    public sealed class ShortcutDetails {
        public string IconPath;
        public int IconIndex;
        public string Description;
    }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, ExactSpelling = true, SetLastError = true)]
    public static extern uint GetLongPathNameW(string path, StringBuilder result, uint size);
    [DllImport("shell32.dll", CharSet = CharSet.Unicode, ExactSpelling = true)]
    private static extern UIntPtr SHGetFileInfoW(string path, uint attributes, out ShellFileInfo info, uint size, uint flags);
    [DllImport("user32.dll", ExactSpelling = true)]
    public static extern bool DestroyIcon(IntPtr icon);

    public static IntPtr ReadShellIcon(string path) {
        ShellFileInfo info;
        // SHGFI_ICON, large icon; no shortcut overlay or USEFILEATTRIBUTES simulation.
        UIntPtr result = SHGetFileInfoW(path, 0, out info, (uint)Marshal.SizeOf(typeof(ShellFileInfo)), 0x100);
        if (result == UIntPtr.Zero || info.Icon == IntPtr.Zero) {
            throw new InvalidOperationException("Shell could not resolve the icon for " + path);
        }
        return info.Icon;
    }

    public static ShortcutDetails ReadShortcutDetails(string shortcut) {
        object instance = new ZhusuanShellLink();
        try {
            ((IPersistFile)instance).Load(shortcut, 0);
            var icon = new StringBuilder(32768);
            var description = new StringBuilder(32768);
            int index;
            Marshal.ThrowExceptionForHR(((IZhusuanShellLinkW)instance).GetIconLocation(icon, icon.Capacity, out index));
            Marshal.ThrowExceptionForHR(((IZhusuanShellLinkW)instance).GetDescription(description, description.Capacity));
            return new ShortcutDetails { IconPath = icon.ToString(), IconIndex = index, Description = description.ToString() };
        } finally {
            if (Marshal.IsComObject(instance)) Marshal.FinalReleaseComObject(instance);
        }
    }

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
function Get-ShellIconSnapshot([string]$path, [string]$name) {
    $handle = [ZhusuanSmokePaths]::ReadShellIcon($path)
    $icon = $null
    $bitmap = $null
    $hash = $null
    try {
        $icon = [System.Drawing.Icon]::FromHandle($handle)
        $bitmap = $icon.ToBitmap()
        $pixels = [byte[]]::new($bitmap.Width * $bitmap.Height * 4)
        $offset = 0
        for ($y = 0; $y -lt $bitmap.Height; $y++) {
            for ($x = 0; $x -lt $bitmap.Width; $x++) {
                $pixel = $bitmap.GetPixel($x, $y)
                $pixels[$offset++] = $pixel.A
                $pixels[$offset++] = $pixel.R
                $pixels[$offset++] = $pixel.G
                $pixels[$offset++] = $pixel.B
            }
        }
        $hash = [System.Security.Cryptography.SHA256]::Create()
        $digest = [BitConverter]::ToString($hash.ComputeHash($pixels)).Replace('-', '').ToLowerInvariant()
        $bitmap.Save((Join-Path $diagnostics ($name + '.png')), [System.Drawing.Imaging.ImageFormat]::Png)
        return [pscustomobject]@{ Width = $bitmap.Width; Height = $bitmap.Height; PixelSHA256 = $digest }
    } finally {
        if ($null -ne $hash) { $hash.Dispose() }
        if ($null -ne $bitmap) { $bitmap.Dispose() }
        if ($null -ne $icon) { $icon.Dispose() }
        [void][ZhusuanSmokePaths]::DestroyIcon($handle)
    }
}
function Get-RegistrationSnapshot {
    $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::CurrentUser, [Microsoft.Win32.RegistryView]::Registry64)
    $entry = $null
    try {
        $entry = $base.OpenSubKey($registration, $false)
        if ($null -eq $entry) { throw 'Prior application registration is missing.' }
        $values = foreach ($name in ($entry.GetValueNames() | Sort-Object)) {
            [pscustomobject]@{
                Name = $name
                Kind = $entry.GetValueKind($name).ToString()
                Data = $entry.GetValue($name, $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
            }
        }
        return ConvertTo-Json -InputObject @($values) -Depth 5 -Compress
    } finally {
        if ($null -ne $entry) { $entry.Dispose() }
        $base.Dispose()
    }
}
function Assert-ShortcutIdentity([string]$directory, [string]$registrationKey, [string[]]$links = @($shortcut, $startShortcut)) {
    $version = (Get-ItemProperty $registrationKey).DisplayVersion
    $expectedIcon = Join-Path $directory ('zhusuan-shortcut-' + $version + '.ico')
    $expectedExe = Join-Path $directory 'zhusuan.exe'
    if (-not (Test-Path -LiteralPath $expectedIcon -PathType Leaf)) { throw 'Version-specific shortcut icon was not installed.' }
    if ((Get-FileHash -LiteralPath $expectedIcon -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $sourceIconPath -Algorithm SHA256).Hash) {
        throw 'Installed shortcut icon does not match the current packaging input.'
    }
    $sourceImage = Get-ShellIconSnapshot $expectedIcon ('installed-icon-' + $version)
    foreach ($link in $links) {
        $details = [ZhusuanSmokePaths]::ReadShortcutDetails($link)
        if ($details.Description -ne $productName) { throw "Shortcut Unicode description is incorrect: '$($details.Description)'." }
        if ($details.IconIndex -ne 0) { throw 'Shortcut icon index must be zero.' }
        if (-not [string]::Equals((Resolve-ExecutablePath $details.IconPath), (Resolve-ExecutablePath $expectedIcon), [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Shortcut IconLocation does not point to this release-specific icon.'
        }
        if (-not [string]::Equals((Resolve-ExecutablePath ([ZhusuanSmokePaths]::ReadShortcutTarget($link))), (Resolve-ExecutablePath $expectedExe), [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Shortcut target changed during icon refresh.'
        }
        $name = if ($link -eq $shortcut -or $link -eq $commonShortcut) { 'desktop' } else { 'start-menu' }
        $shellImage = Get-ShellIconSnapshot $link ($name + '-current')
        if ($shellImage.PixelSHA256 -ne $sourceImage.PixelSHA256 -or $shellImage.Width -ne $sourceImage.Width -or $shellImage.Height -ne $sourceImage.Height) {
            throw "Shell still renders a stale $name shortcut icon."
        }
        Write-Host "Verified ${name}: Unicode='$($details.Description)'; icon='$($details.IconPath)',0; shell pixels=$($shellImage.PixelSHA256)."
    }
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
    if (-not [string]::IsNullOrWhiteSpace($PreviousInstaller)) {
        $previousPath = (Resolve-Path -LiteralPath $PreviousInstaller).Path
        if ((Run-Installer "/S /D=$defaultTarget" $previousPath) -ne 0) { throw 'Published previous-version installation failed.' }
        $oldExe = Join-Path $defaultTarget 'zhusuan.exe'
        $previousHash = (Get-FileHash -LiteralPath $oldExe -Algorithm SHA256).Hash
        $previousVersion = (Get-ItemProperty $key).DisplayVersion
        # Warm Shell's real shortcut cache at the same paths used after the upgrade.
        $oldDesktopImage = Get-ShellIconSnapshot $shortcut 'desktop-before-upgrade'
        $oldStartImage = Get-ShellIconSnapshot $startShortcut 'start-menu-before-upgrade'
        if ((Run-Installer "/S /UPDATE /D=$defaultTarget") -ne 0) { throw 'Published previous-version in-place upgrade failed.' }
        if ((Get-ItemProperty $key).InstallLocation -ne $defaultTarget) { throw 'In-place icon upgrade changed the installation directory.' }
        $newHash = (Get-FileHash -LiteralPath $oldExe -Algorithm SHA256).Hash
        if ($newHash -eq $previousHash) { throw 'Previous-installer fixture did not exercise a different application payload.' }
        Assert-ShortcutIdentity $defaultTarget $key
        $newDesktopImage = Get-ShellIconSnapshot $shortcut 'desktop-after-upgrade'
        $newStartImage = Get-ShellIconSnapshot $startShortcut 'start-menu-after-upgrade'
        if ($newDesktopImage.PixelSHA256 -eq $oldDesktopImage.PixelSHA256 -or $newStartImage.PixelSHA256 -eq $oldStartImage.PixelSHA256) {
            throw 'Published previous-installer fixture did not show a changed shortcut image after upgrade.'
        }
        [pscustomobject]@{
            PreviousVersion = $previousVersion
            CurrentVersion = (Get-ItemProperty $key).DisplayVersion
            SameInstallDirectory = $defaultTarget
            PreviousExecutableSHA256 = $previousHash
            CurrentExecutableSHA256 = $newHash
            DesktopBefore = $oldDesktopImage
            DesktopAfter = $newDesktopImage
            StartMenuBefore = $oldStartImage
            StartMenuAfter = $newStartImage
            ExplorerRestarted = $false
            IconCacheDeleted = $false
        } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $diagnostics 'icon-upgrade.json') -Encoding utf8
        Write-Host 'Passed published previous-installer upgrade: warmed Shell icons changed in place without restarting Explorer or clearing caches.'
    }
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
    Assert-ShortcutIdentity $defaultTarget $key
    Assert-LegacyRetained
    if ((Run-Installer "/S /UPDATE /D=$legacyTarget") -eq 0) { throw 'Orange-only directory incorrectly accepted an automated zhusuan update.' }
    if ((Run-Installer "/S /D=$legacyTarget") -eq 0) { throw 'Orange-only directory incorrectly accepted an explicit installation.' }
    if (Test-Path (Join-Path $legacyTarget 'zhusuan.exe')) { throw 'Rejected Orange directory received a zhusuan executable.' }
    if ((Get-ItemProperty $key).InstallLocation -ne $defaultTarget) { throw 'Rejected explicit directory changed the existing user installation record.' }
    Assert-LegacyRetained
    Set-Content -Path (Join-Path $defaultTarget 'unrelated-data.txt') -Value 'retained user data'
    Set-Content -Path (Join-Path $defaultTarget 'user-selected.ico') -Value 'unrelated user icon'
    $defaultOwnedIcon = Join-Path $defaultTarget ('zhusuan-shortcut-' + (Get-ItemProperty $key).DisplayVersion + '.ico')
    Uninstall-Owned $defaultTarget $key
    if (-not (Test-Path (Join-Path $defaultTarget 'unrelated-data.txt'))) { throw 'Uninstaller deleted unrelated data.' }
    if (-not (Test-Path (Join-Path $defaultTarget 'user-selected.ico'))) { throw 'Uninstaller deleted an unrelated icon.' }
    if (Test-Path -LiteralPath $defaultOwnedIcon) { throw 'Uninstaller retained this version-owned shortcut icon.' }
    Assert-LegacyRetained

    if ((Run-Installer "/S /D=$target") -ne 0) { throw 'Explicit custom per-user installation failed.' }
    $exe = Join-Path $target 'zhusuan.exe'
    if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) { throw 'Explicit path did not receive the zhusuan executable.' }
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
    Assert-ShortcutIdentity $target $key

    # A locked Desktop link must fail rather than report an icon refresh that never happened.
    $beforeFiles = @{}
    $ownedIcon = Join-Path $target ('zhusuan-shortcut-' + (Get-ItemProperty $key).DisplayVersion + '.ico')
    foreach ($file in @($exe, (Join-Path $target 'uninstall.exe'), $ownedIcon, $shortcut, $startShortcut)) {
        $beforeFiles[$file] = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
    }
    $beforeRegistration = Get-ItemProperty $key
    $linkLock = [System.IO.File]::Open($shortcut, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::None)
    try {
        if ((Run-Installer "/S /UPDATE /D=$target") -eq 0) { throw 'Locked shortcut incorrectly reported a successful upgrade.' }
    } finally { $linkLock.Dispose() }
    foreach ($file in $beforeFiles.Keys) {
        if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $beforeFiles[$file]) { throw "Shortcut-write rollback changed '$file'." }
        if (Test-Path -LiteralPath ($file + '.update-backup')) { throw 'Shortcut-write rollback retained a managed backup.' }
    }
    $afterRegistration = Get-ItemProperty $key
    if ($afterRegistration.DisplayVersion -ne $beforeRegistration.DisplayVersion -or $afterRegistration.DisplayIcon -ne $beforeRegistration.DisplayIcon) {
        throw 'Shortcut-write rollback changed version or icon registration.'
    }
    Assert-ShortcutIdentity $target $key
    Assert-LegacyRetained

    # Registered A -> explicit B must preserve every original value/type when a link is locked.
    # Include a missing optional value and an expandable/binary value to catch rollback rewrites.
    $originalRegistration = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($registration, $true)
    if ($null -eq $originalRegistration) { throw 'Existing registration cannot be opened for the failed-move fixture.' }
    try {
        $originalRegistration.DeleteValue('QuietUninstallString', $false)
        $originalRegistration.SetValue('Publisher', 'PrimordialWeave-%SystemRoot%', [Microsoft.Win32.RegistryValueKind]::ExpandString)
        $originalRegistration.SetValue('UnrelatedProbe', [byte[]]@(1, 3, 5), [Microsoft.Win32.RegistryValueKind]::Binary)
    } finally { $originalRegistration.Dispose() }
    $beforeMoveRegistration = Get-RegistrationSnapshot
    $beforeMoveFiles = @{}
    foreach ($file in @($exe, (Join-Path $target 'uninstall.exe'), $ownedIcon, $shortcut, $startShortcut)) {
        $beforeMoveFiles[$file] = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
    }
    $moveLinkLock = [System.IO.File]::Open($shortcut, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::None)
    try {
        if ((Run-Installer "/S /D=$moveTarget") -eq 0) { throw 'Explicit move with a locked shortcut incorrectly succeeded.' }
    } finally { $moveLinkLock.Dispose() }
    if ((Get-RegistrationSnapshot) -cne $beforeMoveRegistration) {
        throw 'Failed explicit move changed prior registration names, value types, data, or missing values.'
    }
    foreach ($file in $beforeMoveFiles.Keys) {
        if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $beforeMoveFiles[$file]) {
            throw "Failed explicit move changed original installation A file '$file'."
        }
        if (Test-Path -LiteralPath ($file + '.update-backup')) { throw 'Failed explicit move retained an A backup.' }
    }
    if ((Test-Path -LiteralPath $moveTarget) -and @(Get-ChildItem -LiteralPath $moveTarget -Recurse -Force).Count -ne 0) {
        throw 'Failed explicit move retained application payload or backup files in B.'
    }
    Assert-ShortcutIdentity $target $key
    Write-Host 'Passed failed A-to-B move: full registration including value types/missing fields and original A payload/links unchanged; B has no payload or backups.'

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
    Assert-ShortcutIdentity $machineTarget $machineKey @($commonShortcut, $commonStartShortcut)
    Assert-LegacyRetained
    Uninstall-Owned $machineTarget $machineKey
    Write-Host 'Passed: new LOCALAPPDATA default, retained Orange installation, Unicode shortcut/icon metadata and Shell image, existing path fallback, locked executable/shortcut rollback, per-user update and prior machine update.'
} finally {
    foreach ($registrationKey in @($key, $machineKey, $legacyKey, $legacyMachineKey)) {
        if (Test-Path $registrationKey) { Remove-Item -Path $registrationKey -Recurse -Force }
    }
    foreach ($link in @($shortcut, $startShortcut, $commonShortcut, $commonStartShortcut, $legacyShortcut)) {
        foreach ($managedLink in @($link, ($link + '.update-backup'))) {
            if (Test-Path -LiteralPath $managedLink) { Remove-Item -LiteralPath $managedLink -Force }
        }
    }
    foreach ($directory in @($target, $legacyTarget, $machineTarget, $defaultTarget, $moveTarget)) {
        if (Test-Path $directory) { Remove-Item -Path $directory -Recurse -Force }
    }
}
