package updater

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

// Info tells the webview whether this release can be installed on this device.
type Info struct {
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	Available      bool   `json:"available"`
	Supported      bool   `json:"supported"`
	Reason         string `json:"reason"`
	ReleaseURL     string `json:"releaseURL"`
	ReleaseNotes   string `json:"releaseNotes"`
}

// Status is a cheap snapshot; the frontend polls it only while updating.
type Status struct {
	State           string  `json:"state"`
	Progress        float64 `json:"progress"`
	DownloadedBytes int64   `json:"downloadedBytes"`
	TotalBytes      int64   `json:"totalBytes"`
	Message         string  `json:"message"`
}

type installTarget struct{ kind, path, executable string }

// Manager owns a single update operation. Installer execution is never exposed over HTTP.
type Manager struct {
	mu                                       sync.Mutex
	version, repo, arch, cacheRoot, platform string
	enabled                                  bool
	target                                   installTarget
	targetErr                                error
	client                                   *http.Client
	downloadClient                           *http.Client
	release                                  Release
	asset                                    Asset
	info                                     Info
	status                                   Status
	cancel                                   context.CancelFunc
	done                                     chan struct{}
	quit                                     func()
	launch                                   func(installPlan) error
}

// NewManager creates the updater without timers or background network requests.
func NewManager(version, repo string, enabled bool, quit func()) *Manager {
	executable, err := os.Executable()
	if err == nil {
		executable, err = filepath.EvalSymlinks(executable)
	}
	target := installTarget{executable: executable}
	targetErr := err
	cache, cacheErr := os.UserCacheDir()
	if cacheErr != nil {
		targetErr = cacheErr
	}
	m := &Manager{
		version: strings.TrimPrefix(version, "v"), repo: canonicalRepository(repo), arch: runtime.GOARCH, enabled: enabled, platform: runtime.GOOS,
		target: target, targetErr: targetErr, cacheRoot: filepath.Join(cache, "zhusuan", "updates"),
		client: NewHTTPClient(15 * time.Second), downloadClient: NewHTTPClient(30 * time.Minute),
		status: Status{State: stateIdle}, quit: quit, launch: launchHelper,
	}
	m.importLegacyResult(filepath.Join(cache, legacyExecutableName, "updates", "result.json"))
	m.readPreviousResult()
	return m
}

func (m *Manager) importLegacyResult(legacyPath string) {
	marker := filepath.Join(m.cacheRoot, "legacy-result-imported")
	if _, err := os.Stat(marker); err == nil {
		return
	}
	if _, err := os.Stat(filepath.Join(m.cacheRoot, "result.json")); err == nil {
		m.markLegacyResultImported(marker)
		return
	}
	data, err := os.ReadFile(legacyPath)
	if err != nil {
		return
	}
	if err = os.MkdirAll(m.cacheRoot, 0o700); err != nil {
		return
	}
	if err = os.WriteFile(filepath.Join(m.cacheRoot, "result.json"), data, 0o600); err != nil {
		return
	}
	m.markLegacyResultImported(marker)
}

func (m *Manager) markLegacyResultImported(marker string) {
	if err := os.MkdirAll(m.cacheRoot, 0o700); err != nil {
		return
	}
	if err := os.WriteFile(marker, []byte("imported"), 0o600); err != nil {
		slog.Warn("Unable to mark legacy update result imported", "error", err)
	}
}

// CheckForUpdates fetches metadata while leaving application and payment data untouched.
func (m *Manager) CheckForUpdates() (Info, error) {
	m.mu.Lock()
	if busy(m.status.State) {
		m.mu.Unlock()
		return Info{}, errors.New("更新正在进行中")
	}
	m.status = Status{State: stateChecking}
	m.mu.Unlock()
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	release, err := FetchLatest(ctx, m.client, m.repo)
	if err != nil {
		m.fail(err)
		return Info{}, err
	}
	info := Info{CurrentVersion: m.version, LatestVersion: strings.TrimPrefix(release.Tag, "v"),
		Available: IsNewer(release.Tag, m.version), ReleaseURL: release.URL, ReleaseNotes: release.Notes}
	// Package-manager detection can be slow on Linux; run it only on an explicit check.
	if m.enabled && m.target.kind == "" && m.targetErr == nil {
		m.target, m.targetErr = detectTarget(m.platform, m.target.executable)
	}
	asset, assetErr := selectAsset(release, m.target.kind, m.arch)
	switch {
	case !m.enabled:
		info.Reason = "开发模式不安装更新，请使用打包后的应用"
	case m.targetErr != nil:
		info.Reason = m.targetErr.Error()
	case assetErr != nil:
		info.Reason = assetErr.Error()
	default:
		info.Supported = true
	}
	m.mu.Lock()
	m.release, m.asset, m.info = release, asset, info
	state := stateIdle
	if info.Available {
		state = stateAvailable
	}
	m.status = Status{State: state}
	m.mu.Unlock()
	return info, nil
}

