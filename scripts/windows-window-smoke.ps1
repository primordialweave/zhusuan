param(
    [Parameter(Mandatory = $true)][string]$Executable,
    [string]$OutputDirectory = (Join-Path $env:RUNNER_TEMP 'zhusuan-window-check')
)

$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT' -or $env:GITHUB_ACTIONS -ne 'true') {
    throw 'This native-window smoke runs only in an isolated GitHub Windows runner.'
}
if (-not [Environment]::UserInteractive) {
    throw 'Native window acceptance requires an interactive desktop; it cannot be skipped.'
}

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Threading;

public static class ZhusuanWindowProbe {
    [StructLayout(LayoutKind.Sequential)]
    public struct Rect {
        public int Left, Top, Right, Bottom;
        public int Width { get { return Right - Left; } }
        public int Height { get { return Bottom - Top; } }
    }
    [StructLayout(LayoutKind.Sequential)]
    public struct Point { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)]
    private struct MonitorInfo {
        public int Size;
        public Rect Monitor, Work;
        public uint Flags;
    }
    private delegate bool EnumWindowsCallback(IntPtr window, IntPtr parameter);
    [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowsCallback callback, IntPtr parameter);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [DllImport("user32.dll")] private static extern IntPtr GetWindow(IntPtr window, uint command);
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr window);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr window);
    [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr window, out Rect rectangle);
    [DllImport("user32.dll")] private static extern bool GetClientRect(IntPtr window, out Rect rectangle);
    [DllImport("user32.dll")] private static extern bool ClientToScreen(IntPtr window, ref Point point);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] private static extern IntPtr GetWindowLongPtr64(IntPtr window, int index);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongW")] private static extern int GetWindowLong32(IntPtr window, int index);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr window, int command);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);
    [DllImport("user32.dll")] private static extern IntPtr MonitorFromWindow(IntPtr window, uint flags);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo info);
    [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr window);
    [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")] private static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] private static extern void mouse_event(uint flags, uint x, uint y, uint data, UIntPtr extra);
    [DllImport("user32.dll")] private static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extra);
    [DllImport("dwmapi.dll")] private static extern int DwmGetWindowAttribute(IntPtr window, int attribute, out Rect rectangle, int size);

    public static IntPtr FindWindow(int processId) {
        IntPtr result = IntPtr.Zero;
        EnumWindows(delegate(IntPtr window, IntPtr parameter) {
            uint owner;
            GetWindowThreadProcessId(window, out owner);
            if (owner == (uint)processId && IsWindowVisible(window) && GetWindow(window, 4) == IntPtr.Zero) {
                result = window;
                return false;
            }
            return true;
        }, IntPtr.Zero);
        return result;
    }
    public static Rect Bounds(IntPtr window) {
        Rect result;
        if (!GetWindowRect(window, out result)) throw new InvalidOperationException("GetWindowRect failed.");
        return result;
    }
    public static Rect ClientBounds(IntPtr window) {
        Rect result;
        if (!GetClientRect(window, out result)) throw new InvalidOperationException("GetClientRect failed.");
        Point origin = new Point();
        if (!ClientToScreen(window, ref origin)) throw new InvalidOperationException("ClientToScreen failed.");
        return new Rect { Left = origin.X, Top = origin.Y, Right = origin.X + result.Width, Bottom = origin.Y + result.Height };
    }
    public static Rect VisibleBounds(IntPtr window) {
        Rect result;
        if (DwmGetWindowAttribute(window, 9, out result, Marshal.SizeOf(typeof(Rect))) != 0) return Bounds(window);
        return result;
    }
    public static Rect MonitorBounds(IntPtr window, bool workArea) {
        MonitorInfo info = new MonitorInfo { Size = Marshal.SizeOf(typeof(MonitorInfo)) };
        if (!GetMonitorInfo(MonitorFromWindow(window, 2), ref info)) throw new InvalidOperationException("GetMonitorInfo failed.");
        return workArea ? info.Work : info.Monitor;
    }
    public static uint Style(IntPtr window) {
        long style = IntPtr.Size == 8 ? GetWindowLongPtr64(window, -16).ToInt64() : GetWindowLong32(window, -16);
        return unchecked((uint)style);
    }
    public static void Click(int x, int y, bool twice) {
        SetCursorPos(x, y);
        Thread.Sleep(60);
        for (int i = 0; i < (twice ? 2 : 1); i++) {
            mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero);
            mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero);
            if (twice) Thread.Sleep(60);
        }
    }
    public static void Drag(int fromX, int fromY, int toX, int toY) {
        SetCursorPos(fromX, fromY);
        Thread.Sleep(150);
        mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero);
        try {
            for (int step = 1; step <= 12; step++) {
                SetCursorPos(fromX + (toX - fromX) * step / 12, fromY + (toY - fromY) * step / 12);
                Thread.Sleep(25);
            }
        } finally { mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero); }
    }
    public static void Key(byte key) {
        keybd_event(key, 0, 0, UIntPtr.Zero);
        keybd_event(key, 0, 2, UIntPtr.Zero);
    }
}
'@

