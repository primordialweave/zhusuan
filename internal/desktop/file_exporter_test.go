package desktop

import (
	"errors"
	"testing"
)

func TestFileExporterSaveText(t *testing.T) {
	var asked, wrotePath, wroteData string
	exporter := &FileExporter{
		prompt: func(filename string) (string, error) {
			asked = filename
			return "/tmp/exports/报表", nil
		},
		write: func(path string, data []byte) error {
			wrotePath, wroteData = path, string(data)
			return nil
		},
	}

	path, err := exporter.SaveText("../../etc/Orange-报表.csv", "\uFEFFa,b")
	if err != nil {
		t.Fatal(err)
	}
	if asked != "Orange-报表.csv" {
		t.Fatalf("dialog was offered %q, want the bare file name", asked)
	}
	if path != "/tmp/exports/报表.csv" || wrotePath != path {
		t.Fatalf("saved to %q (wrote %q), want the extension restored", path, wrotePath)
	}
	if wroteData != "\uFEFFa,b" {
		t.Fatalf("content changed on the way: %q", wroteData)
	}
}

func TestFileExporterCancelAndFailures(t *testing.T) {
	written := false
	exporter := &FileExporter{
		prompt: func(string) (string, error) { return "", nil },
		write:  func(string, []byte) error { written = true; return nil },
	}
	if path, err := exporter.SaveText("a.csv", "x"); err != nil || path != "" || written {
		t.Fatalf("cancel: got %q, %v, written=%v", path, err, written)
	}
	if _, err := exporter.SaveText("  ", "x"); err == nil {
		t.Fatal("an empty file name must be rejected")
	}

	exporter.prompt = func(string) (string, error) { return "/tmp/a.csv", nil }
	exporter.write = func(string, []byte) error { return errors.New("disk full") }
	if _, err := exporter.SaveText("a.csv", "x"); err == nil {
		t.Fatal("a failed write must be reported")
	}
}
