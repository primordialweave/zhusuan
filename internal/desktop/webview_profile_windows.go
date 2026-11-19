//go:build windows

package desktop

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

// PrepareWebviewProfile migrates the retired executable's closed WebView2 profile once.
func PrepareWebviewProfile(destination string) error {
	if _, err := os.Stat(destination); err == nil {
		return nil
	}
	configRoot, err := os.UserConfigDir()
	if err != nil {
		return err
	}
	source := filepath.Join(configRoot, "Orange.exe")
	if _, err := os.Stat(source); errors.Is(err, os.ErrNotExist) {
		return nil
	}
	running, err := legacyOrangeRunning()
	if err != nil {
		return err
	}
	if running {
		return errors.New("请关闭旧版 Orange 后再启动珠算，浏览器配置尚未迁移")
	}
	locks := []string{
		filepath.Join(source, "EBWebView", "Default", "Local Storage", "leveldb", "LOCK"),
		filepath.Join(source, "Default", "Local Storage", "leveldb", "LOCK"),
	}
	var handles []windows.Handle
	defer func() {
		for _, handle := range handles {
			_ = windows.CloseHandle(handle)
		}
	}()
	for _, lock := range locks {
		if _, err := os.Stat(lock); errors.Is(err, os.ErrNotExist) {
			continue
		}
		path, err := windows.UTF16PtrFromString(lock)
		if err != nil {
			return err
		}
		deadline := time.Now().Add(5 * time.Second)
		for {
			handle, err := windows.CreateFile(path, windows.GENERIC_READ|windows.GENERIC_WRITE, 0, nil, windows.OPEN_EXISTING, windows.FILE_ATTRIBUTE_NORMAL, 0)
			if err == nil {
				handles = append(handles, handle)
				break
			}
			if time.Now().After(deadline) {
				return errors.New("请关闭旧版 Orange 后再启动珠算，浏览器配置尚未迁移")
			}
			time.Sleep(100 * time.Millisecond)
		}
	}
	return copyWebviewProfile(source, destination)
}

func legacyOrangeRunning() (bool, error) {
	current, err := windows.GetCurrentProcessToken().GetTokenUser()
	if err != nil {
		return false, err
	}
	snapshot, err := windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPPROCESS, 0)
	if err != nil {
		return false, err
	}
	defer windows.CloseHandle(snapshot) //nolint:errcheck // Process snapshot handle cleanup.
	entry := windows.ProcessEntry32{}
	entry.Size = uint32(unsafe.Sizeof(entry))
	for err = windows.Process32First(snapshot, &entry); err == nil; err = windows.Process32Next(snapshot, &entry) {
		if !strings.EqualFold(windows.UTF16ToString(entry.ExeFile[:]), "Orange.exe") {
			continue
		}
		sameUser, checkErr := processOwnedBy(entry.ProcessID, current.User.Sid)
		if checkErr != nil {
			return true, nil
		} // Cannot prove a legacy process is unrelated: do not clone.
		if sameUser {
			return true, nil
		}
	}
	if !errors.Is(err, windows.ERROR_NO_MORE_FILES) {
		return false, err
	}
	return false, nil
}

func processOwnedBy(pid uint32, sid *windows.SID) (bool, error) {
	process, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
	if errors.Is(err, windows.ERROR_INVALID_PARAMETER) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	defer windows.CloseHandle(process) //nolint:errcheck // Process query handle cleanup.
	var token windows.Token
	if err := windows.OpenProcessToken(process, windows.TOKEN_QUERY, &token); err != nil {
		return false, err
	}
	defer token.Close() //nolint:errcheck // Read-only identity query handle cleanup.
	user, err := token.GetTokenUser()
	if err != nil {
		return false, err
	}
	return sid.Equals(user.User.Sid), nil
}
