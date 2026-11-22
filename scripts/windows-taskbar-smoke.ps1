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
    [DllImport("user32.dll", CharSet = CharSet.Unicode, ExactSpelling = true)]
    private static extern int GetClassNameW(IntPtr window, StringBuilder name, int count);
    [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr window, out NativeRect bounds);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern IntPtr WindowFromPoint(NativePoint point);
    [DllImport("user32.dll")] private static extern IntPtr GetAncestor(IntPtr window, uint flags);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern IntPtr OpenProcess(uint access, bool inherit, uint processId);
    [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr handle);
    [DllImport("kernel32.dll")] private static extern IntPtr LocalFree(IntPtr memory);
    [DllImport("advapi32.dll", SetLastError = true)] private static extern bool OpenProcessToken(IntPtr process, uint access, out IntPtr token);
    [DllImport("advapi32.dll", SetLastError = true)] private static extern bool GetTokenInformation(IntPtr token, int kind, IntPtr data, uint size, out uint required);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, ExactSpelling = true, SetLastError = true)]
    private static extern bool ConvertSidToStringSidW(IntPtr sid, out IntPtr text);
    [DllImport("user32.dll")] private static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] private static extern bool GetCursorPos(out NativePoint point);
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
    [StructLayout(LayoutKind.Sequential)]
    public struct NativeRect { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)]
    private struct NativePoint { public int X, Y; }
    public class NativeWindowValue {
        public long Handle, OwnerHandle;
        public uint ProcessId;
        public string Class, Title;
        public NativeRect Bounds;
    }
    public class ClickValue {
        public int RequestedX, RequestedY, CursorX, CursorY;
        public string TimestampUTC;
        public NativeWindowValue NativeHitBeforeInput;
    }

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
    public static NativeWindowValue InspectWindow(IntPtr window) {
        if (window == IntPtr.Zero) return null;
        var name = new StringBuilder(256); NativeRect bounds;
        GetClassNameW(window, name, name.Capacity); GetWindowRect(window, out bounds);
        return new NativeWindowValue { Handle = window.ToInt64(), OwnerHandle = GetWindow(window, 4).ToInt64(),
            ProcessId = Owner(window), Class = name.ToString(), Title = Title(window), Bounds = bounds };
    }
    public static NativeWindowValue WindowAt(int x, int y) {
        IntPtr hit = WindowFromPoint(new NativePoint { X = x, Y = y });
        return InspectWindow(GetAncestor(hit, 2)); // GA_ROOT, using the actual native hit test.
    }
    public static string ProcessOwnerSid(uint processId) {
        IntPtr process = OpenProcess(0x1000, false, processId); // Query limited information only.
        if (process == IntPtr.Zero) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
        IntPtr token = IntPtr.Zero, buffer = IntPtr.Zero, text = IntPtr.Zero;
        try {
            if (!OpenProcessToken(process, 0x0008, out token)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
            uint required; GetTokenInformation(token, 1, IntPtr.Zero, 0, out required); // TokenUser
            if (required == 0) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
            buffer = Marshal.AllocHGlobal((int)required);
            if (!GetTokenInformation(token, 1, buffer, required, out required)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
            if (!ConvertSidToStringSidW(Marshal.ReadIntPtr(buffer), out text)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
            return Marshal.PtrToStringUni(text);
        } finally {
            if (text != IntPtr.Zero) LocalFree(text);
            if (buffer != IntPtr.Zero) Marshal.FreeHGlobal(buffer);
            if (token != IntPtr.Zero) CloseHandle(token);
            CloseHandle(process);
        }
    }
    public static NativeWindowValue[] VisibleShellWindows(uint processId) {
        var result = new List<NativeWindowValue>();
        EnumWindows(delegate(IntPtr window, IntPtr parameter) {
            if ((processId == 0 || Owner(window) == processId) && IsWindowVisible(window)) {
                var name = new StringBuilder(256); NativeRect bounds;
                GetClassNameW(window, name, name.Capacity);
                GetWindowRect(window, out bounds);
                result.Add(new NativeWindowValue { Handle = window.ToInt64(), OwnerHandle = GetWindow(window, 4).ToInt64(),
                    ProcessId = processId, Class = name.ToString(), Title = Title(window), Bounds = bounds });
            }
            return true;
        }, IntPtr.Zero);
        return result.ToArray();
    }
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
    public static ClickValue PrepareRightClick(int x, int y) {
        if (!SetCursorPos(x, y)) throw new InvalidOperationException("SetCursorPos failed.");
        Thread.Sleep(100);
        NativePoint cursor;
        if (!GetCursorPos(out cursor) || cursor.X != x || cursor.Y != y) throw new InvalidOperationException("Cursor did not reach the observed taskbar button.");
        var trace = new ClickValue { RequestedX = x, RequestedY = y, CursorX = cursor.X, CursorY = cursor.Y,
            TimestampUTC = DateTime.UtcNow.ToString("o"), NativeHitBeforeInput = WindowAt(x, y) };
        return trace;
    }
    public static void SendRightClick() {
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
    $hasInvokePattern = $false
    $patternError = $null
    try {
        $hasInvokePattern = @($element.GetSupportedPatterns() | Where-Object { $_.Id -eq [System.Windows.Automation.InvokePattern]::Pattern.Id }).Count -gt 0
    } catch [System.Runtime.InteropServices.COMException] {
        # Pattern enumeration is optional diagnostic data. A stale/unsupported
        # peer must not discard valid names and geometry from the whole popup.
        $patternError = [ordered]@{ operation = 'GetSupportedPatterns'; message = $_.Exception.Message;
            hresult = ('0x{0:X8}' -f ([uint32]([int64]$_.Exception.HResult -band 0xffffffff))) }
    }
    return [ordered]@{
        runtimeId = ($element.GetRuntimeId() -join '.')
        name = $current.Name
        nameUTF16 = [ZhusuanTaskbarProbe]::CodeUnits($current.Name)
        class = $current.ClassName
        automationId = $current.AutomationId
        framework = $current.FrameworkId
        nativeWindowHandle = $current.NativeWindowHandle
        processId = $current.ProcessId
        type = $current.ControlType.ProgrammaticName
        enabled = $current.IsEnabled
        offscreen = $current.IsOffscreen
        controlElement = $current.IsControlElement
        contentElement = $current.IsContentElement
        hasInvokePattern = $hasInvokePattern
        optionalPatternError = $patternError
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

function Get-RawShellNodes($seed = $null) {
    # A Jump List can be a RawView descendant of an existing Explorer root.
    # Run3 proved that a real visible popup need not add a desktop ControlView root.
    $walker = [System.Windows.Automation.TreeWalker]::RawViewWalker
    $stack = [System.Collections.Generic.Stack[object]]::new()
    if ($seed) {
        $stack.Push([pscustomobject]@{ element = $seed; parentRuntimeId = $null })
    } else {
        $root = $walker.GetFirstChild([System.Windows.Automation.AutomationElement]::RootElement)
        while ($root) {
            $snapshot = Get-ElementSnapshot $root
            if ($snapshot.processId -in $script:trustedShellProcessIds) {
                $stack.Push([pscustomobject]@{ element = $root; parentRuntimeId = $null })
            }
            $root = $walker.GetNextSibling($root)
        }
    }
    $seen = [System.Collections.Generic.HashSet[string]]::new()
    $result = [System.Collections.Generic.List[object]]::new()
    while ($stack.Count -gt 0 -and $result.Count -lt 4000) {
        $node = $stack.Pop()
        $snapshot = Get-ElementSnapshot $node.element
        if (-not $seen.Add($snapshot.runtimeId)) { continue }
        $snapshot.parentRuntimeId = $node.parentRuntimeId
        $result.Add([pscustomobject]@{ element = $node.element; snapshot = $snapshot })
        $child = $walker.GetFirstChild($node.element)
        while ($child) {
            $stack.Push([pscustomobject]@{ element = $child; parentRuntimeId = $snapshot.runtimeId })
            $child = $walker.GetNextSibling($child)
        }
    }
    if ($stack.Count -gt 0) { throw 'RawView Explorer tree exceeded the diagnostic node limit.' }
    return $result.ToArray()
}

function Test-VisiblePopupNode($snapshot) {
    return ($snapshot.processId -in $script:trustedShellProcessIds -and
        $snapshot.enabled -and -not $snapshot.offscreen -and
        $snapshot.bounds.width -gt 0 -and $snapshot.bounds.height -gt 0)
}

function Test-OutsideTaskbar($bounds) {
    $bar = $script:report.checks.taskbarRoot.bounds
    return ($bounds.left + $bounds.width -le $bar.left -or $bounds.left -ge $bar.left + $bar.width -or
        $bounds.top + $bounds.height -le $bar.top -or $bounds.top -ge $bar.top + $bar.height)
}

function Get-TrustedShellProcess([int]$processId) {
    if ($script:shellProcessProofs.ContainsKey($processId)) { return $script:shellProcessProofs[$processId] }
    $proof = [ordered]@{ processId = $processId; trusted = $false; name = $null; path = $null; sessionId = $null; ownerSid = $null; error = $null }
    try {
        $provider = [System.Diagnostics.Process]::GetProcessById($processId)
        try {
            $proof.name = $provider.ProcessName
            $proof.path = $provider.MainModule.FileName
            $proof.sessionId = $provider.SessionId
            $proof.ownerSid = [ZhusuanTaskbarProbe]::ProcessOwnerSid($processId)
            $windowsRoot = [System.IO.Path]::GetFullPath($env:WINDIR).TrimEnd('\') + '\'
            $proof.trusted = ($proof.name -in @('explorer', 'ShellExperienceHost', 'StartMenuExperienceHost', 'ShellHost') -and
                $proof.path.StartsWith($windowsRoot, [StringComparison]::OrdinalIgnoreCase) -and
                $proof.sessionId -eq $script:shellSessionId -and $proof.ownerSid -eq $script:shellOwnerSid)
        } finally { $provider.Dispose() }
    } catch { $proof.error = $_.Exception.Message }
    $script:shellProcessProofs[$processId] = $proof
    return $proof
}

function Get-NativePopupRoots($windows, $beforeHandles) {
    $result = [System.Collections.Generic.List[object]]::new()
    $seen = [System.Collections.Generic.HashSet[long]]::new()
    foreach ($native in $windows) {
        if (-not $native -or -not $seen.Add($native.Handle)) { continue }
        $proof = Get-TrustedShellProcess $native.ProcessId
        if (-not $proof.trusted) { continue }
        if ($native.ProcessId -notin $script:trustedShellProcessIds) { $script:trustedShellProcessIds += [int]$native.ProcessId }
        $bounds = @{ left = $native.Bounds.Left; top = $native.Bounds.Top;
            width = $native.Bounds.Right - $native.Bounds.Left; height = $native.Bounds.Bottom - $native.Bounds.Top }
        if ($bounds.width -le 0 -or $bounds.height -le 0 -or -not (Test-OutsideTaskbar $bounds)) { continue }
        $bar = $script:report.checks.taskbarRoot.bounds
        $button = $script:report.checks.chosenButton.bounds
        $axis = if ($bar.width -ge $bar.height) { $button.left + $button.width / 2 } else { $button.top + $button.height / 2 }
        $matchesAxis = if ($bar.width -ge $bar.height) { $axis -ge $bounds.left -and $axis -le $bounds.left + $bounds.width } else { $axis -ge $bounds.top -and $axis -le $bounds.top + $bounds.height }
        if (-not $matchesAxis) { continue }
        # WindowFromPoint/foreground roots can reuse native handles. New actionable
        # RawView peers are still required by Find-RawTaskbarPopup below.
        $result.Add([pscustomobject]@{ native = $native; proof = $proof; newVisibleHandle = $native.Handle -notin $beforeHandles })
    }
    return $result.ToArray()
}

function Get-TaskbarHitTests {
    $bar = $script:report.checks.taskbarRoot.bounds
    $button = $script:report.checks.chosenButton.bounds
    $screen = [System.Windows.Forms.SystemInformation]::VirtualScreen
    $hits = [System.Collections.Generic.List[object]]::new()
    foreach ($distance in @(1, 2)) {
        if ($bar.width -ge $bar.height) {
            $x = [int]($button.left + $button.width / 2)
            $y = if ($bar.top -ge $screen.Top + $screen.Height / 2) { [int]($bar.top - $bar.height * $distance) } else { [int]($bar.top + $bar.height * (1 + $distance)) }
        } else {
            $y = [int]($button.top + $button.height / 2)
            $x = if ($bar.left -ge $screen.Left + $screen.Width / 2) { [int]($bar.left - $bar.width * $distance) } else { [int]($bar.left + $bar.width * (1 + $distance)) }
        }
        if ($screen.Contains($x, $y)) { $hits.Add([pscustomobject]@{ x = $x; y = $y; native = [ZhusuanTaskbarProbe]::WindowAt($x, $y) }) }
    }
    return $hits.ToArray()
}

function Invoke-ObservedTaskbarRightClick {
    $expected = $script:report.checks.chosenButton
    $current = @(Get-TaskbarButtons | Where-Object { $_.snapshot.automationId -eq $expected.automationId -and
        $_.snapshot.class -eq $expected.class -and $_.snapshot.name -eq $expected.name })
    if ($current.Count -ne 1) { throw 'The owned taskbar button is not unambiguous before real input.' }
    $snapshot = Get-ElementSnapshot $current[0].element
    $bounds = $snapshot.bounds
    if ($bounds.width -le 0 -or $bounds.height -le 0 -or $snapshot.offscreen) { throw 'The owned taskbar button has no visible hit area.' }
    $x = [int]($bounds.left + $bounds.width / 2)
    $y = [int]($bounds.top + $bounds.height / 2)
    $attempt = [ordered]@{ timestampUTC = [DateTime]::UtcNow.ToString('o'); currentButton = $snapshot;
        requestedPoint = @{ x = $x; y = $y }; uiaHitBeforeInput = $null; uiaHitRelated = $null;
        optionalHitError = $null; input = $null; inputSent = $false }
    # Persist the attempted geometry before any diagnostic or native assertion,
    # so a failed pre-input check cannot erase the evidence as run6 did.
    $script:report.checks.pendingRightClick = $attempt
    try {
        $hit = [System.Windows.Automation.AutomationElement]::FromPoint([System.Windows.Point]::new($x, $y))
        $hitSnapshot = Get-ElementSnapshot $hit
        $attempt.uiaHitBeforeInput = $hitSnapshot
        $matchesButton = $hitSnapshot.runtimeId -eq $snapshot.runtimeId
        $walker = [System.Windows.Automation.TreeWalker]::RawViewWalker
        for ($depth = 0; -not $matchesButton -and $hit -and $depth -lt 16; $depth++) {
            $hit = $walker.GetParent($hit)
            if ($hit) { $matchesButton = ($hit.GetRuntimeId() -join '.') -eq $snapshot.runtimeId }
        }
        $attempt.uiaHitRelated = $matchesButton
    } catch [System.Runtime.InteropServices.COMException] {
        $attempt.optionalHitError = [ordered]@{ message = $_.Exception.Message; hresult = $_.Exception.HResult }
    } catch [System.Windows.Automation.ElementNotAvailableException] {
        $attempt.optionalHitError = [ordered]@{ message = $_.Exception.Message; hresult = $_.Exception.HResult }
    }
    $script:report.checks.chosenButton = $snapshot
    $trace = [ZhusuanTaskbarProbe]::PrepareRightClick($x, $y)
    $attempt.input = $trace
    $attempt.timestampUTC = $trace.TimestampUTC
    $inside = ($trace.CursorX -ge $bounds.left -and $trace.CursorX -lt $bounds.left + $bounds.width -and
        $trace.CursorY -ge $bounds.top -and $trace.CursorY -lt $bounds.top + $bounds.height)
    $proof = if ($trace.NativeHitBeforeInput) { Get-TrustedShellProcess $trace.NativeHitBeforeInput.ProcessId } else { $null }
    $attempt.nativeHitProof = $proof
    if (-not $inside -or -not $proof -or -not $proof.trusted) { throw 'The actual native cursor hit is outside the observed button or trusted shell.' }
    # FromPoint may return a taskbar ancestor/provider peer with a different
    # RuntimeId. It is diagnostic; native hit + fresh bounds govern real input.
    [ZhusuanTaskbarProbe]::SendRightClick()
    $attempt.inputSent = $true
    $attempt.foregroundBeforeObservation = [ZhusuanTaskbarProbe]::InspectWindow([ZhusuanTaskbarProbe]::GetForegroundWindow())
    return $attempt
}

function Get-RawAncestorIds($snapshot, $map) {
    $ids = [System.Collections.Generic.List[string]]::new()
    $id = $snapshot.parentRuntimeId
    while ($id -and $map.ContainsKey($id) -and $ids.Count -lt 64) {
        $ids.Add($id)
        $id = $map[$id].snapshot.parentRuntimeId
    }
    return $ids.ToArray()
}

function Get-RawPopupRows($nodes, $map) {
    $rows = [System.Collections.Generic.List[object]]::new()
    foreach ($node in $nodes) {
        $item = $node.snapshot
        if (-not (Test-VisiblePopupNode $item) -or -not (Test-OutsideTaskbar $item.bounds)) { continue }
        if ($item.type -notmatch 'MenuItem|Button|ListItem' -and -not ($item.type -eq 'ControlType.Custom' -and $item.hasInvokePattern)) { continue }
        $label = $item.name
        $source = 'actionable peer'
        if ([string]::IsNullOrWhiteSpace($label)) {
            # Some XAML ListItem peers expose the label through their Text child.
            # Bind that label to the real actionable row, rather than accepting any Text.
            $text = @($nodes | Where-Object { $_.snapshot.parentRuntimeId -eq $item.runtimeId -and
                $_.snapshot.type -eq 'ControlType.Text' -and (Test-VisiblePopupNode $_.snapshot) -and $_.snapshot.name })
            if ($text.Count -eq 1) { $label = $text[0].snapshot.name; $source = 'Text child of actionable peer' }
        }
        if ([string]::IsNullOrWhiteSpace($label)) { continue }
        $copy = [ordered]@{}
        foreach ($entry in $item.GetEnumerator()) { $copy[$entry.Key] = $entry.Value }
        $copy.label = $label.Trim()
        $copy.labelUTF16 = [ZhusuanTaskbarProbe]::CodeUnits($copy.label)
        $copy.labelSource = $source
        $copy.ancestors = @(Get-RawAncestorIds $item $map)
        $rows.Add($copy)
    }
    return $rows.ToArray()
}

function Find-RawTaskbarPopup($nodes, $visibleIdsBeforeClick) {
    $map = @{}
    foreach ($node in $nodes) { $map[$node.snapshot.runtimeId] = $node }
    $rows = @(Get-RawPopupRows $nodes $map | Where-Object { $_.runtimeId -notin $visibleIdsBeforeClick })
    $pins = @($rows | Where-Object { $_.label -match '^(Unpin from|Pin to) taskbar$' })
    $closes = @($rows | Where-Object { $_.label -match '^Close (window|all windows)$' })
    if ($pins.Count -eq 0 -or $closes.Count -eq 0) { return $null }
    $common = @($pins[0].ancestors | Where-Object { $_ -in $closes[0].ancestors })
    $container = $null
    foreach ($id in $common) {
        $candidate = $map[$id].snapshot
        if (-not (Test-VisiblePopupNode $candidate) -or -not (Test-OutsideTaskbar $candidate.bounds)) { continue }
        $bounds = $candidate.bounds
        $bar = $script:report.checks.taskbarRoot.bounds
        $button = $script:report.checks.chosenButton.bounds
        if ($bar.width -ge $bar.height) {
            $axis = $button.left + $button.width / 2
            if ($axis -lt $bounds.left -or $axis -gt $bounds.left + $bounds.width) { continue }
        } else {
            $axis = $button.top + $button.height / 2
            if ($axis -lt $bounds.top -or $axis -gt $bounds.top + $bounds.height) { continue }
        }
        # Keep the outermost popup ancestor whose observed geometry remains outside
        # the taskbar. The full desktop/root cannot become the accepted container.
        $container = $candidate
    }
    if (-not $container) { return $null }
    $popupRows = @($rows | Where-Object { $container.runtimeId -in $_.ancestors })
    if (@($popupRows | ForEach-Object { $_.label } | Select-Object -Unique).Count -lt 3) { return $null }
    return [pscustomobject]@{ container = $container; rows = $popupRows }
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
$shellProcessProofs = @{}
$shellSessionId = [System.Diagnostics.Process]::GetCurrentProcess().SessionId
$shellOwnerSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$trustedShellProcessIds = @()
$popupOpened = $false
$previousDpiContext = [ZhusuanTaskbarProbe]::SetThreadDpiAwarenessContext([IntPtr]::new(-4))
$report = [ordered]@{
    passed = $false
    recordOnly = [bool]$RecordOnly
    labelCorrect = $false
    workflowApplicationSourceCommit = $env:APPLICATION_SOURCE_SHA
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
    $taskbarProof = Get-TrustedShellProcess $report.checks.taskbarRoot.processId
    if (-not $taskbarProof.trusted) { throw 'Taskbar provider is not a trusted shell process in the current session/user.' }
    $trustedShellProcessIds = @([int]$report.checks.taskbarRoot.processId)
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
    $report.checks.rootsBeforeClick = @($rootsBeforeClick | ForEach-Object { $_.snapshot })
    $nativeBeforeClick = @([ZhusuanTaskbarProbe]::VisibleShellWindows(0))
    $report.checks.nativeWindowsBeforeClick = $nativeBeforeClick
    $nativeHandlesBeforeClick = @($nativeBeforeClick | ForEach-Object { $_.Handle })
    foreach ($native in $nativeBeforeClick) {
        if ((Get-TrustedShellProcess $native.ProcessId).trusted -and $native.ProcessId -notin $trustedShellProcessIds) { $trustedShellProcessIds += [int]$native.ProcessId }
    }
    $rawBeforeClick = @(Get-RawShellNodes)
    $report.checks.rawShellBeforeClick = @($rawBeforeClick | ForEach-Object { $_.snapshot })
    $rawVisibleIdsBeforeClick = @($rawBeforeClick | Where-Object { Test-VisiblePopupNode $_.snapshot } | ForEach-Object { $_.snapshot.runtimeId })
    $report.checks.nativeShellWindowsBeforeClick = [ZhusuanTaskbarProbe]::VisibleShellWindows($report.checks.taskbarRoot.processId)
    $clickAttempts = [System.Collections.Generic.List[object]]::new()
    $report.checks.rightClickAttempts = $clickAttempts
    $clickAttempts.Add((Invoke-ObservedTaskbarRightClick))
    $popupOpened = $true
    $popup = $null
    $popupAutomationObserved = $false
    try {
        Wait-TaskbarCondition 'visible taskbar right-click popup' {
        $roots = @(Get-VisibleDesktopRoots)
        $script:report.checks.rootsAfterClick = @($roots | ForEach-Object { $_.snapshot })
        $script:report.checks.nativeShellWindowsAfterClick = [ZhusuanTaskbarProbe]::VisibleShellWindows($report.checks.taskbarRoot.processId)
        $allNative = @([ZhusuanTaskbarProbe]::VisibleShellWindows(0))
        $script:report.checks.nativeWindowsAfterClick = $allNative
        $hits = @(Get-TaskbarHitTests)
        $script:report.checks.nativeHitTestsAfterClick = $hits
        $foreground = [ZhusuanTaskbarProbe]::InspectWindow([ZhusuanTaskbarProbe]::GetForegroundWindow())
        $script:report.checks.nativeForegroundAfterClick = $foreground
        $nativeRoots = @(Get-NativePopupRoots @($allNative + @($hits | ForEach-Object { $_.native }) + @($foreground)) $nativeHandlesBeforeClick)
        $script:report.checks.nativePopupRootCandidates = $nativeRoots
        if ($clickAttempts.Count -eq 1 -and $nativeRoots.Count -eq 0 -and $hits.Count -gt 0 -and
            @($hits | Where-Object { -not $_.native -or $_.native.ProcessId -ne $script:process.Id }).Count -eq 0 -and
            ([DateTime]::UtcNow - [DateTimeOffset]::Parse($clickAttempts[0].timestampUTC).UtcDateTime).TotalSeconds -ge 3) {
            # Run5's third phase had no native popup: both hit tests still reached
            # the app, while both baselines had worked. Retry real input once from
            # refreshed UIA geometry, within this SAME wait deadline.
            $clickAttempts[0].verifiedPopupAbsence = [ordered]@{ timestampUTC = [DateTime]::UtcNow.ToString('o');
                nativeWindows = $allNative; hitTests = $hits; foreground = $foreground }
            $clickAttempts.Add((Invoke-ObservedTaskbarRightClick))
            return $false
        }
        $nodes = @(Get-RawShellNodes)
        $nodeIds = [System.Collections.Generic.HashSet[string]]::new()
        foreach ($node in $nodes) { [void]$nodeIds.Add($node.snapshot.runtimeId) }
        foreach ($nativeRoot in $nativeRoots) {
            $element = [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]::new($nativeRoot.native.Handle))
            foreach ($node in @(Get-RawShellNodes $element)) {
                if ($nodeIds.Add($node.snapshot.runtimeId)) { $nodes += $node }
            }
        }
        $script:report.checks.shellProcessProofs = @($script:shellProcessProofs.Values)
        $script:report.checks.rawShellAfterClick = @($nodes | ForEach-Object { $_.snapshot })
        $script:popup = Find-RawTaskbarPopup $nodes $rawVisibleIdsBeforeClick
        if (-not $script:popup) { return $false }
        $script:report.checks.popupContainer = $script:popup.container
        $script:report.checks.popupNodes = $script:popup.rows
        return $true
        }
        $popupAutomationObserved = $true
    } catch {
        if ($RecordOnly -and $_.Exception.Message.StartsWith('Timed out waiting for visible taskbar right-click popup.') -and
            @($report.checks.nativePopupRootCandidates).Count -gt 0) {
            # Baseline observation can continue to the fixed candidate when the old
            # shell popup has no readable UIA rows. Its screenshot still requires
            # human review; never count this as an automated Unicode menu pass.
            $report.checks.baselineVisualReviewRequired = $true
            $report.checks.baselineAutomationError = $_.Exception.Message
            Write-Warning 'Baseline native popup captured but UIA relaunch rows unavailable; visual review required.'
        } else { throw }
    }
    $report.checks.popupAutomationObserved = $popupAutomationObserved
    Save-TaskbarScreenshot 'taskbar-popup.png'
    $labelMatches = @($report.checks.popupNodes | Where-Object {
        $_.enabled -and -not $_.offscreen -and
        $_.bounds.width -gt 0 -and $_.bounds.height -gt 0 -and $_.label -in $expectedNames
    })
    $report.labelCorrect = if ($popupAutomationObserved) { $labelMatches.Count -gt 0 } else { $null }
    $report.checks.automatedRelaunchLabelVerified = $popupAutomationObserved -and $report.labelCorrect
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
