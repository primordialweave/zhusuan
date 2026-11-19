package config

import (
	"database/sql"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"github.com/glebarez/sqlite"
)

func legacyDatabase(t *testing.T, root string) (*sql.DB, string) {
	t.Helper()
	path := filepath.Join(root, "FruitsAI", "Orange", "orange.db")
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatal(err)
	}
	db, err := sql.Open(sqlite.DriverName, path)
	if err != nil {
		t.Fatal(err)
	}
	db.SetMaxOpenConns(1)
	if _, err = db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec("PRAGMA wal_autocheckpoint=0"); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec("CREATE TABLE records(id INTEGER PRIMARY KEY, name TEXT)"); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec("INSERT INTO records(name) VALUES ('committed-in-wal')"); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := db.Close(); err != nil {
			t.Error(err)
		}
	})
	return db, path
}

func TestPrepareAppDataCopiesWALSnapshotAndKeepsOldData(t *testing.T) {
	root := t.TempDir()
	old, source := legacyDatabase(t, root)
	if info, err := os.Stat(source + "-wal"); err != nil || info.Size() == 0 {
		t.Fatal("fixture has no live WAL data")
	}
	dir := filepath.Dir(source)
	if err := os.WriteFile(filepath.Join(dir, "initial-credentials.txt"), []byte("test fixture credentials"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(dir, "log"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "log", "orange.log"), []byte("old-log"), 0o600); err != nil {
		t.Fatal(err)
	}
	paths, err := PrepareAppData(root, true)
	if err != nil {
		t.Fatal(err)
	}
	newDB, err := sql.Open(sqlite.DriverName, paths.Database)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := newDB.Close(); err != nil {
			t.Error(err)
		}
	}()
	var name string
	if err = newDB.QueryRow("SELECT name FROM records").Scan(&name); err != nil || name != "committed-in-wal" {
		t.Fatalf("snapshot data: %q, %v", name, err)
	}
	if err = old.QueryRow("SELECT name FROM records").Scan(&name); err != nil {
		t.Fatal("old database became unreadable")
	}
	if _, err = old.Exec("INSERT INTO records(name) VALUES ('old-after-migration')"); err != nil {
		t.Fatal(err)
	}
	var count int
	if err = newDB.QueryRow("SELECT count(*) FROM records").Scan(&count); err != nil || count != 1 {
		t.Fatal("new snapshot still depends on old live WAL")
	}
	if log, err := os.ReadFile(paths.Log); err != nil || string(log) != "old-log" {
		t.Fatal("old log not inherited")
	}
	if _, err = os.Stat(filepath.Join(paths.Directory, "initial-credentials.txt")); err != nil {
		t.Fatal("credential note not inherited")
	}
	if info, err := os.Stat(paths.Database); err != nil || info.Mode().Perm() != 0o600 {
		t.Fatal("new database has unsafe permissions")
	}
}

func TestPrepareAppDataNeverOverwritesNewDatabaseOrFiles(t *testing.T) {
	root := t.TempDir()
	_, source := legacyDatabase(t, root)
	newDir := filepath.Join(root, "primordialweave", "zhusuan")
	if err := os.MkdirAll(filepath.Join(newDir, "log"), 0o700); err != nil {
		t.Fatal(err)
	}
	target := filepath.Join(newDir, "zhusuan.db")
	if err := os.WriteFile(target, []byte("existing-new-data"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(filepath.Dir(source), "initial-credentials.txt"), []byte("old"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(newDir, "initial-credentials.txt"), []byte("new"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := PrepareAppData(root, true); err != nil {
		t.Fatal(err)
	}
	if data, err := os.ReadFile(target); err != nil || string(data) != "existing-new-data" {
		t.Fatal("existing database was overwritten")
	}
	if data, err := os.ReadFile(filepath.Join(newDir, "initial-credentials.txt")); err != nil || string(data) != "new" {
		t.Fatal("existing auxiliary data was overwritten")
	}
}

func TestExistingNewDatabaseDoesNotInheritUnrelatedOldCredentialNote(t *testing.T) {
	root := t.TempDir()
	_, source := legacyDatabase(t, root)
	if err := os.WriteFile(filepath.Join(filepath.Dir(source), "initial-credentials.txt"), []byte("old-account-note"), 0o600); err != nil {
		t.Fatal(err)
	}
	newDir := filepath.Join(root, "primordialweave", "zhusuan")
	if err := os.MkdirAll(newDir, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(newDir, "zhusuan.db"), []byte("new-data-is-authoritative"), 0o600); err != nil {
		t.Fatal(err)
	}
	paths, err := PrepareAppData(root, true)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = os.Stat(filepath.Join(paths.Directory, "initial-credentials.txt")); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("inherited credentials from an unrelated old database")
	}
}

func TestPrepareAppDataConcurrentStartupPublishesOneCompleteSnapshot(t *testing.T) {
	root := t.TempDir()
	legacyDatabase(t, root)
	var group sync.WaitGroup
	errors := make(chan error, 6)
	for range 6 {
		group.Add(1)
		go func() { defer group.Done(); _, err := PrepareAppData(root, true); errors <- err }()
	}
	group.Wait()
	close(errors)
	for err := range errors {
		if err != nil {
			t.Fatal(err)
		}
	}
	target := filepath.Join(root, "primordialweave", "zhusuan", "zhusuan.db")
	db, err := sql.Open(sqlite.DriverName, target)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := db.Close(); err != nil {
			t.Error(err)
		}
	}()
	var count int
	if err = db.QueryRow("SELECT count(*) FROM records").Scan(&count); err != nil || count != 1 {
		t.Fatal("concurrent migration published an incomplete database")
	}
}

func TestPrepareAppDataCorruptLegacyDatabaseDoesNotCreateEmptyReplacement(t *testing.T) {
	root := t.TempDir()
	legacy := filepath.Join(root, "FruitsAI", "Orange")
	if err := os.MkdirAll(legacy, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(legacy, "orange.db"), []byte("not-a-sqlite-database"), 0o600); err != nil {
		t.Fatal(err)
	}
	paths, err := PrepareAppData(root, true)
	if err == nil {
		t.Fatal("corrupt source accepted")
	}
	if _, err = os.Stat(paths.Database); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("failed migration published an empty database")
	}
	entries, err := os.ReadDir(paths.Directory)
	if err != nil {
		t.Fatal(err)
	}
	for _, entry := range entries {
		if entry.IsDir() && entry.Name() != "log" {
			t.Fatal("failed migration left temporary data")
		}
	}
}

func TestPrepareAppDataHonorsExplicitDatabaseSelection(t *testing.T) {
	root := t.TempDir()
	legacyDatabase(t, root)
	paths, err := PrepareAppData(root, false)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = os.Stat(paths.Database); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("explicit database selection triggered default database migration")
	}
	t.Setenv("ZHUSUAN_CONFIG_ROOT", root)
	t.Setenv("DB_PATH", filepath.Join(t.TempDir(), "custom with spaces.db"))
	t.Setenv("JWT_SECRET", "migration-test-secret-32-characters-long")
	Load()
	if AppConfig.DBPath != os.Getenv("DB_PATH") || AppConfig.DataDir != paths.Directory {
		t.Fatal("explicit path or new namespace lost")
	}
}

