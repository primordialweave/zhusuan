package desktop

import (
	"errors"
	"path/filepath"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/notifications"
)

func newTestDesktopManager(t *testing.T, platform string, traySupported bool) (*DesktopManager, *PreferencesStore) {
	t.Helper()
	store, err := NewPreferencesStore(t.TempDir())
	require.NoError(t, err)
	m := NewDesktopManager(store, TrayIcons{}, nil)
	m.sessionVerifier = func(token string) (int64, error) { return strconv.ParseInt(token, 10, 64) }
	m.platform = platform
	m.traySupported = traySupported
	m.autostartStatus = func(_ *application.App) AutostartState {
		return AutostartState{Enabled: store.Get().Autostart, Supported: true, Strategy: "test"}
	}
	m.setAutostart = func(_ *application.App, enabled bool, _ bool) (AutostartState, error) {
		return AutostartState{Enabled: enabled, Supported: true, Strategy: "test"}, nil
	}
	return m, store
}

func TestHandleWindowClosingRespectsAskMinimizeQuitAndQuittingFlag(t *testing.T) {
	m, store := newTestDesktopManager(t, "darwin", true)

	var eventsEmitted []string
	var hiddenCount, quitCount int
	m.emitEvent = func(name string, _ any) { eventsEmitted = append(eventsEmitted, name) }
	m.hideMainWindow = func() { hiddenCount++ }
	m.quitApp = func() { quitCount++ }

	// 1. Default policy is "ask": emits close prompt once and does not hide or quit yet.
	m.HandleWindowClosing(nil)
	m.HandleWindowClosing(nil) // duplicate click while prompt open should not emit twice
	require.Equal(t, []string{EventCloseRequested}, eventsEmitted)
	require.Equal(t, 0, hiddenCount)
	require.Equal(t, 0, quitCount)

	// 2. Resolving prompt with remember=true persists minimize_to_tray and hides window.
	require.NoError(t, m.ResolveClosePrompt(CloseActionMinimizeToTray, true))
	require.Equal(t, CloseActionMinimizeToTray, store.Get().CloseAction)
	require.Equal(t, 1, hiddenCount)
	require.Equal(t, 0, quitCount)

	// 3. Subsequent window close immediately hides without prompting again.
	m.HandleWindowClosing(nil)
	require.Equal(t, 2, hiddenCount)
	require.Equal(t, 0, quitCount)

	// 4. Explicit RequestQuit bypasses close interception.
	m.RequestQuit()
	require.Equal(t, 1, quitCount)
	m.HandleWindowClosing(nil)
	require.Equal(t, 2, hiddenCount) // not intercepted again after BeginQuit
}

func TestTraylessLinuxFallsBackToQuitOnMinimizeToTray(t *testing.T) {
	m, store := newTestDesktopManager(t, "linux", false)

	// Selecting minimize_to_tray via settings is rejected when no tray host is available.
	minimize := CloseActionMinimizeToTray
	_, err := m.UpdatePreferences(PreferencesPatch{CloseAction: &minimize})
	require.Error(t, err)

	// Even if a pre-existing config file had minimize_to_tray, closing does not orphan the app.
	_, err = store.Update(func(p *DesktopPreferences) {
		p.CloseAction = CloseActionMinimizeToTray
	})
	require.NoError(t, err)

	hidden := false
	m.hideMainWindow = func() { hidden = true }
	m.HandleWindowClosing(nil)
	require.False(t, hidden)
	require.True(t, m.quitting.Load())
}

func TestShouldStartHiddenRequiresFlagAutostartStartHiddenAndTray(t *testing.T) {
	m, store := newTestDesktopManager(t, "windows", true)
	require.False(t, m.ShouldStartHidden([]string{AutostartLaunchArg}))

	_, err := store.Update(func(p *DesktopPreferences) {
		p.Autostart = true
		p.StartHidden = true
	})
	require.NoError(t, err)

	require.False(t, m.ShouldStartHidden(nil))
	require.True(t, m.ShouldStartHidden([]string{AutostartLaunchArg}))

	m.traySupported = false
	require.False(t, m.ShouldStartHidden([]string{AutostartLaunchArg}))
}

func TestMacOSDockPolicyToggleOnHideAndShow(t *testing.T) {
	m, _ := newTestDesktopManager(t, "darwin", true)
	var dockCalls []bool
	m.setDockVisible = func(visible bool) { dockCalls = append(dockCalls, visible) }
	m.hideMainWindow = func() {}
	m.showMainWindow = func() {}

	hideDock := true
	_, err := m.UpdatePreferences(PreferencesPatch{HideDockWhenMinimized: &hideDock})
	require.NoError(t, err)
	require.Empty(t, dockCalls) // window is currently visible, so no dock flicker

	m.HideWindow()
	require.Equal(t, []bool{false}, dockCalls)

	m.ShowWindow()
	require.Equal(t, []bool{false, true}, dockCalls)
}

