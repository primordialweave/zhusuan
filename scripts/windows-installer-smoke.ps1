param([Parameter(Mandatory=$true)][string]$Installer)
$ErrorActionPreference = 'Stop'
$key = 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\PrimordialWeaveZhusuan'
$legacyKey = 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\FruitsAIOrange'
if ((Test-Path $key) -or (Test-Path $legacyKey)) { throw 'Smoke test requires a clean CI runner without an zhusuan installation.' }
$target = Join-Path $env:RUNNER_TEMP 'zhusuan installer smoke with spaces'
$installerPath = (Resolve-Path $Installer).Path
function Run-Installer([string]$arguments) {
    $process = Start-Process -FilePath $installerPath -ArgumentList $arguments -PassThru -Wait
    return $process.ExitCode
}
try {
    if ((Run-Installer "/S /D=$target") -ne 0) { throw 'Initial silent installation failed.' }
    $exe = Join-Path $target 'zhusuan.exe'
    if (-not (Test-Path $exe)) { throw 'Initial installation did not write zhusuan.exe.' }
    if ((Get-ItemProperty $key).InstallLocation -ne $target) { throw 'InstallLocation was not persisted.' }
    if ((Run-Installer '/S') -ne 0) { throw 'Reinstallation using the saved path failed.' }
    if ((Get-ItemProperty $key).InstallLocation -ne $target) { throw 'Reinstallation changed the install path.' }
    Remove-ItemProperty -Path $key -Name InstallLocation
    # RegistryProvider.GetItem returns a read-only key; explicitly open it for writing.
    $installationKey = [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey(
        'Software\Microsoft\Windows\CurrentVersion\Uninstall\PrimordialWeaveZhusuan', $true)
    if ($null -eq $installationKey) { throw 'Installation registration could not be opened for writing.' }
    try {
        $installationKey.DeleteValue('', $false)
    } finally { $installationKey.Dispose() }
    if ((Run-Installer '/S') -ne 0) { throw 'Reinstallation using the legacy DisplayIcon path failed.' }
    if ((Get-ItemProperty $key).InstallLocation -ne $target) { throw 'Legacy installer path was not recovered.' }
    # Simulate the original Orange identity without starting an application.
    $legacyExe = Join-Path $target 'Orange.exe'
    Rename-Item -Path $exe -NewName 'Orange.exe'
    New-Item -Path $legacyKey -Force | Out-Null
    New-ItemProperty -Path $legacyKey -Name DisplayName -Value 'Orange' -PropertyType String -Force | Out-Null
    New-ItemProperty -Path $legacyKey -Name DisplayIcon -Value ('"' + $legacyExe + '"') -PropertyType String -Force | Out-Null
    New-ItemProperty -Path $legacyKey -Name UninstallString -Value ('"' + (Join-Path $target 'uninstall.exe') + '"') -PropertyType String -Force | Out-Null
    Remove-Item -Path $key -Recurse -Force
    $legacyHash = (Get-FileHash $legacyExe -Algorithm SHA256).Hash
    $legacyLock = [System.IO.File]::Open($legacyExe, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::None)
    try {
        if ((Run-Installer '/S /UPDATE') -eq 0) { throw 'Locked legacy Orange executable incorrectly upgraded.' }
    } finally { $legacyLock.Dispose() }
    if ((Get-FileHash $legacyExe -Algorithm SHA256).Hash -ne $legacyHash) { throw 'Failed migration changed the legacy executable.' }
    if (-not (Test-Path $legacyKey)) { throw 'Failed migration removed legacy installation registration.' }
    if ((Run-Installer '/S /UPDATE') -ne 0) { throw 'Legacy Orange upgrade did not complete.' }
    if (-not (Test-Path $exe)) { throw 'Legacy upgrade did not install zhusuan.exe.' }
    if (Test-Path $legacyExe) { throw 'Legacy upgrade left two product executables.' }
    if (Test-Path $legacyKey) { throw 'Legacy upgrade left duplicate uninstall registration.' }
    if ((Get-ItemProperty $key).InstallLocation -ne $target) { throw 'Legacy upgrade moved the custom install directory.' }
    $before = (Get-FileHash $exe -Algorithm SHA256).Hash
    $lock = [System.IO.File]::Open($exe, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::None)
    try {
        if ((Run-Installer "/S /UPDATE /D=$target") -eq 0) { throw 'Installer incorrectly reported success for a locked executable.' }
    } finally { $lock.Dispose() }
    if ((Get-FileHash $exe -Algorithm SHA256).Hash -ne $before) { throw 'Failed update changed the existing executable.' }
    if ((Run-Installer "/S /UPDATE /D=$target") -ne 0) { throw 'Silent update failed after the executable was unlocked.' }
    if (Test-Path "$exe.update-backup") { throw 'Successful update left a backup executable behind.' }
    Write-Host 'Passed: custom directory, legacy Orange identity migration, locked-file rollback, new registration and silent update.'
} finally {
    if (Test-Path $legacyKey) { Remove-Item -Path $legacyKey -Recurse -Force }
    $uninstaller = Join-Path $target 'uninstall.exe'
    if (Test-Path $uninstaller) { Start-Process -FilePath $uninstaller -ArgumentList '/S' -Wait }
}
