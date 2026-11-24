package desktop

import (
	"fmt"
	"log/slog"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"github.com/wailsapp/wails/v3/pkg/services/notifications"
)

const (
	// EventCloseRequested is emitted to the frontend when closeAction == "ask".
	EventCloseRequested = "desktop:close-requested"
	// EventClosePromptChanged keeps the frontend close prompt synchronized with native state.
	EventClosePromptChanged = "desktop:close-prompt-changed"
	// EventNavigate instructs the frontend router to navigate to a target path.
	EventNavigate = "desktop:navigate"
	// EventStateChanged broadcasts updated DesktopState whenever changed natively (e.g. tray menu).
	EventStateChanged = "desktop:state-changed"
	// EventWindowVisibility notifies the frontend when the main window is hidden or shown so
	// animated WebGL/Canvas scenes can pause immediately with near-zero background CPU.
	EventWindowVisibility = "desktop:window-visibility"

	closePromptRevisionKey = "closePromptRevision"
	summaryRefreshDebounce = 250 * time.Millisecond
)

// DesktopCapabilities describes OS-specific features supported in the current runtime.
type DesktopCapabilities struct {
	Platform                 string `json:"platform"`
	AutostartSupported       bool   `json:"autostartSupported"`
	TraySupported            bool   `json:"traySupported"`
	MenuBarLabelSupported    bool   `json:"menuBarLabelSupported"`
	HideDockSupported        bool   `json:"hideDockSupported"`
	TrayClickActionSupported bool   `json:"trayClickActionSupported"`
	NotificationsSupported   bool   `json:"notificationsSupported"`
	GlobalShortcutsSupported bool   `json:"globalShortcutsSupported"`
	AutoBackupSupported      bool   `json:"autoBackupSupported"`
}

// DesktopState is the full snapshot returned to the frontend Settings view and state listeners.
type DesktopState struct {
	Preferences         DesktopPreferences  `json:"preferences"`
	Autostart           AutostartState      `json:"autostart"`
	Capabilities        DesktopCapabilities `json:"capabilities"`
	WindowHidden        bool                `json:"windowHidden"`
	ClosePromptOpen     bool                `json:"closePromptOpen"`
	ClosePromptRevision uint64              `json:"closePromptRevision"`
}

type closePromptPayload struct {
	Open                bool   `json:"open"`
	ClosePromptRevision uint64 `json:"closePromptRevision"`
}

// PreferencesPatch applies a partial update to DesktopPreferences.
type PreferencesPatch struct {
	Autostart             *bool   `json:"autostart,omitempty"`
	StartHidden           *bool   `json:"startHidden,omitempty"`
	CloseAction           *string `json:"closeAction,omitempty"`
	MenuBarDisplay        *string `json:"menuBarDisplay,omitempty"`
	PrivacyMode           *bool   `json:"privacyMode,omitempty"`
	HideDockWhenMinimized *bool   `json:"hideDockWhenMinimized,omitempty"`
	RememberWindowBounds  *bool   `json:"rememberWindowBounds,omitempty"`
	TrayClickAction       *string `json:"trayClickAction,omitempty"`
	ReminderEnabled       *bool   `json:"reminderEnabled,omitempty"`
	ReminderTime          *string `json:"reminderTime,omitempty"`
	ToggleWindowShortcut  *string `json:"toggleWindowShortcut,omitempty"`
	QuickReceiptShortcut  *string `json:"quickReceiptShortcut,omitempty"`
	PrivacyModeShortcut   *string `json:"privacyModeShortcut,omitempty"`
	AutoBackupEnabled     *bool   `json:"autoBackupEnabled,omitempty"`
	AutoBackupRetention   *int    `json:"autoBackupRetention,omitempty"`
}

// TrayIcons holds platform-tailored tray / menu bar icons.
type TrayIcons struct {
	TemplateIcon []byte // macOS monochrome template icon
	LightIcon    []byte // Windows/Linux light icon
	DarkIcon     []byte // Windows dark taskbar icon
}

// SummaryProvider fetches lightweight account metrics for the currently signed-in desktop user.
type SummaryProvider func(userID int64) (TraySummary, error)

// SessionVerifier checks the signed login token and the account's current enabled state.
type SessionVerifier func(token string) (int64, error)

// DesktopManager coordinates OS-level autostart, close interception, tray/menu bar status,
// window visibility, dock policy, and event-driven summary updates.
type DesktopManager struct {
	store               *PreferencesStore
	platform            string
	trayIcons           TrayIcons
	summaryProvider     SummaryProvider
	sessionVerifier     SessionVerifier
	backupMu            sync.Mutex
	preferencesMu       sync.Mutex
	preferenceEffectsMu sync.Mutex
	reminderMu          sync.Mutex

	mu                  sync.Mutex
	visibilityMu        sync.Mutex
	app                 *application.App
	window              *application.WebviewWindow
	tray                *application.SystemTray
	menuBarPopover      *application.WebviewWindow
	menuBarProvider     MenuBarSnapshotProvider
	notifService        *notifications.NotificationService
	traySupported       bool
	windowHidden        bool
	dockHidden          bool
	sessionUserID       int64
	sessionToken        string
	sessionGeneration   uint64
	sessionChangeID     uint64
	summaryRequestID    uint64
	summary             TraySummary
	refreshTimer        *time.Timer
	closePromptOpen     bool
	closePromptRevision uint64
	stopBgLoop          chan struct{}
	bgCheckInterval     time.Duration
	lastObservedDate    string
	registeredShortcuts []string
	pendingRoute        string
	backupDataDir       string
	backupVacuum        SQLiteVacuumFunc

	quitting atomic.Bool

	// Injectable hooks for deterministic unit testing without a native event loop.
	now                func() time.Time
	probeTray          func() bool
	autostartStatus    func(*application.App) AutostartState
	setAutostart       func(*application.App, bool, bool) (AutostartState, error)
	setDockVisible     func(bool)
	emitEvent          func(name string, data any)
	quitApp            func()
	showMainWindow     func()
	hideMainWindow     func()
	captureBounds      func() (WindowBounds, bool)
	syncTrayView       func(DesktopPreferences, TraySummary, bool)
	requestNotifAuth   func() (bool, error)
	sendNotification   func(notifications.NotificationOptions) error
	registerShortcut   func(accelerator string, cb func()) error
	unregisterShortcut func(accelerator string) error
	unregisterAllKeys  func() error
}

