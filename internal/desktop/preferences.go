package desktop

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
)

const (
	// CloseActionAsk prompts the user on window close with an option to remember the choice.
	CloseActionAsk = "ask"
	// CloseActionMinimizeToTray hides the main window to the system tray / menu bar on close.
	CloseActionMinimizeToTray = "minimize_to_tray"
	// CloseActionQuit terminates the application immediately on window close.
	CloseActionQuit = "quit"

	// MenuBarDisplayIcon displays only the monochrome icon in the macOS menu bar.
	MenuBarDisplayIcon = "icon"
	// MenuBarDisplayPendingCount displays pending/overdue count next to the macOS menu bar icon.
	MenuBarDisplayPendingCount = "pending_count"
	// MenuBarDisplayMonthReceived displays current-month received amount next to the macOS menu bar icon.
	MenuBarDisplayMonthReceived = "month_received"
	// MenuBarDisplayTotalPending displays total pending receivable amount next to the macOS menu bar icon.
	MenuBarDisplayTotalPending = "total_pending"

	// TrayClickToggleWindow toggles main window visibility on Windows tray icon left click.
	TrayClickToggleWindow = "toggle_window"
	// TrayClickOpenMenu opens the tray context menu on Windows tray icon left click.
	TrayClickOpenMenu = "open_menu"

	// DefaultReminderTime is the default local wall-clock time for daily payment reminders.
	DefaultReminderTime = "09:30"

	preferencesFileName = "desktop-preferences.json"
)

// WindowBounds stores the persisted main window geometry for safe restoration across sessions.
type WindowBounds struct {
	X         int  `json:"x"`
	Y         int  `json:"y"`
	Width     int  `json:"width"`
	Height    int  `json:"height"`
	Maximised bool `json:"maximised"`
	Valid     bool `json:"valid"`
}

// DesktopPreferences stores OS-level desktop behavior persisted outside WebView storage so Go
// can inspect it before creating or showing the main window.
type DesktopPreferences struct {
	Autostart             bool         `json:"autostart"`
	StartHidden           bool         `json:"startHidden"`
	CloseAction           string       `json:"closeAction"`
	MenuBarDisplay        string       `json:"menuBarDisplay"`
	PrivacyMode           bool         `json:"privacyMode"`
	HideDockWhenMinimized bool         `json:"hideDockWhenMinimized"`
	RememberWindowBounds  bool         `json:"rememberWindowBounds"`
	TrayClickAction       string       `json:"trayClickAction"`
	ReminderEnabled       bool         `json:"reminderEnabled"`
	ReminderTime          string       `json:"reminderTime"`
	LastReminderDate      string       `json:"lastReminderDate,omitempty"`
	ToggleWindowShortcut  string       `json:"toggleWindowShortcut"`
	QuickReceiptShortcut  string       `json:"quickReceiptShortcut"`
	PrivacyModeShortcut   string       `json:"privacyModeShortcut"`
	AutoBackupEnabled     bool         `json:"autoBackupEnabled"`
	AutoBackupRetention   int          `json:"autoBackupRetention"`
	LastBackupDate        string       `json:"lastBackupDate,omitempty"`
	WindowBounds          WindowBounds `json:"windowBounds"`
}

// DefaultDesktopPreferences returns the baseline cross-platform desktop preferences.
func DefaultDesktopPreferences() DesktopPreferences {
	return DesktopPreferences{
		Autostart:             false,
		StartHidden:           false,
		CloseAction:           CloseActionAsk,
		MenuBarDisplay:        MenuBarDisplayPendingCount,
		PrivacyMode:           false,
		HideDockWhenMinimized: false,
		RememberWindowBounds:  true,
		TrayClickAction:       TrayClickToggleWindow,
		ReminderEnabled:       false,
		ReminderTime:          DefaultReminderTime,
		AutoBackupEnabled:     false,
		AutoBackupRetention:   DefaultAutoBackupRetention,
	}
}