func busy(state string) bool {
	return state == stateChecking || state == stateDownloading || state == stateInstalling || state == stateRestarting
}

// StartUpdate returns immediately; download, verification and handoff happen in one worker.
func (m *Manager) StartUpdate() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if busy(m.status.State) {
		return errors.New("更新正在进行中")
	}
	if !m.info.Available {
		return errors.New("请先检测可用的新版本")
	}
	if !m.info.Supported {
		return errors.New(m.info.Reason)
	}
	ctx, cancel := context.WithCancel(context.Background())
	m.cancel = cancel
	m.done = make(chan struct{})
	m.status = Status{State: stateDownloading, TotalBytes: m.asset.Size, Message: "正在下载更新"}
	go m.runUpdate(ctx, m.release, m.asset, m.done)
	return nil
}

// Status returns an in-memory snapshot without performing any I/O.
func (m *Manager) Status() Status { m.mu.Lock(); defer m.mu.Unlock(); return m.status }

// CancelUpdate cancels downloads before the installer is handed off.
func (m *Manager) CancelUpdate() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.status.State != stateDownloading {
		return errors.New("安装开始后无法取消")
	}
	if m.cancel != nil {
		m.cancel()
	}
	return nil
}

// Close cancels an unfinished download when the application closes normally.
func (m *Manager) Close() error {
	m.mu.Lock()
	if m.cancel != nil {
		m.cancel()
	}
	m.mu.Unlock()
	return nil
}

func (m *Manager) fail(err error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.status.State, m.status.Message = stateError, err.Error()
}

func (m *Manager) runUpdate(ctx context.Context, release Release, asset Asset, done chan struct{}) {
	defer close(done)
	if err := os.MkdirAll(m.cacheRoot, 0o700); err != nil {
		m.fail(errors.New("无法创建更新缓存目录"))
		return
	}
	work, err := os.MkdirTemp(m.cacheRoot, "update-")
	if err != nil {
		m.fail(err)
		return
	}
	handedOff := false
	var stagedRoot string
	defer func() {
		if !handedOff {
			removeUpdatePath(work)
			if stagedRoot != "" {
				removeUpdatePath(stagedRoot)
			}
		}
	}()
	digest, err := m.expectedDigest(ctx, release, asset)
	if err == nil {
		err = m.download(ctx, asset, digest, filepath.Join(work, asset.Name))
	}
	if err != nil {
		if errors.Is(ctx.Err(), context.Canceled) || errors.Is(err, context.Canceled) {
			m.mu.Lock()
			m.status = Status{State: stateAvailable, Message: "已取消下载"}
			m.mu.Unlock()
		} else {
			m.fail(err)
		}
		return
	}
	if err = ctx.Err(); err != nil {
		m.mu.Lock()
		m.status = Status{State: stateAvailable, Message: "已取消下载"}
		m.mu.Unlock()
		return
	}
	plan := installPlan{Kind: m.target.kind, Target: m.target.path, Executable: m.target.executable,
		Package: filepath.Join(work, asset.Name), ParentPID: os.Getpid(), Version: strings.TrimPrefix(release.Tag, "v"),
		WorkDir: work, ResultPath: filepath.Join(m.cacheRoot, "result.json")}
	plan.Staged, stagedRoot, err = prepareReplacement(ctx, plan)
	if err != nil {
		if ctx.Err() != nil || errors.Is(err, context.Canceled) {
			m.mu.Lock()
			m.status = Status{State: stateAvailable, Message: "已取消下载"}
			m.mu.Unlock()
		} else {
			m.fail(err)
		}
		return
	}
	m.mu.Lock()
	if ctx.Err() != nil {
		m.status = Status{State: stateAvailable, Message: "已取消下载"}
		m.mu.Unlock()
		return
	}
	m.status.State, m.status.Message = stateInstalling, "正在准备安装"
	m.mu.Unlock()
	if err = m.launch(plan); err != nil {
		m.fail(fmt.Errorf("无法启动更新助手: %w", err))
		return
	}
	handedOff = true
	m.mu.Lock()
	m.status.State, m.status.Message = stateRestarting, "正在安装更新并重启"
	m.mu.Unlock()
	if m.quit != nil {
		m.quit()
	}
}