function Wait-WindowCondition([string]$description, [scriptblock]$condition, [int]$seconds = 15) {
    $deadline = [DateTime]::UtcNow.AddSeconds($seconds)
    $lastAccessibilityError = $null
    do {
        try {
            if (& $condition) { return }
        } catch [System.Windows.Automation.ElementNotAvailableException] {
            $lastAccessibilityError = $_.Exception.Message
        } catch [System.Runtime.InteropServices.COMException] {
            $lastAccessibilityError = $_.Exception.Message
        }
        if ($script:process -and $script:process.HasExited) {
            throw "Application exited before '$description' (exit $($script:process.ExitCode))."
        }
        Start-Sleep -Milliseconds 100
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "Timed out waiting for $description. Last transient accessibility error: $lastAccessibilityError"
}

function Find-WindowButton([string]$name) {
    $root = [System.Windows.Automation.AutomationElement]::FromHandle($script:window)
    $groupConditions = [System.Windows.Automation.Condition[]]@(
        [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty, '窗口控制'),
        [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Group)
    )
    $controls = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.AndCondition]::new($groupConditions))
    if ($null -eq $controls) { return $null }
    $conditions = [System.Windows.Automation.Condition[]]@(
        [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty, $name),
        [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)
    )
    # The custom group distinguishes web controls from a hidden native caption's UIA nodes.
    return $controls.FindFirst([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.AndCondition]::new($conditions))
}

function Wait-WindowButton([string]$name) {
    Wait-WindowCondition "accessible '$name' button" { $null -ne (Find-WindowButton $name) } 30
    return Find-WindowButton $name
}

function Click-WindowButton([string]$name) {
    $button = Wait-WindowButton $name
    if (-not $button.Current.IsEnabled -or $button.Current.IsOffscreen) {
        throw "Window button '$name' is disabled or offscreen."
    }
    $bounds = $button.Current.BoundingRectangle
    if ($bounds.Width -le 0 -or $bounds.Height -le 0) { throw "Window button '$name' has no physical hit area." }
    [void][ZhusuanWindowProbe]::SetForegroundWindow($script:window)
    # Real pointer input also checks that --wails-draggable does not swallow button clicks.
    [ZhusuanWindowProbe]::Click([int]($bounds.Left + $bounds.Width / 2), [int]($bounds.Top + $bounds.Height / 2), $false)
}

function Is-Fullscreen {
    $bounds = [ZhusuanWindowProbe]::Bounds($script:window)
    $monitor = [ZhusuanWindowProbe]::MonitorBounds($script:window, $false)
    $style = [ZhusuanWindowProbe]::Style($script:window)
    return (($style -band 0x00CF0000) -eq 0 -and ($style -band 2147483648L) -ne 0 -and
        [Math]::Abs($bounds.Left - $monitor.Left) -le 2 -and [Math]::Abs($bounds.Top - $monitor.Top) -le 2 -and
        [Math]::Abs($bounds.Right - $monitor.Right) -le 2 -and [Math]::Abs($bounds.Bottom - $monitor.Bottom) -le 2)
}

function Get-RectangleData($rectangle) {
    return [ordered]@{ left = $rectangle.Left; top = $rectangle.Top; right = $rectangle.Right; bottom = $rectangle.Bottom; width = $rectangle.Width; height = $rectangle.Height }
}