func TestLoadMigratesLegacyDatabaseForBlankDBPath(t *testing.T) {
	for _, tc := range []struct {
		name, value string
	}{
		{"empty", ""},
		{"spaces", "   "},
		{"mixed whitespace", " \t\r\n"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			root := t.TempDir()
			old, source := legacyDatabase(t, root)
			t.Setenv("ZHUSUAN_CONFIG_ROOT", root)
			t.Setenv("DB_PATH", tc.value)
			t.Setenv("JWT_SECRET", "migration-test-secret-32-characters-long")
			Load()

			expected := filepath.Join(root, "primordialweave", "zhusuan", "zhusuan.db")
			if AppConfig.DBPath != expected {
				t.Fatalf("blank DB_PATH selected %q, want new default %q", AppConfig.DBPath, expected)
			}
			migrated, err := sql.Open(sqlite.DriverName, AppConfig.DBPath)
			if err != nil {
				t.Fatal(err)
			}
			defer func() {
				if err := migrated.Close(); err != nil {
					t.Error(err)
				}
			}()
			var name string
			if err := migrated.QueryRow("SELECT name FROM records").Scan(&name); err != nil || name != "committed-in-wal" {
				t.Fatalf("legacy WAL record was not inherited: %q, %v", name, err)
			}
			if _, err := os.Stat(source); err != nil {
				t.Fatal("legacy source was removed:", err)
			}
			if _, err := old.Exec("INSERT INTO records(name) VALUES ('old-still-writable')"); err != nil {
				t.Fatal("legacy source was changed or locked:", err)
			}
		})
	}
}

func TestPrepareAppDataSkipsSymlinkAuxiliaryFiles(t *testing.T) {
	root := t.TempDir()
	_, source := legacyDatabase(t, root)
	unrelated := filepath.Join(t.TempDir(), "private-data")
	if err := os.WriteFile(unrelated, []byte("not-owned-by-migration"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(unrelated, filepath.Join(filepath.Dir(source), "initial-credentials.txt")); err != nil {
		t.Fatal(err)
	}
	paths, err := PrepareAppData(root, true)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = os.Stat(filepath.Join(paths.Directory, "initial-credentials.txt")); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("followed unrelated symbolic link")
	}
}

func TestPrepareAppDataAllowsQuotedFilesystemPaths(t *testing.T) {
	root := filepath.Join(t.TempDir(), "owner's config")
	legacyDatabase(t, root)
	if _, err := PrepareAppData(root, true); err != nil {
		t.Fatal(err)
	}
}

func TestMigrationWeakSecretBlacklistKeepsBothBrands(t *testing.T) {
	for _, secret := range []string{"orange-secret-key-change-in-production", "orange-runtime-secret-fallback-change-me", "zhusuan-secret-key-change-in-production", "zhusuan-runtime-secret-fallback-change-me"} {
		found := false
		for _, blocked := range knownWeakSecrets {
			if secret == blocked {
				found = true
			}
		}
		if !found {
			t.Fatal("historical weak secret was removed from the blacklist")
		}
	}
}
