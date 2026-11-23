//go:build linux && !android

package desktop

import "github.com/godbus/dbus/v5"

// probePlatformTrayAvailable checks whether the active Linux desktop session exposes a
// StatusNotifierWatcher D-Bus service (e.g. KDE Plasma, Waybar, or GNOME with AppIndicator).
// When absent, hiding the main window to tray would orphan the app without any visible entry.
func probePlatformTrayAvailable() bool {
	conn, err := dbus.SessionBus()
	if err != nil || conn == nil {
		return false
	}
	var hasOwner bool
	call := conn.BusObject().Call("org.freedesktop.DBus.NameHasOwner", 0, "org.kde.StatusNotifierWatcher")
	if call.Err != nil {
		return false
	}
	if err := call.Store(&hasOwner); err != nil {
		return false
	}
	return hasOwner
}
