package desktop

import (
	"errors"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/notifications"
)

func TestNativeSessionRequiresAuthentication(t *testing.T) {
	store, err := NewPreferencesStore(t.TempDir())
	require.NoError(t, err)
	m := NewDesktopManager(store, TrayIcons{}, nil)
	require.Error(t, m.SetSessionUser(99, "99"))
	require.Zero(t, m.sessionUserID)
}

func TestNativeSessionRejectsMismatchedOrExpiredTokens(t *testing.T) {
	m, _ := newTestDesktopManager(t, "darwin", true)
	require.Error(t, m.SetSessionUser(2, "1"))
	require.Zero(t, m.sessionUserID)
	require.NoError(t, m.SetSessionUser(1, "1"))
	m.sessionVerifier = func(_ string) (int64, error) { return 0, errors.New("expired") }
	called := false
	m.SetMenuBarSnapshotProvider(func(_ int64, _ string) (MenuBarSnapshot, error) {
		called = true
		return MenuBarSnapshot{PeriodReceived: 999}, nil
	})
	_, err := m.GetMenuBarSnapshot("month")
	require.Error(t, err)
	require.False(t, called)
	require.Zero(t, m.sessionUserID)
}

func TestNativeSessionIgnoresOlderVerification(t *testing.T) {
	m, _ := newTestDesktopManager(t, "darwin", true)
	started, release := make(chan struct{}), make(chan struct{})
	m.sessionVerifier = func(token string) (int64, error) {
		if token == "1" {
			close(started)
			<-release
			return 1, nil
		}
		return 2, nil
	}
	finished := make(chan error, 1)
	go func() { finished <- m.SetSessionUser(1, "1") }()
	<-started
	require.NoError(t, m.SetSessionUser(2, "2"))
	close(release)
	require.NoError(t, <-finished)
	require.Equal(t, int64(2), m.sessionUserID)
}

func TestConcurrentPreferencesPreserveBothChanges(t *testing.T) {
	m, store := newTestDesktopManager(t, "darwin", true)
	started, release := make(chan struct{}), make(chan struct{})
	m.setAutostart = func(_ *application.App, enabled bool, _ bool) (AutostartState, error) {
		close(started)
		<-release
		return AutostartState{Enabled: enabled, Supported: true}, nil
	}
	enabled := true
	first, second := make(chan error, 1), make(chan error, 1)
	go func() { _, err := m.UpdatePreferences(PreferencesPatch{Autostart: &enabled}); first <- err }()
	<-started
	go func() { _, err := m.UpdatePreferences(PreferencesPatch{PrivacyMode: &enabled}); second <- err }()
	select {
	case err := <-second:
		close(release)
		require.NoError(t, <-first)
		require.NoError(t, err)
	case <-time.After(50 * time.Millisecond):
		close(release)
		require.NoError(t, <-first)
		require.NoError(t, <-second)
	}
	require.True(t, store.Get().Autostart)
	require.True(t, store.Get().PrivacyMode)
}

func TestReminderAuthorizationFailureDoesNotEnableReminders(t *testing.T) {
	m, store := newTestDesktopManager(t, "darwin", true)
	m.requestNotifAuth = func() (bool, error) { return false, errors.New("unavailable") }
	enabled := true
	_, err := m.UpdatePreferences(PreferencesPatch{ReminderEnabled: &enabled})
	require.Error(t, err)
	require.False(t, store.Get().ReminderEnabled)
}

func TestNativePreferencesRollbackAfterSaveFailure(t *testing.T) {
	m, store := newTestDesktopManager(t, "darwin", true)
	blocked := filepath.Join(t.TempDir(), "not-a-directory")
	require.NoError(t, os.WriteFile(blocked, []byte("blocked"), 0o600))
	store.path = filepath.Join(blocked, preferencesFileName)
	active := false
	m.setAutostart = func(_ *application.App, enabled, _ bool) (AutostartState, error) {
		active = enabled
		return AutostartState{Enabled: enabled, Supported: true}, nil
	}
	enabled := true
	_, err := m.UpdatePreferences(PreferencesPatch{Autostart: &enabled})
	require.Error(t, err)
	require.False(t, active, "restore the original OS setting when persistence fails")
	require.False(t, store.Get().Autostart)
}

func TestGlobalShortcutsRollbackAfterAutostartFailure(t *testing.T) {
	m, _ := newTestDesktopManager(t, "darwin", true)
	registered := map[string]bool{}
	m.registerShortcut = func(key string, _ func()) error { registered[key] = true; return nil }
	m.unregisterShortcut = func(key string) error { delete(registered, key); return nil }
	oldKey, newKey := "CmdOrCtrl+Shift+Z", "CmdOrCtrl+Shift+Y"
	_, err := m.UpdatePreferences(PreferencesPatch{ToggleWindowShortcut: &oldKey})
	require.NoError(t, err)
	m.setAutostart = func(_ *application.App, _, _ bool) (AutostartState, error) {
		return AutostartState{}, errors.New("unavailable")
	}
	enabled := true
	_, err = m.UpdatePreferences(PreferencesPatch{Autostart: &enabled, ToggleWindowShortcut: &newKey})
	require.Error(t, err)
	require.True(t, registered[oldKey])
	require.False(t, registered[newKey])
}

