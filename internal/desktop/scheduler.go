package desktop

import (
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/wailsapp/wails/v3/pkg/services/notifications"
)

const (
	// EventDayChanged notifies the frontend when local wall-clock date crosses midnight or wakes on a new day.
	EventDayChanged = "desktop:day-changed"

	// Coarse background check interval: 4 wakeups/hour keeps CPU near 0% while remaining resilient
	// across OS sleep/hibernation without missing daily reminders or midnight rollover.
	backgroundCheckInterval = 15 * time.Minute
)

// FormatPaymentReminder builds the title and privacy-respecting body for daily local notifications.
// Returns ok == false when there are no overdue or upcoming payments requiring attention.
func FormatPaymentReminder(prefs DesktopPreferences, summary TraySummary) (title string, body string, ok bool) {
	if !summary.LoggedIn || (summary.OverdueCount <= 0 && summary.UpcomingCount <= 0) {
		return "", "", false
	}
	title = "珠算 · 收款提醒"
	totalItems := summary.OverdueCount + summary.UpcomingCount
	if prefs.PrivacyMode {
		return title, fmt.Sprintf("共有 %d 笔收款待关注，点击查看收款日历", totalItems), true
	}

	var parts []string
	if summary.OverdueCount > 0 {
		parts = append(parts, fmt.Sprintf("逾期 %d 笔", summary.OverdueCount))
	}
	if summary.UpcomingCount > 0 {
		parts = append(parts, fmt.Sprintf("7日内到期 %d 笔", summary.UpcomingCount))
	}
	if summary.TotalPending > 0 {
		parts = append(parts, "累计待收 "+FormatCompactCurrency(summary.TotalPending))
	}
	return title, strings.Join(parts, " · "), true
}

func (m *DesktopManager) startBackgroundLoop() {
	m.mu.Lock()
	if m.stopBgLoop != nil {
		m.mu.Unlock()
		return
	}
	stopCh := make(chan struct{})
	m.stopBgLoop = stopCh
	m.lastObservedDate = m.now().Format(time.DateOnly)
	interval := m.bgCheckInterval
	if interval <= 0 {
		interval = backgroundCheckInterval
	}
	m.mu.Unlock()

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-stopCh:
				return
			case <-ticker.C:
				m.RunScheduledChecks()
			}
		}
	}()
}

func (m *DesktopManager) stopBackgroundLoop() {
	m.mu.Lock()
	stopCh := m.stopBgLoop
	m.stopBgLoop = nil
	m.mu.Unlock()
	if stopCh != nil {
		close(stopCh)
	}
}

// RunScheduledChecks checks for local date rollover (midnight / wake from sleep) and daily
// local payment reminders. Safe to call directly in unit tests.
func (m *DesktopManager) RunScheduledChecks() {
	now := m.now()
	today := now.Format(time.DateOnly)

	m.mu.Lock()
	prevDate := m.lastObservedDate
	dayChanged := prevDate != "" && prevDate != today
	m.lastObservedDate = today
	emit := m.emitEvent
	m.mu.Unlock()

	if dayChanged {
		if err := m.RefreshTraySummary(); err != nil {
			slog.Debug("Unable to refresh tray summary after day rollover", "error", err)
		}
		if emit != nil {
			emit(EventDayChanged, map[string]any{"date": today})
		}
	}

	m.maybeSendDailyReminder(now)
	m.maybeRunDailyBackup(now)
}

func (m *DesktopManager) maybeRunDailyBackup(now time.Time) {
	m.backupMu.Lock()
	defer m.backupMu.Unlock()
	prefs := m.store.Get()
	if !prefs.AutoBackupEnabled {
		return
	}
	today := now.Format(time.DateOnly)
	if prefs.LastBackupDate == today {
		return
	}

	m.mu.Lock()
	dataDir := m.backupDataDir
	vacuumFn := m.backupVacuum
	m.mu.Unlock()
	if dataDir == "" || vacuumFn == nil {
		return
	}

	if _, err := CreateAutoBackup(dataDir, prefs.AutoBackupRetention, now, vacuumFn); err != nil {
		slog.Warn("Unable to create scheduled SQLite auto-backup", "error", err)
		return
	}
	if _, err := m.store.Update(func(p *DesktopPreferences) {
		p.LastBackupDate = today
	}); err != nil {
		slog.Debug("Unable to persist last backup date", "error", err)
		return
	}
	m.broadcastStateChanged()
}

