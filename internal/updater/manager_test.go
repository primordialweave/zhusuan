package updater

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func testManager(t *testing.T, payload []byte, handler http.HandlerFunc) (*Manager, Asset) {
	t.Helper()
	root := t.TempDir()
	installed := filepath.Join(root, "installed", "zhusuan.AppImage")
	if err := os.MkdirAll(filepath.Dir(installed), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(installed, []byte("old application"), 0o755); err != nil {
		t.Fatal(err)
	}
	asset := fixtureAsset("zhusuan-v1.1.0-linux-x86_64.AppImage", payload)
	release := fixtureRelease()
	release.Assets = []Asset{asset}
	client := fixtureClient(t, handler)
	m := &Manager{version: "1.0.0", repo: "primordialweave/zhusuan", arch: "amd64", enabled: true,
		target:    installTarget{kind: "appimage", path: installed, executable: installed},
		cacheRoot: filepath.Join(root, "cache"), client: client, downloadClient: client,
		release: release, asset: asset, info: Info{Available: true, Supported: true},
		status: Status{State: "available"}, launch: func(installPlan) error { return nil }}
	t.Cleanup(func() { _ = m.Close() })
	return m, asset
}

func waitForUpdate(t *testing.T, m *Manager) {
	t.Helper()
	m.mu.Lock()
	done := m.done
	m.mu.Unlock()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("update worker did not finish")
	}
}

func TestUpdateDownloadVerifiesExactBytesAndRejectsIncompleteOrOversizedData(t *testing.T) {
	payload := []byte("verified installer payload")
	for _, tc := range []struct {
		name           string
		data           []byte
		digest         string
		declaredLength int64
		wantError      bool
	}{
		{"valid", payload, checksum(payload), -1, false},
		{"truncated", payload[:len(payload)-1], checksum(payload), -1, true},
		{"extra bytes", append(append([]byte{}, payload...), '!'), checksum(payload), -1, true},
		{"wrong digest", payload, strings.Repeat("0", 64), -1, true},
		{"declared oversized", nil, checksum(payload), maxDownloadBytes + 1, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			m, asset := testManager(t, payload, func(w http.ResponseWriter, req *http.Request) {
				if tc.declaredLength >= 0 {
					w.Header().Set("Content-Length", strconv.FormatInt(tc.declaredLength, 10))
				}
				w.WriteHeader(http.StatusOK)
				w.(http.Flusher).Flush() // Unknown body length exercises stream limits.
				_, _ = w.Write(tc.data)
			})
			destination := filepath.Join(t.TempDir(), "installer")
			err := m.download(context.Background(), asset, tc.digest, destination)
			if (err != nil) != tc.wantError {
				t.Fatalf("download error = %v, wantError %v", err, tc.wantError)
			}
			if !tc.wantError {
				data, err := os.ReadFile(destination)
				if err != nil || string(data) != string(payload) || m.Status().Progress != 100 {
					t.Fatalf("download mismatch: %q, status %+v, error %v", data, m.Status(), err)
				}
			}
		})
	}
}

func TestUpdateDigestFallsBackToOneValidManifest(t *testing.T) {
	payload := []byte("verified installer payload")
	m, asset := testManager(t, payload, func(w http.ResponseWriter, req *http.Request) {
		_, _ = w.Write([]byte(checksum(payload) + "  zhusuan-v1.1.0-linux-x86_64.AppImage\n"))
	})
	asset.Digest = ""
	manifest := fixtureAsset("SHA256SUMS", []byte("manifest"))
	release := m.release
	release.Assets = []Asset{asset, manifest}
	if digest, err := m.expectedDigest(context.Background(), release, asset); err != nil || digest != checksum(payload) {
		t.Fatalf("digest = %s, error = %v", digest, err)
	}
	release.Assets = append(release.Assets, manifest)
	if _, err := m.expectedDigest(context.Background(), release, asset); err == nil {
		t.Fatal("accepted duplicate manifests")
	}
	for _, data := range []string{checksum(payload) + "  another.AppImage\n", "bad  " + asset.Name,
		checksum(payload) + "  " + asset.Name + "\n" + checksum(payload) + " *" + asset.Name} {
		if _, err := checksumFromManifest([]byte(data), asset.Name); err == nil {
			t.Fatal("accepted missing, invalid or duplicate checksum entry")
		}
	}
	asset.URL = strings.Replace(asset.URL, "primordialweave/zhusuan", "another/zhusuan", 1)
	if _, err := m.expectedDigest(context.Background(), release, asset); err == nil {
		t.Fatal("accepted checksum for asset from another repository")
	}
}