// NewDesktopManager creates a DesktopManager backed by store and optional summary provider.
func NewDesktopManager(store *PreferencesStore, icons TrayIcons, summaryProvider SummaryProvider, verifiers ...SessionVerifier) *DesktopManager {
	m := &DesktopManager{
		store:           store,
		platform:        runtime.GOOS,
		trayIcons:       icons,
		summaryProvider: summaryProvider,
		now:             time.Now,
		probeTray:       probePlatformTrayAvailable,
		autostartStatus: platformAutostartStatus,
		setAutostart:    platformSetAutostart,
		setDockVisible:  setPlatformDockVisible,
	}
	m.traySupported = m.probeTray()
	if len(verifiers) > 0 {
		m.sessionVerifier = verifiers[0]
	}
	return m
}

// SetNotificationService binds Wails' native notification service so daily reminders can deliver
// OS notifications and route notification clicks back into the app.
func (m *DesktopManager) SetNotificationService(ns *notifications.NotificationService) {
	if ns == nil {
		return
	}
	m.mu.Lock()
	m.notifService = ns
	m.requestNotifAuth = ns.RequestNotificationAuthorization
	m.sendNotification = ns.SendNotification
	m.mu.Unlock()

	ns.OnNotificationResponse(func(result notifications.NotificationResult) {
		route := routeCalendar
		if raw, ok := result.Response.UserInfo["route"].(string); ok && strings.HasPrefix(raw, "/") {
			route = raw
		}
		m.openAndNavigate(route)
	})
}

// SetBackupProvider enables atomic local SQLite auto-backup snapshots.
func (m *DesktopManager) SetBackupProvider(dataDir string, vacuumFn SQLiteVacuumFunc) {
	m.mu.Lock()
	m.backupDataDir = dataDir
	m.backupVacuum = vacuumFn
	m.mu.Unlock()
}

// SetInitialLaunchArgs records any cold-launch `--action=` route so the frontend can navigate
// immediately after mounting.
func (m *DesktopManager) SetInitialLaunchArgs(args []string) {
	route := ParseLaunchActionRoute(args)
	if route == "" {
		return
	}
	m.mu.Lock()
	m.pendingRoute = route
	m.mu.Unlock()
}

// ConsumePendingRoute returns and clears a pending cold-launch route if present.
func (m *DesktopManager) ConsumePendingRoute() string {
	m.mu.Lock()
	route := m.pendingRoute
	m.pendingRoute = ""
	m.mu.Unlock()
	return route
}

// RunBackupNow creates an immediate SQLite snapshot and rotates old auto-backups.
func (m *DesktopManager) RunBackupNow() (BackupInfo, error) {
	m.backupMu.Lock()
	defer m.backupMu.Unlock()
	m.mu.Lock()
	dataDir := m.backupDataDir
	vacuumFn := m.backupVacuum
	m.mu.Unlock()

	now := m.now()
	prefs := m.store.Get()
	info, err := CreateAutoBackup(dataDir, prefs.AutoBackupRetention, now, vacuumFn)
	if err != nil {
		return BackupInfo{}, err
	}
	if _, err := m.store.Update(func(p *DesktopPreferences) {
		p.LastBackupDate = now.Format(time.DateOnly)
	}); err == nil {
		m.broadcastStateChanged()
	}
	return info, nil
}

// OpenBackupDir opens the local SQLite auto-backup directory in the OS file manager.
func (m *DesktopManager) OpenBackupDir() error {
	m.mu.Lock()
	dataDir := m.backupDataDir
	m.mu.Unlock()
	if dataDir == "" {
		return fmt.Errorf("当前数据库模式不支持本地自动快照备份")
	}
	return openDirectoryInFileManager(AutoBackupDir(dataDir))
}

// ShouldStartHidden reports whether the application should launch directly into the background.
func (m *DesktopManager) ShouldStartHidden(args []string) bool {
	if !HasAutostartLaunchArg(args) {
		return false
	}
	prefs := m.store.Get()
	if !prefs.Autostart || !prefs.StartHidden {
		return false
	}
	return m.traySupported
}

// Attach binds the Wails application and main window, initializes the system tray / menu bar,
// registers lifecycle hooks, and applies persisted window geometry.
func (m *DesktopManager) Attach(app *application.App, window *application.WebviewWindow, startHidden bool) {
	m.mu.Lock()
	m.app = app
	m.window = window
	m.windowHidden = startHidden
	m.configureApplicationCallbacks(app)
	m.configureWindowCallbacks()
	m.mu.Unlock()

	m.setupWindowHooks(app, window)
	m.setupSystemTray(app)
	m.applyInitialWindowState(app, window, startHidden)
	if err := m.syncGlobalShortcuts(m.store.Get()); err != nil {
		slog.Warn("Unable to register persisted global shortcuts", "error", err)
	}
	registerPlatformTaskbarActions()
	m.startBackgroundLoop()
}

func (m *DesktopManager) setupWindowHooks(app *application.App, window *application.WebviewWindow) {
	if window != nil {
		window.RegisterHook(events.Common.WindowClosing, func(event *application.WindowEvent) {
			m.HandleWindowClosing(event)
		})
		window.OnWindowEvent(events.Common.WindowHide, func(_ *application.WindowEvent) {
			m.transitionNativeWindowVisibility(false, window.IsVisible)
		})
		window.OnWindowEvent(events.Common.WindowShow, func(_ *application.WindowEvent) {
			m.transitionNativeWindowVisibility(true, window.IsVisible)
		})
	}

	if app != nil && m.platform == platformDarwin {
		app.Event.RegisterApplicationEventHook(events.Mac.ApplicationShouldHandleReopen, m.handleMacApplicationReopen)
	}
}

func (m *DesktopManager) handleMacApplicationReopen(event *application.ApplicationEvent) {
	if event != nil {
		event.Cancel()
	}
	m.HideMenuBarPopover()
	m.ShowWindow()
}

