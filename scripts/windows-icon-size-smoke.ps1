param(
    [Parameter(Mandatory = $true)][string]$IconPath,
    [string]$OutputDirectory = (Join-Path $env:RUNNER_TEMP 'zhusuan-icon-size-check')
)

$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT' -or $env:GITHUB_ACTIONS -ne 'true') {
    throw 'Native icon-size acceptance runs only in an isolated GitHub Windows runner.'
}

Add-Type -AssemblyName System.Drawing
$iconReferences = @('System.Drawing.Common.dll', 'System.Drawing.Primitives.dll', 'System.Runtime.dll',
    'System.Collections.dll', 'System.ComponentModel.Primitives.dll', 'Microsoft.Win32.Primitives.dll')
# Newer .NET Drawing assemblies expose interfaces from these bundled runtime
# assemblies. Add them when present; no external package or installation is needed.
foreach ($name in @('System.Private.Windows.Core.dll', 'System.Private.Windows.GdiPlus.dll')) {
    $path = Join-Path $PSHOME $name
    if (Test-Path -LiteralPath $path) { $iconReferences += $path }
}
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

public static class ZhusuanIconSizeProbe {
    private static readonly int[] RequiredSizes = {16,20,24,32,40,48,60,64,72,80,96,128,256};
    [DllImport("user32.dll", CharSet = CharSet.Unicode, ExactSpelling = true, SetLastError = true)]
    private static extern IntPtr LoadImageW(IntPtr instance, string path, uint kind, int width, int height, uint flags);
    [DllImport("user32.dll", ExactSpelling = true, SetLastError = true)]
    private static extern bool DestroyIcon(IntPtr icon);
    [DllImport("user32.dll")] private static extern int GetSystemMetrics(int index);
    [DllImport("ole32.dll")] private static extern int CoInitializeEx(IntPtr reserved, uint mode);
    [DllImport("ole32.dll")] private static extern void CoUninitialize();
    [DllImport("shell32.dll", CharSet = CharSet.Unicode, ExactSpelling = true)]
    private static extern UIntPtr SHGetFileInfoW(string path, uint attributes, out ShellFileInfo info, uint size, uint flags);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct ShellFileInfo {
        public IntPtr Icon;
        public int IconIndex;
        public uint Attributes;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string DisplayName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 80)] public string TypeName;
    }
    public sealed class IcoFrame {
        public int Width, Height, Planes, BitCount;
        public uint Offset, Bytes;
        public string Encoding;
    }
    public sealed class IcoDirectory {
        public int Count;
        public IcoFrame[] Frames;
        public bool ExactNativeDPISizes, AllFrames32Bpp, ValidNonOverlappingPayloads;
    }
    public sealed class Measurement {
        public string Method, PNGPath;
        public int RequestedSize, Width, Height, BitmapBitsPerPixel;
        public int AlphaThreshold, ContentLeft, ContentTop, ContentWidth, ContentHeight;
        public int MarginLeft, MarginTop, MarginRight, MarginBottom, VisiblePixels, EdgePixelsAtThreshold;
        public double ContentWidthRatio, ContentHeightRatio, MajorRatio, BodyAspect;
        public bool NativeHandleReleased;
    }

    private static uint BigEndian32(byte[] bytes, int offset) {
        return ((uint)bytes[offset] << 24) | ((uint)bytes[offset+1] << 16) | ((uint)bytes[offset+2] << 8) | bytes[offset+3];
    }
    public static IcoDirectory ReadDirectory(string path) {
        byte[] bytes = File.ReadAllBytes(path);
        if (bytes.Length < 6 || BitConverter.ToUInt16(bytes, 0) != 0 || BitConverter.ToUInt16(bytes, 2) != 1)
            throw new InvalidDataException("File is not a valid ICO directory.");
        int count = BitConverter.ToUInt16(bytes, 4);
        if (count != RequiredSizes.Length || bytes.Length < 6 + 16 * count)
            throw new InvalidDataException("ICO must contain exactly the thirteen native DPI frames.");
        var frames = new List<IcoFrame>();
        var sizes = new List<int>();
        for (int index = 0; index < count; index++) {
            int entry = 6 + 16 * index;
            int width = bytes[entry] == 0 ? 256 : bytes[entry];
            int height = bytes[entry+1] == 0 ? 256 : bytes[entry+1];
            int planes = BitConverter.ToUInt16(bytes, entry+4), bits = BitConverter.ToUInt16(bytes, entry+6);
            uint length = BitConverter.ToUInt32(bytes, entry+8), offset = BitConverter.ToUInt32(bytes, entry+12);
            if (width != height || planes != 1 || bits != 32 || bytes[entry+3] != 0 || length == 0 ||
                offset < 6 + 16 * count || (ulong)offset + length > (ulong)bytes.Length)
                throw new InvalidDataException("ICO frame has invalid dimensions, depth or payload bounds.");
            int start = checked((int)offset);
            string encoding;
            if (length >= 33 && bytes[start] == 137 && bytes[start+1] == 80 && bytes[start+2] == 78 && bytes[start+3] == 71) {
                if (BigEndian32(bytes, start+16) != width || BigEndian32(bytes, start+20) != height ||
                    bytes[start+24] != 8 || bytes[start+25] != 6)
                    throw new InvalidDataException("ICO PNG frame is not matching 8-bit RGBA artwork.");
                encoding = "PNG RGBA32";
            } else {
                if (length < 40 || BitConverter.ToUInt32(bytes, start) < 40 ||
                    BitConverter.ToInt32(bytes, start+4) != width ||
                    Math.Abs((long)BitConverter.ToInt32(bytes, start+8)) != 2L * height ||
                    BitConverter.ToUInt16(bytes, start+12) != 1 || BitConverter.ToUInt16(bytes, start+14) != 32)
                    throw new InvalidDataException("ICO DIB frame is not matching 32-bit artwork.");
                encoding = "DIB32";
            }
            frames.Add(new IcoFrame { Width=width, Height=height, Planes=planes, BitCount=bits, Offset=offset, Bytes=length, Encoding=encoding });
            sizes.Add(width);
        }
        sizes.Sort();
        for (int index = 0; index < RequiredSizes.Length; index++)
            if (sizes[index] != RequiredSizes[index]) throw new InvalidDataException("ICO native DPI frame list differs from the required exact sizes.");
        var byOffset = new List<IcoFrame>(frames);
        byOffset.Sort((left, right) => left.Offset.CompareTo(right.Offset));
        for (int index = 1; index < byOffset.Count; index++)
            if ((ulong)byOffset[index-1].Offset + byOffset[index-1].Bytes > byOffset[index].Offset)
                throw new InvalidDataException("ICO payloads overlap.");
        return new IcoDirectory { Count=count, Frames=frames.ToArray(), ExactNativeDPISizes=true, AllFrames32Bpp=true, ValidNonOverlappingPayloads=true };
    }

    private static Measurement Measure(IntPtr handle, string method, int requested, string output) {
        using (var wrapper = Icon.FromHandle(handle))
        using (var decoded = wrapper.ToBitmap())
        using (var bitmap = decoded.Clone(new Rectangle(0,0,decoded.Width,decoded.Height), PixelFormat.Format32bppArgb)) {
            var result = new Measurement { Method=method, RequestedSize=requested, Width=bitmap.Width, Height=bitmap.Height,
                BitmapBitsPerPixel=Image.GetPixelFormatSize(bitmap.PixelFormat), AlphaThreshold=16, PNGPath=output };
            int minX=bitmap.Width, minY=bitmap.Height, maxX=-1, maxY=-1;
            for (int y=0; y<bitmap.Height; y++) for (int x=0; x<bitmap.Width; x++) {
                if (bitmap.GetPixel(x,y).A < result.AlphaThreshold) continue;
                result.VisiblePixels++;
                minX=Math.Min(minX,x); minY=Math.Min(minY,y); maxX=Math.Max(maxX,x); maxY=Math.Max(maxY,y);
                if (x==0 || y==0 || x==bitmap.Width-1 || y==bitmap.Height-1) result.EdgePixelsAtThreshold++;
            }
            // Save the actual native bitmap before any acceptance assertion can fail.
            bitmap.Save(output, ImageFormat.Png);
            if (maxX < minX || maxY < minY) throw new InvalidDataException("Native icon contains no visible alpha pixels.");
            result.ContentLeft=minX; result.ContentTop=minY; result.ContentWidth=maxX-minX+1; result.ContentHeight=maxY-minY+1;
            result.MarginLeft=minX; result.MarginTop=minY; result.MarginRight=bitmap.Width-1-maxX; result.MarginBottom=bitmap.Height-1-maxY;
            result.ContentWidthRatio=(double)result.ContentWidth/result.Width;
            result.ContentHeightRatio=(double)result.ContentHeight/result.Height;
            result.MajorRatio=Math.Max(result.ContentWidthRatio,result.ContentHeightRatio);
            result.BodyAspect=(double)result.ContentWidth/result.ContentHeight;
            return result;
        }
    }

    public static Measurement LoadRequested(string path, int size, string output) {
        IntPtr handle = LoadImageW(IntPtr.Zero, path, 1, size, size, 0x10); // IMAGE_ICON, LR_LOADFROMFILE; no LR_SHARED.
        if (handle == IntPtr.Zero) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), "LoadImageW failed.");
        Measurement result = null;
        try { result = Measure(handle,"LoadImageW LR_LOADFROMFILE",size,output); return result; }
        finally {
            if (!DestroyIcon(handle)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), "DestroyIcon failed.");
            if (result != null) result.NativeHandleReleased=true;
        }
    }
    public static Measurement LoadShellLarge(string path, string output) {
        int initialized = CoInitializeEx(IntPtr.Zero, 0);
        if (initialized < 0 && initialized != unchecked((int)0x80010106)) Marshal.ThrowExceptionForHR(initialized);
        IntPtr handle = IntPtr.Zero;
        Measurement result = null;
        try {
            ShellFileInfo info;
            UIntPtr status = SHGetFileInfoW(path,0,out info,(uint)Marshal.SizeOf(typeof(ShellFileInfo)),0x100); // Bare ICO, SHGFI_ICON | SHGFI_LARGEICON.
            handle=info.Icon;
            if (status == UIntPtr.Zero || handle == IntPtr.Zero) throw new InvalidOperationException("SHGetFileInfoW did not return the real large icon.");
            result=Measure(handle,"SHGetFileInfoW bare ICO large HICON",32,output);
            return result;
        } finally {
            try {
                if (handle != IntPtr.Zero && !DestroyIcon(handle)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), "DestroyIcon failed.");
                if (result != null) result.NativeHandleReleased=true;
            } finally { if (initialized >= 0) CoUninitialize(); }
        }
    }
    public static int[] LargeIconMetrics() { return new[] { GetSystemMetrics(11), GetSystemMetrics(12) }; }
}
'@ -ReferencedAssemblies $iconReferences

