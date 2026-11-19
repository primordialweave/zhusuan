package updater

import (
	"io"
	"log/slog"
	"os"
)

const (
	kindWindows             = "windows"
	kindDarwin              = "darwin"
	kindAppImage            = "appimage"
	kindDeb                 = "deb"
	kindRPM                 = "rpm"
	appBundleName           = "zhusuan.app"
	legacyAppBundleName     = "Orange.app"
	executableName          = "zhusuan"
	legacyExecutableName    = "Orange"
	productIdentifier       = "org.primordialweave.zhusuan"
	legacyProductIdentifier = "ai.fruits.orange"
	defaultRepository       = "primordialweave/zhusuan"
	legacyRepository        = "FruitsAI/Orange"
	stateIdle               = "idle"
	stateChecking           = "checking"
	stateAvailable          = "available"
	stateDownloading        = "downloading"
	stateInstalling         = "installing"
	stateRestarting         = "restarting"
	stateError              = "error"
)

// Read-only handles and cache cleanup do not change installation success.
func closeRead(closer io.Closer) {
	if err := closer.Close(); err != nil {
		slog.Debug("Unable to close updater data", "error", err)
	}
}

func removeUpdatePath(path string) {
	if err := os.RemoveAll(path); err != nil {
		slog.Warn("Unable to clean update cache", "path", path, "error", err)
	}
}

func removeUpdateFile(path string) {
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		slog.Debug("Unable to remove update state", "error", err)
	}
}
