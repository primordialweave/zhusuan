package updater

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) { return f(req) }

// All request paths and contexts are preserved, but the fixture transport stays local.
func fixtureClient(t *testing.T, handler http.HandlerFunc) *http.Client {
	t.Helper()
	server := httptest.NewTLSServer(handler)
	t.Cleanup(server.Close)
	local, err := url.Parse(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	client := server.Client()
	transport := client.Transport
	client.Transport = roundTripFunc(func(req *http.Request) (*http.Response, error) {
		clone := req.Clone(req.Context())
		u := *req.URL
		u.Scheme, u.Host = local.Scheme, local.Host
		clone.URL, clone.Host = &u, local.Host
		return transport.RoundTrip(clone)
	})
	client.Timeout = 5 * time.Second
	return client
}

func fixtureRelease() Release {
	return Release{Tag: "v1.1.0", URL: "https://github.com/primordialweave/zhusuan/releases/tag/v1.1.0"}
}

func checksum(data []byte) string {
	digest := sha256.Sum256(data)
	return hex.EncodeToString(digest[:])
}

func fixtureAsset(name string, data []byte) Asset {
	return Asset{Name: name, URL: "https://github.com/primordialweave/zhusuan/releases/download/v1.1.0/" + name,
		Size: int64(len(data)), Digest: "sha256:" + checksum(data)}
}

func TestFetchLatestRejectsUntrustedOrNonStableMetadata(t *testing.T) {
	for _, tc := range []struct {
		name string
		edit func(*Release)
	}{
		{"draft", func(r *Release) { r.Draft = true }},
		{"prerelease flag", func(r *Release) { r.Prerelease = true }},
		{"prerelease tag", func(r *Release) {
			r.Tag = "v1.1.0-rc.1"
			r.URL = "https://github.com/primordialweave/zhusuan/releases/tag/" + r.Tag
		}},
		{"invalid tag", func(r *Release) { r.Tag = "main" }},
		{"wrong repository", func(r *Release) { r.URL = "https://github.com/another/zhusuan/releases/tag/v1.1.0" }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			release := fixtureRelease()
			tc.edit(&release)
			data, err := json.Marshal(release)
			if err != nil {
				t.Fatal(err)
			}
			client := fixtureClient(t, func(w http.ResponseWriter, req *http.Request) {
				_, _ = w.Write(data)
			})
			if _, err := FetchLatest(context.Background(), client, "primordialweave/zhusuan"); err == nil {
				t.Fatal("accepted invalid release metadata")
			}
		})
	}
	for _, data := range [][]byte{[]byte("invalid json"), bytes.Repeat([]byte(" "), maxReleaseBytes+1)} {
		client := fixtureClient(t, func(w http.ResponseWriter, req *http.Request) { _, _ = w.Write(data) })
		if _, err := FetchLatest(context.Background(), client, "primordialweave/zhusuan"); err == nil {
			t.Fatal("accepted invalid or oversized release metadata")
		}
	}
}

func TestFetchLatestRequestsStableReleaseWithBoundedClient(t *testing.T) {
	release := fixtureRelease()
	requests := 0
	client := fixtureClient(t, func(w http.ResponseWriter, req *http.Request) {
		requests++
		if req.URL.Path == "/primordialweave/zhusuan/releases/latest/download/update.json" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		if req.URL.Path != "/repos/primordialweave/zhusuan/releases/latest" || req.Header.Get("User-Agent") != "zhusuan-Updater" {
			t.Error("incorrect release request")
		}
		_ = json.NewEncoder(w).Encode(release)
	})
	got, err := FetchLatest(context.Background(), client, "primordialweave/zhusuan")
	if err != nil || got.Tag != release.Tag {
		t.Fatalf("release = %+v, error = %v", got, err)
	}
	if requests != 2 {
		t.Fatalf("legacy fallback made %d requests, want 2", requests)
	}
	if _, err := FetchLatest(context.Background(), client, "primordialweave/zhusuan/extra"); err == nil {
		t.Fatal("accepted malformed repository name")
	}
}

func TestFetchLatestUsesManifestWithoutCallingRateLimitedAPI(t *testing.T) {
	client := fixtureClient(t, func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path != "/primordialweave/zhusuan/releases/latest/download/update.json" {
			t.Error("static manifest triggered an API request")
			w.WriteHeader(http.StatusForbidden)
			return
		}
		if err := json.NewEncoder(w).Encode(fixtureRelease()); err != nil {
			t.Fatal(err)
		}
	})
	if release, err := FetchLatest(context.Background(), client, "primordialweave/zhusuan"); err != nil || release.Tag != "v1.1.0" {
		t.Fatalf("manifest lookup failed: %+v, %v", release, err)
	}
}

func TestUpdateInfoMatchesWebviewJSONContract(t *testing.T) {
	data, err := json.Marshal(Info{Available: true, Supported: true, CurrentVersion: "1.0.0", LatestVersion: "1.1.0"})
	if err != nil {
		t.Fatal(err)
	}
	var fields map[string]any
	if err := json.Unmarshal(data, &fields); err != nil {
		t.Fatal(err)
	}
	if fields["available"] != true || fields["supported"] != true || fields["currentVersion"] != "1.0.0" {
		t.Fatalf("webview update fields are missing: %s", data)
	}
}

func TestReleaseVersionComparisonNeverDowngrades(t *testing.T) {
	for _, tc := range []struct {
		latest, current string
		want            bool
	}{
		{"v1.10.0", "1.9.0", true}, {"1.0.0", "1.0.0-rc.2", true},
		{"1.0.0-rc.10", "1.0.0-rc.2", true}, {"v1.0.0", "v1.1.0", false},
		{"1.0.0+build2", "1.0.0+build1", false}, {"1.0.0-rc.2", "1.0.0", false},
		{"invalid", "1.0.0", false}, {"1.0.0", "invalid", false},
	} {
		if got := IsNewer(tc.latest, tc.current); got != tc.want {
			t.Errorf("IsNewer(%q, %q) = %v, want %v", tc.latest, tc.current, got, tc.want)
		}
	}
}

