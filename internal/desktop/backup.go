package desktop

import (
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"time"
)

var autoBackupNamePattern = regexp.MustCompile(`^zhusuan-auto-([0-9]{8}-[0-9]{6})(-[0-9]+)?\.db$`)

const (
	// DefaultAutoBackupRetention is the default number of automatic local snapshots retained.
	DefaultAutoBackupRetention = 7
	// MinAutoBackupRetention is the minimum allowed retention count.
	MinAutoBackupRetention = 1
	// MaxAutoBackupRetention is the maximum allowed retention count.
	MaxAutoBackupRetention = 30

	autoBackupPrefix = "zhusuan-auto-"
	autoBackupSuffix = ".db"
)

// BackupInfo describes a completed snapshot and current local backup folder state.
type BackupInfo struct {
	FileName  string `json:"fileName"`
	Path      string `json:"path"`
	SizeBytes int64  `json:"sizeBytes"`
	CreatedAt string `json:"createdAt"`
	Count     int    `json:"count"`
	BackupDir string `json:"backupDir"`
}

// SQLiteVacuumFunc executes `VACUUM INTO ?` against the active SQLite connection so backups are
// transactionally consistent and include all committed WAL frames.
type SQLiteVacuumFunc func(destPath string) error

// AutoBackupDir returns the private auto-backup directory under dataDir.
func AutoBackupDir(dataDir string) string {
	return filepath.Join(dataDir, "backups", "auto")
}

// CreateAutoBackup writes an atomic SQLite snapshot using vacuumFn and rotates older auto backups.
func CreateAutoBackup(dataDir string, retention int, now time.Time, vacuumFn SQLiteVacuumFunc) (BackupInfo, error) {
	if vacuumFn == nil || strings.TrimSpace(dataDir) == "" {
		return BackupInfo{}, fmt.Errorf("当前数据库模式不支持本地自动快照备份")
	}
	retention = clampBackupRetention(retention)
	backupDir := AutoBackupDir(dataDir)
	if err := os.MkdirAll(backupDir, 0o700); err != nil {
		return BackupInfo{}, fmt.Errorf("创建备份目录失败: %w", err)
	}

	stamp := now.Format("20060102-150405")
	stage, err := os.MkdirTemp(backupDir, "."+autoBackupPrefix+stamp+"-")
	if err != nil {
		return BackupInfo{}, fmt.Errorf("创建快照暂存目录失败: %w", err)
	}
	defer func() {
		if err := os.RemoveAll(stage); err != nil {
			slog.Debug("Unable to clean backup staging directory", "error", err)
		}
	}()
	unique := strings.TrimPrefix(filepath.Base(stage), "."+autoBackupPrefix+stamp+"-")
	finalName := autoBackupPrefix + stamp + "-" + unique + autoBackupSuffix
	finalPath := filepath.Join(backupDir, finalName)
	if _, err := os.Lstat(finalPath); err == nil {
		return BackupInfo{}, fmt.Errorf("快照文件名已存在，请重试")
	} else if !os.IsNotExist(err) {
		return BackupInfo{}, err
	}
	tmpPath := filepath.Join(stage, "snapshot.db")

	if err := vacuumFn(tmpPath); err != nil {
		return BackupInfo{}, fmt.Errorf("生成数据库快照失败: %w", err)
	}
	if err := os.Chmod(tmpPath, 0o600); err != nil {
		return BackupInfo{}, fmt.Errorf("设置快照权限失败: %w", err)
	}
	if err := os.Rename(tmpPath, finalPath); err != nil {
		return BackupInfo{}, fmt.Errorf("保存快照文件失败: %w", err)
	}

	info, err := os.Stat(finalPath)
	if err != nil {
		return BackupInfo{}, err
	}
	remaining, err := rotateAutoBackups(backupDir, retention, finalName)
	if err != nil {
		return BackupInfo{}, err
	}

	return BackupInfo{
		FileName:  finalName,
		Path:      finalPath,
		SizeBytes: info.Size(),
		CreatedAt: now.Format(time.RFC3339),
		Count:     remaining,
		BackupDir: backupDir,
	}, nil
}

func rotateAutoBackups(backupDir string, retention int, keepName string) (int, error) {
	entries, err := os.ReadDir(backupDir)
	if err != nil {
		return 0, fmt.Errorf("读取备份目录失败: %w", err)
	}
	var names []string
	for _, entry := range entries {
		if entry.IsDir() || entry.Type()&os.ModeSymlink != 0 {
			continue
		}
		name := entry.Name()
		match := autoBackupNamePattern.FindStringSubmatch(name)
		if match == nil {
			continue
		}
		if _, err := time.Parse("20060102-150405", match[1]); err != nil {
			continue
		}
		names = append(names, name)
	}
	// Newest lexicographical timestamp first.
	sort.Slice(names, func(i, j int) bool {
		if names[i] == keepName || names[j] == keepName {
			return names[i] == keepName
		}
		return names[i] > names[j]
	})
	if len(names) > retention {
		for _, stale := range names[retention:] {
			if err := os.Remove(filepath.Join(backupDir, stale)); err != nil {
				return 0, fmt.Errorf("删除旧自动快照失败: %w", err)
			}
		}
		names = names[:retention]
	}
	return len(names), nil
}

func clampBackupRetention(value int) int {
	if value < MinAutoBackupRetention {
		return DefaultAutoBackupRetention
	}
	if value > MaxAutoBackupRetention {
		return MaxAutoBackupRetention
	}
	return value
}

func openDirectoryInFileManager(dir string) error {
	dir, err := filepath.Abs(dir)
	if err != nil {
		return fmt.Errorf("解析备份目录失败: %w", err)
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return fmt.Errorf("准备备份目录失败: %w", err)
	}
	var command *exec.Cmd
	switch runtime.GOOS {
	case platformDarwin:
		command = exec.Command("open", "--", dir) // #nosec G204 -- Fixed native opener and absolute directory; no shell.
	case platformWindows:
		command = exec.Command("explorer", dir) // #nosec G204 -- Fixed native opener and absolute directory; no shell.
	case platformLinux:
		command = exec.Command("xdg-open", dir) // #nosec G204 -- Fixed native opener and absolute directory; no shell.
	default:
		return fmt.Errorf("当前平台不支持打开本地目录")
	}
	if err := command.Start(); err != nil {
		return err
	}
	go func() {
		if err := command.Wait(); err != nil {
			slog.Debug("Native file manager exited with an error", "error", err)
		}
	}()
	return nil
}
