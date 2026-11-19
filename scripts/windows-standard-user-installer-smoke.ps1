param(
    [Parameter(Mandatory=$true)][string]$Installer,
    [switch]$StandardUserWorker,
    [string]$ResultPath,
    [string]$ExpectedUserSid
)
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or -not $IsWindows) {
    throw 'This installation smoke is restricted to a disposable Windows GitHub runner.'
}
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;

public static class ZhusuanStandardUser {
    [StructLayout(LayoutKind.Sequential)] struct SidAndAttributes { public IntPtr Sid; public uint Attributes; }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] struct StartupInfo {
        public int Size; public string Reserved; public string Desktop; public string Title;
        public int X, Y, XSize, YSize, XCountChars, YCountChars, FillAttribute, Flags;
        public short ShowWindow, Reserved2; public IntPtr ReservedPointer, StdInput, StdOutput, StdError;
    }
    [StructLayout(LayoutKind.Sequential)] struct ProcessInfo { public IntPtr Process, Thread; public uint ProcessId, ThreadId; }
    delegate bool EnumWindowsCallback(IntPtr window, IntPtr parameter);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsCallback callback, IntPtr parameter);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr window, StringBuilder text, int count);
    [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool CloseHandle(IntPtr handle);
    [DllImport("kernel32.dll", SetLastError = true)] static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool GetExitCodeProcess(IntPtr process, out uint exitCode);
    [DllImport("advapi32.dll", SetLastError = true)] static extern bool OpenProcessToken(IntPtr process, uint access, out IntPtr token);
    [DllImport("advapi32.dll", SetLastError = true)] static extern bool CreateRestrictedToken(IntPtr token, uint flags, uint disableCount,
        [In] SidAndAttributes[] disable, uint privilegeCount, IntPtr privileges, uint restrictCount, IntPtr restrict, out IntPtr restricted);
    [DllImport("advapi32.dll", SetLastError = true)] static extern bool SetTokenInformation(IntPtr token, int type, ref SidAndAttributes info, uint length);
    [DllImport("advapi32.dll", SetLastError = true)] static extern bool GetTokenInformation(IntPtr token, int type, IntPtr info, int length, out int required);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] static extern bool ConvertStringSidToSid(string sid, out IntPtr pointer);
    [DllImport("advapi32.dll")] static extern uint GetLengthSid(IntPtr sid);
    [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr pointer);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] static extern bool CreateProcessAsUser(IntPtr token, string application,
        StringBuilder commandLine, IntPtr processAttributes, IntPtr threadAttributes, bool inherit, uint flags, IntPtr environment,
        string directory, ref StartupInfo startup, out ProcessInfo process);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] static extern bool CreateProcessWithTokenW(IntPtr token, uint logonFlags,
        string application, StringBuilder commandLine, uint flags, IntPtr environment, string directory, ref StartupInfo startup, out ProcessInfo process);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] static extern IntPtr LoadLibraryEx(string path, IntPtr file, uint flags);
    [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr FindResource(IntPtr module, IntPtr name, IntPtr type);
    [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr LoadResource(IntPtr module, IntPtr resource);
    [DllImport("kernel32.dll")] static extern uint SizeofResource(IntPtr module, IntPtr resource);
    [DllImport("kernel32.dll")] static extern IntPtr LockResource(IntPtr resource);
    [DllImport("kernel32.dll")] static extern bool FreeLibrary(IntPtr module);
    static void Check(bool result) { if (!result) throw new Win32Exception(Marshal.GetLastWin32Error()); }
    public static bool HasVisibleInstallerDialog(uint processId) {
        bool found = false;
        EnumWindows((window, unused) => {
            uint owner; GetWindowThreadProcessId(window, out owner);
            var name = new StringBuilder(128); GetClassName(window, name, name.Capacity);
            if (owner == processId && IsWindowVisible(window) && name.ToString() == "#32770") { found = true; return false; }
            return true;
        }, IntPtr.Zero);
        return found;
    }
    public static string Manifest(string path) {
        IntPtr module = LoadLibraryEx(path, IntPtr.Zero, 2);
        if (module == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
        try {
            IntPtr resource = FindResource(module, new IntPtr(1), new IntPtr(24));
            if (resource == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
            int length = checked((int)SizeofResource(module, resource));
            IntPtr data = LockResource(LoadResource(module, resource));
            if (data == IntPtr.Zero || length == 0) throw new InvalidOperationException("Installer manifest is missing.");
            byte[] bytes = new byte[length]; Marshal.Copy(data, bytes, 0, length);
            return Encoding.UTF8.GetString(bytes);
        } finally { FreeLibrary(module); }
    }
    public static bool TokenIsElevated() {
        IntPtr token; Check(OpenProcessToken(GetCurrentProcess(), 8, out token));
        IntPtr buffer = Marshal.AllocHGlobal(4);
        try {
            int length; Check(GetTokenInformation(token, 20, buffer, 4, out length));
            return Marshal.ReadInt32(buffer) != 0;
        } finally { Marshal.FreeHGlobal(buffer); CloseHandle(token); }
    }
    public static uint IntegrityRid() {
        IntPtr token; Check(OpenProcessToken(GetCurrentProcess(), 8, out token));
        try {
            int length; GetTokenInformation(token, 25, IntPtr.Zero, 0, out length);
            IntPtr buffer = Marshal.AllocHGlobal(length);
            try {
                Check(GetTokenInformation(token, 25, buffer, length, out length));
                var label = (SidAndAttributes)Marshal.PtrToStructure(buffer, typeof(SidAndAttributes));
                var sid = new SecurityIdentifier(label.Sid).Value;
                return UInt32.Parse(sid.Substring(sid.LastIndexOf('-') + 1));
            } finally { Marshal.FreeHGlobal(buffer); }
        } finally { CloseHandle(token); }
    }
    public static int RunRestricted(string executable, string arguments, string directory) {
        IntPtr token = IntPtr.Zero, restricted = IntPtr.Zero, administrators = IntPtr.Zero, medium = IntPtr.Zero;
        ProcessInfo process = new ProcessInfo();
        try {
            Check(OpenProcessToken(GetCurrentProcess(), 0xF01FF, out token));
            Check(ConvertStringSidToSid("S-1-5-32-544", out administrators));
            // Disable administrator membership and privileges, retaining the same user/profile.
            Check(CreateRestrictedToken(token, 1, 1, new[] { new SidAndAttributes { Sid = administrators } }, 0, IntPtr.Zero, 0, IntPtr.Zero, out restricted));
            Check(ConvertStringSidToSid("S-1-16-8192", out medium));
            var label = new SidAndAttributes { Sid = medium, Attributes = 0x20 };
            Check(SetTokenInformation(restricted, 25, ref label, (uint)Marshal.SizeOf(label) + GetLengthSid(medium)));
            // A reduced token must attach to the interactive desktop explicitly. The
            // elevated CI service's implicit desktop can reject user32 initialization.
            var startup = new StartupInfo { Size = Marshal.SizeOf(typeof(StartupInfo)), Desktop = "winsta0\\default", Flags = 1, ShowWindow = 0 };
            var command = new StringBuilder("\"" + executable + "\" " + arguments);
            bool created = CreateProcessAsUser(restricted, executable, command, IntPtr.Zero, IntPtr.Zero, false, 0, IntPtr.Zero, directory, ref startup, out process);
            if (!created && Marshal.GetLastWin32Error() == 1314) {
                command = new StringBuilder("\"" + executable + "\" " + arguments);
                created = CreateProcessWithTokenW(restricted, 0, executable, command, 0, IntPtr.Zero, directory, ref startup, out process);
            }
            Check(created);
            uint wait = WaitForSingleObject(process.Process, 120000);
            if (wait != 0) {
                // Terminate this fixture's own worker/process tree before the parent cleans its files.
                System.Diagnostics.Process.GetProcessById((int)process.ProcessId).Kill(true);
                throw new InvalidOperationException("Standard-user installation worker did not finish within 120 seconds.");
            }
            uint code; Check(GetExitCodeProcess(process.Process, out code));
            return unchecked((int)code);
        } finally {
            if (process.Thread != IntPtr.Zero) CloseHandle(process.Thread);
            if (process.Process != IntPtr.Zero) CloseHandle(process.Process);
            if (medium != IntPtr.Zero) LocalFree(medium);
            if (administrators != IntPtr.Zero) LocalFree(administrators);
            if (restricted != IntPtr.Zero) CloseHandle(restricted);
            if (token != IntPtr.Zero) CloseHandle(token);
        }
    }
}
'@
$installerPath = (Resolve-Path -LiteralPath $Installer).Path
$registration = 'Software\Microsoft\Windows\CurrentVersion\Uninstall\PrimordialWeaveZhusuan'
$key = 'HKCU:\' + $registration
$machineKey = 'HKLM:\' + $registration
$target = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'PrimordialWeave\zhusuan'
$product = [string][char]0x73E0 + [char]0x7B97
$links = @(
    (Join-Path ([Environment]::GetFolderPath('Desktop')) ($product + '.lnk')),
    (Join-Path ([Environment]::GetFolderPath('Programs')) ($product + '.lnk'))
)
if (-not $StandardUserWorker) {
    [xml]$manifest = [ZhusuanStandardUser]::Manifest($installerPath)
    $execution = $manifest.SelectSingleNode("//*[local-name()='requestedExecutionLevel']")
    if ($null -eq $execution -or $execution.level -ne 'asInvoker' -or $execution.uiAccess -ne 'false') {
        throw 'Installer must use asInvoker with uiAccess=false, permitting an ordinary double-click.'
    }
    foreach ($path in @($key, $machineKey, $target) + $links) {
        if (Test-Path -LiteralPath $path) { throw "Standard-user smoke requires a clean runner: $path" }
    }
    $ResultPath = Join-Path $env:RUNNER_TEMP 'zhusuan-standard-user-installation.json'
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $powershell = (Get-Process -Id $PID).Path
    $arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $PSCommandPath + '" -Installer "' + $installerPath + '" -StandardUserWorker -ResultPath "' + $ResultPath + '" -ExpectedUserSid "' + $sid + '"'
    try {
        $code = [ZhusuanStandardUser]::RunRestricted($powershell, $arguments, (Get-Location).Path)
        if (-not (Test-Path -LiteralPath $ResultPath)) { throw "Standard-user worker returned $code (0x$(([BitConverter]::ToUInt32([BitConverter]::GetBytes([int]$code), 0)).ToString('X8'))) before writing its evidence report; installation results are unknown." }
        $evidence = Get-Content -LiteralPath $ResultPath -Raw | ConvertFrom-Json
        $evidence | ConvertTo-Json -Depth 5 | Write-Host
        if ($code -ne 0 -or -not $evidence.passed) { throw "Standard-user installation failed: $($evidence.error) (exit $code)." }
        if ($evidence.isAdmin -or $evidence.integrityRid -gt 8192 -or $evidence.userSid -ne $sid) { throw 'Worker was not the original user with administrator access disabled at medium integrity.' }
    } finally {
        if (Test-Path -LiteralPath $key) { Remove-Item -LiteralPath $key -Recurse -Force }
        foreach ($link in $links) { if (Test-Path -LiteralPath $link) { Remove-Item -LiteralPath $link -Force } }
        if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
    }
    Write-Host 'Passed: real installer manifest is asInvoker; medium-integrity non-admin install and uninstall use the original user profile.'
    exit 0
}
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$evidence = @{
    passed = $false
    userSid = $identity.User.Value
    isAdmin = ([Security.Principal.WindowsPrincipal]$identity).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    integrityRid = [ZhusuanStandardUser]::IntegrityRid()
    tokenElevationReported = [ZhusuanStandardUser]::TokenIsElevated()
    installerSha256 = (Get-FileHash -LiteralPath $installerPath -Algorithm SHA256).Hash.ToLowerInvariant()
    manifest = 'asInvoker'
}
$exitCode = 1
try {
    if ($evidence.isAdmin -or $evidence.integrityRid -gt 8192 -or $evidence.userSid -ne $ExpectedUserSid) { throw 'Worker does not have the expected standard-user security context.' }
    $machineWriteDenied = $false
    try {
        $machine = [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey('SOFTWARE', $true)
        if ($null -ne $machine) { $machine.Dispose() }
    } catch [System.UnauthorizedAccessException] {
        $machineWriteDenied = $true
    } catch [System.Security.SecurityException] {
        $machineWriteDenied = $true
    }
    if (-not $machineWriteDenied) { throw 'Restricted worker can still open HKLM SOFTWARE for writing.' }
    $evidence.machineWriteDenied = $true
    # Opening the welcome page is the ordinary double-click behavior; do not begin installation.
    $interactive = Start-Process -FilePath $installerPath -PassThru
    try {
        $deadline = [DateTime]::UtcNow.AddSeconds(15)
        while (-not $interactive.HasExited -and -not [ZhusuanStandardUser]::HasVisibleInstallerDialog($interactive.Id) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 100 }
        if ($interactive.HasExited -or -not [ZhusuanStandardUser]::HasVisibleInstallerDialog($interactive.Id)) { throw 'Ordinary non-admin launch did not show the installer welcome dialog.' }
        $evidence.ordinaryLaunchShowsDialog = $true
    } finally {
        if (-not $interactive.HasExited) { Stop-Process -Id $interactive.Id -Force; $interactive.WaitForExit() }
    }
    $process = Start-Process -FilePath $installerPath -ArgumentList '/S' -PassThru -Wait
    if ($process.ExitCode -ne 0) { throw "Non-admin installer returned $($process.ExitCode)." }
    if (-not (Test-Path -LiteralPath (Join-Path $target 'zhusuan.exe'))) { throw 'Non-admin installer did not create the executable in the user default directory.' }
    if ((Get-ItemProperty -LiteralPath $key).InstallLocation -ne $target -or (Test-Path -LiteralPath $machineKey)) { throw 'Non-admin installer did not register the current-user installation.' }
    if ((Get-ItemProperty -LiteralPath $key).DisplayName -ne $product) { throw 'Non-admin installation lost its Chinese product name.' }
    foreach ($link in $links) { if (-not (Test-Path -LiteralPath $link)) { throw 'Non-admin installer did not create a current-user shortcut.' } }
    $process = Start-Process -FilePath (Join-Path $target 'uninstall.exe') -ArgumentList '/S' -PassThru -Wait
    $deadline = [DateTime]::UtcNow.AddSeconds(15)
    while (((Test-Path -LiteralPath $key) -or (Test-Path -LiteralPath (Join-Path $target 'zhusuan.exe'))) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 100 }
    if ((Test-Path -LiteralPath $key) -or (Test-Path -LiteralPath (Join-Path $target 'zhusuan.exe'))) { throw 'Non-admin uninstall did not remove the owned executable and registration.' }
    $evidence.passed = $true
    $evidence.installLocation = $target
    $exitCode = 0
} catch {
    $evidence.error = $_.Exception.Message
} finally {
    $evidence | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $ResultPath -Encoding utf8
}
exit $exitCode