func (m *DesktopManager) applyInitialWindowState(app *application.App, window *application.WebviewWindow, startHidden bool) {
	prefs := m.store.Get()
	if window != nil && prefs.RememberWindowBounds && prefs.WindowBounds.Valid {
		var workAreas []application.Rect
		if app != nil {
			for _, screen := range app.Screen.GetAll() {
				if screen != nil {
					workAreas = append(workAreas, screen.WorkArea)
				}
			}
		}
		if valid, ok := ValidateWindowBounds(prefs.WindowBounds, workAreas); ok {
			window.SetSize(valid.Width, valid.Height)
			window.SetPosition(valid.X, valid.Y)
			if valid.Maximised && !startHidden {
				window.Maximise()
			}
		}
	}

	if startHidden {
		hideDock := m.platform == platformDarwin && prefs.HideDockWhenMinimized && m.setDockVisible != nil
		m.mu.Lock()
		m.windowHidden = true
		if hideDock {
			m.dockHidden = true
		}
		m.mu.Unlock()
		if hideDock {
			m.setDockVisible(false)
		}
	}
}

func (m *DesktopManager) setupSystemTray(app *application.App) {
	if app == nil || !m.traySupported {
		return
	}
	tray := app.SystemTray.New()
	if m.platform == platformDarwin && len(m.trayIcons.TemplateIcon) > 0 {
		tray.SetTemplateIcon(m.trayIcons.TemplateIcon)
		tray.SetIconPosition(application.NSImageLeading)
	} else {
		if len(m.trayIcons.LightIcon) > 0 {
			tray.SetIcon(m.trayIcons.LightIcon)
		}
		if len(m.trayIcons.DarkIcon) > 0 {
			tray.SetDarkModeIcon(m.trayIcons.DarkIcon)
		}
	}

	m.mu.Lock()
	m.tray = tray
	m.mu.Unlock()

	m.setupMenuBarPopover(app, tray)
	m.applyTrayHandlers()
	m.rebuildTrayView()
}

func (m *DesktopManager) applyTrayHandlers() {
	m.mu.Lock()
	tray := m.tray
	m.mu.Unlock()
	if tray == nil {
		return
	}
	switch m.platform {
	case platformWindows:
		tray.OnClick(func() {
			if m.store.Get().TrayClickAction == TrayClickOpenMenu {
				tray.OpenMenu()
				return
			}
			m.ToggleWindow()
		})
		tray.OnDoubleClick(func() {
			m.ShowWindow()
		})
		tray.OnRightClick(func() {
			tray.OpenMenu()
		})
	case platformDarwin:
		tray.OnClick(func() {
			m.toggleMenuBarPopover()
		})
		tray.OnRightClick(func() {
			m.HideMenuBarPopover()
			tray.OpenMenu()
		})
	default:
		// Linux StatusNotifierItem opens its DBus menu natively on click.
	}
}

// HandleSecondInstance brings the existing window to the front when a second process starts,
// and honors any `--action=` JumpList / .desktop quick action route.
func (m *DesktopManager) HandleSecondInstance(data application.SecondInstanceData) {
	if route := ParseLaunchActionRoute(data.Args); route != "" {
		m.openAndNavigate(route)
		return
	}
	m.ShowWindow()
}

// BeginQuit marks an intentional application termination (Cmd+Q, tray quit, updater, OS shutdown)
// and persists the current window geometry before shutdown proceeds.
func (m *DesktopManager) BeginQuit() {
	m.quitting.Store(true)
	m.saveCurrentWindowBounds()
	m.stopRefreshTimer()
	m.stopBackgroundLoop()
	m.clearGlobalShortcuts()
}

// HandleWindowClosing intercepts the main window close button according to DesktopPreferences.
func (m *DesktopManager) HandleWindowClosing(event *application.WindowEvent) {
	if m.quitting.Load() {
		return
	}
	prefs := m.store.Get()
	switch prefs.CloseAction {
	case CloseActionQuit:
		m.quitFromWindowClose(event)
		return
	case CloseActionMinimizeToTray:
		if !m.traySupported {
			// Guard against invisible orphan processes on tray-less Linux sessions.
			m.quitFromWindowClose(event)
			return
		}
		if event != nil {
			event.Cancel()
		}
		m.HideWindow()
		return
	default: // CloseActionAsk
		if event != nil {
			event.Cancel()
		}
		m.mu.Lock()
		alreadyOpen := m.closePromptOpen
		m.closePromptOpen = true
		emit := m.emitEvent
		traySupported := m.traySupported
		platform := m.platform
		if !alreadyOpen {
			m.closePromptRevision++
		}
		revision := m.closePromptRevision
		m.mu.Unlock()
		if !alreadyOpen && emit != nil {
			emit(EventCloseRequested, map[string]any{
				"traySupported":        traySupported,
				"platform":             platform,
				closePromptRevisionKey: revision,
			})
		}
	}
}

func (m *DesktopManager) quitFromWindowClose(event *application.WindowEvent) {
	// Resident applications disable automatic exit when their last window closes.
	// Cancel this close path and let intentional application shutdown close all windows.
	if event != nil {
		event.Cancel()
	}
	m.RequestQuit()
}

// ResolveClosePrompt executes the user's choice from the close confirmation modal.
func (m *DesktopManager) ResolveClosePrompt(action string, remember bool) error {
	m.mu.Lock()
	prompt, promptChanged := m.resetClosePromptLocked()
	emit := m.emitEvent
	m.mu.Unlock()
	if promptChanged && emit != nil {
		emit(EventClosePromptChanged, prompt)
	}

	normalized := strings.TrimSpace(action)
	if normalized == "cancel" || normalized == "" {
		return nil
	}
	if normalized != CloseActionMinimizeToTray && normalized != CloseActionQuit {
		return fmt.Errorf("invalid close action: %q", action)
	}
	if normalized == CloseActionMinimizeToTray && !m.traySupported {
		return fmt.Errorf("system tray is unavailable in the current desktop session")
	}

	if remember {
		if _, err := m.store.Update(func(p *DesktopPreferences) {
			p.CloseAction = normalized
		}); err != nil {
			return err
		}
		m.broadcastStateChanged()
	}

	if normalized == CloseActionQuit {
		m.RequestQuit()
		return nil
	}

	m.HideWindow()
	return nil
}

// RequestQuit triggers a clean application termination bypassing close interception.
func (m *DesktopManager) RequestQuit() {
	m.BeginQuit()
	m.mu.Lock()
	quit := m.quitApp
	m.mu.Unlock()
	if quit != nil {
		quit()
	}
}

