//go:build windows

package config

import (
	"errors"
	"os"
	"time"

	"golang.org/x/sys/windows"
)

func acquireMigrationLock(file *os.File, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for {
		var overlap windows.Overlapped
		err := windows.LockFileEx(windows.Handle(file.Fd()), windows.LOCKFILE_EXCLUSIVE_LOCK|windows.LOCKFILE_FAIL_IMMEDIATELY, 0, 1, 0, &overlap)
		if err == nil {
			return nil
		}
		if !errors.Is(err, windows.ERROR_LOCK_VIOLATION) {
			return err
		}
		if time.Now().After(deadline) {
			return errors.New("另一实例正在迁移数据，请稍后重试")
		}
		time.Sleep(25 * time.Millisecond)
	}
}
func releaseMigrationLock(file *os.File) {
	var overlap windows.Overlapped
	if err := windows.UnlockFileEx(windows.Handle(file.Fd()), 0, 1, 0, &overlap); err != nil {
		logMigrationCleanup(err)
	}
}
