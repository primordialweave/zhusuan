package desktop

import (
	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/primordialweave/zhusuan/internal/updater"
)

// AppUpdater exposes installation only to the desktop webview through Wails bindings.
type AppUpdater struct{ manager *updater.Manager }

// NewAppUpdater uses the same embedded version metadata as the frontend.
func NewAppUpdater(version, repo string) *AppUpdater {
	return &AppUpdater{manager: updater.NewManager(version, repo, desktopUpdatesEnabled, func() { application.Get().Quit() })}
}

// CheckForUpdates fetches a stable release and determines whether it can be installed.
func (s *AppUpdater) CheckForUpdates() (updater.Info, error) { return s.manager.CheckForUpdates() }

// StartUpdate downloads, verifies, installs and restarts the application.
func (s *AppUpdater) StartUpdate() error { return s.manager.StartUpdate() }

// Status returns a cheap progress snapshot.
func (s *AppUpdater) Status() updater.Status { return s.manager.Status() }

// CancelUpdate cancels before installation begins.
func (s *AppUpdater) CancelUpdate() error { return s.manager.CancelUpdate() }

// ServiceShutdown cancels an unfinished download when Wails exits.
func (s *AppUpdater) ServiceShutdown() error { return s.manager.Close() }