// ShowWindow restores and focuses the main window (and restores Dock icon on macOS if hidden).
func (m *DesktopManager) ShowWindow() {
	m.visibilityMu.Lock()
	defer m.visibilityMu.Unlock()
	prefs := m.store.Get()
	m.mu.Lock()
	m.windowHidden = false
	prompt, promptChanged := m.resetClosePromptLocked()
	closePromptRevision := m.closePromptRevision
	restoreDock := m.platform == platformDarwin && (prefs.HideDockWhenMinimized || m.dockHidden) && m.setDockVisible != nil
	if restoreDock {
		m.dockHidden = false
	}
	show := m.showMainWindow
	emit := m.emitEvent
	m.mu.Unlock()
	if promptChanged && emit != nil {
		emit(EventClosePromptChanged, prompt)
	}
	if restoreDock {
		m.setDockVisible(true)
	}
	if show != nil {
		show()
	}
	if emit != nil {
		emit(EventWindowVisibility, map[string]any{
			visibilityHiddenKey:    false,
			closePromptRevisionKey: closePromptRevision,
		})
	}
	m.rebuildTrayView()
}

// HideWindow saves geometry, hides the main window to tray/menu bar, and notifies the frontend
// to pause animations immediately.
func (m *DesktopManager) HideWindow() {
	m.visibilityMu.Lock()
	defer m.visibilityMu.Unlock()
	m.saveCurrentWindowBounds()
	prefs := m.store.Get()
	m.mu.Lock()
	m.windowHidden = true
	prompt, promptChanged := m.resetClosePromptLocked()
	closePromptRevision := m.closePromptRevision
	hideDock := m.platform == platformDarwin && prefs.HideDockWhenMinimized && m.setDockVisible != nil
	if hideDock {
		m.dockHidden = true
	}
	hide := m.hideMainWindow
	emit := m.emitEvent
	m.mu.Unlock()
	if emit != nil {
		emit(EventWindowVisibility, map[string]any{
			visibilityHiddenKey:    true,
			closePromptRevisionKey: closePromptRevision,
		})
		if promptChanged {
			emit(EventClosePromptChanged, prompt)
		}
	}
	if hide != nil {
		hide()
	}
	if hideDock {
		m.setDockVisible(false)
	}
	m.rebuildTrayView()
}

// ToggleWindow alternates between showing and hiding the main window.
func (m *DesktopManager) ToggleWindow() {
	m.mu.Lock()
	hidden := m.windowHidden
	if m.window != nil {
		hidden = !m.window.IsVisible() || m.window.IsMinimised()
	}
	m.mu.Unlock()
	if hidden {
		m.ShowWindow()
	} else {
		m.HideWindow()
	}
}

func (m *DesktopManager) onWindowHidden() {
	m.transitionNativeWindowVisibility(false, nil)
}

func (m *DesktopManager) onWindowShown() {
	m.transitionNativeWindowVisibility(true, nil)
}

func (m *DesktopManager) transitionNativeWindowVisibility(visible bool, currentVisibility func() bool) {
	m.visibilityMu.Lock()
	defer m.visibilityMu.Unlock()
	if currentVisibility != nil && currentVisibility() != visible {
		return
	}

	if visible {
		m.applyNativeWindowShown()
		return
	}
	m.applyNativeWindowHidden()
}

func (m *DesktopManager) applyNativeWindowHidden() {
	m.mu.Lock()
	m.windowHidden = true
	prompt, promptChanged := m.resetClosePromptLocked()
	closePromptRevision := m.closePromptRevision
	emit := m.emitEvent
	m.mu.Unlock()
	if emit != nil {
		emit(EventWindowVisibility, map[string]any{
			visibilityHiddenKey:    true,
			closePromptRevisionKey: closePromptRevision,
		})
		if promptChanged {
			emit(EventClosePromptChanged, prompt)
		}
	}
	m.rebuildTrayView()
}

func (m *DesktopManager) applyNativeWindowShown() {
	m.mu.Lock()
	m.windowHidden = false
	prompt, promptChanged := m.resetClosePromptLocked()
	closePromptRevision := m.closePromptRevision
	restoreDock := m.platform == platformDarwin && m.dockHidden && m.setDockVisible != nil
	if restoreDock {
		m.dockHidden = false
	}
	emit := m.emitEvent
	m.mu.Unlock()
	if promptChanged && emit != nil {
		emit(EventClosePromptChanged, prompt)
	}
	if restoreDock {
		m.setDockVisible(true)
	}
	if emit != nil {
		emit(EventWindowVisibility, map[string]any{
			visibilityHiddenKey:    false,
			closePromptRevisionKey: closePromptRevision,
		})
	}
	m.rebuildTrayView()
}

func (m *DesktopManager) saveCurrentWindowBounds() {
	if !m.store.Get().RememberWindowBounds {
		return
	}
	m.mu.Lock()
	capture := m.captureBounds
	m.mu.Unlock()
	if capture == nil {
		return
	}
	bounds, ok := capture()
	if !ok {
		return
	}
	if _, err := m.store.Update(func(p *DesktopPreferences) {
		p.WindowBounds = bounds
	}); err != nil {
		slog.Debug("Unable to persist window bounds", "error", err)
	}
}

// GetCapabilities reports OS-specific desktop capabilities to the frontend.
func (m *DesktopManager) GetCapabilities() DesktopCapabilities {
	isDesktop := m.platform == platformDarwin || m.platform == platformWindows || m.platform == platformLinux
	m.mu.Lock()
	notifSupported := m.sendNotification != nil || isDesktop
	backupSupported := m.backupDataDir != "" && m.backupVacuum != nil
	m.mu.Unlock()
	return DesktopCapabilities{
		Platform:                 m.platform,
		AutostartSupported:       isDesktop,
		TraySupported:            m.traySupported,
		MenuBarLabelSupported:    m.platform == platformDarwin,
		HideDockSupported:        m.platform == platformDarwin,
		TrayClickActionSupported: m.platform == platformWindows,
		NotificationsSupported:   notifSupported,
		GlobalShortcutsSupported: isDesktop,
		AutoBackupSupported:      backupSupported,
	}
}

// GetState returns the current desktop preferences, OS autostart status, and capabilities.
func (m *DesktopManager) GetState() DesktopState {
	m.preferencesMu.Lock()
	defer m.preferencesMu.Unlock()
	return m.getState()
}

