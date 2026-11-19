package desktop

import (
	"database/sql"
	"encoding/binary"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"unicode/utf16"
)

func TestLegacyPreferencesIncludesWALWithoutCopyingTokensOrReplacingSource(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Darwin WebKit SQLite fixture; Windows persistent migration uses the WebView2 profile-copy tests")
	}
	home := t.TempDir()
	path := filepath.Join(home, "Library", "WebKit", "ai.fruits.orange", "WebsiteData", "LocalStorage", "localstorage.sqlite3")
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatal(err)
	}
	db, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err = db.Exec("PRAGMA journal_mode=WAL; CREATE TABLE ItemTable(key TEXT UNIQUE, value BLOB)"); err != nil {
		t.Fatal(err)
	}
	encode := func(value string) []byte {
		units := utf16.Encode([]rune(value))
		data := make([]byte, len(units)*2)
		for index, unit := range units {
			binary.LittleEndian.PutUint16(data[index*2:], unit)
		}
		return data
	}
	for key, value := range map[string]string{"theme": "dark", "lastUsername": "测试用户", "rememberPassword": "true", "token": "never copy", "password": "never copy"} {
		if _, err = db.Exec("INSERT INTO ItemTable VALUES(?,?)", key, encode(value)); err != nil {
			t.Fatal(err)
		}
	}
	values, err := ReadLegacyPreferences("darwin", home)
	if err != nil {
		t.Fatal(err)
	}
	if values["theme"] != "dark" || values["lastUsername"] != "测试用户" || values["rememberPassword"] != "true" {
		t.Fatalf("preferences missing: %v", values)
	}
	if _, ok := values["token"]; ok {
		t.Fatal("imported authentication token")
	}
	if _, ok := values["password"]; ok {
		t.Fatal("imported password")
	}
	if _, err = db.Exec("UPDATE ItemTable SET value=? WHERE key='theme'", encode("light")); err != nil {
		t.Fatal("modified or locked source:", err)
	}
}

func TestWebviewProfileCopiesPersistentDataButKeepsNewProfileAndOldBackup(t *testing.T) {
	root := t.TempDir()
	old, new := filepath.Join(root, "old"), filepath.Join(root, "new")
	if err := os.MkdirAll(filepath.Join(old, "Cache"), 0o700); err != nil {
		t.Fatal(err)
	}
	for name, content := range map[string]string{"Preferences": "old preferences", "Cache/temp": "discard cache"} {
		if err := os.WriteFile(filepath.Join(old, name), []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	if err := copyWebviewProfile(old, new); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(new, "Cache")); !os.IsNotExist(err) {
		t.Fatal("copied transient cache")
	}
	if err := os.WriteFile(filepath.Join(new, "Preferences"), []byte("new preferences"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := copyWebviewProfile(old, new); err != nil {
		t.Fatal(err)
	}
	content, err := os.ReadFile(filepath.Join(new, "Preferences"))
	if err != nil || string(content) != "new preferences" {
		t.Fatal("overwrote new profile")
	}
	content, err = os.ReadFile(filepath.Join(old, "Preferences"))
	if err != nil || string(content) != "old preferences" {
		t.Fatal("removed old profile")
	}
}
