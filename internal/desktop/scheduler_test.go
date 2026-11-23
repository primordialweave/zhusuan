package desktop

import (
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/wailsapp/wails/v3/pkg/services/notifications"
)

func TestDailyReminderOncePerDayPrivacyAndDayRollover(t *testing.T) {
	m, store := newTestDesktopManager(t, "darwin", true)

	currentTime := time.Date(2026, 11, 23, 9, 0, 0, 0, time.Local)
	m.now = func() time.Time { return currentTime }
	m.lastObservedDate = "2026-11-23"

	var mu sync.Mutex
	var sent []notifications.NotificationOptions
	var emitted []string
	m.requestNotifAuth = func() (bool, error) { return true, nil }
	m.sendNotification = func(opts notifications.NotificationOptions) error {
		mu.Lock()
		sent = append(sent, opts)
		mu.Unlock()
		return nil
	}
	m.emitEvent = func(name string, _ any) {
		mu.Lock()
		emitted = append(emitted, name)
		mu.Unlock()
	}
	m.summaryProvider = func(_ int64) (TraySummary, error) {
		return TraySummary{
			LoggedIn:      true,
			MonthReceived: 80000,
			TotalPending:  45000,
			OverdueCount:  2,
			UpcomingCount: 1,
		}, nil
	}
	m.syncTrayView = func(_ DesktopPreferences, _ TraySummary, _ bool) {}

	enabled := true
	reminderTime := "09:30"
	_, err := m.UpdatePreferences(PreferencesPatch{
		ReminderEnabled: &enabled,
		ReminderTime:    &reminderTime,
	})
	require.NoError(t, err)
	require.NoError(t, m.SetSessionUser(1, "1"))

	// Before 09:30 -> must not fire.
	m.RunScheduledChecks()
	require.Empty(t, sent)

	// At 09:35 -> fires once and records LastReminderDate.
	currentTime = time.Date(2026, 11, 23, 9, 35, 0, 0, time.Local)
	m.RunScheduledChecks()
	require.Len(t, sent, 1)
	require.Equal(t, "珠算 · 收款提醒", sent[0].Title)
	require.Contains(t, sent[0].Body, "逾期 2 笔")
	require.Contains(t, sent[0].Body, "¥4.5万")
	require.Equal(t, "2026-11-23", store.Get().LastReminderDate)

	// Running again on same day must not duplicate.
	currentTime = time.Date(2026, 11, 23, 14, 0, 0, 0, time.Local)
	m.RunScheduledChecks()
	require.Len(t, sent, 1)

	// Next day + privacy mode -> emits day-changed and redacts amount from notification.
	privacy := true
	_, err = m.UpdatePreferences(PreferencesPatch{PrivacyMode: &privacy})
	require.NoError(t, err)

	currentTime = time.Date(2026, 11, 24, 9, 45, 0, 0, time.Local)
	m.RunScheduledChecks()
	require.Len(t, sent, 2)
	require.Contains(t, sent[1].Body, "3 笔收款待关注")
	require.NotContains(t, sent[1].Body, "¥")
	require.Contains(t, emitted, EventDayChanged)
}

func TestGlobalShortcutsRegisterConflictRollbackAndCleanup(t *testing.T) {
	m, store := newTestDesktopManager(t, "darwin", true)

	registered := map[string]func(){}
	failAccel := ""
	m.registerShortcut = func(accel string, cb func()) error {
		if accel == failAccel {
			return errors.New("busy")
		}
		registered[accel] = cb
		return nil
	}
	m.unregisterShortcut = func(accel string) error {
		delete(registered, accel)
		return nil
	}
	m.unregisterAllKeys = func() error {
		clear(registered)
		return nil
	}

	toggle := "CmdOrCtrl+Shift+Z"
	receipt := "CmdOrCtrl+Shift+N"
	_, err := m.UpdatePreferences(PreferencesPatch{
		ToggleWindowShortcut: &toggle,
		QuickReceiptShortcut: &receipt,
	})
	require.NoError(t, err)
	require.Contains(t, registered, toggle)
	require.Contains(t, registered, receipt)

	// Duplicate shortcut across two actions is rejected before touching OS bindings.
	dup := "cmdorctrl+shift+z"
	_, err = m.UpdatePreferences(PreferencesPatch{PrivacyModeShortcut: &dup})
	require.Error(t, err)
	require.Empty(t, store.Get().PrivacyModeShortcut)

	// OS registration failure rolls back cleanly to previous shortcuts.
	failAccel = "CmdOrCtrl+Shift+P"
	privacyKey := "CmdOrCtrl+Shift+P"
	_, err = m.UpdatePreferences(PreferencesPatch{PrivacyModeShortcut: &privacyKey})
	require.Error(t, err)
	require.Contains(t, registered, toggle)
	require.Contains(t, registered, receipt)
	require.NotContains(t, registered, privacyKey)

	// Quitting unregisters all shortcuts cleanly.
	m.BeginQuit()
	require.Empty(t, registered)
}