func TestReleaseAssetSelectionAndRepositoryMatch(t *testing.T) {
	release := fixtureRelease()
	for _, tc := range []struct{ kind, arch, filename string }{
		{"windows", "amd64", "zhusuan-v1.1.0-windows-amd64-installer.exe"},
		{"darwin", "arm64", "zhusuan-v1.1.0-macOS-arm64.zip"},
		{"darwin", "amd64", "zhusuan-v1.1.0-macOS-universal.zip"},
		{"appimage", "amd64", "zhusuan-v1.1.0-linux-x86_64.AppImage"},
		{"deb", "amd64", "zhusuan-v1.1.0-linux-amd64.deb"},
	} {
		t.Run(tc.kind+"/"+tc.arch, func(t *testing.T) {
			asset := fixtureAsset(tc.filename, []byte("binary"))
			release.Assets = []Asset{asset}
			got, err := selectAsset(release, tc.kind, tc.arch)
			if err != nil || got.Name != tc.filename {
				t.Fatalf("asset = %+v, error = %v", got, err)
			}
			if err := validateAssetURL(got, release, "primordialweave/zhusuan"); err != nil {
				t.Fatal(err)
			}
			got.URL = strings.Replace(got.URL, "v1.1.0", "v1.0.0", 1)
			if err := validateAssetURL(got, release, "primordialweave/zhusuan"); err == nil {
				t.Fatal("accepted asset URL for another release")
			}
		})
	}
	asset := fixtureAsset("zhusuan-v1.1.0-windows-amd64-installer.exe", []byte("binary"))
	for _, assets := range [][]Asset{{asset, asset}, {{Name: asset.Name, Size: 0}}, {{Name: asset.Name, Size: maxDownloadBytes + 1}}} {
		release.Assets = assets
		if _, err := selectAsset(release, "windows", "amd64"); err == nil {
			t.Fatal("accepted duplicate or invalid size asset")
		}
	}
}

func TestMacUpdateSelectsZIPPayloadWhenDMGInstallersArePresent(t *testing.T) {
	for _, tc := range []struct {
		name, arch, want string
		payloads         []string
	}{
		{
			name: "Apple Silicon prefers native ZIP", arch: "arm64", want: "zhusuan-v1.1.0-macOS-arm64.zip",
			payloads: []string{"zhusuan-v1.1.0-macOS-amd64.zip", "zhusuan-v1.1.0-macOS-universal.zip", "zhusuan-v1.1.0-macOS-arm64.zip"},
		},
		{
			name: "Intel prefers native ZIP", arch: "amd64", want: "zhusuan-v1.1.0-macOS-amd64.zip",
			payloads: []string{"zhusuan-v1.1.0-macOS-arm64.zip", "zhusuan-v1.1.0-macOS-universal.zip", "zhusuan-v1.1.0-macOS-amd64.zip"},
		},
		{
			name: "opposite architecture falls back to universal", arch: "arm64", want: "zhusuan-v1.1.0-macOS-universal.zip",
			payloads: []string{"zhusuan-v1.1.0-macOS-amd64.zip", "zhusuan-v1.1.0-macOS-universal.zip"},
		},
		{
			name: "legacy universal remains compatible", arch: "amd64", want: "Orange-v1.1.0-macOS-universal.zip",
			payloads: []string{"zhusuan-v1.1.0-macOS-arm64.zip", "Orange-v1.1.0-macOS-universal.zip"},
		},
		{name: "DMG only is not an automatic update", arch: "arm64"},
		{
			name: "wrong architecture ZIP is not an automatic update", arch: "amd64",
			payloads: []string{"zhusuan-v1.1.0-macOS-arm64.zip"},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			release := fixtureRelease()
			// Installers are deliberately listed first; automatic updates must use ZIPs.
			release.Assets = []Asset{
				fixtureAsset("zhusuan-v1.1.0-macOS-arm64.dmg", []byte("manual installer")),
				fixtureAsset("zhusuan-v1.1.0-macOS-amd64.dmg", []byte("manual installer")),
			}
			for _, name := range tc.payloads {
				release.Assets = append(release.Assets, fixtureAsset(name, []byte("update payload")))
			}
			got, err := selectAsset(release, kindDarwin, tc.arch)
			if tc.want == "" {
				if err == nil {
					t.Fatalf("accepted unsupported update payload: %+v", got)
				}
				return
			}
			if err != nil || got.Name != tc.want {
				t.Fatalf("selected %q, error %v; want %q", got.Name, err, tc.want)
			}
			if err := validateAssetURL(got, release, defaultRepository); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestUpdaterRejectsRedirectsOutsideGitHubHTTPS(t *testing.T) {
	for _, address := range []string{"http://github.com/asset", "https://github.com:444/asset", "https://user@github.com/asset", "https://evil.example/asset"} {
		u, err := url.Parse(address)
		if err != nil {
			t.Fatal(err)
		}
		if trustedDownloadURL(u) {
			t.Errorf("trusted URL %s", address)
		}
	}
	client := NewHTTPClient(time.Second)
	client.Transport = roundTripFunc(func(req *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusFound, Header: http.Header{"Location": []string{"https://evil.example/asset"}}, Body: io.NopCloser(strings.NewReader("")), Request: req}, nil
	})
	if _, err := client.Get("https://github.com/primordialweave/zhusuan/releases/download/v1.1.0/asset"); err == nil {
		t.Fatal("followed untrusted redirect")
	}
}