func (m *DesktopManager) getState() DesktopState {
	m.mu.Lock()
	app := m.app
	statusFn := m.autostartStatus
	windowHidden := m.windowHidden
	closePromptOpen := m.closePromptOpen
	closePromptRevision := m.closePromptRevision
	m.mu.Unlock()

	prefs := m.store.Get()
	autoState := AutostartState{Supported: false}
	if statusFn != nil {
		autoState = statusFn(app)
	}
	if prefs.AutostartApprovalPending && !autoState.Enabled {
		autoState.RequiresApproval = true
	}
	if autoState.Supported && autoState.Error == "" && autoState.RequiresApproval &&
		!prefs.AutostartApprovalPending {
		if updated, err := m.store.Update(func(p *DesktopPreferences) {
			p.Autostart = true
			p.AutostartApprovalPending = true
		}); err == nil {
			prefs = updated
		}
	}
	if autoState.Supported && autoState.Error == "" && autoState.Enabled && prefs.AutostartApprovalPending {
		if updated, err := m.store.Update(func(p *DesktopPreferences) {
			p.Autostart = true
			p.AutostartApprovalPending = false
		}); err == nil {
			prefs = updated
		}
	}
	// Reflect OS reality in preferences if the user disabled a previously authorized login item.
	if autoState.Supported && autoState.Error == "" && !autoState.RequiresApproval && prefs.Autostart != autoState.Enabled {
		if updated, err := m.store.Update(func(p *DesktopPreferences) {
			p.Autostart = autoState.Enabled
			p.AutostartApprovalPending = false
			if !autoState.Enabled {
				p.StartHidden = false
			}
		}); err == nil {
			prefs = updated
		}
	}

	return DesktopState{
		Preferences:         prefs,
		Autostart:           autoState,
		Capabilities:        m.GetCapabilities(),
		WindowHidden:        windowHidden,
		ClosePromptOpen:     closePromptOpen,
		ClosePromptRevision: closePromptRevision,
	}
}

// UpdatePreferences updates one or more desktop preferences and synchronizes OS integrations.
func (m *DesktopManager) UpdatePreferences(patch PreferencesPatch) (DesktopState, error) {
	m.preferenceEffectsMu.Lock()
	defer m.preferenceEffectsMu.Unlock()
	m.preferencesMu.Lock()
	state, err := m.updatePreferences(patch)
	m.preferencesMu.Unlock()
	if err == nil {
		m.applyTrayHandlers()
		m.rebuildTrayView()
		m.emitState(state)
	}
	return state, err
}

func (m *DesktopManager) updatePreferences(patch PreferencesPatch) (DesktopState, error) {
	current := m.store.Get()
	if patch.CloseAction != nil && *patch.CloseAction == CloseActionMinimizeToTray && !m.traySupported {
		return m.getState(), fmt.Errorf("当前桌面环境未检测到系统托盘，无法隐藏到托盘")
	}
	if patch.ReminderTime != nil {
		if _, _, ok := ParseReminderTime(*patch.ReminderTime); !ok {
			return m.getState(), fmt.Errorf("提醒时间格式无效，请使用 HH:MM")
		}
	}
	next := current
	next.Autostart = valueOrCurrent(current.Autostart, patch.Autostart)
	next.StartHidden = valueOrCurrent(current.StartHidden, patch.StartHidden)
	next.CloseAction = valueOrCurrent(current.CloseAction, patch.CloseAction)
	next.MenuBarDisplay = valueOrCurrent(current.MenuBarDisplay, patch.MenuBarDisplay)
	next.PrivacyMode = valueOrCurrent(current.PrivacyMode, patch.PrivacyMode)
	next.HideDockWhenMinimized = valueOrCurrent(current.HideDockWhenMinimized, patch.HideDockWhenMinimized)
	next.RememberWindowBounds = valueOrCurrent(current.RememberWindowBounds, patch.RememberWindowBounds)
	next.TrayClickAction = valueOrCurrent(current.TrayClickAction, patch.TrayClickAction)
	next.ReminderEnabled = valueOrCurrent(current.ReminderEnabled, patch.ReminderEnabled)
	next.ReminderTime = valueOrCurrent(current.ReminderTime, patch.ReminderTime)
	next.ToggleWindowShortcut = valueOrCurrent(current.ToggleWindowShortcut, patch.ToggleWindowShortcut)
	next.QuickReceiptShortcut = valueOrCurrent(current.QuickReceiptShortcut, patch.QuickReceiptShortcut)
	next.PrivacyModeShortcut = valueOrCurrent(current.PrivacyModeShortcut, patch.PrivacyModeShortcut)
	next.AutoBackupEnabled = valueOrCurrent(current.AutoBackupEnabled, patch.AutoBackupEnabled)
	next.AutoBackupRetention = valueOrCurrent(current.AutoBackupRetention, patch.AutoBackupRetention)
	next = next.Normalize()

	if err := validateDistinctShortcuts(next); err != nil {
		return m.getState(), err
	}

	if err := m.requestReminderAuthorization(current, next); err != nil {
		return m.getState(), err
	}
	shortcutsChanged := shortcutsDiffer(current, next)
	autostartChanged := autostartDiffers(current, next)
	autoState, err := m.syncNativePreferences(current, next)
	if err != nil {
		return m.getState(), err
	}

	saved, err := m.store.Update(func(p *DesktopPreferences) {
		p.Autostart = next.Autostart
		if !next.Autostart {
			p.AutostartApprovalPending = false
		} else if autoState.RequiresApproval {
			p.AutostartApprovalPending = true
		} else if patch.Autostart != nil {
			p.AutostartApprovalPending = false
		}
		p.StartHidden = next.StartHidden
		p.CloseAction = next.CloseAction
		p.MenuBarDisplay = next.MenuBarDisplay
		p.PrivacyMode = next.PrivacyMode
		p.HideDockWhenMinimized = next.HideDockWhenMinimized
		p.RememberWindowBounds = next.RememberWindowBounds
		p.TrayClickAction = next.TrayClickAction
		p.ReminderEnabled = next.ReminderEnabled
		p.ReminderTime = next.ReminderTime
		p.ToggleWindowShortcut = next.ToggleWindowShortcut
		p.QuickReceiptShortcut = next.QuickReceiptShortcut
		p.PrivacyModeShortcut = next.PrivacyModeShortcut
		p.AutoBackupEnabled = next.AutoBackupEnabled
		p.AutoBackupRetention = next.AutoBackupRetention
	})
	if err != nil {
		m.restoreNativePreferences(current, shortcutsChanged, autostartChanged)
		return m.getState(), err
	}

	// Update macOS dock policy immediately only when hideDockWhenMinimized changed while hidden.
	m.applyDockPreference(patch, saved)

	state := m.getState()
	if autostartChanged && autoState.RequiresApproval {
		state.Autostart.RequiresApproval = true
	}
	return state, nil
}

