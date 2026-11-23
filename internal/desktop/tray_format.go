package desktop

import (
	"fmt"
	"math"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// TraySummary holds the lightweight account metrics surfaced in the menu bar and tray tooltip.
type TraySummary struct {
	LoggedIn      bool    `json:"loggedIn"`
	MonthReceived float64 `json:"monthReceived"`
	TotalPending  float64 `json:"totalPending"`
	OverdueAmount float64 `json:"overdueAmount"`
	OverdueCount  int     `json:"overdueCount"`
	UpcomingCount int     `json:"upcomingCount"`
}

// FormatMenuBarLabel computes the concise macOS status bar text displayed beside the template icon.
// It returns an empty string when logged out, in privacy mode, or in icon-only mode.
func FormatMenuBarLabel(prefs DesktopPreferences, summary TraySummary) string {
	if !summary.LoggedIn || prefs.PrivacyMode {
		return ""
	}
	switch prefs.MenuBarDisplay {
	case MenuBarDisplayIcon:
		return ""
	case MenuBarDisplayPendingCount:
		if summary.OverdueCount > 0 {
			return fmt.Sprintf("逾期 %d", summary.OverdueCount)
		}
		if summary.UpcomingCount > 0 {
			return fmt.Sprintf("待收 %d", summary.UpcomingCount)
		}
		return ""
	case MenuBarDisplayMonthReceived:
		return FormatCompactCurrency(summary.MonthReceived)
	case MenuBarDisplayTotalPending:
		return "待收 " + FormatCompactCurrency(summary.TotalPending)
	default:
		return ""
	}
}

// FormatTrayTooltip computes the hover tooltip for Windows/Linux system tray and macOS status item.
func FormatTrayTooltip(prefs DesktopPreferences, summary TraySummary) string {
	if !summary.LoggedIn {
		return "珠算 · 未登录"
	}
	if prefs.PrivacyMode {
		return "珠算 · 隐私模式"
	}
	line1 := fmt.Sprintf("珠算 · 本月实收 %s", FormatCompactCurrency(summary.MonthReceived))
	parts := []string{fmt.Sprintf("待收 %s", FormatCompactCurrency(summary.TotalPending))}
	if summary.OverdueCount > 0 {
		parts = append(parts, fmt.Sprintf("逾期 %d 笔", summary.OverdueCount))
	} else if summary.UpcomingCount > 0 {
		parts = append(parts, fmt.Sprintf("近期到期 %d 笔", summary.UpcomingCount))
	}
	return line1 + "\n" + strings.Join(parts, " · ")
}

// FormatCompactCurrency formats RMB amounts compactly for tight status bar / tooltip spaces.
func FormatCompactCurrency(amount float64) string {
	if math.IsNaN(amount) || math.IsInf(amount, 0) {
		return "¥0"
	}
	sign := ""
	if amount < 0 {
		sign = "-"
		amount = -amount
	}
	switch {
	case amount >= 1e8:
		return fmt.Sprintf("%s¥%s亿", sign, trimTrailingZeros(fmt.Sprintf("%.2f", amount/1e8)))
	case amount >= 1e4:
		return fmt.Sprintf("%s¥%s万", sign, trimTrailingZeros(fmt.Sprintf("%.1f", amount/1e4)))
	case amount == math.Trunc(amount):
		return fmt.Sprintf("%s¥%s", sign, formatThousandsInt(int64(amount)))
	default:
		return fmt.Sprintf("%s¥%s", sign, formatExactNumber(amount))
	}
}

// FormatExactCurrency formats RMB amounts with thousands separators for menu summary rows.
func FormatExactCurrency(amount float64) string {
	if math.IsNaN(amount) || math.IsInf(amount, 0) {
		return "¥0.00"
	}
	sign := ""
	if amount < 0 {
		sign = "-"
		amount = -amount
	}
	return fmt.Sprintf("%s¥%s", sign, formatExactNumber(amount))
}

func formatExactNumber(amount float64) string {
	fixed := fmt.Sprintf("%.2f", amount)
	dot := strings.IndexByte(fixed, '.')
	intPart := fixed[:dot]
	fracPart := fixed[dot:]
	var b strings.Builder
	b.Grow(len(intPart) + len(intPart)/3 + len(fracPart))
	rem := len(intPart) % 3
	if rem > 0 {
		b.WriteString(intPart[:rem])
	}
	for i := rem; i < len(intPart); i += 3 {
		if b.Len() > 0 {
			b.WriteByte(',')
		}
		b.WriteString(intPart[i : i+3])
	}
	b.WriteString(fracPart)
	return b.String()
}

func formatThousandsInt(value int64) string {
	raw := fmt.Sprintf("%d", value)
	var b strings.Builder
	b.Grow(len(raw) + len(raw)/3)
	rem := len(raw) % 3
	if rem > 0 {
		b.WriteString(raw[:rem])
	}
	for i := rem; i < len(raw); i += 3 {
		if b.Len() > 0 {
			b.WriteByte(',')
		}
		b.WriteString(raw[i : i+3])
	}
	return b.String()
}

func trimTrailingZeros(text string) string {
	if !strings.Contains(text, ".") {
		return text
	}
	text = strings.TrimRight(text, "0")
	return strings.TrimRight(text, ".")
}

// ValidateWindowBounds checks whether persisted bounds intersect at least one visible work area
// with sufficient draggable area, preventing off-screen windows after disconnecting monitors.
func ValidateWindowBounds(bounds WindowBounds, workAreas []application.Rect) (WindowBounds, bool) {
	if !bounds.Valid || bounds.Width < 760 || bounds.Height < 520 {
		return WindowBounds{}, false
	}
	if len(workAreas) == 0 {
		return bounds, true
	}
	// The title/drag strip must be visible, not only the bottom of a tall window.
	dragRect := application.Rect{
		X:      bounds.X,
		Y:      bounds.Y,
		Width:  bounds.Width,
		Height: 32,
	}
	winRect := dragRect
	winRect.Height = bounds.Height
	for _, area := range workAreas {
		inter := dragRect.Intersect(area)
		if inter.Width >= 240 && inter.Height >= 24 && winRect.Intersect(area).Height >= 120 {
			return bounds, true
		}
	}
	return WindowBounds{}, false
}