// Normalize coerces unknown enum values back to safe defaults.
func (p DesktopPreferences) Normalize() DesktopPreferences {
	switch p.CloseAction {
	case CloseActionAsk, CloseActionMinimizeToTray, CloseActionQuit:
	default:
		p.CloseAction = CloseActionAsk
	}

	switch p.MenuBarDisplay {
	case MenuBarDisplayIcon, MenuBarDisplayPendingCount, MenuBarDisplayMonthReceived, MenuBarDisplayTotalPending:
	default:
		p.MenuBarDisplay = MenuBarDisplayPendingCount
	}

	switch p.TrayClickAction {
	case TrayClickToggleWindow, TrayClickOpenMenu:
	default:
		p.TrayClickAction = TrayClickToggleWindow
	}

	if !p.Autostart {
		p.StartHidden = false
	}

	if p.WindowBounds.Width < 400 || p.WindowBounds.Height < 300 {
		p.WindowBounds.Valid = false
	}

	if _, _, ok := ParseReminderTime(p.ReminderTime); !ok {
		p.ReminderTime = DefaultReminderTime
	} else {
		h, m, _ := ParseReminderTime(p.ReminderTime)
		p.ReminderTime = fmt.Sprintf("%02d:%02d", h, m)
	}

	p.ToggleWindowShortcut = strings.TrimSpace(p.ToggleWindowShortcut)
	p.QuickReceiptShortcut = strings.TrimSpace(p.QuickReceiptShortcut)
	p.PrivacyModeShortcut = strings.TrimSpace(p.PrivacyModeShortcut)
	p.AutoBackupRetention = clampBackupRetention(p.AutoBackupRetention)

	return p
}

// ParseReminderTime parses an "HH:MM" 24-hour clock string.
func ParseReminderTime(value string) (hour int, minute int, ok bool) {
	trimmed := strings.TrimSpace(value)
	parts := strings.Split(trimmed, ":")
	if len(parts) != 2 {
		return 0, 0, false
	}
	h, err := strconv.Atoi(parts[0])
	if err != nil || h < 0 || h > 23 {
		return 0, 0, false
	}
	m, err := strconv.Atoi(parts[1])
	if err != nil || m < 0 || m > 59 {
		return 0, 0, false
	}
	return h, m, true
}

// PreferencesStore manages atomic read/write access to desktop-preferences.json.
type PreferencesStore struct {
	mu   sync.RWMutex
	path string
	data DesktopPreferences
}

// NewPreferencesStore loads preferences from dataDir/desktop-preferences.json, falling back to
// defaults when the file does not yet exist.
func NewPreferencesStore(dataDir string) (*PreferencesStore, error) {
	store := &PreferencesStore{
		path: filepath.Join(dataDir, preferencesFileName),
		data: DefaultDesktopPreferences(),
	}
	if err := store.load(); err != nil {
		return nil, err
	}
	return store, nil
}

func (s *PreferencesStore) load() error {
	raw, err := os.ReadFile(s.path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return fmt.Errorf("read desktop preferences: %w", err)
	}
	if len(raw) == 0 {
		return nil
	}
	prefs := DefaultDesktopPreferences()
	if err := json.Unmarshal(raw, &prefs); err != nil {
		// Corrupted preference file should not block desktop startup; keep defaults.
		return nil
	}
	s.data = prefs.Normalize()
	return nil
}

// Get returns a snapshot of the current desktop preferences.
func (s *PreferencesStore) Get() DesktopPreferences {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.data
}

// Path returns the backing JSON file path.
func (s *PreferencesStore) Path() string {
	return s.path
}

// Update mutates the preferences under lock and persists them atomically.
func (s *PreferencesStore) Update(fn func(*DesktopPreferences)) (DesktopPreferences, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	next := s.data
	fn(&next)
	next = next.Normalize()
	if err := writeFileAtomic(s.path, next); err != nil {
		return s.data, err
	}
	s.data = next
	return s.data, nil
}

func writeFileAtomic(path string, prefs DesktopPreferences) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return fmt.Errorf("create desktop preferences dir: %w", err)
	}
	payload, err := json.MarshalIndent(prefs, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal desktop preferences: %w", err)
	}
	payload = append(payload, '\n')

	return writeAtomicFile(path, payload, 0o600)
}