function Save-WindowState([string]$name, [bool]$screenshot = $true) {
    $bounds = [ZhusuanWindowProbe]::Bounds($script:window)
    $script:states.Add([ordered]@{
        name = $name
        outer = Get-RectangleData $bounds
        client = Get-RectangleData ([ZhusuanWindowProbe]::ClientBounds($script:window))
        dwm = Get-RectangleData ([ZhusuanWindowProbe]::VisibleBounds($script:window))
        monitor = Get-RectangleData ([ZhusuanWindowProbe]::MonitorBounds($script:window, $false))
        workArea = Get-RectangleData ([ZhusuanWindowProbe]::MonitorBounds($script:window, $true))
        style = ('0x{0:X8}' -f [ZhusuanWindowProbe]::Style($script:window))
        dpi = [ZhusuanWindowProbe]::GetDpiForWindow($script:window)
        maximised = [ZhusuanWindowProbe]::IsZoomed($script:window)
        minimised = [ZhusuanWindowProbe]::IsIconic($script:window)
        fullscreen = Is-Fullscreen
    })
    if ($screenshot) {
        $desktop = [System.Windows.Forms.SystemInformation]::VirtualScreen
        $capture = [System.Drawing.Rectangle]::Intersect($desktop, [System.Drawing.Rectangle]::new($bounds.Left, $bounds.Top, $bounds.Width, $bounds.Height))
        if ($capture.Width -le 0 -or $capture.Height -le 0) { throw 'Window screenshot is outside the interactive desktop.' }
        $bitmap = [System.Drawing.Bitmap]::new($capture.Width, $capture.Height)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.CopyFromScreen($capture.Location, [System.Drawing.Point]::Empty, $capture.Size)
            $bitmap.Save((Join-Path $script:artifacts ($name + '.png')), [System.Drawing.Imaging.ImageFormat]::Png)
        } finally { $graphics.Dispose(); $bitmap.Dispose() }
    }
}

function Focus-Webview {
    [void][ZhusuanWindowProbe]::SetForegroundWindow($script:window)
    Wait-WindowCondition 'foreground application window' { [ZhusuanWindowProbe]::GetForegroundWindow() -eq $script:window }
    (Wait-WindowButton '关闭窗口').SetFocus()
}

function Save-AccessibilityDiagnostics {
    $root = [System.Windows.Automation.AutomationElement]::FromHandle($script:window)
    $elements = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
    $items = [System.Collections.Generic.List[object]]::new()
    for ($index = 0; $index -lt [Math]::Min($elements.Count, 300); $index++) {
        try {
            $current = $elements[$index].Current
            $items.Add([ordered]@{
                name = $current.Name
                type = $current.ControlType.ProgrammaticName
                enabled = $current.IsEnabled
                offscreen = $current.IsOffscreen
                bounds = $current.BoundingRectangle.ToString()
            })
        } catch [System.Windows.Automation.ElementNotAvailableException] { }
    }
    $items.ToArray() | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 (Join-Path $script:artifacts 'accessibility-failure.json')
}

function Write-PrivateQuitClosePolicy([string]$configRoot) {
    $directory = Join-Path $configRoot 'primordialweave/zhusuan'
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    $path = Join-Path $directory 'desktop-preferences.json'
    $preferences = @{ closeAction = 'quit' } | ConvertTo-Json -Compress
    [System.IO.File]::WriteAllText($path, $preferences, [System.Text.UTF8Encoding]::new($false))
    return $path
}

