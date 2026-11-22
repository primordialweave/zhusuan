param(
    [Parameter(Mandatory = $true)][string]$Executable,
    [string]$LaunchShortcut,
    [string]$OutputDirectory = (Join-Path $env:RUNNER_TEMP 'zhusuan-taskbar-check'),
    [switch]$RecordOnly
)

$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT' -or $env:GITHUB_ACTIONS -ne 'true') {
    throw 'This taskbar smoke runs only in an isolated GitHub Windows runner.'
}
if (-not [Environment]::UserInteractive) {
    throw 'Taskbar acceptance requires an interactive desktop and cannot be skipped.'
}

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public static class ZhusuanTaskbarProbe {
    private delegate bool EnumWindowsCallback(IntPtr window, IntPtr parameter);
    [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowsCallback callback, IntPtr parameter);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [DllImport("user32.dll")] private static extern IntPtr GetWindow(IntPtr window, uint command);
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr window);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] public static extern bool IsWindowUnicode(IntPtr window);
    [DllImport("user32.dll", CharSet = CharSet.Unicode, ExactSpelling = true)]
    private static extern int GetWindowTextW(IntPtr window, StringBuilder text, int count);
    [DllImport("user32.dll", CharSet = CharSet.Unicode, ExactSpelling = true)]
    public static extern IntPtr FindWindowW(string className, string name);
    [DllImport("user32.dll")] private static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] private static extern void mouse_event(uint flags, uint x, uint y, uint data, UIntPtr extra);
    [DllImport("user32.dll")] private static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extra);
    [DllImport("user32.dll", CharSet = CharSet.Unicode, ExactSpelling = true)]
    public static extern bool PostMessageW(IntPtr window, uint message, UIntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
    [DllImport("shell32.dll", ExactSpelling = true)]
    private static extern int SHGetPropertyStoreForWindow(IntPtr window, ref Guid iid, out IPropertyStore store);
    [DllImport("ole32.dll", ExactSpelling = true)] private static extern int PropVariantClear(ref PropVariant value);

    [StructLayout(LayoutKind.Sequential)]
    public struct PropertyKey { public Guid Format; public uint Id; }
    [StructLayout(LayoutKind.Explicit, Size = 24)]
    public struct PropVariant {
        [FieldOffset(0)] public ushort Type;
        [FieldOffset(8)] public IntPtr Pointer;
    }
    [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IPropertyStore {
        [PreserveSig] int GetCount(out uint count);
        [PreserveSig] int GetAt(uint index, out PropertyKey key);
        [PreserveSig] int GetValue(ref PropertyKey key, out PropVariant value);
        [PreserveSig] int SetValue(ref PropertyKey key, ref PropVariant value);
        [PreserveSig] int Commit();
    }
    [ComImport, Guid("000214F9-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IShellLinkW {
        void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder path, int count, IntPtr data, uint flags);
        void GetIDList(out IntPtr itemList);
        void SetIDList(IntPtr itemList);
        void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder text, int count);
        void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string text);
        void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder text, int count);
        void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string text);
        void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder text, int count);
        void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string text);
        void GetHotkey(out short key);
        void SetHotkey(short key);
        void GetShowCmd(out int command);
        void SetShowCmd(int command);
        void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder path, int count, out int index);
        void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string path, int index);
        void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string path, uint reserved);
        void Resolve(IntPtr window, uint flags);
        void SetPath([MarshalAs(UnmanagedType.LPWStr)] string path);
    }
    [ComImport, Guid("0000010B-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IPersistFile {
        void GetClassID(out Guid id);
        [PreserveSig] int IsDirty();
        void Load([MarshalAs(UnmanagedType.LPWStr)] string path, uint mode);
        void Save([MarshalAs(UnmanagedType.LPWStr)] string path, bool remember);
        void SaveCompleted([MarshalAs(UnmanagedType.LPWStr)] string path);
        void GetCurFile([MarshalAs(UnmanagedType.LPWStr)] out string path);
    }
    public class PropertyValue {
        public uint Id;
        public string Name;
        public ushort VariantType;
        public string RawUTF16;
        public string[] UTF16CodeUnits;
    }
    public class ShortcutValue { public string Target, Arguments, Description, IconPath; public int IconIndex; }

    public static string[] CodeUnits(string value) {
        if (value == null) return new string[0];
        var result = new string[value.Length];
        for (int i = 0; i < value.Length; i++) result[i] = "0x" + ((ushort)value[i]).ToString("X4");
        return result;
    }
    public static string Title(IntPtr window) {
        var result = new StringBuilder(32768);
        GetWindowTextW(window, result, result.Capacity);
        return result.ToString();
    }
    public static uint Owner(IntPtr window) { uint owner; GetWindowThreadProcessId(window, out owner); return owner; }
    public static IntPtr FindOwnedWindow(int processId) {
        IntPtr found = IntPtr.Zero;
        EnumWindows(delegate(IntPtr window, IntPtr parameter) {
            if (Owner(window) == (uint)processId && IsWindowVisible(window) && GetWindow(window, 4) == IntPtr.Zero) {
                found = window; return false;
            }
            return true;
        }, IntPtr.Zero);
        return found;
    }
    public static PropertyValue[] WindowProperties(IntPtr window) {
        var iid = new Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99");
        IPropertyStore store;
        Marshal.ThrowExceptionForHR(SHGetPropertyStoreForWindow(window, ref iid, out store));
        var values = new List<PropertyValue>();
        try {
            var names = new[] { "RelaunchCommand", "RelaunchIconResource", "RelaunchDisplayNameResource", "AppUserModelID" };
            for (uint id = 2; id <= 5; id++) {
                var key = new PropertyKey { Format = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), Id = id };
                PropVariant variant;
                Marshal.ThrowExceptionForHR(store.GetValue(ref key, out variant));
                try {
                    string text = null;
                    if (variant.Type == 31) text = Marshal.PtrToStringUni(variant.Pointer);
                    else if (variant.Type == 8) text = Marshal.PtrToStringBSTR(variant.Pointer);
                    else if (variant.Type != 0) throw new InvalidOperationException("Unexpected taskbar string variant " + variant.Type);
                    values.Add(new PropertyValue { Id = id, Name = names[id - 2], VariantType = variant.Type,
                                                  RawUTF16 = text, UTF16CodeUnits = CodeUnits(text) });
                } finally { Marshal.ThrowExceptionForHR(PropVariantClear(ref variant)); }
            }
        } finally { Marshal.FinalReleaseComObject(store); }
        return values.ToArray();
    }
    public static ShortcutValue ReadShortcut(string path) {
        object instance = Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("00021401-0000-0000-C000-000000000046")));
        try {
            ((IPersistFile)instance).Load(path, 0);
            var link = (IShellLinkW)instance;
            var target = new StringBuilder(32768); var description = new StringBuilder(32768);
            var icon = new StringBuilder(32768); var arguments = new StringBuilder(32768); int index;
            link.GetPath(target, target.Capacity, IntPtr.Zero, 0);
            link.GetDescription(description, description.Capacity);
            link.GetArguments(arguments, arguments.Capacity);
            link.GetIconLocation(icon, icon.Capacity, out index);
            return new ShortcutValue { Target = target.ToString(), Description = description.ToString(),
                                       Arguments = arguments.ToString(), IconPath = icon.ToString(), IconIndex = index };
        } finally { Marshal.FinalReleaseComObject(instance); }
    }
    public static void RightClick(int x, int y) {
        if (!SetCursorPos(x, y)) throw new InvalidOperationException("SetCursorPos failed.");
        Thread.Sleep(100);
        mouse_event(0x0008, 0, 0, 0, UIntPtr.Zero);
        mouse_event(0x0010, 0, 0, 0, UIntPtr.Zero);
    }
    public static void Escape() {
        keybd_event(0x1B, 0, 0, UIntPtr.Zero); keybd_event(0x1B, 0, 2, UIntPtr.Zero);
    }
}
'@