function Assert-OpticalExtent($measurement) {
    if ($measurement.Width -ne $measurement.RequestedSize -or $measurement.Height -ne $measurement.RequestedSize) {
        throw "$($measurement.Method) returned $($measurement.Width)x$($measurement.Height) for requested $($measurement.RequestedSize)."
    }
    if ($measurement.BitmapBitsPerPixel -ne 32 -or -not $measurement.NativeHandleReleased) { throw 'Native ARGB image or HICON cleanup verification failed.' }
    if ($measurement.ContentWidthRatio -lt 0.90 -or $measurement.ContentWidthRatio -gt 0.97 -or
        $measurement.ContentHeightRatio -lt 0.90 -or $measurement.ContentHeightRatio -gt 0.97) {
        throw "$($measurement.Method) content ratios $($measurement.ContentWidthRatio),$($measurement.ContentHeightRatio) fall outside 0.90..0.97."
    }
    if (@(@($measurement.MarginLeft, $measurement.MarginTop, $measurement.MarginRight, $measurement.MarginBottom) | Where-Object { $_ -lt 1 }).Count -gt 0 -or
        $measurement.EdgePixelsAtThreshold -ne 0) { throw 'Native icon content reaches the canvas edge or lacks a one-pixel safe margin.' }
    if ([Math]::Abs($measurement.ContentWidth - $measurement.ContentHeight) -gt 1) {
        throw 'Current square artwork changed aspect in native icon rendering.'
    }
}

