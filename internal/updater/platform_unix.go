//go:build !windows

package updater

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

func detach(cmd *exec.Cmd) { cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true} }

func waitForExit(pid int, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for {
		err := syscall.Kill(pid, 0)
		if errors.Is(err, syscall.ESRCH) {
			return nil
		}
		if err != nil && !errors.Is(err, syscall.EPERM) {
			return err
		}
		if time.Now().After(deadline) {
			return errors.New("原应用未能退出，更新已取消")
		}
		time.Sleep(150 * time.Millisecond)
	}
}

func runInstaller(plan installPlan) error {
	var command string
	var args []string
	switch plan.Kind {
	case kindDeb:
		command, args = "dpkg", []string{"-i", plan.Package}
	case kindRPM:
		command, args = kindRPM, []string{"-U", plan.Package}
	default:
		return errors.New("不支持此安装包类型")
	}
	if os.Geteuid() != 0 {
		args = append([]string{command}, args...)
		command = "pkexec"
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()
	// Package-manager output is streamed to a bounded private log, never buffered in memory.
	log, err := os.OpenFile(filepath.Join(filepath.Dir(plan.WorkDir), "installer-last.log"), os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	defer closeRead(log)
	// #nosec G204 -- command is selected from fixed package managers; the package has a verified digest.
	cmd := exec.CommandContext(ctx, command, args...)
	output := &limitedLog{writer: log, remaining: 4 << 20}
	cmd.Stdout, cmd.Stderr = output, output
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("安装更新失败，请检查系统安装权限: %w", err)
	}
	return nil
}

type limitedLog struct {
	writer    io.Writer
	remaining int
}

func (log *limitedLog) Write(data []byte) (int, error) {
	keep := min(log.remaining, len(data))
	if keep > 0 {
		if _, err := log.writer.Write(data[:keep]); err != nil {
			return 0, err
		}
		log.remaining -= keep
	}
	return len(data), nil
}

func restartApplication(plan installPlan) error {
	if plan.Kind == kindDarwin {
		// #nosec G204 -- Fixed system launcher; target is the validated, installed app bundle.
		return exec.Command("/usr/bin/open", "-n", plan.Target).Run()
	}
	executable := plan.Executable
	switch plan.Kind {
	case kindAppImage:
		executable = plan.Target
	case kindDeb, kindRPM:
		current := filepath.Join(filepath.Dir(plan.Executable), executableName)
		if _, err := os.Stat(current); err == nil {
			executable = current
		}
	}
	// #nosec G204 -- Executable is the validated installed path; it is never supplied by HTTP.
	cmd := exec.Command(executable)
	if plan.Kind == kindAppImage {
		for _, env := range os.Environ() {
			if !strings.HasPrefix(env, "APPIMAGE=") && !strings.HasPrefix(env, "APPDIR=") {
				cmd.Env = append(cmd.Env, env)
			}
		}
	}
	detach(cmd)
	if err := cmd.Start(); err != nil {
		return err
	}
	return cmd.Process.Release()
}
