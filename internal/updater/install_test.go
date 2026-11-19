package updater

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type archiveEntry struct {
	name, content string
	mode          os.FileMode
}

func appArchive(t *testing.T, entries ...archiveEntry) []byte {
	t.Helper()
	var buffer bytes.Buffer
	writer := zip.NewWriter(&buffer)
	for _, entry := range entries {
		header := &zip.FileHeader{Name: entry.name, Method: zip.Deflate}
		mode := entry.mode
		if mode == 0 {
			mode = 0o644
		}
		header.SetMode(mode)
		file, err := writer.CreateHeader(header)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := file.Write([]byte(entry.content)); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	return buffer.Bytes()
}

func extractArchive(t *testing.T, directory string, entries ...archiveEntry) error {
	t.Helper()
	archive := filepath.Join(t.TempDir(), "zhusuan.zip")
	if err := os.WriteFile(archive, appArchive(t, entries...), 0o600); err != nil {
		t.Fatal(err)
	}
	return extractApp(context.Background(), archive, directory)
}

func TestAppArchiveRejectsTraversalAndSymlinkEscape(t *testing.T) {
	for _, tc := range []struct {
		name    string
		entries []archiveEntry
	}{
		{"parent traversal", []archiveEntry{{name: "zhusuan.app/../../outside", content: "bad"}}},
		{"outside app", []archiveEntry{{name: "another.app/executable", content: "bad"}}},
		{"backslash path", []archiveEntry{{name: `zhusuan.app\Contents\bad`, content: "bad"}}},
		{"absolute symlink", []archiveEntry{{name: "zhusuan.app/link", content: "/tmp", mode: os.ModeSymlink | 0o777}}},
		{"relative symlink escape", []archiveEntry{{name: "zhusuan.app/link", content: "../outside", mode: os.ModeSymlink | 0o777}}},
		{"write through earlier link", []archiveEntry{
			{name: "zhusuan.app/link", content: "Contents", mode: os.ModeSymlink | 0o777},
			{name: "zhusuan.app/link/file", content: "bad"},
		}},
		{"duplicate entry", []archiveEntry{{name: "zhusuan.app/file", content: "first"}, {name: "zhusuan.app/file", content: "second"}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			root := t.TempDir()
			if err := extractArchive(t, root, tc.entries...); err == nil {
				t.Fatal("unsafe archive was accepted")
			}
		})
	}
}

func TestAppArchiveRejectsExistingSymlinkParent(t *testing.T) {
	root, outside := t.TempDir(), t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "zhusuan.app"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(root, "zhusuan.app", "Contents")); err != nil {
		t.Fatal(err)
	}
	if err := extractArchive(t, root, archiveEntry{name: "zhusuan.app/Contents/escape", content: "bad"}); err == nil {
		t.Fatal("wrote through preexisting symlink")
	}
	if _, err := os.Stat(filepath.Join(outside, "escape")); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("escaped extraction directory")
	}
}

func TestAppArchiveKeepsInternalFrameworkSymlinksAndExecutablePermissions(t *testing.T) {
	root := t.TempDir()
	if err := extractArchive(t, root,
		archiveEntry{name: "__MACOSX/", mode: os.ModeDir | 0o755},
		archiveEntry{name: "__MACOSX/zhusuan.app/._Contents", content: "ditto metadata"},
		archiveEntry{name: "zhusuan.app/Contents/MacOS/zhusuan", content: "binary", mode: 0o777},
		archiveEntry{name: "zhusuan.app/Contents/Frameworks/Widget/Versions/A/Widget", content: "framework"},
		archiveEntry{name: "zhusuan.app/Contents/Frameworks/Widget/Versions/Current", content: "A", mode: os.ModeSymlink | 0o777},
		archiveEntry{name: "zhusuan.app/Contents/Frameworks/Widget/Widget", content: "Versions/Current/Widget", mode: os.ModeSymlink | 0o777},
	); err != nil {
		t.Fatal(err)
	}
	content, err := os.ReadFile(filepath.Join(root, "zhusuan.app", "Contents", "Frameworks", "Widget", "Widget"))
	if err != nil || string(content) != "framework" {
		t.Fatalf("framework link = %q, error %v", content, err)
	}
	info, err := os.Stat(filepath.Join(root, "zhusuan.app", "Contents", "MacOS", "zhusuan"))
	if err != nil || info.Mode().Perm() != 0o755 {
		t.Fatalf("executable permissions = %v, error %v", info, err)
	}
}