func TestStaleNativeVisibilityEventsDoNotOverrideCurrentWindowState(t *testing.T) {
	m, _ := newTestDesktopManager(t, "darwin", true)
	m.mu.Lock()
	m.windowHidden = false
	m.mu.Unlock()

	var events []string
	m.emitEvent = func(name string, _ any) { events = append(events, name) }
	windowVisible := atomic.Bool{}
	windowVisible.Store(true)

	m.transitionNativeWindowVisibility(false, windowVisible.Load)
	require.False(t, m.windowHidden, "a delayed hide notification must not override the visible native window")
	require.Empty(t, events)

	windowVisible.Store(false)
	m.transitionNativeWindowVisibility(true, windowVisible.Load)
	require.False(t, m.windowHidden, "a delayed show notification must not override the hidden native window")
	require.Empty(t, events)
}

func TestSessionAndDebouncedDataRefresh(t *testing.T) {
	m, _ := newTestDesktopManager(t, "darwin", true)

	var mu sync.Mutex
	var synced []TraySummary
	queryCount := 0

	m.summaryProvider = func(userID int64) (TraySummary, error) {
		mu.Lock()
		queryCount++
		mu.Unlock()
		return TraySummary{
			LoggedIn:      true,
			MonthReceived: float64(userID * 1000),
			TotalPending:  5000,
			OverdueCount:  1,
		}, nil
	}
	m.syncTrayView = func(_ DesktopPreferences, summary TraySummary, _ bool) {
		mu.Lock()
		synced = append(synced, summary)
		mu.Unlock()
	}

	// Sign in refreshes immediately.
	require.NoError(t, m.SetSessionUser(7, "7"))
	mu.Lock()
	require.Equal(t, 1, queryCount)
	require.Len(t, synced, 2)
	require.Zero(t, synced[0].MonthReceived, "clear the prior account before loading the new one")
	require.Equal(t, 7000.0, synced[1].MonthReceived)
	mu.Unlock()

	// Multiple rapid writes coalesce into a single debounced refresh.
	m.NotifyDataChanged(7)
	m.NotifyDataChanged(7)
	m.NotifyDataChanged(7)
	require.Eventually(t, func() bool {
		mu.Lock()
		defer mu.Unlock()
		return queryCount == 2
	}, 2*time.Second, 20*time.Millisecond)

	// Logout clears financial data immediately.
	require.NoError(t, m.SetSessionUser(0, "0"))
	mu.Lock()
	last := synced[len(synced)-1]
	mu.Unlock()
	require.False(t, last.LoggedIn)
	require.Zero(t, last.MonthReceived)
}

func TestClosePromptSurvivesStateReadsAndResetsOnVisibilityChanges(t *testing.T) {
	m, _ := newTestDesktopManager(t, "darwin", true)
	var eventsEmitted []string
	m.emitEvent = func(name string, _ any) {
		if name == EventCloseRequested || name == EventClosePromptChanged {
			eventsEmitted = append(eventsEmitted, name)
		}
	}
	m.hideMainWindow = func() {}
	m.showMainWindow = func() {}

	m.HandleWindowClosing(nil)
	require.Len(t, eventsEmitted, 1)
	require.Equal(t, uint64(1), m.GetState().ClosePromptRevision)

	// Reads, including a reloaded frontend, must not consume a pending prompt.
	require.True(t, m.GetState().ClosePromptOpen)
	m.HandleWindowClosing(nil)
	require.Len(t, eventsEmitted, 1)

	// Simulate hiding window via shortcut while prompt was open.
	m.HideWindow()
	require.Equal(t, EventClosePromptChanged, eventsEmitted[1])
	m.ShowWindow()
	require.False(t, m.GetState().ClosePromptOpen)
	m.HandleWindowClosing(nil)
	require.Equal(t, []string{EventCloseRequested, EventClosePromptChanged, EventCloseRequested}, eventsEmitted)
}

func TestMacAutostartPendingApprovalKeepsRequestedPreference(t *testing.T) {
	dataDir := t.TempDir()
	store, err := NewPreferencesStore(dataDir)
	require.NoError(t, err)
	m := NewDesktopManager(store, TrayIcons{}, nil)
	m.platform = "darwin"
	m.traySupported = true
	m.autostartStatus = func(*application.App) AutostartState {
		return AutostartState{Supported: true}
	}
	pending := AutostartState{Supported: true, RequiresApproval: true, Strategy: string(application.AutostartStrategySMAppService)}
	m.setAutostart = func(_ *application.App, _, _ bool) (AutostartState, error) {
		return pending, nil
	}
	// Registration can know the OS is pending approval before a status read catches up.
	enabled := true
	updated, err := m.UpdatePreferences(PreferencesPatch{Autostart: &enabled})
	require.NoError(t, err)
	require.True(t, updated.Autostart.RequiresApproval)
	require.True(t, updated.Preferences.Autostart)

	restartedStore, err := NewPreferencesStore(filepath.Clean(dataDir))
	require.NoError(t, err)
	restart := NewDesktopManager(restartedStore, TrayIcons{}, nil)
	restart.autostartStatus = func(*application.App) AutostartState { return AutostartState{Supported: true} }
	status := restart.GetState()
	require.True(t, status.Autostart.RequiresApproval)
	require.True(t, status.Preferences.Autostart)

	restart.autostartStatus = func(*application.App) AutostartState {
		return AutostartState{Supported: true, Enabled: true}
	}
	status = restart.GetState()
	require.True(t, status.Autostart.Enabled)
	require.False(t, status.Autostart.RequiresApproval)
	require.True(t, status.Preferences.Autostart)
	require.False(t, restartedStore.Get().AutostartApprovalPending)
}

