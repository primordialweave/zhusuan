//go:build !windows

package config

import (
	"errors"
	"os"
	"syscall"
	"time"
)

func acquireMigrationLock(file *os.File, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for {
		err := syscall.Flock(int(file.Fd()), syscall.LOCK_EX|syscall.LOCK_NB)
		if err == nil {
			return nil
		}
		if !errors.Is(err, syscall.EWOULDBLOCK) && !errors.Is(err, syscall.EAGAIN) {
			return err
		}
		if time.Now().After(deadline) {
			return errors.New("另一实例正在迁移数据，请稍后重试")
		}
		time.Sleep(25 * time.Millisecond)
	}
}
func releaseMigrationLock(file *os.File) {
	if err := syscall.Flock(int(file.Fd()), syscall.LOCK_UN); err != nil {
		logMigrationCleanup(err)
	}
}