func testInstallPlan(t *testing.T) installPlan {
	t.Helper()
	root := t.TempDir()
	stageRoot := filepath.Join(root, ".zhusuan-update-test")
	work := filepath.Join(root, "cache", "update-test")
	if err := os.MkdirAll(stageRoot, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(work, 0o700); err != nil {
		t.Fatal(err)
	}
	plan := installPlan{Kind: "appimage", Target: filepath.Join(root, "zhusuan.AppImage"),
		Staged: filepath.Join(stageRoot, "zhusuan.AppImage"), WorkDir: work,
		ResultPath: filepath.Join(root, "cache", "result.json"), Version: "1.1.0"}
	plan.Executable, plan.Package = plan.Target, filepath.Join(work, "zhusuan-v1.1.0-linux-x86_64.AppImage")
	if err := os.WriteFile(plan.Target, []byte("old application"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(plan.Staged, []byte("new application"), 0o755); err != nil {
		t.Fatal(err)
	}
	return plan
}

func TestReplacementInstallsInPlaceAndKeepsOldVersionUntilRestart(t *testing.T) {
	plan := testInstallPlan(t)
	restarted := false
	err := installAndRestart(plan, func(installPlan) error { t.Fatal("unexpected system installer"); return nil }, func(plan installPlan) error {
		restarted = true
		old, err := os.ReadFile(filepath.Join(filepath.Dir(plan.Staged), "previous"))
		if err != nil || string(old) != "old application" {
			t.Error("old backup removed before successful restart")
		}
		got, err := os.ReadFile(plan.Target)
		if err != nil || string(got) != "new application" {
			t.Error("new application not installed in original location")
		}
		return nil
	})
	if err != nil || !restarted {
		t.Fatalf("install failed: %v", err)
	}
	if _, err := os.Stat(filepath.Join(filepath.Dir(plan.Staged), "previous")); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("old backup kept after successful restart")
	}
}

func TestReplacementFailureRestoresAndRestartsOldApplication(t *testing.T) {
	for _, tc := range []struct {
		name                        string
		failReplace, failOldRestart bool
	}{
		{"failed replacement", true, false}, {"failed new restart", false, false}, {"both restarts fail", false, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			plan := testInstallPlan(t)
			if tc.failReplace {
				if err := os.Remove(plan.Staged); err != nil {
					t.Fatal(err)
				}
			}
			calls := 0
			err := installAndRestart(plan, func(installPlan) error { t.Fatal("unexpected system installer"); return nil }, func(plan installPlan) error {
				calls++
				content, readErr := os.ReadFile(plan.Target)
				if readErr != nil {
					return readErr
				}
				if string(content) == "new application" {
					return errors.New("new application failed to launch")
				}
				if string(content) != "old application" {
					t.Error("restart did not receive restored old application")
				}
				if tc.failOldRestart {
					return errors.New("old application failed to launch")
				}
				return nil
			})
			if err == nil {
				t.Fatal("failed installation reported success")
			}
			if tc.failOldRestart && !strings.Contains(err.Error(), "旧应用重启失败") {
				t.Fatalf("lost restart failure: %v", err)
			}
			wantCalls := 2
			if tc.failReplace {
				wantCalls = 1
			}
			if calls != wantCalls {
				t.Fatalf("restart calls=%d, want %d", calls, wantCalls)
			}
			content, readErr := os.ReadFile(plan.Target)
			if readErr != nil || string(content) != "old application" {
				t.Fatalf("old version lost: %q, %v", content, readErr)
			}
			data, readErr := os.ReadFile(plan.ResultPath)
			var result installResult
			if readErr != nil || json.Unmarshal(data, &result) != nil || result.Success {
				t.Fatal("failure result not persisted")
			}
			if tc.failOldRestart && !strings.Contains(result.Message, "旧应用重启失败") {
				t.Fatalf("persisted failure omitted restart failure: %s", result.Message)
			}
		})
	}
}

func TestRestartFailurePreservesBackupWhenRollbackCannotStart(t *testing.T) {
	plan := testInstallPlan(t)
	err := installAndRestart(plan, func(installPlan) error { return nil }, func(plan installPlan) error {
		// A directory at the old staging path forces the rollback rename to fail.
		if err := os.Mkdir(plan.Staged, 0o700); err != nil {
			return err
		}
		return errors.New("new application failed to launch")
	})
	backup := filepath.Join(filepath.Dir(plan.Staged), "previous")
	if err == nil || !strings.Contains(err.Error(), backup) {
		t.Fatalf("missing manual recovery path: %v", err)
	}
	content, readErr := os.ReadFile(backup)
	if readErr != nil || string(content) != "old application" {
		t.Fatalf("recovery copy lost: %q %v", content, readErr)
	}
	cleanupHelper(plan)
	content, readErr = os.ReadFile(backup)
	if readErr != nil || string(content) != "old application" {
		t.Fatalf("helper cleanup deleted recovery copy: %q %v", content, readErr)
	}
	if _, err := os.Stat(plan.WorkDir); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("helper left disposable download cache")
	}
}

func TestHelperCleanupRemovesStageAfterSuccessfulReplacement(t *testing.T) {
	plan := testInstallPlan(t)
	if err := installAndRestart(plan, func(installPlan) error { return nil }, func(installPlan) error { return nil }); err != nil {
		t.Fatal(err)
	}
	cleanupHelper(plan)
	for _, directory := range []string{plan.WorkDir, filepath.Dir(plan.Staged)} {
		if _, err := os.Stat(directory); !errors.Is(err, os.ErrNotExist) {
			t.Fatalf("helper did not clean directory %s", directory)
		}
	}
	content, err := os.ReadFile(plan.Target)
	if err != nil || string(content) != "new application" {
		t.Fatal("cleanup deleted newly installed application")
	}
}

func TestSystemInstallerFailureRestartsExistingApplication(t *testing.T) {
	plan := testInstallPlan(t)
	plan.Kind = "deb"
	restarted := false
	err := installAndRestart(plan, func(installPlan) error { return errors.New("package installation denied") }, func(plan installPlan) error {
		restarted = true
		content, err := os.ReadFile(plan.Target)
		if err != nil || string(content) != "old application" {
			t.Error("installer failure changed existing application")
		}
		return nil
	})
	if err == nil || !restarted {
		t.Fatalf("installer failure not recovered: %v", err)
	}
}
