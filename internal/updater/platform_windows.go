//go:build windows

package updater

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

func detach(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: windows.CREATE_NEW_PROCESS_GROUP | 0x00000008}
}

func waitForExit(pid int, timeout time.Duration) error {
	handle, err := windows.OpenProcess(windows.SYNCHRONIZE, false, uint32(pid))
	if errors.Is(err, windows.ERROR_INVALID_PARAMETER) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("无法等待原应用退出: %w", err)
	}
	defer windows.CloseHandle(handle)
	result, err := windows.WaitForSingleObject(handle, uint32(timeout/time.Millisecond))
	if err != nil {
		return err
	}
	if result != windows.WAIT_OBJECT_0 {
		return errors.New("原应用未能退出，更新已取消")
	}
	return nil
}

type shellExecuteInfo struct {
	size       uint32
	mask       uint32
	window     windows.Handle
	verb       *uint16
	file       *uint16
	parameters *uint16
	directory  *uint16
	show       int32
	instance   windows.Handle
	idList     uintptr
	class      *uint16
	classKey   windows.Handle
	hotKey     uint32
	icon       windows.Handle
	process    windows.Handle
}

func windowsMachineInstallDirectories() []string {
	const uninstallKey = `Software\Microsoft\Windows\CurrentVersion\Uninstall\PrimordialWeaveZhusuan`
	var directories []string
	for _, view := range []uint32{registry.WOW64_64KEY, registry.WOW64_32KEY} {
		key, err := registry.OpenKey(registry.LOCAL_MACHINE, uninstallKey, registry.QUERY_VALUE|view)
		if err != nil {
			continue
		}
		for _, name := range []string{"InstallLocation", ""} {
			if value, _, readErr := key.GetStringValue(name); readErr == nil && value != "" {
				directories = append(directories, value)
			}
		}
		for _, name := range []string{"DisplayIcon", "UninstallString"} {
			if value, _, readErr := key.GetStringValue(name); readErr == nil {
				if directory := windowsRegistrationCommandDirectory(value); directory != "" {
					directories = append(directories, directory)
				}
			}
		}
		if closeErr := key.Close(); closeErr != nil {
			slog.Warn("Unable to close Windows installer registration", "error", closeErr)
		}
	}
	return directories
}

func runInstaller(plan installPlan) error {
	if plan.Kind != kindWindows {
		return errors.New("不支持此安装包类型")
	}
	verb, _ := windows.UTF16PtrFromString(windowsInstallerVerb(plan.Target, windowsMachineInstallDirectories(), []string{
		os.Getenv("ProgramW6432"), os.Getenv("ProgramFiles"), os.Getenv("ProgramFiles(x86)"),
	}))
	file, err := windows.UTF16PtrFromString(plan.Package)
	if err != nil {
		return err
	}
	// NSIS /D consumes the rest of the command line and must be last, without quotes.
	parameters, err := windows.UTF16PtrFromString("/S /UPDATE /D=" + plan.Target)
	if err != nil {
		return err
	}
	info := shellExecuteInfo{mask: 0x00000040 | 0x00000100, verb: verb, file: file, parameters: parameters}
	info.size = uint32(unsafe.Sizeof(info))
	proc := windows.NewLazySystemDLL("shell32.dll").NewProc("ShellExecuteExW")
	ok, _, callErr := proc.Call(uintptr(unsafe.Pointer(&info)))
	if ok == 0 {
		return fmt.Errorf("安装更新未获授权或无法启动: %v", callErr)
	}
	if info.process == 0 {
		return errors.New("无法等待更新安装器")
	}
	defer windows.CloseHandle(info.process)
	result, err := windows.WaitForSingleObject(info.process, windows.INFINITE)
	if err != nil || result != windows.WAIT_OBJECT_0 {
		return errors.New("更新安装器执行失败")
	}
	var exitCode uint32
	if err = windows.GetExitCodeProcess(info.process, &exitCode); err != nil {
		return err
	}
	if exitCode != 0 {
		return fmt.Errorf("更新安装失败 (退出码 %d)，已保留旧应用", exitCode)
	}
	return nil
}

func restartApplication(plan installPlan) error {
	executable := filepath.Join(plan.Target, executableName+".exe")
	if _, err := os.Stat(executable); err != nil {
		executable = plan.Executable
	}
	cmd := exec.Command(executable)
	if err := cmd.Start(); err != nil {
		return err
	}
	return cmd.Process.Release()
}