func TestUpdateWorkerOnlyQuitsAfterVerifiedHandoffAndRestart(t *testing.T) {
	payload := []byte("new verified application")
	m, _ := testManager(t, payload, func(w http.ResponseWriter, req *http.Request) { _, _ = w.Write(payload) })
	var launchCount, restartCount, quitCount atomic.Int32
	m.launch = func(plan installPlan) error {
		launchCount.Add(1)
		old, err := os.ReadFile(plan.Target)
		if err != nil || string(old) != "old application" {
			t.Error("running application was changed before helper handoff")
		}
		return installAndRestart(plan, func(installPlan) error {
			t.Error("AppImage replacement invoked a system installer")
			return errors.New("unexpected installer")
		}, func(plan installPlan) error {
			restartCount.Add(1)
			got, err := os.ReadFile(plan.Target)
			if err != nil || string(got) != string(payload) {
				t.Errorf("restarted incorrect application %q, error %v", got, err)
			}
			return nil
		})
	}
	m.quit = func() { quitCount.Add(1) }
	if err := m.StartUpdate(); err != nil {
		t.Fatal(err)
	}
	waitForUpdate(t, m)
	if status := m.Status(); status.State != "restarting" || status.Progress != 100 {
		t.Fatalf("status = %+v", status)
	}
	if launchCount.Load() != 1 || restartCount.Load() != 1 || quitCount.Load() != 1 {
		t.Fatal("update did not hand off, restart and quit exactly once")
	}
}

func TestUpdateWorkerPreservesApplicationAndCleansFailedDownloads(t *testing.T) {
	for _, helperFails := range []bool{false, true} {
		t.Run(strconv.FormatBool(helperFails), func(t *testing.T) {
			payload := []byte("new application")
			m, _ := testManager(t, payload, func(w http.ResponseWriter, req *http.Request) { _, _ = w.Write(payload) })
			if !helperFails {
				m.asset.Digest = "sha256:" + strings.Repeat("0", 64)
			}
			var quitCount atomic.Int32
			m.quit = func() { quitCount.Add(1) }
			m.launch = func(plan installPlan) error { return errors.New("helper initialization failed") }
			if err := m.StartUpdate(); err != nil {
				t.Fatal(err)
			}
			waitForUpdate(t, m)
			if m.Status().State != "error" || quitCount.Load() != 0 {
				t.Fatalf("failed update quit application: %+v", m.Status())
			}
			got, err := os.ReadFile(m.target.path)
			if err != nil || string(got) != "old application" {
				t.Fatal("failed update replaced current application")
			}
			for _, directory := range []string{m.cacheRoot, filepath.Dir(m.target.path)} {
				entries, err := os.ReadDir(directory)
				if err != nil {
					t.Fatal(err)
				}
				for _, entry := range entries {
					if strings.HasPrefix(entry.Name(), "update-") || strings.HasPrefix(entry.Name(), ".zhusuan-update-") {
						t.Errorf("failed update left temporary directory %s", entry.Name())
					}
				}
			}
		})
	}
}

func TestUpdateCancellationAndDuplicateOperationsDoNotHandoff(t *testing.T) {
	for _, closeManager := range []bool{false, true} {
		t.Run(strconv.FormatBool(closeManager), func(t *testing.T) {
			started := make(chan struct{})
			m, _ := testManager(t, []byte("new application"), func(w http.ResponseWriter, req *http.Request) {
				w.WriteHeader(http.StatusOK)
				w.(http.Flusher).Flush()
				close(started)
				<-req.Context().Done()
			})
			var launchCount, quitCount atomic.Int32
			m.launch = func(installPlan) error { launchCount.Add(1); return nil }
			m.quit = func() { quitCount.Add(1) }
			if err := m.StartUpdate(); err != nil {
				t.Fatal(err)
			}
			select {
			case <-started:
			case <-time.After(3 * time.Second):
				t.Fatal("download did not start")
			}
			if err := m.StartUpdate(); err == nil {
				t.Error("accepted concurrent update")
			}
			if _, err := m.CheckForUpdates(); err == nil {
				t.Error("accepted concurrent metadata check")
			}
			for i := 0; i < 100; i++ {
				_ = m.Status()
			}
			var err error
			if closeManager {
				err = m.Close()
			} else {
				err = m.CancelUpdate()
			}
			if err != nil {
				t.Fatal(err)
			}
			waitForUpdate(t, m)
			if m.Status().State != "available" || launchCount.Load() != 0 || quitCount.Load() != 0 {
				t.Fatalf("cancelled update handed off: %+v", m.Status())
			}
		})
	}
}

type cancelledEOFBody struct {
	ctx     context.Context
	reading chan struct{}
}

