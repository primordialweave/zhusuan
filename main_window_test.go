package main

import (
	"testing"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func TestMainWindowUsesCSSDragRegionWithoutNativeTitleBarOverlay(t *testing.T) {
	options := mainWindowOptions()

	if options.Mac.InvisibleTitleBarHeight != 0 {
		t.Fatalf("InvisibleTitleBarHeight = %d, want 0", options.Mac.InvisibleTitleBarHeight)
	}
}

func TestMainWindowUsesCustomChromeOnlyOnWindows(t *testing.T) {
	for _, platform := range []string{"windows", "darwin", "linux"} {
		t.Run(platform, func(t *testing.T) {
			options := mainWindowOptionsForPlatform(platform)
			if options.Frameless != (platform == "windows") {
				t.Fatalf("Frameless = %v for %s", options.Frameless, platform)
			}
			if options.DisableResize || options.MaxWidth != 0 || options.MaxHeight != 0 {
				t.Fatal("custom chrome must preserve resizing and unconstrained maximising/fullscreen")
			}
			if options.MinimiseButtonState != application.ButtonEnabled ||
				options.MaximiseButtonState != application.ButtonEnabled ||
				options.CloseButtonState != application.ButtonEnabled {
				t.Fatal("custom chrome must preserve native window actions")
			}
			if platform == "windows" && options.Windows.DisableFramelessWindowDecorations {
				t.Fatal("Windows custom chrome must retain system shadows and rounded corners")
			}
			if platform == "darwin" && options.Mac.TitleBar != application.MacTitleBarHiddenInset {
				t.Fatal("macOS must retain its inset native titlebar and traffic-light controls")
			}
		})
	}
}
