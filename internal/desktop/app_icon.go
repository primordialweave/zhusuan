package desktop

import (
	"fmt"
	"strings"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// AppIconManager updates the running desktop application icon between light and dark artwork.
type AppIconManager struct {
	mu                sync.Mutex
	light             []byte
	dark              []byte
	currentAppearance string
	apply             func([]byte)
}

// NewAppIconManager constructs an icon service backed by static light and dark PNG payloads.
func NewAppIconManager(light, dark []byte) *AppIconManager {
	return &AppIconManager{
		light: light,
		dark:  dark,
		apply: func(icon []byte) {
			if app := application.Get(); app != nil {
				app.SetIcon(icon)
			}
		},
	}
}

// SetAppearance applies the resolved "light" or "dark" desktop application icon.
func (m *AppIconManager) SetAppearance(appearance string) error {
	normalized := strings.ToLower(strings.TrimSpace(appearance))
	var icon []byte
	switch normalized {
	case "light":
		icon = m.light
	case "dark":
		icon = m.dark
	default:
		return fmt.Errorf("invalid app icon appearance: %q", appearance)
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	if m.currentAppearance == normalized {
		return nil
	}
	m.currentAppearance = normalized
	if len(icon) > 0 && m.apply != nil {
		m.apply(icon)
	}
	return nil
}

// CurrentAppearance reports the last applied appearance ("light", "dark", or "").
func (m *AppIconManager) CurrentAppearance() string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.currentAppearance
}
