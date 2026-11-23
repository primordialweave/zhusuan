package desktop

import (
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/wailsapp/wails/v3/pkg/application"
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
