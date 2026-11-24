//go:build darwin && !ios

package desktop

import (
	"bytes"
	"encoding/xml"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func platformAutostartStatus(app *application.App) AutostartState {
	plistPath, plistOK := findDarwinLaunchAgent()
	if plistOK {
		return AutostartState{
			Enabled:   true,
			Supported: true,
			Strategy:  string(application.AutostartStrategyLaunchAgent),
			Path:      plistPath,
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
		if err := removeDarwinLaunchAgent(); err != nil {
			errs = append(errs, err)
		}
		state := platformAutostartStatus(app)
		return state, errors.Join(errs...)
	}

	// SMAppService.mainAppService cannot pass CLI arguments such as --autostart, so silent
	// background login launches use a user LaunchAgent plist while cleaning up SMAppService
	// to prevent double-launching.
	if startHidden {
		if app != nil {
			if err := app.Autostart.Disable(); err != nil {
				return platformAutostartStatus(app), err
			}
		}
		if err := writeDarwinLaunchAgent([]string{AutostartLaunchArg}); err != nil {
			return platformAutostartStatus(app), err
		}
		return platformAutostartStatus(app), nil
	}

	// Standard login launch: prefer Wails SMAppService when running from a signed .app bundle,
	// falling back to a LaunchAgent plist for ad-hoc or dev builds where SMAppService rejects registration.
	if err := removeDarwinLaunchAgent(); err != nil {
		return platformAutostartStatus(app), err
	}
	if app != nil {
		opts := application.AutostartOptions{
			Identifier: AutostartIdentifier,
		}
		if err := app.Autostart.EnableWithOptions(opts); err == nil {
			state := platformAutostartStatus(app)
			if state.Enabled {
				return state, nil
			}
			// SMAppService succeeded at registration time but Login Items requires user approval.
			state.RequiresApproval = true
			return state, nil
		}
	}

	if err := writeDarwinLaunchAgent(nil); err != nil {
		return platformAutostartStatus(app), err
	}
	return platformAutostartStatus(app), nil
}

// OpenAutostartSettings opens macOS System Settings -> Login Items when available.
func OpenAutostartSettings() error {
	cmd := exec.Command("open", "x-apple.systempreferences:com.apple.LoginItems-Settings.extension")
	if err := cmd.Start(); err != nil {
		return err
	}
	go func() {
		if err := cmd.Wait(); err != nil {
			slog.Debug("Login Items settings opener exited with error", "error", err)
		}
	}()
	return nil
}

func darwinLaunchAgentPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("resolve home dir: %w", err)
	}
	return filepath.Join(home, "Library", "LaunchAgents", AutostartIdentifier+".plist"), nil
}

func findDarwinLaunchAgent() (string, bool) {
	path, err := darwinLaunchAgentPath()
	if err != nil {
		return "", false
	}
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return "", false
	}
	return path, true
}

func writeDarwinLaunchAgent(args []string) error {
	exe, err := resolveDesktopExecutable()
	if err != nil {
		return fmt.Errorf("resolve executable: %w", err)
	}
	path, err := darwinLaunchAgentPath()
	if err != nil {
		return err
	}
	body, err := buildDarwinLaunchAgentPlist(AutostartIdentifier, exe, args)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return fmt.Errorf("create LaunchAgents dir: %w", err)
	}
	return writeAtomicFile(path, body, 0o644)
}

func removeDarwinLaunchAgent() error {
	path, err := darwinLaunchAgentPath()
	if err != nil {
		return err
	}
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("remove LaunchAgent plist: %w", err)
	}
	return nil
}

func buildDarwinLaunchAgentPlist(label, executable string, args []string) ([]byte, error) {
	var buf bytes.Buffer
	buf.WriteString(`<?xml version="1.0" encoding="UTF-8"?>` + "\n")
	buf.WriteString(`<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">` + "\n")
	buf.WriteString(`<plist version="1.0">` + "\n<dict>\n")
	if err := writePlistKeyString(&buf, "Label", label); err != nil {
		return nil, err
	}
	buf.WriteString("\t<key>ProgramArguments</key>\n\t<array>\n")
	if err := writePlistString(&buf, "\t\t", executable); err != nil {
		return nil, err
	}
	for _, arg := range args {
		if strings.TrimSpace(arg) == "" {
			continue
		}
		if err := writePlistString(&buf, "\t\t", arg); err != nil {
			return nil, err
		}
	}
	buf.WriteString("\t</array>\n")
	buf.WriteString("\t<key>RunAtLoad</key>\n\t<true/>\n")
	if err := writePlistKeyString(&buf, "ProcessType", "Interactive"); err != nil {
		return nil, err
	}
	buf.WriteString("</dict>\n</plist>\n")
	return buf.Bytes(), nil
}

func writePlistKeyString(buf *bytes.Buffer, key, value string) error {
	buf.WriteString("\t<key>")
	if err := xml.EscapeText(buf, []byte(key)); err != nil {
		return err
	}
	buf.WriteString("</key>\n")
	return writePlistString(buf, "\t", value)
}

func writePlistString(buf *bytes.Buffer, indent, value string) error {
	buf.WriteString(indent)
	buf.WriteString("<string>")
	if err := xml.EscapeText(buf, []byte(value)); err != nil {
		return err
	}
	buf.WriteString("</string>\n")
	return nil
}
