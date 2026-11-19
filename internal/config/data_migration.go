package config

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/glebarez/sqlite"
)

// DataPaths identifies the current application's private data locations.
type DataPaths struct {
	Directory string
	Database  string
	Log       string
}

// PrepareAppData creates the new namespace and inherits only missing legacy data.
// Explicit database paths can disable the default SQLite migration.
func PrepareAppData(configRoot string, migrateDatabase bool) (DataPaths, error) {
	paths := DataPaths{Directory: filepath.Join(configRoot, "primordialweave", "zhusuan")}
	paths.Database = filepath.Join(paths.Directory, "zhusuan.db")
	paths.Log = filepath.Join(paths.Directory, "log", "zhusuan.log")
	if !filepath.IsAbs(configRoot) {
		return paths, errors.New("配置根目录必须是绝对路径")
	}
	if err := os.MkdirAll(filepath.Dir(paths.Log), 0o700); err != nil {
		return paths, fmt.Errorf("无法创建珠算数据目录: %w", err)
	}
	lock, err := os.OpenFile(filepath.Join(paths.Directory, ".migration.lock"), os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return paths, err
	}
	defer closeMigrationFile(lock)
	if err = acquireMigrationLock(lock, 10*time.Second); err != nil {
		return paths, err
	}
	defer releaseMigrationLock(lock)
	if migrateDatabase {
		if exists, checkErr := migrationDestinationExists(paths.Database); exists || checkErr != nil {
			return paths, checkErr
		}
	}
	legacy := filepath.Join(configRoot, "FruitsAI", "Orange")
	// Auxiliary files are published before the database, so a completed database migration
	// never makes another concurrent startup skip unfinished auxiliary migration.
	if migrateDatabase {
		if err = inheritDataFile(filepath.Join(legacy, "initial-credentials.txt"), filepath.Join(paths.Directory, "initial-credentials.txt")); err != nil {
			return paths, err
		}
	}
	if err = inheritLegacyLogs(filepath.Join(legacy, "log"), filepath.Dir(paths.Log)); err != nil {
		return paths, err
	}
	if err = inheritDataFile(filepath.Join(legacy, "orange.log"), paths.Log); err != nil {
		return paths, err
	}
	if migrateDatabase {
		if err = inheritSQLite(filepath.Join(legacy, "orange.db"), paths.Database); err != nil {
			return paths, fmt.Errorf("旧项目数据库迁移失败，旧库已保留: %w", err)
		}
	}
	return paths, nil
}

func inheritLegacyLogs(source, destination string) error {
	entries, err := os.ReadDir(source)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if !entry.Type().IsRegular() {
			continue
		}
		name := entry.Name()
		if name == "orange.log" {
			name = "zhusuan.log"
		}
		if err = inheritDataFile(filepath.Join(source, entry.Name()), filepath.Join(destination, name)); err != nil {
			return err
		}
	}
	return nil
}

func inheritDataFile(source, destination string) error {
	if exists, err := migrationDestinationExists(destination); exists || err != nil {
		return err
	}
	info, err := os.Lstat(source)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	if !info.Mode().IsRegular() {
		return nil
	}
	input, err := os.Open(source)
	if err != nil {
		return err
	}
	defer closeMigrationFile(input)
	inputInfo, err := input.Stat()
	if err != nil {
		return err
	}
	dir, err := os.MkdirTemp(filepath.Dir(destination), ".legacy-file-")
	if err != nil {
		return err
	}
	defer removeMigrationDirectory(dir)
	stage := filepath.Join(dir, "data")
	output, err := os.OpenFile(stage, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	_, err = io.CopyN(output, input, inputInfo.Size())
	if syncErr := output.Sync(); err == nil {
		err = syncErr
	}
	if closeErr := output.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		return err
	}
	return publishMigratedFile(stage, destination)
}

func inheritSQLite(source, destination string) error {
	if exists, err := migrationDestinationExists(destination); exists || err != nil {
		return err
	}
	info, err := os.Stat(source)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	if !info.Mode().IsRegular() {
		return errors.New("旧数据库不是普通文件")
	}
	dir, err := os.MkdirTemp(filepath.Dir(destination), ".legacy-database-")
	if err != nil {
		return err
	}
	defer removeMigrationDirectory(dir)
	stage := filepath.Join(dir, "snapshot.db")
	sourcePath := filepath.ToSlash(source)
	if !strings.HasPrefix(sourcePath, "/") {
		sourcePath = "/" + sourcePath
	}
	u := url.URL{Scheme: "file", Path: sourcePath}
	query := url.Values{"mode": []string{"ro"}, "_pragma": []string{"busy_timeout(5000)"}}
	u.RawQuery = query.Encode()
	db, err := sql.Open(sqlite.DriverName, u.String())
	if err != nil {
		return err
	}
	db.SetMaxOpenConns(1)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	_, copyErr := db.ExecContext(ctx, "VACUUM INTO ?", stage)
	closeErr := db.Close()
	if copyErr != nil {
		return copyErr
	}
	if closeErr != nil {
		return closeErr
	}
	if err = os.Chmod(stage, 0o600); err != nil {
		return err
	}
	file, err := os.OpenFile(stage, os.O_RDWR, 0)
	if err != nil {
		return err
	}
	syncErr := file.Sync()
	closeErr = file.Close()
	if syncErr != nil {
		return syncErr
	}
	if closeErr != nil {
		return closeErr
	}
	return publishMigratedFile(stage, destination)
}

func migrationDestinationExists(path string) (bool, error) {
	info, err := os.Lstat(path)
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if info.IsDir() {
		return true, errors.New("迁移目标被目录占用")
	}
	return true, nil
}

func publishMigratedFile(source, destination string) error {
	// A same-filesystem hard link atomically publishes a complete file without replacement.
	if err := os.Link(source, destination); err != nil && !errors.Is(err, os.ErrExist) {
		return err
	}
	return nil
}

func closeMigrationFile(file *os.File) {
	if err := file.Close(); err != nil {
		logMigrationCleanup(err)
	}
}
func removeMigrationDirectory(path string) {
	if err := os.RemoveAll(path); err != nil {
		logMigrationCleanup(err)
	}
}