$artifacts = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$privateRoot = Join-Path $env:RUNNER_TEMP ('zhusuan-window-private-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $privateRoot | Out-Null
$states = [System.Collections.Generic.List[object]]::new()
$process = $null
$window = [IntPtr]::Zero
$success = $false
$failure = $null
$stdout = $null
$stderr = $null
$previousDpiContext = [ZhusuanWindowProbe]::SetThreadDpiAwarenessContext([IntPtr]::new(-4))
try {
    $start = [System.Diagnostics.ProcessStartInfo]::new()
    $start.FileName = (Resolve-Path -LiteralPath $Executable).Path
    $start.WorkingDirectory = $privateRoot
    $start.UseShellExecute = $false
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $settings = @{
        ZHUSUAN_CONFIG_ROOT = (Join-Path $privateRoot 'config')
        DB_TYPE = 'sqlite'
        DB_PATH = (Join-Path $privateRoot 'window-check.db')
        JWT_SECRET = ([Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48)))
        ENABLE_API_SERVER = 'false'
        ENV = 'development'
        LOG_PATH = (Join-Path $artifacts 'application.log')
        LOG_LEVEL = 'warn'
        APPDATA = (Join-Path $privateRoot 'roaming')
        LOCALAPPDATA = (Join-Path $privateRoot 'local')
        WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--force-renderer-accessibility'
    }
    foreach ($entry in $settings.GetEnumerator()) { $start.Environment[$entry.Key] = $entry.Value }
    # This fixture verifies the explicit quit close policy, including process exit.
    # Write it only under the disposable profile; the application's default remains ask.
    $desktopPreferencesPath = Write-PrivateQuitClosePolicy $settings.ZHUSUAN_CONFIG_ROOT
    $process = [System.Diagnostics.Process]::Start($start)
    $stdout = $process.StandardOutput.ReadToEndAsync()
    $stderr = $process.StandardError.ReadToEndAsync()
    Wait-WindowCondition 'visible native window' {
        $script:window = [ZhusuanWindowProbe]::FindWindow($script:process.Id)
        $script:window -ne [IntPtr]::Zero
    } 60
    [void](Wait-WindowButton '最大化')
    [void](Wait-WindowButton '全屏')
    [void](Wait-WindowButton '最小化')
    [void](Wait-WindowButton '关闭窗口')

    # Arrange a normal window away from monitor edges before real resize/drag input.
    $work = [ZhusuanWindowProbe]::MonitorBounds($window, $true)
    $width = [Math]::Min(1100, $work.Width - 100)
    $height = [Math]::Min(700, $work.Height - 100)
    if ($width -lt 640 -or $height -lt 400) { throw 'Runner desktop is too small for native window acceptance.' }
    [void][ZhusuanWindowProbe]::ShowWindow($window, 9)
    [void][ZhusuanWindowProbe]::SetWindowPos($window, [IntPtr]::Zero, $work.Left + 40, $work.Top + 40, $width, $height, 0x0040)
    Wait-WindowCondition 'arranged normal window' {
        $bounds = [ZhusuanWindowProbe]::Bounds($script:window)
        -not [ZhusuanWindowProbe]::IsZoomed($script:window) -and [Math]::Abs($bounds.Width - $width) -le 2
    }
    $outer = [ZhusuanWindowProbe]::Bounds($window)
    $client = [ZhusuanWindowProbe]::ClientBounds($window)
    $tolerance = [Math]::Ceiling(4 * [ZhusuanWindowProbe]::GetDpiForWindow($window) / 96)
    # Wails alpha.55 retains WS_CAPTION for native window operations, but removes
    # the standard titlebar through WM_NCCALCSIZE. The geometry is the contract.
    if ([Math]::Abs($client.Top - $outer.Top) -gt $tolerance) { throw 'Native caption still occupies space above the WebView client area.' }
    if (([ZhusuanWindowProbe]::Style($window) -band 0x00040000) -eq 0) { throw 'Resizable WS_THICKFRAME was lost in frameless mode.' }
    Save-WindowState '01-normal'

    # Programmatic SetWindowPos above is only setup; this must resize through a real edge drag.
    [ZhusuanWindowProbe]::Drag($outer.Right - 2, $outer.Bottom - 2, $outer.Right - 74, $outer.Bottom - 50)
    Wait-WindowCondition 'pointer resize through the frameless bottom-right edge' {
        $resized = [ZhusuanWindowProbe]::Bounds($script:window)
        $resized.Width -lt ($outer.Width - 30) -and $resized.Height -lt ($outer.Height - 20)
    }
    Save-WindowState '02-resized'
    $beforeDrag = [ZhusuanWindowProbe]::Bounds($window)
    [ZhusuanWindowProbe]::Drag($beforeDrag.Left + [int]($beforeDrag.Width / 2), $beforeDrag.Top + 22,
        $beforeDrag.Left + [int]($beforeDrag.Width / 2) + 45, $beforeDrag.Top + 47)
    Wait-WindowCondition 'pointer drag through custom titlebar' {
        $moved = [ZhusuanWindowProbe]::Bounds($script:window)
        [Math]::Abs($moved.Left - $beforeDrag.Left) -ge 20 -and [Math]::Abs($moved.Top - $beforeDrag.Top) -ge 10
    }
    $normal = [ZhusuanWindowProbe]::Bounds($window)
    Save-WindowState '03-dragged'

    Click-WindowButton '最大化'
    Wait-WindowCondition 'native maximised state' { [ZhusuanWindowProbe]::IsZoomed($script:window) }
    [void](Wait-WindowButton '还原')
    $maxClient = [ZhusuanWindowProbe]::ClientBounds($window)
    $work = [ZhusuanWindowProbe]::MonitorBounds($window, $true)
    if ([Math]::Abs($maxClient.Top - $work.Top) -gt $tolerance -or [Math]::Abs($maxClient.Bottom - $work.Bottom) -gt $tolerance) {
        throw 'Maximised client bounds do not respect the monitor work area.'
    }
    Save-WindowState '04-maximised'

    Click-WindowButton '全屏'
    Wait-WindowCondition 'fullscreen monitor bounds and native style' { Is-Fullscreen }
    [void](Wait-WindowButton '退出全屏')
    Save-WindowState '05-fullscreen-from-maximised'
    Click-WindowButton '退出全屏'
    Wait-WindowCondition 'restored maximised state after fullscreen' {
        -not (Is-Fullscreen) -and [ZhusuanWindowProbe]::IsZoomed($script:window)
    }
    Click-WindowButton '还原'
    Wait-WindowCondition 'restored normal state' { -not [ZhusuanWindowProbe]::IsZoomed($script:window) }
    $restored = [ZhusuanWindowProbe]::Bounds($window)
    if ([Math]::Abs($restored.Width - $normal.Width) -gt $tolerance -or [Math]::Abs($restored.Height - $normal.Height) -gt $tolerance) {
        throw 'Maximise/fullscreen restore did not retain the normal window dimensions.'
    }

    Click-WindowButton '最小化'
    Wait-WindowCondition 'native minimised state' { [ZhusuanWindowProbe]::IsIconic($script:window) }
    Save-WindowState '06-minimised' $false
    [void][ZhusuanWindowProbe]::ShowWindow($window, 9)
    Wait-WindowCondition 'restored window after minimise' { -not [ZhusuanWindowProbe]::IsIconic($script:window) }

    Focus-Webview
    [ZhusuanWindowProbe]::Key(0x7A) # F11
    Wait-WindowCondition 'F11 entering fullscreen' { Is-Fullscreen }
    [void](Wait-WindowButton '退出全屏')
    Save-WindowState '07-fullscreen-f11'
    Focus-Webview
    [ZhusuanWindowProbe]::Key(0x1B) # Escape
    Wait-WindowCondition 'Escape leaving fullscreen' { -not (Is-Fullscreen) }
    [void](Wait-WindowButton '全屏')
    Save-WindowState '08-restored-after-escape'

    $bounds = [ZhusuanWindowProbe]::Bounds($window)
    [ZhusuanWindowProbe]::Click($bounds.Left + [int]($bounds.Width / 2), $bounds.Top + 22, $true)
    Wait-WindowCondition 'double-click custom titlebar maximising the window' { [ZhusuanWindowProbe]::IsZoomed($script:window) }
    Click-WindowButton '还原'
    Wait-WindowCondition 'restored after titlebar double-click' { -not [ZhusuanWindowProbe]::IsZoomed($script:window) }
    Save-WindowState '09-final-normal'

    Click-WindowButton '关闭窗口'
    if (-not $process.WaitForExit(15000)) { throw 'Close button did not terminate the owned desktop process.' }
    if ([ZhusuanWindowProbe]::IsWindow($window)) { throw 'Close button left the native window alive.' }
    if ($process.ExitCode -ne 0) { throw "Desktop process exited with code $($process.ExitCode)." }
    $success = $true
    Write-Host 'Passed: native frameless geometry, pointer resize/drag, window controls, fullscreen/restore, F11/Escape, and close.'
} catch {
    $failure = $_.Exception.Message
    if ($window -ne [IntPtr]::Zero -and [ZhusuanWindowProbe]::IsWindow($window)) {
        try { Save-AccessibilityDiagnostics } catch { Write-Warning "Unable to capture failure accessibility tree: $_" }
        try { Save-WindowState '99-failure' (-not [ZhusuanWindowProbe]::IsIconic($window)) } catch { Write-Warning "Unable to capture failure window: $_" }
    }
    throw
} finally {
    if ($process -and -not $process.HasExited) {
        $process.Kill($true)
        [void]$process.WaitForExit(10000)
    }
    foreach ($stream in @(@{ task = $stdout; name = 'stdout.log' }, @{ task = $stderr; name = 'stderr.log' })) {
        if ($stream.task) {
            $text = if ($stream.task.Wait(10000)) { $stream.task.GetAwaiter().GetResult() } else { 'Log pipe did not close within 10 seconds after application exit.' }
            [System.IO.File]::WriteAllText((Join-Path $artifacts $stream.name), $text)
        }
    }
    [ordered]@{
        passed = $success
        error = $failure
        sourceCommit = $env:APPLICATION_SOURCE_SHA
        executable = [System.IO.Path]::GetFileName($Executable)
        nativeDesktop = $true
        closeActionUnderTest = 'quit'
        states = $states.ToArray()
    } | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 (Join-Path $artifacts 'window-verification.json')
    # The private database, generated credentials and WebView profile are never artifacts.
    Remove-Item -LiteralPath $privateRoot -Recurse -Force -ErrorAction SilentlyContinue
    if ($previousDpiContext -ne [IntPtr]::Zero) { [void][ZhusuanWindowProbe]::SetThreadDpiAwarenessContext($previousDpiContext) }
    if ($process) { $process.Dispose() }
}