func (body *cancelledEOFBody) Read([]byte) (int, error) {
	close(body.reading)
	<-body.ctx.Done()
	// A server can close its response as cancellation is observed, yielding EOF.
	return 0, io.EOF
}

func (body *cancelledEOFBody) Close() error { return nil }

func TestUpdateCancellationWhileReadingEndOfStreamDoesNotHandoff(t *testing.T) {
	for _, closeManager := range []bool{false, true} {
		t.Run(strconv.FormatBool(closeManager), func(t *testing.T) {
			m, _ := testManager(t, []byte("new application"), func(http.ResponseWriter, *http.Request) {})
			reading := make(chan struct{})
			m.downloadClient = &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				return &http.Response{
					StatusCode:    http.StatusOK,
					ContentLength: -1,
					Body:          &cancelledEOFBody{ctx: req.Context(), reading: reading},
				}, nil
			})}
			var launchCount, quitCount atomic.Int32
			m.launch = func(installPlan) error { launchCount.Add(1); return nil }
			m.quit = func() { quitCount.Add(1) }
			if err := m.StartUpdate(); err != nil {
				t.Fatal(err)
			}
			select {
			case <-reading:
			case <-time.After(3 * time.Second):
				t.Fatal("download did not begin reading the response")
			}
			var err error
			if closeManager {
				err = m.Close()
			} else {
				err = m.CancelUpdate()
			}
			if err != nil {
				t.Fatal(err)
			}
			waitForUpdate(t, m)
			if status := m.Status(); status.State != "available" || launchCount.Load() != 0 || quitCount.Load() != 0 {
				t.Fatalf("cancelled update did not return to available without handoff: %+v", status)
			}
		})
	}
}

func TestPreviousInstallFailureIsReportedOnce(t *testing.T) {
	m := &Manager{cacheRoot: t.TempDir(), status: Status{State: "idle"}}
	data, err := json.Marshal(installResult{Message: "installation failed; old application restored"})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(m.cacheRoot, "result.json"), data, 0o600); err != nil {
		t.Fatal(err)
	}
	m.readPreviousResult()
	if m.Status().State != "error" || !strings.Contains(m.Status().Message, "old application restored") {
		t.Fatal("previous failure was lost")
	}
	if _, err := os.Stat(filepath.Join(m.cacheRoot, "result.json")); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("failure result not consumed")
	}
}

func TestUpdateCancellationDuringAppPreparationNeverLaunchesHelper(t *testing.T) {
	// Multiple real entries hold preparation open long enough to cancel after staging begins.
	entries := make([]archiveEntry, 0, 2048)
	for i := 0; i < 2048; i++ {
		entries = append(entries, archiveEntry{name: "zhusuan.app/Contents/Resources/" + strconv.Itoa(i), content: strings.Repeat("resource", 128)})
	}
	payload := appArchive(t, entries...)
	m, _ := testManager(t, payload, func(w http.ResponseWriter, req *http.Request) { _, _ = w.Write(payload) })
	m.target.kind = "darwin"
	m.target.path = filepath.Join(filepath.Dir(m.target.path), "zhusuan.app")
	m.target.executable = filepath.Join(m.target.path, "Contents", "MacOS", "zhusuan")
	if err := os.MkdirAll(filepath.Dir(m.target.executable), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(m.target.executable, []byte("old application"), 0o755); err != nil {
		t.Fatal(err)
	}
	m.asset = fixtureAsset("zhusuan-v1.1.0-macOS-amd64.zip", payload)
	m.release.Assets = []Asset{m.asset}
	var launchCount, quitCount atomic.Int32
	m.launch = func(installPlan) error { launchCount.Add(1); return nil }
	m.quit = func() { quitCount.Add(1) }
	if err := m.StartUpdate(); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(5 * time.Second)
	foundStage := false
	for time.Now().Before(deadline) {
		files, err := os.ReadDir(filepath.Dir(m.target.path))
		if err != nil {
			t.Fatal(err)
		}
		for _, file := range files {
			foundStage = foundStage || strings.HasPrefix(file.Name(), ".zhusuan-update-")
		}
		if foundStage {
			break
		}
		time.Sleep(time.Millisecond)
	}
	if !foundStage {
		t.Fatal("application staging never started")
	}
	if err := m.CancelUpdate(); err != nil {
		t.Fatal(err)
	}
	waitForUpdate(t, m)
	if status := m.Status(); status.State != "available" || launchCount.Load() != 0 || quitCount.Load() != 0 {
		t.Fatalf("cancelled preparation handed off installation: %+v", status)
	}
	content, err := os.ReadFile(m.target.executable)
	if err != nil || string(content) != "old application" {
		t.Fatal("cancelled preparation changed current application")
	}
}
