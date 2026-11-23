package desktop

import (
	"context"
	"database/sql"
	"encoding/binary"
	"errors"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf16"

	// Register the existing SQLite driver for read-only WebKit preference snapshots.
	_ "github.com/glebarez/go-sqlite"
)

var legacyPreferenceKeys = []string{
	"theme", "lastUsername", "rememberPassword", "rememberMe",
	"workbenchSummaryScope", "orange.appearance.v1", "zhusuan.appearance.v1",
	"zhusuan.themePack.v1",
}

// ReadLegacyPreferences reads only application preferences, never passwords or sessions.
// It leaves old profiles intact and uses SQLite's read transaction to include committed WAL data.
func ReadLegacyPreferences(platform, home string) (map[string]string, error) {
	result := make(map[string]string)
	var roots []string
	switch platform {
	case platformDarwin:
		roots = []string{filepath.Join(home, "Library", "WebKit", "ai.fruits.orange")}
	case platformLinux:
		roots = []string{filepath.Join(home, ".local", "share", "Orange"), filepath.Join(home, ".config", "Orange")}
	default:
		return result, nil
	}
	for _, root := range roots {
		err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
			if walkErr != nil {
				if errors.Is(walkErr, os.ErrNotExist) {
					return nil
				}
				return walkErr
			}
			if entry.IsDir() {
				if strings.Contains(strings.ToLower(entry.Name()), "cache") {
					return filepath.SkipDir
				}
				return nil
			}
			if entry.Name() != "localstorage.sqlite3" && !strings.HasSuffix(entry.Name(), ".localstorage") {
				return nil
			}
			values, err := readPreferenceDatabase(path)
			if err != nil {
				return err
			}
			for key, value := range values {
				if _, exists := result[key]; !exists {
					result[key] = value
				}
			}
			return nil
		})
		if err != nil {
			return nil, err
		}
	}
	return result, nil
}

func readPreferenceDatabase(path string) (map[string]string, error) {
	source := (&url.URL{Scheme: "file", Path: filepath.ToSlash(path), RawQuery: "mode=ro"}).String()
	db, err := sql.Open("sqlite", source)
	if err != nil {
		return nil, err
	}
	defer db.Close() //nolint:errcheck // Read-only handle cleanup cannot change the migration result.
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	args := make([]any, len(legacyPreferenceKeys))
	for index, key := range legacyPreferenceKeys {
		args[index] = key
	}
	rows, err := db.QueryContext(ctx, "SELECT key, value FROM ItemTable WHERE key IN (?,?,?,?,?,?,?,?)", args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close() //nolint:errcheck // rows.Err below carries query/read failures.
	result := make(map[string]string)
	for rows.Next() {
		var key string
		var value any
		if err := rows.Scan(&key, &value); err != nil {
			return nil, err
		}
		text, ok := decodePreference(value)
		if ok {
			result[key] = text
		}
	}
	return result, rows.Err()
}

func decodePreference(value any) (string, bool) {
	switch value := value.(type) {
	case string:
		return value, len(value) <= 64<<10
	case []byte:
		if len(value)%2 != 0 || len(value) > 64<<10 {
			return "", false
		}
		units := make([]uint16, len(value)/2)
		for index := range units {
			units[index] = binary.LittleEndian.Uint16(value[index*2:])
		}
		return string(utf16.Decode(units)), true
	}
	return "", false
}
