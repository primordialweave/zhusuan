package desktop

import (
	"errors"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// copyWebviewProfile clones persistent data only, without overwriting a new profile.
func copyWebviewProfile(source, destination string) error {
	if _, err := os.Stat(destination); err == nil {
		return nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	if _, err := os.Stat(source); errors.Is(err, os.ErrNotExist) {
		return nil
	} else if err != nil {
		return err
	}
	return cloneProfileTree(source, destination)
}

func cloneProfileTree(source, destination string) error {
	if err := os.MkdirAll(filepath.Dir(destination), 0o700); err != nil {
		return err
	}
	stage, err := os.MkdirTemp(filepath.Dir(destination), ".webview-migration-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(stage) //nolint:errcheck // Best-effort private staging cleanup; old/new profiles are untouched.
	var total int64
	err = filepath.WalkDir(source, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if skipProfileEntry(entry.Name()) {
			if entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		relative, err := filepath.Rel(source, path)
		if err != nil {
			return err
		}
		target := filepath.Join(stage, relative)
		if entry.IsDir() {
			return os.MkdirAll(target, 0o700)
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		if !info.Mode().IsRegular() {
			return errors.New("旧浏览器配置包含不支持的链接或文件")
		}
		total += info.Size()
		if total > 512<<20 {
			return errors.New("旧浏览器持久配置超过迁移大小限制")
		}
		return copyProfileFile(path, target)
	})
	if err != nil {
		return err
	}
	if _, err := os.Stat(destination); err == nil {
		return nil
	}
	return os.Rename(stage, destination)
}

func skipProfileEntry(name string) bool {
	lower := strings.ToLower(name)
	return strings.Contains(lower, "cache") || strings.HasPrefix(lower, "singleton") || lower == "lock" || lower == "lockfile" || lower == "session storage" || lower == "sessions"
}

func copyProfileFile(source, destination string) error {
	input, err := os.Open(source)
	if err != nil {
		return err
	}
	defer input.Close() //nolint:errcheck // Read-only handle cleanup.
	output, err := os.OpenFile(destination, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	_, err = io.Copy(output, input)
	if closeErr := output.Close(); err == nil {
		err = closeErr
	}
	return err
}
