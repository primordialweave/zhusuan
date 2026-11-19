package updater

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLegacyRepositoryConfigurationUsesTransferredRepository(t *testing.T) {
	for _, configured := range []string{"FruitsAI/Orange", "FRUITSAI/ORANGE", "PrimordialWeave/Zhusuan", ""} {
		t.Run(configured, func(t *testing.T) {
			client := fixtureClient(t, func(w http.ResponseWriter, req *http.Request) {
				if req.URL.Path != "/primordialweave/zhusuan/releases/latest/download/update.json" {
					t.Errorf("unexpected repository request: %s", req.URL.Path)
				}
				if err := json.NewEncoder(w).Encode(fixtureRelease()); err != nil {
					t.Error(err)
				}
			})
			if _, err := FetchLatest(context.Background(), client, configured); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestHistoricalReleaseAssetsRemainUsableButNewNamesTakePriority(t *testing.T) {
	release := fixtureRelease()
	legacy := fixtureAsset("Orange-v1.1.0-windows-amd64-installer.exe", []byte("legacy release"))
	release.Assets = []Asset{legacy}
	asset, err := selectAsset(release, kindWindows, "amd64")
	if err != nil || asset.Name != legacy.Name {
		t.Fatalf("legacy asset not recognized: %+v %v", asset, err)
	}
	if err := validateAssetURL(asset, release, legacyRepository); err != nil {
		t.Fatal(err)
	}
	foreign := asset
	foreign.URL = strings.Replace(foreign.URL, defaultRepository, "another/repo", 1)
	if err := validateAssetURL(foreign, release, legacyRepository); err == nil {
		t.Fatal("legacy alias trusted another repository")
	}
	current := fixtureAsset("zhusuan-v1.1.0-windows-amd64-installer.exe", []byte("current release"))
	release.Assets = append(release.Assets, current)
	asset, err = selectAsset(release, kindWindows, "amd64")
	if err != nil || asset.Name != current.Name {
		t.Fatalf("current asset did not take priority: %+v %v", asset, err)
	}
}

func TestLegacyBundleRootKeepsInternalLinksAndRejectsMixedApplications(t *testing.T) {
	root := t.TempDir()
	if err := extractArchive(t, root,
		archiveEntry{name: "Orange.app/Contents/MacOS/Orange", content: "legacy", mode: 0o755},
		archiveEntry{name: "Orange.app/current", content: "Contents/MacOS/Orange", mode: os.ModeSymlink | 0o777},
	); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(filepath.Join(root, legacyAppBundleName, "current"))
	if err != nil || string(data) != "legacy" {
		t.Fatalf("legacy bundle link broken: %s %v", data, err)
	}
	if err := extractArchive(t, t.TempDir(),
		archiveEntry{name: "Orange.app/file", content: "old"},
		archiveEntry{name: "zhusuan.app/file", content: "new"},
	); err == nil {
		t.Fatal("mixed application archive was accepted")
	}
}

func TestLegacyUpdateResultImportsOnceAndPreservesSource(t *testing.T) {
	legacy := filepath.Join(t.TempDir(), "result.json")
	source := []byte("{\"success\":false,\"message\":\"legacy failure\"}")
	if err := os.WriteFile(legacy, source, 0o600); err != nil {
		t.Fatal(err)
	}
	manager := &Manager{cacheRoot: t.TempDir(), status: Status{State: stateIdle}}
	manager.importLegacyResult(legacy)
	manager.readPreviousResult()
	if manager.Status().Message != "legacy failure" {
		t.Fatal("legacy result not imported")
	}
	data, err := os.ReadFile(legacy)
	if err != nil || string(data) != string(source) {
		t.Fatal("legacy result source changed")
	}
	manager.status = Status{State: stateIdle}
	manager.importLegacyResult(legacy)
	manager.readPreviousResult()
	if manager.Status().State != stateIdle {
		t.Fatal("stale legacy result was reimported")
	}
}

func TestLegacyResultNeverOverwritesNewResultOrReturnsAfterConsumption(t *testing.T) {
	legacy := filepath.Join(t.TempDir(), "result.json")
	if err := os.WriteFile(legacy, []byte("{\"success\":false,\"message\":\"old\"}"), 0o600); err != nil {
		t.Fatal(err)
	}
	manager := &Manager{cacheRoot: t.TempDir()}
	if err := os.WriteFile(filepath.Join(manager.cacheRoot, "result.json"), []byte("{\"success\":false,\"message\":\"new\"}"), 0o600); err != nil {
		t.Fatal(err)
	}
	manager.importLegacyResult(legacy)
	manager.readPreviousResult()
	if manager.Status().Message != "new" {
		t.Fatal("new result was overwritten")
	}
	manager.status = Status{State: stateIdle}
	manager.importLegacyResult(legacy)
	manager.readPreviousResult()
	if manager.Status().State != stateIdle {
		t.Fatal("legacy failure returned after consuming newer result")
	}
}

func TestHelperRetainsLegacyFlagWithoutOpeningApplication(t *testing.T) {
	for _, flag := range []string{"--zhusuan-update-helper", "--orange-update-helper"} {
		handled, err := RunHelper([]string{flag})
		if !handled || err == nil {
			t.Fatalf("helper invocation was not handled safely: %s", flag)
		}
	}
}
