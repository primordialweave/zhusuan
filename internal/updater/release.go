// Package updater downloads verified zhusuan releases and replaces the application after exit.
package updater

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"golang.org/x/mod/semver"
)

const maxReleaseBytes = 2 << 20
const maxDownloadBytes int64 = 512 << 20

var repoPattern = regexp.MustCompile(`^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`)

// Asset describes a published GitHub release attachment.
type Asset struct {
	Name   string `json:"name"`
	URL    string `json:"browser_download_url"`
	Size   int64  `json:"size"`
	Digest string `json:"digest"`
}

// Release is the metadata needed to select and verify a desktop update.
type Release struct {
	Tag        string  `json:"tag_name"`
	URL        string  `json:"html_url"`
	Notes      string  `json:"body"`
	Draft      bool    `json:"draft"`
	Prerelease bool    `json:"prerelease"`
	Assets     []Asset `json:"assets"`
}

// NewHTTPClient bounds metadata requests and only follows HTTPS GitHub asset redirects.
func NewHTTPClient(timeout time.Duration) *http.Client {
	return &http.Client{
		Timeout: timeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return errors.New("更新下载重定向次数过多")
			}
			if !trustedDownloadURL(req.URL) {
				return errors.New("更新下载地址无效")
			}
			return nil
		},
	}
}

func trustedDownloadURL(u *url.URL) bool {
	if u.Scheme != "https" || u.User != nil || u.Port() != "" {
		return false
	}
	switch strings.ToLower(u.Hostname()) {
	case "github.com", "api.github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com":
		return true
	}
	return false
}

// FetchLatest fetches one stable release; it is also used by the browser-only check endpoint.
func FetchLatest(ctx context.Context, client *http.Client, repo string) (Release, error) {
	var release Release
	repo = canonicalRepository(repo)
	if !repoPattern.MatchString(repo) {
		return release, errors.New("更新仓库配置无效")
	}
	// The release manifest avoids GitHub's shared anonymous API quota.
	// A 404 falls back to the API so releases published before this updater still work.
	release, status, err := fetchReleaseMetadata(ctx, client, "https://github.com/"+repo+"/releases/latest/download/update.json")
	if status == http.StatusNotFound {
		release, _, err = fetchReleaseMetadata(ctx, client, "https://api.github.com/repos/"+repo+"/releases/latest")
	}
	if err != nil {
		return release, err
	}
	if !semver.IsValid(normalizeVersion(release.Tag)) || semver.Prerelease(normalizeVersion(release.Tag)) != "" || release.Draft || release.Prerelease {
		return release, errors.New("发布版本无效或不是正式版本")
	}
	if release.URL != "https://github.com/"+repo+"/releases/tag/"+release.Tag {
		return release, errors.New("发布页面与更新仓库不匹配")
	}
	return release, nil
}

func fetchReleaseMetadata(ctx context.Context, client *http.Client, address string) (Release, int, error) {
	var release Release
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, address, nil)
	if err != nil {
		return release, 0, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("User-Agent", "zhusuan-Updater")
	resp, err := client.Do(req)
	if err != nil {
		return release, 0, fmt.Errorf("无法获取更新信息: %w", err)
	}
	defer closeRead(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return release, resp.StatusCode, fmt.Errorf("获取更新信息失败 (HTTP %d)", resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxReleaseBytes+1))
	if err != nil || len(data) > maxReleaseBytes {
		return release, resp.StatusCode, errors.New("更新信息读取失败或超过大小限制")
	}
	if err := json.Unmarshal(data, &release); err != nil {
		return release, resp.StatusCode, errors.New("更新信息格式无效")
	}
	return release, resp.StatusCode, nil
}

func normalizeVersion(version string) string {
	return "v" + strings.TrimPrefix(strings.TrimSpace(version), "v")
}

func canonicalRepository(repo string) string {
	repo = strings.TrimSpace(repo)
	if repo == "" || strings.EqualFold(repo, legacyRepository) || strings.EqualFold(repo, defaultRepository) {
		return defaultRepository
	}
	return repo
}

// IsNewer compares semantic versions and never treats an older release as an upgrade.
func IsNewer(latest, current string) bool {
	latest, current = normalizeVersion(latest), normalizeVersion(current)
	return semver.IsValid(latest) && semver.IsValid(current) && semver.Compare(latest, current) > 0
}

func selectAsset(release Release, kind, arch string) (Asset, error) {
	var names []string
	prefix := executableName + "-" + release.Tag
	switch kind {
	case kindWindows:
		names = []string{prefix + "-windows-" + arch + "-installer.exe"}
	case kindDarwin:
		names = []string{prefix + "-macOS-" + arch + ".zip", prefix + "-macOS-universal.zip"}
	case kindAppImage:
		if arch == "amd64" {
			arch = "x86_64"
		}
		names = []string{prefix + "-linux-" + arch + ".AppImage"}
	case kindDeb, kindRPM:
		names = []string{prefix + "-linux-" + arch + "." + kind}
	}
	// Historical releases keep their original attachment names after a repository transfer.
	newNames := append([]string(nil), names...)
	for _, name := range newNames {
		names = append(names, strings.Replace(name, executableName+"-", legacyExecutableName+"-", 1))
	}
	for _, name := range names {
		var matches []Asset
		for _, asset := range release.Assets {
			if asset.Name == name {
				matches = append(matches, asset)
			}
		}
		if len(matches) > 1 {
			return Asset{}, errors.New("发布包含重名安装包")
		}
		if len(matches) == 1 {
			asset := matches[0]
			if asset.Size <= 0 || asset.Size > maxDownloadBytes {
				return Asset{}, errors.New("更新安装包大小无效")
			}
			return asset, nil
		}
	}
	return Asset{}, errors.New("此版本没有适用于当前系统和架构的安装包")
}

func validateAssetURL(asset Asset, release Release, repo string) error {
	repo = canonicalRepository(repo)
	expected := "https://github.com/" + repo + "/releases/download/" + release.Tag + "/" + asset.Name
	if asset.URL != expected {
		return errors.New("安装包下载地址与发布版本不匹配")
	}
	return nil
}

func assetDigest(asset Asset) (string, bool) {
	digest := strings.TrimPrefix(asset.Digest, "sha256:")
	decoded, err := hex.DecodeString(digest)
	return strings.ToLower(digest), strings.HasPrefix(asset.Digest, "sha256:") && err == nil && len(decoded) == 32
}

func checksumFromManifest(data []byte, filename string) (string, error) {
	var found string
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) != 2 || strings.TrimPrefix(fields[1], "*") != filename {
			continue
		}
		digest, err := hex.DecodeString(fields[0])
		if err != nil || len(digest) != 32 || found != "" {
			return "", errors.New("安装包校验清单无效")
		}
		found = strings.ToLower(fields[0])
	}
	if found == "" {
		return "", errors.New("发布未提供安装包 SHA-256 校验值")
	}
	return found, nil
}
