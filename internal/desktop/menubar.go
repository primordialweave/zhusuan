package desktop

import (
	"log/slog"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

const (
	// EventMenuBarUpdated signals the macOS menu bar popover to refresh its snapshot.
	EventMenuBarUpdated = "desktop:menubar-updated"

	menuBarPopoverWidth  = 360
	menuBarPopoverHeight = 492
)

// MenuBarTrendPoint represents a single bucket in the menu bar popover sparkline chart.
type MenuBarTrendPoint struct {
	Label  string  `json:"label"`
	Amount float64 `json:"amount"`
}

// MenuBarUpcomingItem represents a compact overdue or upcoming payment row in the popover.
type MenuBarUpcomingItem struct {
	PaymentID   int64   `json:"paymentId"`
	ProjectID   int64   `json:"projectId"`
	ProjectName string  `json:"projectName"`
	Stage       string  `json:"stage"`
	Amount      float64 `json:"amount"`
	PlanDate    string  `json:"planDate"`
	Overdue     bool    `json:"overdue"`
}

// MenuBarSnapshot holds the complete chart and metric payload for the macOS menu bar popover.
type MenuBarSnapshot struct {
	LoggedIn         bool                  `json:"loggedIn"`
	Scope            string                `json:"scope"`
	PeriodReceived   float64               `json:"periodReceived"`
	ContractTotal    float64               `json:"contractTotal"`
	ContractReceived float64               `json:"contractReceived"`
	TotalPending     float64               `json:"totalPending"`
	OverdueAmount    float64               `json:"overdueAmount"`
	OverdueCount     int                   `json:"overdueCount"`
	UpcomingCount    int                   `json:"upcomingCount"`
	PrivacyMode      bool                  `json:"privacyMode"`
	Trend            []MenuBarTrendPoint   `json:"trend"`
	Items            []MenuBarUpcomingItem `json:"items"`
}

// MenuBarSnapshotProvider computes chart and alert data for the signed-in desktop user.
type MenuBarSnapshotProvider func(userID int64, scope string) (MenuBarSnapshot, error)

// MenuBarPopoverOptions returns the native macOS translucent NSPanel window options for the
// menu bar popover.
func MenuBarPopoverOptions() application.WebviewWindowOptions {
	return application.WebviewWindowOptions{
		Name:             "zhusuan-menubar-popover",
		Title:            "珠算速览",
		Width:            menuBarPopoverWidth,
		Height:           menuBarPopoverHeight,
		DisableResize:    true,
		Frameless:        true,
		AlwaysOnTop:      true,
		Hidden:           true,
		BackgroundType:   application.BackgroundTypeTranslucent,
		BackgroundColour: application.NewRGBA(0, 0, 0, 0),
		URL:              "/menubar",
		Mac: application.MacWindow{
			Backdrop:     application.MacBackdropTranslucent,
			CornerType:   application.MacWindowCornerTypeRounded,
			CornerRadius: 16,
			WindowLevel:  application.MacWindowLevelPopUpMenu,
			WindowClass:  application.MacWindowClassPanel,
			PanelPreferences: application.MacPanelPreferences{
				FloatingPanel: true,
			},
			CollectionBehavior: application.MacWindowCollectionBehaviorCanJoinAllSpaces |
				application.MacWindowCollectionBehaviorFullScreenAuxiliary,
		},
	}
}

func normalizeMenuBarScope(scope string) string {
	switch strings.ToLower(strings.TrimSpace(scope)) {
	case "year", "all":
		return strings.ToLower(strings.TrimSpace(scope))
	default:
		return "month"
	}
}

// SetMenuBarSnapshotProvider wires the chart + upcoming items provider for the macOS popover.
func (m *DesktopManager) SetMenuBarSnapshotProvider(provider MenuBarSnapshotProvider) {
	m.mu.Lock()
	m.menuBarProvider = provider
	m.mu.Unlock()
}

func (m *DesktopManager) setupMenuBarPopover(app *application.App, tray *application.SystemTray) {
	if app == nil || tray == nil || m.platform != platformDarwin {
		return
	}
	popover := app.Window.NewWithOptions(MenuBarPopoverOptions())
	popover.RegisterHook(events.Common.WindowClosing, func(event *application.WindowEvent) {
		if m.quitting.Load() {
			return
		}
		event.Cancel()
		popover.Hide()
	})
	popover.OnWindowEvent(events.Common.WindowLostFocus, func(_ *application.WindowEvent) {
		if !m.quitting.Load() && popover.IsVisible() {
			popover.Hide()
		}
	})
	popover.OnWindowEvent(events.Common.WindowShow, func(_ *application.WindowEvent) {
		m.emitMenuBarUpdated()
	})

	tray.AttachWindow(popover).WindowOffset(6)

	m.mu.Lock()
	m.menuBarPopover = popover
	m.mu.Unlock()
}

// GetMenuBarSnapshot returns the live metrics, sparkline trend, and top urgent payments for the
// macOS menu bar popover. Returns an empty logged-out snapshot when no desktop session is active.
func (m *DesktopManager) GetMenuBarSnapshot(scope string) (MenuBarSnapshot, error) {
	normalized := normalizeMenuBarScope(scope)
	userID, generation, sessionErr := m.validatedSession()
	if sessionErr != nil {
		return MenuBarSnapshot{}, sessionErr
	}
	prefs := m.store.Get()

	m.mu.Lock()
	provider := m.menuBarProvider
	summary := m.summary
	m.mu.Unlock()

	if userID <= 0 {
		return MenuBarSnapshot{
			LoggedIn:    false,
			Scope:       normalized,
			PrivacyMode: prefs.PrivacyMode,
			Trend:       []MenuBarTrendPoint{},
			Items:       []MenuBarUpcomingItem{},
		}, nil
	}

	if provider == nil {
		return MenuBarSnapshot{
			LoggedIn:       true,
			Scope:          normalized,
			PeriodReceived: summary.MonthReceived,
			TotalPending:   summary.TotalPending,
			OverdueAmount:  summary.OverdueAmount,
			OverdueCount:   summary.OverdueCount,
			UpcomingCount:  summary.UpcomingCount,
			PrivacyMode:    prefs.PrivacyMode,
			Trend:          []MenuBarTrendPoint{},
			Items:          []MenuBarUpcomingItem{},
		}, nil
	}

	snapshot, err := provider(userID, normalized)
	m.mu.Lock()
	current := m.sessionGeneration == generation
	m.mu.Unlock()
	prefs = m.store.Get()
	if !current {
		return MenuBarSnapshot{Scope: normalized, PrivacyMode: prefs.PrivacyMode,
			Trend: []MenuBarTrendPoint{}, Items: []MenuBarUpcomingItem{}}, nil
	}
	if err != nil {
		return MenuBarSnapshot{}, err
	}
	snapshot.LoggedIn = true
	snapshot.Scope = normalized
	snapshot.PrivacyMode = prefs.PrivacyMode
	if snapshot.Trend == nil {
		snapshot.Trend = []MenuBarTrendPoint{}
	}
	if snapshot.Items == nil {
		snapshot.Items = []MenuBarUpcomingItem{}
	}
	return snapshot, nil
}

// HideMenuBarPopover dismisses the macOS menu bar popover panel.
func (m *DesktopManager) HideMenuBarPopover() {
	m.mu.Lock()
	popover := m.menuBarPopover
	m.mu.Unlock()
	if popover != nil && popover.IsVisible() {
		popover.Hide()
	}
}

// OpenRouteFromMenuBar dismisses the popover, brings the main window to front, and navigates to route.
func (m *DesktopManager) OpenRouteFromMenuBar(route string) {
	m.HideMenuBarPopover()
	target := strings.TrimSpace(route)
	if target == "" || !strings.HasPrefix(target, "/") {
		m.ShowWindow()
		return
	}
	m.openAndNavigate(target)
}

func (m *DesktopManager) emitMenuBarUpdated() {
	m.mu.Lock()
	emit := m.emitEvent
	m.mu.Unlock()
	if emit != nil {
		emit(EventMenuBarUpdated, map[string]any{"ts": m.now().Unix()})
	}
}

func (m *DesktopManager) toggleMenuBarPopover() {
	m.mu.Lock()
	tray := m.tray
	popover := m.menuBarPopover
	m.mu.Unlock()
	if tray == nil || popover == nil {
		if tray != nil {
			tray.OpenMenu()
		}
		return
	}
	if popover.IsVisible() {
		popover.Hide()
		return
	}
	if err := tray.PositionWindow(popover, 6); err != nil {
		slog.Debug("Unable to anchor macOS menu bar popover", "error", err)
	}
	popover.Show()
	popover.Focus()
}