func (m *DesktopManager) applyDockPreference(patch PreferencesPatch, saved DesktopPreferences) {
	if patch.HideDockWhenMinimized == nil || m.platform != platformDarwin || m.setDockVisible == nil {
		return
	}
	m.visibilityMu.Lock()
	defer m.visibilityMu.Unlock()
	m.mu.Lock()
	hidden := m.windowHidden
	dockHidden := m.dockHidden
	if hidden {
		m.dockHidden = saved.HideDockWhenMinimized
	} else if !saved.HideDockWhenMinimized && dockHidden {
		m.dockHidden = false
	}
	m.mu.Unlock()
	if hidden {
		m.setDockVisible(!saved.HideDockWhenMinimized)
	} else if !saved.HideDockWhenMinimized && dockHidden {
		m.setDockVisible(true)
	}
}

// resetClosePromptLocked advances the prompt revision only when it closes an open prompt.
// The caller must hold m.mu.
func (m *DesktopManager) resetClosePromptLocked() (closePromptPayload, bool) {
	if !m.closePromptOpen {
		return closePromptPayload{ClosePromptRevision: m.closePromptRevision}, false
	}
	m.closePromptOpen = false
	m.closePromptRevision++
	return closePromptPayload{
		Open:                false,
		ClosePromptRevision: m.closePromptRevision,
	}, true
}

func (m *DesktopManager) restoreNativePreferences(current DesktopPreferences, shortcuts, autostart bool) {
	if shortcuts {
		if err := m.syncGlobalShortcuts(current); err != nil {
			slog.Warn("Unable to restore previous global shortcuts", "error", err)
		}
	}
	if autostart {
		m.mu.Lock()
		app, setAuto := m.app, m.setAutostart
		m.mu.Unlock()
		if setAuto != nil {
			if _, err := setAuto(app, current.Autostart, current.StartHidden); err != nil {
				slog.Warn("Unable to restore previous autostart setting", "error", err)
			}
		}
	}
}

// OpenAutostartSettings opens the OS Login Items pane on macOS.
func (m *DesktopManager) OpenAutostartSettings() error {
	return OpenAutostartSettings()
}

// SetSessionUser verifies the login token before selecting the desktop tray/menu bar account.
// Passing userID <= 0 immediately clears all financial metrics from tray/menu bar surfaces.
func (m *DesktopManager) SetSessionUser(userID int64, token string) error {
	m.mu.Lock()
	m.sessionChangeID++
	changeID := m.sessionChangeID
	m.mu.Unlock()
	if userID > 0 {
		if m.sessionVerifier == nil || token == "" {
			return fmt.Errorf("请先登录后查看桌面账户数据")
		}
		verifiedID, err := m.sessionVerifier(token)
		if err != nil || verifiedID != userID {
			return fmt.Errorf("桌面登录凭据无效或账户不匹配")
		}
	}
	m.mu.Lock()
	if m.sessionChangeID != changeID {
		m.mu.Unlock()
		return nil
	}
	if userID <= 0 {
		token = ""
	}
	m.sessionUserID = userID
	m.sessionToken = token
	m.sessionGeneration++
	m.summaryRequestID++
	m.summary = TraySummary{LoggedIn: userID > 0}
	m.mu.Unlock()
	m.rebuildTrayView()
	if userID <= 0 {
		return nil
	}
	err := m.RefreshTraySummary()
	if err == nil {
		m.maybeSendDailyReminder(m.now())
	}
	return err
}

func (m *DesktopManager) validatedSession() (int64, uint64, error) {
	m.mu.Lock()
	userID, token, generation := m.sessionUserID, m.sessionToken, m.sessionGeneration
	verifier := m.sessionVerifier
	m.mu.Unlock()
	if userID <= 0 {
		return 0, generation, nil
	}
	if verifier != nil {
		verifiedID, err := verifier(token)
		if err == nil && verifiedID == userID {
			return userID, generation, nil
		}
	}
	m.mu.Lock()
	if m.sessionGeneration == generation {
		m.sessionUserID, m.sessionToken = 0, ""
		m.sessionGeneration++
		m.summaryRequestID++
		m.summary = TraySummary{}
	}
	m.mu.Unlock()
	m.rebuildTrayView()
	return 0, generation, fmt.Errorf("桌面登录已失效，请重新登录")
}

// NotifyDataChanged schedules a debounced tray/menu bar refresh when project or payment records mutate.
func (m *DesktopManager) NotifyDataChanged(userID int64) {
	m.mu.Lock()
	activeUser := m.sessionUserID
	if activeUser <= 0 || (userID > 0 && userID != activeUser) {
		m.mu.Unlock()
		return
	}
	if m.refreshTimer != nil {
		m.refreshTimer.Reset(summaryRefreshDebounce)
		m.mu.Unlock()
		return
	}
	m.refreshTimer = time.AfterFunc(summaryRefreshDebounce, func() {
		if err := m.RefreshTraySummary(); err != nil {
			slog.Debug("Unable to refresh tray summary", "error", err)
		}
	})
	m.mu.Unlock()
}

// RefreshTraySummary reloads lightweight metrics for the signed-in user and refreshes tray UI.
func (m *DesktopManager) RefreshTraySummary() error {
	userID, generation, sessionErr := m.validatedSession()
	if sessionErr != nil {
		return sessionErr
	}
	m.mu.Lock()
	provider := m.summaryProvider
	m.summaryRequestID++
	requestID := m.summaryRequestID
	m.mu.Unlock()

	if userID <= 0 || provider == nil {
		m.mu.Lock()
		if m.sessionGeneration == generation && m.summaryRequestID == requestID {
			m.summary = TraySummary{LoggedIn: userID > 0}
		}
		m.mu.Unlock()
		m.rebuildTrayView()
		return nil
	}

	summary, err := provider(userID)
	if err != nil {
		return err
	}
	summary.LoggedIn = true

	m.mu.Lock()
	// Discard stale result if user signed out or switched mid-query.
	if m.sessionGeneration != generation || m.summaryRequestID != requestID {
		m.mu.Unlock()
		return nil
	}
	m.summary = summary
	m.mu.Unlock()

	m.rebuildTrayView()
	return nil
}

func (m *DesktopManager) stopRefreshTimer() {
	m.mu.Lock()
	if m.refreshTimer != nil {
		m.refreshTimer.Stop()
		m.refreshTimer = nil
	}
	m.mu.Unlock()
}

