//go:build windows

package desktop

import (
	"errors"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func platformAutostartStatus(app *application.App) AutostartState {
	if app == nil {
		return AutostartState{Supported: true}
	}
	status, err := app.Autostart.Status()
	if err != nil {
		return AutostartState{
			Supported: true,
			Error:     err.Error(),
		}
	}
	return AutostartState{
		Enabled:   status.Enabled,
		Supported: true,
		Strategy:  string(status.Strategy),
		Path:      status.Path,
	}
}

func platformSetAutostart(app *application.App, enabled bool, startHidden bool) (AutostartState, error) {
	if app == nil {
		return AutostartState{Supported: true}, errors.New("desktop runtime unavailable")
	}
	if !enabled {
		err := app.Autostart.Disable()
		return platformAutostartStatus(app), err
	}
	var args []string
	if startHidden {
		args = []string{AutostartLaunchArg}
	}
	err := app.Autostart.EnableWithOptions(application.AutostartOptions{
		Identifier: AutostartIdentifier,
		Arguments:  args,
	})
	return platformAutostartStatus(app), err
}

// OpenAutostartSettings is a no-op on Windows where HKCU Run requires no external approval pane.
func OpenAutostartSettings() error {
	return nil
}
