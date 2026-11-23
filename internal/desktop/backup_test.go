package desktop

import (
	"database/sql"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	_ "github.com/glebarez/go-sqlite"
	"github.com/stretchr/testify/require"
	"github.com/wailsapp/wails/v3/pkg/application"
)

func TestSQLiteVacuumAutoBackupIncludesWALAndRotates(t *testing.T) {
	dataDir := t.TempDir()
	dbPath := filepath.Join(dataDir, "zhusuan.db")

	db, err := sql.Open("sqlite", dbPath)
	require.NoError(t, err)
	defer db.Close()

	_, err = db.Exec(`PRAGMA journal_mode=WAL; CREATE TABLE ledger (id INTEGER PRIMARY KEY, note TEXT); INSERT INTO ledger (note) VALUES ('row-1');`)
	require.NoError(t, err)

	vacuumFn := func(destPath string) error {
		_, execErr := db.Exec("VACUUM INTO ?", destPath)
		return execErr
	}

	// Place a non-auto file in the folder to ensure rotation never removes unrelated files.
	backupDir := AutoBackupDir(dataDir)
	require.NoError(t, os.MkdirAll(backupDir, 0o700))
	manualKeep := filepath.Join(backupDir, "manual-keep.db")
	require.NoError(t, os.WriteFile(manualKeep, []byte("keep"), 0o600))

	base := time.Date(2026, 11, 20, 9, 0, 0, 0, time.Local)
	var latest BackupInfo
	for i := 0; i < 4; i++ {
		latest, err = CreateAutoBackup(dataDir, 2, base.AddDate(0, 0, i), vacuumFn)
		require.NoError(t, err)
	}
	require.Equal(t, 2, latest.Count)

	stat, err := os.Stat(latest.Path)
	require.NoError(t, err)
	if runtime.GOOS != platformWindows {
		require.Equal(t, os.FileMode(0o600), stat.Mode().Perm())
	}
	require.Greater(t, stat.Size(), int64(0))

	// Unrelated manual file must still exist.
	_, err = os.Stat(manualKeep)
	require.NoError(t, err)

	// Verify snapshot integrity and WAL data visibility.
	snapDB, err := sql.Open("sqlite", latest.Path)
	require.NoError(t, err)
	defer snapDB.Close()

	var integrity string
	require.NoError(t, snapDB.QueryRow("PRAGMA integrity_check").Scan(&integrity))
	require.Equal(t, "ok", integrity)

	var note string
	require.NoError(t, snapDB.QueryRow("SELECT note FROM ledger WHERE id = 1").Scan(&note))
	require.Equal(t, "row-1", note)
}

func TestScheduledDailyAutoBackupRunsOncePerDay(t *testing.T) {
	m, store := newTestDesktopManager(t, "darwin", true)
	dataDir := t.TempDir()
	now := time.Date(2026, 11, 23, 10, 0, 0, 0, time.Local)
	m.now = func() time.Time { return now }

	runs := 0
	m.SetBackupProvider(dataDir, func(destPath string) error {
		runs++
		return os.WriteFile(destPath, []byte("sqlite-bytes"), 0o600)
	})

	enabled := true
	_, err := m.UpdatePreferences(PreferencesPatch{AutoBackupEnabled: &enabled})
	require.NoError(t, err)

	m.RunScheduledChecks()
	require.Equal(t, 1, runs)
	require.Equal(t, "2026-11-23", store.Get().LastBackupDate)

	// Same day check does not repeat.
	m.RunScheduledChecks()
	require.Equal(t, 1, runs)

	// Next day runs again.
	now = now.AddDate(0, 0, 1)
	m.RunScheduledChecks()
	require.Equal(t, 2, runs)
	require.Equal(t, "2026-11-24", store.Get().LastBackupDate)
}

func TestLaunchActionRoutingColdAndSecondInstance(t *testing.T) {
	require.Equal(t, "/payment/create", ParseLaunchActionRoute([]string{"--action=quick-receipt"}))
	require.Equal(t, "/projects/create", ParseLaunchActionRoute([]string{"--action", "new-project"}))
	require.Equal(t, "/calendar", ParseLaunchActionRoute([]string{"--action=calendar"}))
	require.Equal(t, "", ParseLaunchActionRoute([]string{"--action=unknown"}))

	m, _ := newTestDesktopManager(t, "windows", true)
	m.SetInitialLaunchArgs([]string{"--action=quick-receipt"})
	require.Equal(t, "/payment/create", m.ConsumePendingRoute())
	require.Equal(t, "", m.ConsumePendingRoute())

	var shown bool
	var navigated string
	m.showMainWindow = func() { shown = true }
	m.emitEvent = func(name string, data any) {
		if name == EventNavigate {
			if payload, ok := data.(map[string]any); ok {
				navigated, _ = payload["path"].(string)
			}
		}
	}

	m.HandleSecondInstance(application.SecondInstanceData{
		Args: []string{"zhusuan.exe", "--action=calendar"},
	})
	require.True(t, shown)
	require.Equal(t, "/calendar", navigated)
}
