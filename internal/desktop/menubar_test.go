package desktop

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/wailsapp/wails/v3/pkg/application"
)

func TestMenuBarPopoverOptionsUseNativeMacPanelVibrancy(t *testing.T) {
	opts := MenuBarPopoverOptions()
	require.Equal(t, "/menubar", opts.URL)
	require.True(t, opts.Frameless)
	require.True(t, opts.DisableResize)
	require.True(t, opts.Hidden)
	require.Equal(t, application.BackgroundTypeTranslucent, opts.BackgroundType)
	require.Equal(t, application.MacWindowClassPanel, opts.Mac.WindowClass)
	require.Equal(t, application.MacBackdropTranslucent, opts.Mac.Backdrop)
	require.Equal(t, application.MacWindowLevelPopUpMenu, opts.Mac.WindowLevel)
	require.Equal(t, float64(16), opts.Mac.CornerRadius)
	require.True(t, opts.Mac.PanelPreferences.FloatingPanel)
	require.NotZero(t, opts.Mac.CollectionBehavior&application.MacWindowCollectionBehaviorCanJoinAllSpaces)
	require.NotZero(t, opts.Mac.CollectionBehavior&application.MacWindowCollectionBehaviorFullScreenAuxiliary)
}

func TestGetMenuBarSnapshotEnforcesSessionAndRoutesActions(t *testing.T) {
	m, _ := newTestDesktopManager(t, "darwin", true)

	// Logged out must never call provider or leak data.
	called := false
	m.SetMenuBarSnapshotProvider(func(userID int64, scope string) (MenuBarSnapshot, error) {
		called = true
		return MenuBarSnapshot{
			PeriodReceived:   float64(userID) * 1000,
			ContractTotal:    100000,
			ContractReceived: 75000,
			TotalPending:     25000,
			OverdueCount:     1,
			Trend: []MenuBarTrendPoint{
				{Label: "11-01", Amount: 12000},
				{Label: "11-15", Amount: 28000},
			},
			Items: []MenuBarUpcomingItem{
				{PaymentID: 9, ProjectID: 3, ProjectName: "示例项目", Amount: 5000, PlanDate: "2026-11-20", Overdue: true},
			},
		}, nil
	})

	guest, err := m.GetMenuBarSnapshot("invalid")
	require.NoError(t, err)
	require.False(t, guest.LoggedIn)
	require.Equal(t, "month", guest.Scope)
	require.False(t, called)
	require.Empty(t, guest.Trend)

	// Signed in returns scoped chart & items and reflects privacy preference.
	m.syncTrayView = func(_ DesktopPreferences, _ TraySummary, _ bool) {}
	require.NoError(t, m.SetSessionUser(5, "5"))

	snap, err := m.GetMenuBarSnapshot("year")
	require.NoError(t, err)
	require.True(t, called)
	require.True(t, snap.LoggedIn)
	require.Equal(t, "year", snap.Scope)
	require.Equal(t, 5000.0, snap.PeriodReceived)
	require.Len(t, snap.Trend, 2)
	require.Len(t, snap.Items, 1)

	// OpenRouteFromMenuBar brings main window up and emits navigate event.
	var shown bool
	var navigated string
	m.showMainWindow = func() { shown = true }
	m.emitEvent = func(name string, data any) {
		if name == EventNavigate {
			if payload, ok := data.(map[string]any); ok {
				navigated, _ = payload["path"].(string)
			}
		}
	}
	m.OpenRouteFromMenuBar("/payment/create")
	require.True(t, shown)
	require.Equal(t, "/payment/create", navigated)
}