function Wait-TaskbarCondition([string]$description, [scriptblock]$condition, [int]$seconds = 30) {
    $deadline = [DateTime]::UtcNow.AddSeconds($seconds)
    $lastError = $null
    do {
        try { if (& $condition) { return } } catch [System.Windows.Automation.ElementNotAvailableException] {
            $lastError = $_.Exception.Message
        } catch [System.Runtime.InteropServices.COMException] { $lastError = $_.Exception.Message }
        if ($script:process -and $script:process.HasExited) { throw "Application exited while waiting for $description." }
        Start-Sleep -Milliseconds 100
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "Timed out waiting for $description. Last transient UIA error: $lastError"
}

function Get-ElementSnapshot($element) {
    $current = $element.Current
    $bounds = $current.BoundingRectangle
    return [ordered]@{
        runtimeId = ($element.GetRuntimeId() -join '.')
        name = $current.Name
        nameUTF16 = [ZhusuanTaskbarProbe]::CodeUnits($current.Name)
        class = $current.ClassName
        automationId = $current.AutomationId
        processId = $current.ProcessId
        type = $current.ControlType.ProgrammaticName
        enabled = $current.IsEnabled
        offscreen = $current.IsOffscreen
        bounds = [ordered]@{ left = $bounds.Left; top = $bounds.Top; width = $bounds.Width; height = $bounds.Height }
    }
}

function Get-TaskbarButtons {
    $elements = $script:taskbarElement.FindAll([System.Windows.Automation.TreeScope]::Descendants,
        [System.Windows.Automation.Condition]::TrueCondition)
    $result = [System.Collections.Generic.List[object]]::new()
    for ($index = 0; $index -lt $elements.Count; $index++) {
        $element = $elements[$index]
        $current = $element.Current
        if (($current.ControlType -eq [System.Windows.Automation.ControlType]::Button -or $current.ClassName -match 'TaskListButton') -and
            -not $current.IsOffscreen -and $current.BoundingRectangle.Width -gt 0 -and $current.BoundingRectangle.Height -gt 0) {
            $result.Add([pscustomobject]@{ element = $element; snapshot = (Get-ElementSnapshot $element) })
        }
    }
    return $result.ToArray()
}

function Get-VisibleDesktopRoots {
    $roots = [System.Windows.Automation.AutomationElement]::RootElement.FindAll(
        [System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
    $result = [System.Collections.Generic.List[object]]::new()
    for ($index = 0; $index -lt $roots.Count; $index++) {
        $element = $roots[$index]
        $snapshot = Get-ElementSnapshot $element
        if (-not $snapshot.offscreen -and $snapshot.bounds.width -gt 0 -and $snapshot.bounds.height -gt 0) {
            $result.Add([pscustomobject]@{ element = $element; snapshot = $snapshot })
        }
    }
    return $result.ToArray()
}

function Get-PopupNodes($root) {
    $nodes = [System.Collections.Generic.List[object]]::new()
    $nodes.Add((Get-ElementSnapshot $root))
    $children = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
    for ($index = 0; $index -lt [Math]::Min($children.Count, 1000); $index++) {
        try { $nodes.Add((Get-ElementSnapshot $children[$index])) }
        catch [System.Windows.Automation.ElementNotAvailableException] { }
    }
    return $nodes.ToArray()
}

function Save-TaskbarScreenshot([string]$name) {
    $screen = [System.Windows.Forms.SystemInformation]::VirtualScreen
    $bitmap = [System.Drawing.Bitmap]::new($screen.Width, $screen.Height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
        $bitmap.Save((Join-Path $script:artifacts $name), [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $graphics.Dispose(); $bitmap.Dispose() }
}

function Test-OwnedTaskbarProcess($candidate) {
    if (-not $candidate -or $candidate.Id -in $script:existingProcesses) { return $false }
    try {
        return [string]::Equals($candidate.MainModule.FileName, $script:executablePath, [StringComparison]::OrdinalIgnoreCase)
    } catch [System.ComponentModel.Win32Exception] { return $false }
    catch [System.InvalidOperationException] { return $false }
}

$artifacts = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$executablePath = (Resolve-Path -LiteralPath $Executable).Path
$privateRoot = Join-Path $env:RUNNER_TEMP ('zhusuan-taskbar-private-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $privateRoot | Out-Null
$process = $null
$ownedProcess = $false
$window = [IntPtr]::Zero
$taskbarElement = $null
$popupOpened = $false
$previousDpiContext = [ZhusuanTaskbarProbe]::SetThreadDpiAwarenessContext([IntPtr]::new(-4))
$report = [ordered]@{
    passed = $false
    recordOnly = [bool]$RecordOnly
    labelCorrect = $false
    sourceCommit = $env:APPLICATION_SOURCE_SHA
    executable = [System.IO.Path]::GetFileName($executablePath)
    nativeDesktop = $true
    checks = [ordered]@{}
    error = $null
}
try {
    $fileInfo = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($executablePath)
    $report.checks.pe = [ordered]@{
        productName = $fileInfo.ProductName
        productNameUTF16 = [ZhusuanTaskbarProbe]::CodeUnits($fileInfo.ProductName)
        fileDescription = $fileInfo.FileDescription
        fileDescriptionUTF16 = [ZhusuanTaskbarProbe]::CodeUnits($fileInfo.FileDescription)
        fileVersion = $fileInfo.FileVersion
        productVersion = $fileInfo.ProductVersion
    }
    $taskbar = [ZhusuanTaskbarProbe]::FindWindowW('Shell_TrayWnd', $null)
    if ($taskbar -eq [IntPtr]::Zero) { throw 'Explorer Shell_TrayWnd is absent; taskbar UI cannot be accepted.' }
    $taskbarElement = [System.Windows.Automation.AutomationElement]::FromHandle($taskbar)
    $report.checks.taskbarRoot = Get-ElementSnapshot $taskbarElement
    $beforeButtons = @(Get-TaskbarButtons)
    $report.checks.buttonsBefore = @($beforeButtons | ForEach-Object { $_.snapshot })
    $beforeRuntimeIds = @($beforeButtons | ForEach-Object { $_.snapshot.runtimeId })
    $existingProcesses = @([System.Diagnostics.Process]::GetProcessesByName([System.IO.Path]::GetFileNameWithoutExtension($executablePath)) | ForEach-Object { $_.Id })

    $settings = @{
        ZHUSUAN_CONFIG_ROOT = (Join-Path $privateRoot 'config')
        DB_TYPE = 'sqlite'
        DB_PATH = (Join-Path $privateRoot 'taskbar-check.db')
        JWT_SECRET = ([Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48)))
        ENABLE_API_SERVER = 'false'
        ENV = 'development'
        LOG_PATH = (Join-Path $privateRoot 'application.log')
        LOG_LEVEL = 'warn'
        APPDATA = (Join-Path $privateRoot 'roaming')
        LOCALAPPDATA = (Join-Path $privateRoot 'local')
        WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--force-renderer-accessibility'
    }
    $start = [System.Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $executablePath
    $start.WorkingDirectory = $privateRoot
    $start.UseShellExecute = $false
    if ($LaunchShortcut) {
        $shortcutPath = (Resolve-Path -LiteralPath $LaunchShortcut).Path
        $shortcut = [ZhusuanTaskbarProbe]::ReadShortcut($shortcutPath)
        $target = [System.IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($shortcut.Target))
        if (-not [string]::Equals($target, $executablePath, [StringComparison]::OrdinalIgnoreCase) -or $shortcut.Arguments) {
            throw 'Launch shortcut must point to the owned executable without arguments.'
        }
        $report.checks.launchShortcut = [ordered]@{ file = [System.IO.Path]::GetFileName($shortcutPath); target = $target;
            description = $shortcut.Description; descriptionUTF16 = [ZhusuanTaskbarProbe]::CodeUnits($shortcut.Description);
            iconPath = $shortcut.IconPath; iconIndex = $shortcut.IconIndex }
        $start.FileName = $shortcutPath
        $start.UseShellExecute = $true
        # ProcessStartInfo.Environment cannot be used with ShellExecute. On this disposable
        # runner only, scope the caller environment and restore it even when launching fails.
        $previousEnvironment = @{}
        try {
            foreach ($entry in $settings.GetEnumerator()) {
                $previousEnvironment[$entry.Key] = [Environment]::GetEnvironmentVariable($entry.Key, 'Process')
                [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
            }
            $launchedProcess = [System.Diagnostics.Process]::Start($start)
        } finally {
            foreach ($entry in $previousEnvironment.GetEnumerator()) { [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process') }
        }
    } else {
        foreach ($entry in $settings.GetEnumerator()) { $start.Environment[$entry.Key] = $entry.Value }
        $launchedProcess = [System.Diagnostics.Process]::Start($start)
    }
    if ($launchedProcess) {
        $report.checks.launchHandleProcessId = $launchedProcess.Id
        if (-not $LaunchShortcut -or (Test-OwnedTaskbarProcess $launchedProcess)) {
            $process = $launchedProcess
            $ownedProcess = $true
        } else {
            # ShellExecute may delegate through Explorer or return no target handle.
            # Never close or kill an unverified launcher/previous application process.
            $launchedProcess.Dispose()
        }
    }
    Wait-TaskbarCondition 'owned visible native window' {
        if (-not $script:process) {
            foreach ($candidate in [System.Diagnostics.Process]::GetProcessesByName([System.IO.Path]::GetFileNameWithoutExtension($executablePath))) {
                if (Test-OwnedTaskbarProcess $candidate) {
                    $script:process = $candidate
                    $script:ownedProcess = $true
                    break
                }
            }
        }
        if ($script:process) { $script:window = [ZhusuanTaskbarProbe]::FindOwnedWindow($script:process.Id) }
        $script:window -ne [IntPtr]::Zero
    } 60
    if ($process.Id -in $existingProcesses -or -not [string]::Equals($process.MainModule.FileName, $executablePath, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Shell launch did not create the expected owned application process.'
    }
    if (-not (Test-Path -LiteralPath $settings.DB_PATH)) { throw 'Owned application did not create its private database; environment isolation was not verified.' }
    $report.checks.privateDatabaseCreated = $true
    $title = [ZhusuanTaskbarProbe]::Title($window)
    $report.checks.window = [ordered]@{ title = $title; titleUTF16 = [ZhusuanTaskbarProbe]::CodeUnits($title);
        isUnicode = [ZhusuanTaskbarProbe]::IsWindowUnicode($window); processId = $process.Id }
    $report.checks.properties = [ZhusuanTaskbarProbe]::WindowProperties($window)
    $expectedNames = @('珠算')
    if ($fileInfo.FileDescription -and $fileInfo.FileDescription.Contains('珠算')) { $expectedNames += $fileInfo.FileDescription }
    $matchNames = @($title, $fileInfo.ProductName, $fileInfo.FileDescription, [System.IO.Path]::GetFileNameWithoutExtension($executablePath)) |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    $button = $null
    Wait-TaskbarCondition 'unambiguous owned application taskbar button' {
        $buttons = @(Get-TaskbarButtons)
        $script:report.checks.buttonsAfter = @($buttons | ForEach-Object { $_.snapshot })
        $named = @($buttons | Where-Object {
            $name = $_.snapshot.name
            @($matchNames | Where-Object { $name.Contains($_) }).Count -gt 0
        })
        if ($named.Count -eq 1) { $script:button = $named[0]; return $true }
        if ($named.Count -gt 1) { return $false }
        $new = @($buttons | Where-Object { $_.snapshot.runtimeId -notin $beforeRuntimeIds -and $_.snapshot.enabled })
        if ($new.Count -eq 1) { $script:button = $new[0]; return $true }
        return $false
    }
    $report.checks.chosenButton = $button.snapshot
    $rootsBeforeClick = @(Get-VisibleDesktopRoots)
    $rootIdsBeforeClick = @($rootsBeforeClick | ForEach-Object { $_.snapshot.runtimeId })
    $report.checks.rootsBeforeClick = @($rootsBeforeClick | ForEach-Object { $_.snapshot })
    $bounds = $button.element.Current.BoundingRectangle
    [ZhusuanTaskbarProbe]::RightClick([int]($bounds.Left + $bounds.Width / 2), [int]($bounds.Top + $bounds.Height / 2))
    $popupOpened = $true
    $popup = $null
    Wait-TaskbarCondition 'visible taskbar right-click popup' {
        $roots = @(Get-VisibleDesktopRoots)
        $script:report.checks.rootsAfterClick = @($roots | ForEach-Object { $_.snapshot })
        $popups = @($roots | Where-Object {
            $_.snapshot.runtimeId -notin $rootIdsBeforeClick -and
            ($_.snapshot.processId -eq $report.checks.taskbarRoot.processId -or $_.snapshot.class -match 'JumpList|DV2ControlHost|Xaml.*Window|#32768')
        })
        if ($popups.Count -ne 1) { return $false }
        $script:popup = $popups[0]
        $nodes = @(Get-PopupNodes $script:popup.element)
        if (@($nodes | Where-Object { -not $_.offscreen -and $_.type -match 'MenuItem|Button' -and $_.name }).Count -eq 0) { return $false }
        $script:report.checks.popupNodes = $nodes
        return $true
    }
    Save-TaskbarScreenshot 'taskbar-popup.png'
    $labelMatches = @($report.checks.popupNodes | Where-Object {
        $_.enabled -and -not $_.offscreen -and $_.type -match 'MenuItem|Button' -and
        $_.bounds.width -gt 0 -and $_.bounds.height -gt 0 -and $_.name.Trim() -in $expectedNames
    })
    $report.labelCorrect = $labelMatches.Count -gt 0
    $report.checks.relaunchLabelMatches = $labelMatches
    # The application may publish its properties from its first-show callback.
    # Record both the early snapshot and the actual values after the menu opens.
    $report.checks.propertiesAfterPopup = [ZhusuanTaskbarProbe]::WindowProperties($window)
    if (-not $RecordOnly) {
        if ($title -ne '珠算' -or -not $report.checks.window.isUnicode) { throw 'Native window title is not Unicode 珠算.' }
        if ($fileInfo.ProductName -ne '珠算') { throw 'PE ProductName is not Unicode 珠算.' }
        if (-not $report.labelCorrect) { throw 'Taskbar relaunch menu item does not display Unicode 珠算 (or its legitimate PE FileDescription).' }
    }
    $report.passed = $true
    Write-Host "Observed native taskbar popup; correct relaunch label=$($report.labelCorrect), recordOnly=$RecordOnly."
} catch {
    $report.error = $_.Exception.Message
    try { Save-TaskbarScreenshot 'taskbar-failure.png' } catch { $report.screenshotError = $_.Exception.Message }
    throw
} finally {
    # Persist all UIA/property diagnostics while the owned window and popup still exist.
    $report | ConvertTo-Json -Depth 12 | Set-Content -Encoding utf8 (Join-Path $artifacts 'taskbar-verification.json')
    if ($popupOpened) { [ZhusuanTaskbarProbe]::Escape() }
    if ($ownedProcess -and $process -and -not $process.HasExited) {
        if ($window -ne [IntPtr]::Zero) { [void][ZhusuanTaskbarProbe]::PostMessageW($window, 0x0010, [UIntPtr]::Zero, [IntPtr]::Zero) }
        if (-not $process.WaitForExit(10000)) { $process.Kill($true); [void]$process.WaitForExit(10000) }
    }
    # Private DB/config/log/profile and generated credential material are never artifacts.
    Remove-Item -LiteralPath $privateRoot -Recurse -Force -ErrorAction SilentlyContinue
    if ($previousDpiContext -ne [IntPtr]::Zero) { [void][ZhusuanTaskbarProbe]::SetThreadDpiAwarenessContext($previousDpiContext) }
    if ($process) { $process.Dispose() }
}