func (m *DesktopManager) broadcastStateChanged() {
	m.emitState(m.GetState())
}

func (m *DesktopManager) emitState(state DesktopState) {
	m.mu.Lock()
	emit := m.emitEvent
	m.mu.Unlock()
	if emit != nil {
		emit(EventStateChanged, state)
	}
}

func (m *DesktopManager) openAndNavigate(routePath string) {
	m.ShowWindow()
	m.mu.Lock()
	emit := m.emitEvent
	m.mu.Unlock()
	if emit != nil {
		emit(EventNavigate, map[string]any{"path": routePath})
	}
}

func (m *DesktopManager) rebuildTrayView() {
	prefs := m.store.Get()
	m.mu.Lock()
	summary := m.summary
	hidden := m.windowHidden
	tray := m.tray
	app := m.app
	customSync := m.syncTrayView
	m.mu.Unlock()

	if customSync != nil {
		customSync(prefs, summary, hidden)
		return
	}
	if tray == nil || app == nil {
		return
	}

	if m.platform == platformDarwin {
		tray.SetLabel(FormatMenuBarLabel(prefs, summary))
	}
	tray.SetTooltip(FormatTrayTooltip(prefs, summary))
	tray.SetMenu(m.buildTrayMenu(app, prefs, summary, hidden))
	m.emitMenuBarUpdated()
}

func (m *DesktopManager) buildTrayMenu(app *application.App, prefs DesktopPreferences, summary TraySummary, hidden bool) *application.Menu {
	menu := app.NewMenu()

	// 1. Live summary header
	switch {
	case !summary.LoggedIn:
		menu.Add("未登录 · 点击打开珠算").OnClick(func(_ *application.Context) {
			m.openAndNavigate("/login")
		})
	case prefs.PrivacyMode:
		menu.Add("隐私模式 · 金额已隐藏").SetEnabled(false)
	default:
		menu.Add("本月实收：" + FormatExactCurrency(summary.MonthReceived)).SetEnabled(false)
		menu.Add("累计待收：" + FormatExactCurrency(summary.TotalPending)).SetEnabled(false)
		if summary.OverdueCount > 0 || summary.UpcomingCount > 0 {
			var parts []string
			if summary.OverdueCount > 0 {
				parts = append(parts, fmt.Sprintf("逾期 %d 笔", summary.OverdueCount))
			}
			if summary.UpcomingCount > 0 {
				parts = append(parts, fmt.Sprintf("近期到期 %d 笔", summary.UpcomingCount))
			}
			menu.Add("待处理：" + strings.Join(parts, " · ")).OnClick(func(_ *application.Context) {
				m.openAndNavigate(routeCalendar)
			})
		}
	}

	menu.AddSeparator()

	// 2. Quick business actions
	windowToggleLabel := "隐藏主窗口"
	if hidden {
		windowToggleLabel = "打开珠算"
	}
	toggleItem := menu.Add(windowToggleLabel)
	if prefs.ToggleWindowShortcut != "" {
		toggleItem.SetAccelerator(prefs.ToggleWindowShortcut)
	}
	toggleItem.OnClick(func(_ *application.Context) {
		m.ToggleWindow()
	})
	receiptItem := menu.Add("记一笔收款")
	if prefs.QuickReceiptShortcut != "" {
		receiptItem.SetAccelerator(prefs.QuickReceiptShortcut)
	}
	receiptItem.OnClick(func(_ *application.Context) {
		m.openAndNavigate("/payment/create")
	})
	menu.Add("新建项目").OnClick(func(_ *application.Context) {
		m.openAndNavigate("/projects/create")
	})
	menu.Add("收款日历").OnClick(func(_ *application.Context) {
		m.openAndNavigate(routeCalendar)
	})
	menu.Add("数据分析").OnClick(func(_ *application.Context) {
		m.openAndNavigate("/analytics")
	})

	menu.AddSeparator()

	// 3. Quick preferences & app actions
	privacyItem := menu.AddCheckbox("隐私模式（隐藏金额）", prefs.PrivacyMode)
	if prefs.PrivacyModeShortcut != "" {
		privacyItem.SetAccelerator(prefs.PrivacyModeShortcut)
	}
	privacyItem.OnClick(func(_ *application.Context) {
		m.togglePrivacyMode()
	})

	autostartItem := menu.AddCheckbox("开机自动启动", prefs.Autostart)
	autostartItem.OnClick(func(_ *application.Context) {
		next := !m.store.Get().Autostart
		if _, err := m.UpdatePreferences(PreferencesPatch{Autostart: &next}); err != nil {
			slog.Warn("Unable to toggle autostart from tray", "error", err)
		}
	})

	menu.Add("检查更新").OnClick(func(_ *application.Context) {
		m.openAndNavigate("/settings?tab=about&checkUpdate=1")
	})
	menu.Add("偏好设置…").OnClick(func(_ *application.Context) {
		m.openAndNavigate("/settings?tab=desktop")
	})

	menu.AddSeparator()

	// 4. Explicit exit
	menu.Add("退出珠算").OnClick(func(_ *application.Context) {
		m.RequestQuit()
	})

	return menu
}

// ServiceShutdown cleans up timers and saves window bounds when Wails exits.
func (m *DesktopManager) ServiceShutdown() error {
	m.BeginQuit()
	return nil
}

func (m *DesktopManager) togglePrivacyMode() {
	next := !m.store.Get().PrivacyMode
	if _, err := m.UpdatePreferences(PreferencesPatch{PrivacyMode: &next}); err != nil {
		slog.Debug("Unable to toggle privacy mode", "error", err)
	}
}

func validateDistinctShortcuts(prefs DesktopPreferences) error {
	seen := make(map[string]string, 3)
	entries := []struct {
		label string
		accel string
	}{
		{"唤起/隐藏窗口", prefs.ToggleWindowShortcut},
		{"极速记收款", prefs.QuickReceiptShortcut},
		{"切换隐私模式", prefs.PrivacyModeShortcut},
	}
	for _, entry := range entries {
		if entry.accel == "" {
			continue
		}
		key := strings.ToLower(entry.accel)
		if prev, exists := seen[key]; exists {
			return fmt.Errorf("快捷键 %s 同时分配给了「%s」和「%s」", entry.accel, prev, entry.label)
		}
		seen[key] = entry.label
	}
	return nil
}

