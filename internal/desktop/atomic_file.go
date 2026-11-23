package desktop

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
)

// writeAtomicFile publishes a fully written file without truncating an existing destination.
// Callers create the parent directory with the permissions appropriate to its purpose.
func writeAtomicFile(path string, payload []byte, mode os.FileMode) error {
	file, err := os.CreateTemp(filepath.Dir(path), "."+filepath.Base(path)+".*.tmp")
	if err != nil {
		return fmt.Errorf("create temporary file: %w", err)
	}
	closed, published := false, false
	defer func() {
		if !closed {
			if err := file.Close(); err != nil {
				slog.Debug("Unable to close temporary file", "error", err)
			}
		}
		if !published {
			if err := os.Remove(file.Name()); err != nil && !os.IsNotExist(err) {
				slog.Debug("Unable to remove temporary file", "error", err)
			}
		}
	}()
	if err := file.Chmod(mode); err != nil {
		return fmt.Errorf("set temporary file permissions: %w", err)
	}
	if _, err := file.Write(payload); err != nil {
		return fmt.Errorf("write temporary file: %w", err)
	}
	if err := file.Sync(); err != nil {
		return fmt.Errorf("sync temporary file: %w", err)
	}
	err = file.Close()
	closed = true
	if err != nil {
		return fmt.Errorf("close temporary file: %w", err)
	}
	if err := os.Rename(file.Name(), path); err != nil {
		return fmt.Errorf("publish temporary file: %w", err)
	}
	published = true
	return nil
}