func (m *DesktopManager) maybeSendDailyReminder(now time.Time) {
	m.reminderMu.Lock()
	defer m.reminderMu.Unlock()
	prefs := m.store.Get()
	if !reminderDue(prefs, now) {
		return
	}
	today := now.Format(time.DateOnly)

	m.mu.Lock()
	provider := m.summaryProvider
	sendNotif := m.sendNotification
	m.mu.Unlock()
	userID, generation, sessionErr := m.validatedSession()
	if sessionErr != nil {
		return
	}

	if userID <= 0 || provider == nil || sendNotif == nil {
		return
	}

	summary, err := provider(userID)
	if err != nil {
		slog.Debug("Unable to load payment reminder summary", "error", err)
		return
	}
	summary.LoggedIn = true
	m.mu.Lock()
	current := m.sessionGeneration == generation
	m.mu.Unlock()
	prefs = m.store.Get()
	if !current || !prefs.ReminderEnabled || prefs.LastReminderDate == today {
		return
	}

	title, body, shouldNotify := FormatPaymentReminder(prefs, summary)
	if !shouldNotify {
		return
	}

	err = sendNotif(notifications.NotificationOptions{
		ID:       "zhusuan-payment-reminder-" + today,
		Title:    title,
		Body:     body,
		ThreadID: "zhusuan-payment-reminders",
		Data:     map[string]any{"route": routeCalendar},
	})
	if err != nil {
		slog.Debug("Unable to deliver daily payment reminder", "error", err)
		return
	}

	if _, err := m.store.Update(func(p *DesktopPreferences) {
		p.LastReminderDate = today
	}); err != nil {
		slog.Debug("Unable to persist last reminder date", "error", err)
	}
}

// SendTestReminder triggers an immediate native OS notification so the user can verify system
// notification permissions and delivery from Desktop Settings.
func (m *DesktopManager) SendTestReminder() error {
	m.mu.Lock()
	reqAuth := m.requestNotifAuth
	sendNotif := m.sendNotification
	m.mu.Unlock()

	if sendNotif == nil {
		return fmt.Errorf("当前环境不支持系统桌面通知")
	}
	if reqAuth != nil {
		authorized, err := reqAuth()
		if err != nil {
			return fmt.Errorf("无法请求系统通知权限：%w", err)
		}
		if !authorized {
			return fmt.Errorf("系统通知权限未开启，请在系统设置中允许「珠算」发送通知")
		}
	}

	userID, _, sessionErr := m.validatedSession()
	m.mu.Lock()
	summary := m.summary
	m.mu.Unlock()

	prefs := m.store.Get()
	title := "珠算 · 桌面提醒已就绪"
	body := "到期与逾期收款将在每日设定时间通过系统通知提醒你"
	if sessionErr == nil && userID > 0 {
		if t, b, ok := FormatPaymentReminder(prefs, summary); ok {
			title, body = t, b
		}
	}

	return sendNotif(notifications.NotificationOptions{
		ID:       fmt.Sprintf("zhusuan-test-reminder-%d", m.now().Unix()),
		Title:    title,
		Body:     body,
		ThreadID: "zhusuan-payment-reminders",
		Data:     map[string]any{"route": routeCalendar},
	})
}

func reminderDue(prefs DesktopPreferences, now time.Time) bool {
	if !prefs.ReminderEnabled || prefs.LastReminderDate == now.Format(time.DateOnly) {
		return false
	}
	hour, minute, ok := ParseReminderTime(prefs.ReminderTime)
	if !ok {
		return false
	}
	scheduled := time.Date(now.Year(), now.Month(), now.Day(), hour, minute, 0, 0, now.Location())
	return !now.Before(scheduled)
}
