//go:build linux && !android

package desktop

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func platformAutostartStatus(app *application.App) AutostartState {
	path, ok := findLinuxDesktopAutostartFile()
	if ok {
		return AutostartState{
			Enabled:   true,
			Supported: true,
			Strategy:  string(application.AutostartStrategyXDGAutostart),
			Path:      path,
		}
	}
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
	if !enabled {
		var errs []error
		if app != nil {
			if err := app.Autostart.Disable(); err != nil {
				errs = append(errs, err)
			}
		}
		if err := removeLinuxDesktopAutostartFile(); err != nil {
			errs = append(errs, err)
		}
		return platformAutostartStatus(app), errors.Join(errs...)
	}

	var args []string
	if startHidden {
		args = []string{AutostartLaunchArg}
	}

	// AppImage mounts its payload at an ephemeral /tmp/.mount_* path. Write the persistent
	// $APPIMAGE path directly instead of letting Wails record os.Executable().
	if appImagePath := strings.TrimSpace(os.Getenv("APPIMAGE")); appImagePath != "" {
		if err := writeLinuxDesktopAutostartFile(appImagePath, args); err != nil {
			return platformAutostartStatus(app), err
		}
		return platformAutostartStatus(app), nil
	}

	if app == nil {
		exe, err := resolveDesktopExecutable()
		if err != nil {
			return AutostartState{Supported: true}, err
		}
		if err := writeLinuxDesktopAutostartFile(exe, args); err != nil {
			return AutostartState{Supported: true}, err
		}
		return platformAutostartStatus(nil), nil
	}

	err := app.Autostart.EnableWithOptions(application.AutostartOptions{
		Identifier: AutostartIdentifier,
		Arguments:  args,
	})
	return platformAutostartStatus(app), err
}

// OpenAutostartSettings is a no-op on Linux XDG autostart.
func OpenAutostartSettings() error {
	return nil
}

func linuxAutostartFilePath() (string, error) {
	cfg := strings.TrimSpace(os.Getenv("XDG_CONFIG_HOME"))
	if cfg == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", fmt.Errorf("resolve home dir: %w", err)
		}
		cfg = filepath.Join(home, ".config")
	}
	return filepath.Join(cfg, "autostart", AutostartIdentifier+".desktop"), nil
}

func findLinuxDesktopAutostartFile() (string, bool) {
	path, err := linuxAutostartFilePath()
	if err != nil {
		return "", false
	}
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return "", false
	}
	return path, true
}

func writeLinuxDesktopAutostartFile(execPath string, args []string) error {
	path, err := linuxAutostartFilePath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return fmt.Errorf("create autostart dir: %w", err)
	}
	content := buildLinuxDesktopEntry("珠算", execPath, args)
	return writeAtomicFile(path, []byte(content), 0o644)
}

func removeLinuxDesktopAutostartFile() error {
	path, err := linuxAutostartFilePath()
	if err != nil {
		return err
	}
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("remove desktop entry: %w", err)
	}
	return nil
}

func buildLinuxDesktopEntry(name, execPath string, args []string) string {
	quoted := quoteDesktopExecArg(execPath)
	parts := make([]string, 0, 1+len(args))
	parts = append(parts, quoted)
	for _, arg := range args {
		if strings.TrimSpace(arg) == "" {
			continue
		}
		parts = append(parts, quoteDesktopExecArg(arg))
	}
	return strings.Join([]string{
		"[Desktop Entry]",
		"Type=Application",
		"Name=" + name,
		"Exec=" + strings.Join(parts, " "),
		"Terminal=false",
		"X-GNOME-Autostart-enabled=true",
		"",
	}, "\n")
}

func quoteDesktopExecArg(value string) string {
	escaped := strings.NewReplacer(
		`\`, `\\`,
		`"`, `\"`,
		`$`, `\$`,
		"`", "\\`",
	).Replace(value)
	return `"` + escaped + `"`
}