func (m *Manager) expectedDigest(ctx context.Context, release Release, asset Asset) (string, error) {
	if err := validateAssetURL(asset, release, m.repo); err != nil {
		return "", err
	}
	if digest, ok := assetDigest(asset); ok {
		return digest, nil
	}
	var manifest Asset
	for _, a := range release.Assets {
		if a.Name == "SHA256SUMS" {
			if manifest.Name != "" {
				return "", errors.New("发布包含重名校验清单")
			}
			manifest = a
		}
	}
	if manifest.Name == "" {
		return "", errors.New("发布未提供安装包 SHA-256 校验值")
	}
	if err := validateAssetURL(manifest, release, m.repo); err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, manifest.URL, nil)
	if err != nil {
		return "", err
	}
	resp, err := m.client.Do(req)
	if err != nil {
		return "", err
	}
	defer closeRead(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", errors.New("无法下载更新校验清单")
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20+1))
	if err != nil || len(data) > 1<<20 {
		return "", errors.New("更新校验清单超过大小限制")
	}
	return checksumFromManifest(data, asset.Name)
}

func (m *Manager) download(ctx context.Context, asset Asset, digest, destination string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, asset.URL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "zhusuan-Updater")
	resp, err := m.downloadClient.Do(req)
	if err != nil {
		return err
	}
	defer closeRead(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("下载安装包失败 (HTTP %d)", resp.StatusCode)
	}
	if resp.ContentLength > maxDownloadBytes || (resp.ContentLength >= 0 && resp.ContentLength != asset.Size) {
		return errors.New("安装包大小与发布信息不一致")
	}
	f, err := os.OpenFile(destination, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return err
	}
	hash := sha256.New()
	writer := io.MultiWriter(f, hash)
	reader := io.LimitReader(resp.Body, asset.Size+1)
	downloaded, err := copyDownload(ctx, reader, writer, func(downloaded int64) {
		m.mu.Lock()
		m.status.DownloadedBytes = downloaded
		m.status.Progress = 100 * float64(downloaded) / float64(asset.Size)
		m.mu.Unlock()
	})
	closeErr := f.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	if downloaded != asset.Size {
		return errors.New("安装包下载不完整")
	}
	if hex.EncodeToString(hash.Sum(nil)) != digest {
		return errors.New("安装包 SHA-256 校验失败，请重新下载")
	}
	return nil
}

func copyDownload(ctx context.Context, reader io.Reader, writer io.Writer, progress func(int64)) (int64, error) {
	buffer := make([]byte, 128<<10)
	var downloaded int64
	for {
		if err := ctx.Err(); err != nil {
			return downloaded, err
		}
		n, err := reader.Read(buffer)
		if n > 0 {
			if _, writeErr := writer.Write(buffer[:n]); writeErr != nil {
				return downloaded, writeErr
			}
			downloaded += int64(n)
			progress(downloaded)
		}
		if err != nil {
			if errors.Is(err, io.EOF) {
				return downloaded, nil
			}
			return downloaded, err
		}
	}
}

func (m *Manager) readPreviousResult() {
	data, err := os.ReadFile(filepath.Join(m.cacheRoot, "result.json"))
	if err != nil {
		return
	}
	var result installResult
	if json.Unmarshal(data, &result) == nil && !result.Success {
		m.status = Status{State: stateError, Message: result.Message}
	}
	removeUpdateFile(filepath.Join(m.cacheRoot, "result.json"))
}
