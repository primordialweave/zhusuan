package desktop

import (
	"errors"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// FileExporter writes files the user exports from the desktop webview. WKWebView ignores
// download links, so the webview hands the content over and the user picks where it goes.
// It is exposed through Wails bindings, never through the HTTP API.
type FileExporter struct {
	prompt func(filename string) (string, error)
	write  func(path string, data []byte) error
}

// NewFileExporter creates an exporter that asks with the native save dialog.
func NewFileExporter() *FileExporter {
	return &FileExporter{
		prompt: func(filename string) (string, error) {
			dialog := application.Get().Dialog.SaveFile().
				SetFilename(filename).
				CanCreateDirectories(true)
			if extension := strings.TrimPrefix(filepath.Ext(filename), "."); extension != "" {
				dialog.AddFilter(strings.ToUpper(extension), "*."+extension)
			}
			return dialog.PromptForSingleSelection()
		},
		write: func(path string, data []byte) error { return os.WriteFile(path, data, 0o600) },
	}
}

// SaveText asks where to save and writes content there. It returns the chosen path, or an
// empty string when the user cancels.
func (e *FileExporter) SaveText(filename, content string) (string, error) {
	filename = filepath.Base(strings.TrimSpace(filename))
	if filename == "" || filename == "." || filename == string(filepath.Separator) {
		return "", errors.New("导出文件名不能为空")
	}
	path, err := e.prompt(filename)
	if err != nil {
		return "", errors.New("无法打开保存对话框")
	}
	if strings.TrimSpace(path) == "" {
		return "", nil
	}
	if filepath.Ext(path) == "" {
		path += filepath.Ext(filename)
	}
	if err := e.write(path, []byte(content)); err != nil {
		return "", errors.New("写入导出文件失败，请检查保存位置的权限")
	}
	return path, nil
}
