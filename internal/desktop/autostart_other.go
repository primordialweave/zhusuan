//go:build !darwin && !windows && !linux

package desktop

import (
	"errors"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func platformAutostartStatus(_ *application.App) AutostartState {
	return AutostartState{Supported: false}
}

func platformSetAutostart(_ *application.App, _ bool, _ bool) (AutostartState, error) {
	return AutostartState{Supported: false}, errors.New("autostart is not supported on this platform")
}

// OpenAutostartSettings is unsupported on non-desktop platforms.
func OpenAutostartSettings() error {
	return nil
}
