package desktop

import (
	"os"
	"path/filepath"
	"slices"
)

const (
	// AutostartIdentifier is the stable ASCII registration ID across macOS, Windows, and Linux.
	// Passing it explicitly avoids Wails slugifying the Chinese name "珠算" to "wails-app".
	AutostartIdentifier = "org.primordialweave.zhusuan"
	// AutostartLaunchArg marks launches initiated by OS login/autostart so the app can start hidden.
	AutostartLaunchArg = "--autostart"
)

// AutostartState describes the OS-level login launch status.
type AutostartState struct {
	Enabled          bool   `json:"enabled"`
	Supported        bool   `json:"supported"`
	RequiresApproval bool   `json:"requiresApproval"`
	Strategy         string `json:"strategy"`
	Path             string `json:"path,omitempty"`
	Error            string `json:"error,omitempty"`
}

// HasAutostartLaunchArg reports whether the process arguments include the autostart marker.
func HasAutostartLaunchArg(args []string) bool {
	return slices.Contains(args, AutostartLaunchArg)
}

func resolveDesktopExecutable() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	if resolved, err := filepath.EvalSymlinks(exe); err == nil {
		return resolved, nil
	}
	return exe, nil
}