func (m *DesktopManager) clearGlobalShortcuts() {
	m.mu.Lock()
	unregAll := m.unregisterAllKeys
	unregOne := m.unregisterShortcut
	registered := append([]string(nil), m.registeredShortcuts...)
	m.registeredShortcuts = nil
	m.mu.Unlock()

	if unregAll != nil && len(registered) > 0 {
		if err := unregAll(); err != nil {
			slog.Warn("Unable to release global shortcuts", "error", err)
		}
		return
	}
	if unregOne != nil {
		for _, accel := range registered {
			if err := unregOne(accel); err != nil {
				slog.Warn("Unable to release global shortcut", "error", err)
			}
		}
	}
}

func (m *DesktopManager) syncGlobalShortcuts(prefs DesktopPreferences) error {
	m.mu.Lock()
	reg := m.registerShortcut
	unregOne := m.unregisterShortcut
	previous := append([]string(nil), m.registeredShortcuts...)
	m.registeredShortcuts = nil
	m.mu.Unlock()

	if unregOne != nil {
		for _, accel := range previous {
			if err := unregOne(accel); err != nil {
				return fmt.Errorf("释放原快捷键失败: %w", err)
			}
		}
	}
	if reg == nil {
		return nil
	}

	type binding struct {
		accel string
		fn    func()
	}
	bindings := []binding{
		{prefs.ToggleWindowShortcut, m.ToggleWindow},
		{prefs.QuickReceiptShortcut, func() { m.openAndNavigate("/payment/create") }},
		{prefs.PrivacyModeShortcut, m.togglePrivacyMode},
	}

	var applied []string
	for _, item := range bindings {
		if item.accel == "" {
			continue
		}
		if err := reg(item.accel, item.fn); err != nil {
			if unregOne != nil {
				for _, done := range applied {
					if err := unregOne(done); err != nil {
						slog.Warn("Unable to release partially registered shortcut", "error", err)
					}
				}
			}
			return fmt.Errorf("快捷键 %s 注册失败，可能已被其他应用占用", item.accel)
		}
		applied = append(applied, item.accel)
	}

	m.mu.Lock()
	m.registeredShortcuts = applied
	m.mu.Unlock()
	return nil
}

// valueOrCurrent applies an optional patch while preserving an omitted field.
func valueOrCurrent[T any](current T, replacement *T) T {
	if replacement != nil {
		return *replacement
	}
	return current
}

// configureApplicationCallbacks is called with m.mu held during Attach.
func (m *DesktopManager) configureApplicationCallbacks(app *application.App) {
	if m.emitEvent == nil {
		m.emitEvent = func(name string, data any) {
			if m.app != nil {
				m.app.Event.Emit(name, data)
			}
		}
	}
	if m.quitApp == nil {
		m.quitApp = func() {
			if m.app != nil {
				m.app.Quit()
			}
		}
	}
	if m.registerShortcut == nil && app != nil {
		m.registerShortcut = app.GlobalShortcut.Register
	}
	if m.unregisterShortcut == nil && app != nil {
		m.unregisterShortcut = app.GlobalShortcut.Unregister
	}
	if m.unregisterAllKeys == nil && app != nil {
		m.unregisterAllKeys = app.GlobalShortcut.UnregisterAll
	}
}

// configureWindowCallbacks preserves injectable hooks and is called with m.mu held.
func (m *DesktopManager) configureWindowCallbacks() {
	if m.showMainWindow == nil {
		m.showMainWindow = func() {
			if m.window == nil {
				return
			}
			if m.window.IsMinimised() {
				m.window.UnMinimise()
			}
			m.window.Show()
			m.window.Focus()
		}
	}
	if m.hideMainWindow == nil {
		m.hideMainWindow = func() {
			if m.window == nil {
				return
			}
			m.window.Hide()
		}
	}
	if m.captureBounds == nil {
		m.captureBounds = func() (WindowBounds, bool) {
			if m.window == nil || !m.window.IsVisible() || m.window.IsMinimised() {
				return WindowBounds{}, false
			}
			x, y := m.window.Position()
			w, h := m.window.Size()
			if w < 400 || h < 300 {
				return WindowBounds{}, false
			}
			return WindowBounds{
				X:         x,
				Y:         y,
				Width:     w,
				Height:    h,
				Maximised: m.window.IsMaximised(),
				Valid:     true,
			}, true
		}
	}
}

func (m *DesktopManager) requestReminderAuthorization(current, next DesktopPreferences) error {
	// Request OS notification authorization when enabling reminders for the first time.
	if next.ReminderEnabled && !current.ReminderEnabled {
		m.mu.Lock()
		reqAuth := m.requestNotifAuth
		m.mu.Unlock()
		if reqAuth != nil {
			authorized, err := reqAuth()
			if err != nil {
				return fmt.Errorf("无法验证系统通知权限: %w", err)
			} else if !authorized {
				return fmt.Errorf("系统通知权限未开启，请在系统设置中允许「珠算」发送通知")
			}
		}
	}

	return nil
}

func (m *DesktopManager) syncNativePreferences(current, next DesktopPreferences) (AutostartState, error) {
	shortcutsChanged := shortcutsDiffer(current, next)
	if shortcutsChanged {
		if err := m.syncGlobalShortcuts(next); err != nil {
			// Roll back OS bindings back to current preferences on registration failure.
			if rollbackErr := m.syncGlobalShortcuts(current); rollbackErr != nil {
				slog.Warn("Unable to restore previous global shortcuts", "error", rollbackErr)
			}
			return AutostartState{}, err
		}
	}

	autostartChanged := autostartDiffers(current, next)
	var autoState AutostartState
	if autostartChanged {
		m.mu.Lock()
		app := m.app
		setAuto := m.setAutostart
		m.mu.Unlock()
		if setAuto != nil {
			var err error
			autoState, err = setAuto(app, next.Autostart, next.StartHidden)
			if err != nil {
				m.restoreNativePreferences(current, shortcutsChanged, true)
				return AutostartState{}, err
			}
		}
	}

	return autoState, nil
}

func shortcutsDiffer(current, next DesktopPreferences) bool {
	return next.ToggleWindowShortcut != current.ToggleWindowShortcut ||
		next.QuickReceiptShortcut != current.QuickReceiptShortcut ||
		next.PrivacyModeShortcut != current.PrivacyModeShortcut
}

func autostartDiffers(current, next DesktopPreferences) bool {
	return next.Autostart != current.Autostart || (next.Autostart && next.StartHidden != current.StartHidden)
}