func TestMacDockHideDoesNotOverrideConcurrentShow(t *testing.T) {
	m, store := newTestDesktopManager(t, "darwin", true)
	_, err := store.Update(func(p *DesktopPreferences) { p.HideDockWhenMinimized = true })
	require.NoError(t, err)
	hiding, releaseHide := make(chan struct{}), make(chan struct{})
	showStarted, shown := make(chan struct{}), make(chan struct{})
	var operations sync.WaitGroup
	var dockVisible atomic.Bool
	dockVisible.Store(true)
	m.hideMainWindow = func() {
		close(hiding)
		<-releaseHide
	}
	m.showMainWindow = func() { close(shown) }
	m.setDockVisible = dockVisible.Store
	operations.Go(m.HideWindow)
	<-hiding
	operations.Go(func() {
		close(showStarted)
		m.ShowWindow()
	})
	<-showStarted
	select {
	case <-shown:
		t.Fatal("ShowWindow bypassed the in-progress hide transition")
	case <-time.After(25 * time.Millisecond):
	}
	close(releaseHide)
	operations.Wait()
	select {
	case <-shown:
	default:
		t.Fatal("concurrent ShowWindow did not complete")
	}
	require.False(t, m.GetState().WindowHidden)
	require.True(t, dockVisible.Load())
}

func TestMacOSDockRestoresWhenShownNativelyOrPreferenceDisabled(t *testing.T) {
	m, _ := newTestDesktopManager(t, "darwin", true)
	var dockCalls []bool
	m.setDockVisible = func(visible bool) { dockCalls = append(dockCalls, visible) }
	m.hideMainWindow = func() {}
	m.showMainWindow = func() {}

	hideDock := true
	_, err := m.UpdatePreferences(PreferencesPatch{HideDockWhenMinimized: &hideDock})
	require.NoError(t, err)

	m.HideWindow()
	require.Equal(t, []bool{false}, dockCalls)

	// Native WindowShow event restores Dock visibility and clears dockHidden.
	m.onWindowShown()
	require.Equal(t, []bool{false, true}, dockCalls)

	// Hide again, then disable preference after window Hidden state is cleared.
	m.HideWindow()
	require.Equal(t, []bool{false, true, false}, dockCalls)
	m.mu.Lock()
	m.windowHidden = false
	m.mu.Unlock()
	hideDock = false
	_, err = m.UpdatePreferences(PreferencesPatch{HideDockWhenMinimized: &hideDock})
	require.NoError(t, err)
	require.Equal(t, []bool{false, true, false, true}, dockCalls)
}

func TestMacApplicationReopenCancelsDefaultAndShowsOnlyMainWindow(t *testing.T) {
	m, _ := newTestDesktopManager(t, "darwin", true)
	shown := 0
	m.showMainWindow = func() { shown++ }

	event := &application.ApplicationEvent{}
	m.handleMacApplicationReopen(event)
	require.True(t, event.IsCancelled())
	require.Equal(t, 1, shown)
}

func TestSendTestReminderValidatesSessionAfterAuthorization(t *testing.T) {
	m, _ := newTestDesktopManager(t, "darwin", true)
	m.summaryProvider = func(_ int64) (TraySummary, error) {
		return TraySummary{LoggedIn: true, OverdueCount: 2, TotalPending: 8800}, nil
	}
	require.NoError(t, m.SetSessionUser(7, "7"))

	// If session becomes invalid while waiting for OS notification authorization,
	// SendTestReminder must not leak financial figures from the stale summary.
	m.requestNotifAuth = func() (bool, error) {
		m.sessionVerifier = func(string) (int64, error) {
			return 0, errors.New("session expired")
		}
		return true, nil
	}
	var sent notifications.NotificationOptions
	m.sendNotification = func(opts notifications.NotificationOptions) error {
		sent = opts
		return nil
	}

	require.NoError(t, m.SendTestReminder())
	require.Equal(t, "珠算 · 桌面提醒已就绪", sent.Title)
	require.NotContains(t, sent.Body, "8,800")
	require.NotContains(t, sent.Body, "逾期 2 笔")
}