$artifacts = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$source = (Resolve-Path -LiteralPath $IconPath).Path
$measurements = [System.Collections.Generic.List[object]]::new()
$report = [ordered]@{
    passed = $false
    iconFile = [System.IO.Path]::GetFileName($source)
    iconSHA256 = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
    sourceCommit = $env:APPLICATION_SOURCE_SHA
    expectedFrames = @(16,20,24,32,40,48,60,64,72,80,96,128,256)
    targetOpticalRatio = 0.93
    acceptedOpticalRange = @(0.90,0.97)
    alphaThreshold = 16
    directory = $null
    largeIconSystemMetrics = $null
    shellVsLoadImage32 = $null
    measurements = @()
    error = $null
    boundary = [ordered]@{ actualDesktopItemsCompared = $false; shortcutOverlaysCompared = $false;
        applicationExecuted = $false; userInstallationChanged = $false; explorerRestarted = $false; globalIconCacheDeleted = $false }
}
try {
    if ([System.IO.Path]::GetExtension($source) -ne '.ico') { throw 'Optical acceptance requires the bare ICO, not an executable or shortcut.' }
    $report.directory = [ZhusuanIconSizeProbe]::ReadDirectory($source)
    foreach ($size in @(32,48,64,96,256)) {
        $measurement = [ZhusuanIconSizeProbe]::LoadRequested($source,$size,(Join-Path $artifacts ("loadimage-$size.png")))
        $measurements.Add($measurement)
        Assert-OpticalExtent $measurement
    }
    $report.largeIconSystemMetrics = [ZhusuanIconSizeProbe]::LargeIconMetrics()
    $shell = [ZhusuanIconSizeProbe]::LoadShellLarge($source,(Join-Path $artifacts 'shell-large-32.png'))
    $measurements.Add($shell)
    Assert-OpticalExtent $shell
    $native32 = $measurements[0]
    $sameExtent = ([Math]::Abs($shell.ContentWidth - $native32.ContentWidth) -le 1 -and
        [Math]::Abs($shell.ContentHeight - $native32.ContentHeight) -le 1)
    $report.shellVsLoadImage32 = [ordered]@{ sameOpticalExtentWithinOnePixel = $sameExtent;
        nativeContent = @($native32.ContentWidth,$native32.ContentHeight); shellContent = @($shell.ContentWidth,$shell.ContentHeight) }
    if (-not $sameExtent) { throw 'Real Shell large HICON has a different optical extent than native requested 32px artwork.' }
    $report.passed = $true
    Write-Host 'Passed: 13 RGBA ICO frames, native requested dimensions and 93% optical extent, real Shell large HICON, safe margins, square aspect and HICON cleanup.'
} catch {
    $report.error = $_.Exception.Message
    throw
} finally {
    $report.measurements = $measurements.ToArray()
    $report | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 (Join-Path $artifacts 'icon-size-verification.json')
}