func TestConcurrentDailyChecksSendOneReminder(t *testing.T) {
	m, store := newTestDesktopManager(t, "darwin", true)
	_, err := store.Update(func(p *DesktopPreferences) { p.ReminderEnabled = true })
	require.NoError(t, err)
	m.summaryProvider = func(_ int64) (TraySummary, error) { return TraySummary{OverdueCount: 1}, nil }
	require.NoError(t, m.SetSessionUser(1, "1"))
	var sent atomic.Int32
	m.sendNotification = func(_ notifications.NotificationOptions) error { sent.Add(1); return nil }
	now := time.Date(2026, 11, 23, 12, 0, 0, 0, time.UTC)
	var workers sync.WaitGroup
	for range 10 {
		workers.Add(1)
		go func() { defer workers.Done(); m.maybeSendDailyReminder(now) }()
	}
	workers.Wait()
	require.Equal(t, int32(1), sent.Load())
}

func TestMenuBarSnapshotDiscardsSignedOutSession(t *testing.T) {
	m, _ := newTestDesktopManager(t, "darwin", true)
	require.NoError(t, m.SetSessionUser(1, "1"))
	started, release := make(chan struct{}), make(chan struct{})
	m.SetMenuBarSnapshotProvider(func(_ int64, _ string) (MenuBarSnapshot, error) {
		close(started)
		<-release
		return MenuBarSnapshot{PeriodReceived: 999}, nil
	})
	result := make(chan MenuBarSnapshot, 1)
	go func() {
		snapshot, err := m.GetMenuBarSnapshot("month")
		if err != nil {
			t.Error(err)
		}
		result <- snapshot
	}()
	<-started
	require.NoError(t, m.SetSessionUser(0, "0"))
	close(release)
	snapshot := <-result
	require.False(t, snapshot.LoggedIn)
	require.Zero(t, snapshot.PeriodReceived)
}

func TestMenuBarSnapshotUsesCurrentPrivacyPreference(t *testing.T) {
	m, store := newTestDesktopManager(t, "darwin", true)
	require.NoError(t, m.SetSessionUser(1, "1"))
	m.SetMenuBarSnapshotProvider(func(_ int64, _ string) (MenuBarSnapshot, error) {
		_, err := store.Update(func(p *DesktopPreferences) { p.PrivacyMode = true })
		return MenuBarSnapshot{PeriodReceived: 999}, err
	})
	snapshot, err := m.GetMenuBarSnapshot("month")
	require.NoError(t, err)
	require.True(t, snapshot.PrivacyMode)
}

func TestAutoBackupKeepsDistinctSnapshotsAtSameTime(t *testing.T) {
	dir := t.TempDir()
	now := time.Date(2026, 11, 23, 9, 0, 0, 0, time.UTC)
	write := func(dest string) error { return os.WriteFile(dest, []byte("snapshot"), 0o600) }
	first, err := CreateAutoBackup(dir, 3, now, write)
	require.NoError(t, err)
	second, err := CreateAutoBackup(dir, 3, now, write)
	require.NoError(t, err)
	require.NotEqual(t, first.Path, second.Path)
	require.Equal(t, 2, second.Count)
	require.FileExists(t, first.Path)
}

func TestAutoBackupRotationPreservesSimilarManualNames(t *testing.T) {
	dir := t.TempDir()
	backupDir := AutoBackupDir(dir)
	require.NoError(t, os.MkdirAll(backupDir, 0o700))
	manual := filepath.Join(backupDir, "zhusuan-auto-manual.db")
	require.NoError(t, os.WriteFile(manual, []byte("manual"), 0o600))
	_, err := CreateAutoBackup(dir, 1, time.Now(), func(dest string) error {
		return os.WriteFile(dest, []byte("snapshot"), 0o600)
	})
	require.NoError(t, err)
	require.FileExists(t, manual)
}

func TestWindowRestoreRequiresVisibleDragArea(t *testing.T) {
	screens := []application.Rect{{X: 0, Y: 0, Width: 1440, Height: 900}}
	bounds := WindowBounds{X: 100, Y: -600, Width: 1280, Height: 800, Valid: true}
	_, ok := ValidateWindowBounds(bounds, screens)
	require.False(t, ok, "a visible body does not make an off-screen title bar draggable")
	bounds.Y = -24
	_, ok = ValidateWindowBounds(bounds, screens)
	require.False(t, ok)
	bounds.Y, bounds.Maximised = -8, true
	_, ok = ValidateWindowBounds(bounds, screens)
	require.True(t, ok, "retain the visible drag area with a maximized border offset")
	bounds.Y = 100
	_, ok = ValidateWindowBounds(bounds, screens)
	require.True(t, ok)
}

func TestClosePoliciesRequestApplicationQuit(t *testing.T) {
	for _, scenario := range []struct {
		name   string
		policy string
		tray   bool
	}{
		{"explicit quit", CloseActionQuit, true},
		{"tray unavailable", CloseActionMinimizeToTray, false},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			m, store := newTestDesktopManager(t, platformWindows, scenario.tray)
			_, err := store.Update(func(p *DesktopPreferences) { p.CloseAction = scenario.policy })
			require.NoError(t, err)
			quits := 0
			m.quitApp = func() { quits++ }
			m.HandleWindowClosing(nil)
			require.Equal(t, 1, quits, "closing the window alone does not stop a resident application")
			require.True(t, m.quitting.Load())
			m.HandleWindowClosing(nil)
			require.Equal(t, 1, quits)
		})
	}
}
