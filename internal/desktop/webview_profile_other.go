//go:build !windows

package desktop

// PrepareWebviewProfile uses logical SQLite preference migration on WebKit platforms.
func PrepareWebviewProfile(_ string) error { return nil }
