package desktop

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/wailsapp/wails/v3/pkg/application"
)

func TestPreferencesStoreDefaultsAndPersistence(t *testing.T) {
	dir := t.TempDir()
	store, err := NewPreferencesStore(dir)
	require.NoError(t, err)

	defaults := store.Get()
	require.Equal(t, CloseActionAsk, defaults.CloseAction)
	require.Equal(t, MenuBarDisplayPendingCount, defaults.MenuBarDisplay)
	require.Equal(t, TrayClickToggleWindow, defaults.TrayClickAction)
	require.False(t, defaults.Autostart)
	require.False(t, defaults.StartHidden)
	require.False(t, defaults.PrivacyMode)
	require.False(t, defaults.HideDockWhenMinimized)
	require.True(t, defaults.RememberWindowBounds)

	updated, err := store.Update(func(p *DesktopPreferences) {
		p.Autostart = true
		p.StartHidden = true
		p.CloseAction = CloseActionMinimizeToTray
		p.MenuBarDisplay = MenuBarDisplayMonthReceived
		p.PrivacyMode = true
		p.HideDockWhenMinimized = true
		p.WindowBounds = WindowBounds{X: 120, Y: 80, Width: 1280, Height: 800, Valid: true}
	})
	require.NoError(t, err)
	require.True(t, updated.Autostart)
	require.True(t, updated.StartHidden)
	require.Equal(t, CloseActionMinimizeToTray, updated.CloseAction)

	reloaded, err := NewPreferencesStore(dir)
	require.NoError(t, err)
	require.Equal(t, updated, reloaded.Get())

	info, err := os.Stat(filepath.Join(dir, preferencesFileName))
	require.NoError(t, err)
	if runtime.GOOS != platformWindows {
		require.Equal(t, os.FileMode(0o600), info.Mode().Perm())
	}
}

func TestPreferencesNormalizationAndCorruptFallback(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, preferencesFileName), []byte("{invalid json"), 0o600))

	store, err := NewPreferencesStore(dir)
	require.NoError(t, err)
	require.Equal(t, DefaultDesktopPreferences(), store.Get())

	normalized, err := store.Update(func(p *DesktopPreferences) {
		p.Autostart = false
		p.StartHidden = true
		p.CloseAction = "unknown"
		p.MenuBarDisplay = "unknown"
		p.TrayClickAction = "unknown"
		p.WindowBounds = WindowBounds{Width: 100, Height: 100, Valid: true}
	})
	require.NoError(t, err)
	require.False(t, normalized.StartHidden)
	require.Equal(t, CloseActionAsk, normalized.CloseAction)
	require.Equal(t, MenuBarDisplayPendingCount, normalized.MenuBarDisplay)
	require.Equal(t, TrayClickToggleWindow, normalized.TrayClickAction)
	require.False(t, normalized.WindowBounds.Valid)
}

func TestFormatMenuBarLabelAndTooltip(t *testing.T) {
	summary := TraySummary{
		LoggedIn:      true,
		MonthReceived: 128400,
		TotalPending:  45000,
		OverdueCount:  2,
		UpcomingCount: 1,
	}

	prefs := DefaultDesktopPreferences()
	require.Equal(t, "逾期 2", FormatMenuBarLabel(prefs, summary))
	require.Equal(t, "珠算 · 本月实收 ¥12.8万\n待收 ¥4.5万 · 逾期 2 笔", FormatTrayTooltip(prefs, summary))

	// Logged out must never leak financial numbers.
	require.Equal(t, "", FormatMenuBarLabel(prefs, TraySummary{LoggedIn: false, MonthReceived: 99999}))
	require.Equal(t, "珠算 · 未登录", FormatTrayTooltip(prefs, TraySummary{LoggedIn: false, MonthReceived: 99999}))

	// Privacy mode must redact both label and tooltip.
	prefs.PrivacyMode = true
	require.Equal(t, "", FormatMenuBarLabel(prefs, summary))
	require.Equal(t, "珠算 · 隐私模式", FormatTrayTooltip(prefs, summary))

	prefs.PrivacyMode = false
	prefs.MenuBarDisplay = MenuBarDisplayIcon
	require.Equal(t, "", FormatMenuBarLabel(prefs, summary))

	prefs.MenuBarDisplay = MenuBarDisplayMonthReceived
	require.Equal(t, "¥12.8万", FormatMenuBarLabel(prefs, summary))

	prefs.MenuBarDisplay = MenuBarDisplayTotalPending
	require.Equal(t, "待收 ¥4.5万", FormatMenuBarLabel(prefs, summary))

	prefs.MenuBarDisplay = MenuBarDisplayPendingCount
	require.Equal(t, "待收 3", FormatMenuBarLabel(prefs, TraySummary{LoggedIn: true, UpcomingCount: 3}))
	require.Equal(t, "", FormatMenuBarLabel(prefs, TraySummary{LoggedIn: true}))
}

func TestValidateWindowBounds(t *testing.T) {
	screens := []application.Rect{
		{X: 0, Y: 0, Width: 1920, Height: 1080},
	}

	okBounds := WindowBounds{X: 100, Y: 100, Width: 1280, Height: 800, Valid: true}
	got, ok := ValidateWindowBounds(okBounds, screens)
	require.True(t, ok)
	require.Equal(t, okBounds, got)

	// Off-screen monitor disconnected -> rejected cleanly.
	offScreen := WindowBounds{X: 2500, Y: 100, Width: 1280, Height: 800, Valid: true}
	_, ok = ValidateWindowBounds(offScreen, screens)
	require.False(t, ok)

	// Too small -> rejected.
	tiny := WindowBounds{X: 0, Y: 0, Width: 300, Height: 200, Valid: true}
	_, ok = ValidateWindowBounds(tiny, screens)
	require.False(t, ok)
}
