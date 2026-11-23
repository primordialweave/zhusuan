package updater

import (
	"archive/zip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type installPlan struct {
	Kind       string `json:"kind"`
	Target     string `json:"target"`
	Executable string `json:"executable"`
	Package    string `json:"package"`
	Staged     string `json:"staged"`
	Version    string `json:"version"`
	ParentPID  int    `json:"parentPID"`
	WorkDir    string `json:"workDir"`
	ResultPath string `json:"resultPath"`
}

type installResult struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

func detectTarget(platform, executable string) (installTarget, error) {
	target := installTarget{executable: executable}
	switch platform {
	case kindWindows:
		target.kind, target.path = kindWindows, filepath.Dir(executable)
		if !isWindowsExecutable(filepath.Base(executable)) {
			return target, errors.New("请使用已安装的 zhusuan 应用更新")
		}
	case kindDarwin:
		target.kind = kindDarwin
		for dir := filepath.Dir(executable); dir != filepath.Dir(dir); dir = filepath.Dir(dir) {
			if strings.HasSuffix(dir, ".app") {
				target.path = dir
				break
			}
		}
		if target.path == "" {
			return target, errors.New("请安装珠算后再更新")
		}
		if strings.HasPrefix(target.path, "/Volumes/") || strings.Contains(target.path, "/AppTranslocation/") {
			return target, errors.New("请将珠算移到应用程序文件夹后再更新")
		}
	case "linux":
		return detectLinuxTarget(executable)
	default:
		return target, errors.New("当前系统暂不支持自动更新")
	}
	return target, nil
}

func detectLinuxTarget(executable string) (installTarget, error) {
	target := installTarget{executable: executable}
	if image := os.Getenv("APPIMAGE"); image != "" && filepath.IsAbs(image) && strings.HasSuffix(image, ".AppImage") {
		target.kind, target.path = kindAppImage, image
		return target, nil
	}
	// A package update must target a package that actually owns this executable.
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	// #nosec G204 -- Fixed package-query executable; the absolute running executable is one argument, never shell text.
	if output, err := exec.CommandContext(ctx, "dpkg-query", "-S", executable).Output(); err == nil && (strings.Contains(strings.ToLower(string(output)), executableName+":") || strings.Contains(strings.ToLower(string(output)), strings.ToLower(legacyExecutableName)+":")) {
		target.kind, target.path = kindDeb, executable
	} else if output, err := exec.CommandContext(ctx, kindRPM, "-qf", "--qf", "%{NAME}", executable).Output(); err == nil && (strings.EqualFold(strings.TrimSpace(string(output)), executableName) || strings.EqualFold(strings.TrimSpace(string(output)), legacyExecutableName)) { // #nosec G204 -- Fixed RPM query with the running executable passed as a single argument.
		target.kind, target.path = kindRPM, executable
	} else {
		return target, errors.New("此安装方式暂不支持自动更新，请使用 AppImage 或系统安装包")
	}
	if os.Geteuid() != 0 {
		if _, err := exec.LookPath("pkexec"); err != nil {
			return target, errors.New("系统安装包更新需要安装 PolicyKit (pkexec)")
		}
	}
	return target, nil
}

func prepareReplacement(ctx context.Context, plan installPlan) (staged, root string, err error) {
	if plan.Kind != kindDarwin && plan.Kind != kindAppImage {
		return "", "", nil
	}
	root, err = os.MkdirTemp(filepath.Dir(plan.Target), ".zhusuan-update-")
	if err != nil {
		return "", root, errors.New("安装目录不可写，请将应用安装到可写的位置后重试")
	}
	if plan.Kind == kindAppImage {
		staged = filepath.Join(root, filepath.Base(plan.Target))
		err = copyFile(plan.Package, staged, 0o755)
		return staged, root, err
	}
	staged = filepath.Join(root, appBundleName)
	if err = extractApp(ctx, plan.Package, root); err != nil {
		return staged, root, err
	}
	bundleID, binaryName := productIdentifier, executableName
	if _, statErr := os.Stat(staged); errors.Is(statErr, os.ErrNotExist) {
		staged = filepath.Join(root, legacyAppBundleName)
		bundleID, binaryName = legacyProductIdentifier, legacyExecutableName
	}
	plist := filepath.Join(staged, "Contents", "Info.plist")
	for key, expected := range map[string]string{"CFBundleIdentifier": bundleID, "CFBundleExecutable": binaryName, "CFBundleShortVersionString": plan.Version} {
		// #nosec G204 -- Fixed system binary; this plist is inside the verified staged application.
		value, readErr := exec.CommandContext(ctx, "/usr/libexec/PlistBuddy", "-c", "Print :"+key, plist).Output()
		if readErr != nil || strings.TrimSpace(string(value)) != expected {
			return staged, root, errors.New("更新应用的名称或版本与发布信息不匹配")
		}
	}
	executable := filepath.Join(staged, "Contents", "MacOS", binaryName)
	info, err := os.Stat(executable)
	if err != nil || !info.Mode().IsRegular() || info.Mode().Perm()&0o111 == 0 {
		return staged, root, errors.New("更新包缺少可执行的 zhusuan 应用")
	}
	return staged, root, nil
}

func copyFile(source, destination string, mode os.FileMode) error {
	in, err := os.Open(source)
	if err != nil {
		return err
	}
	defer closeRead(in)
	out, err := os.OpenFile(destination, os.O_CREATE|os.O_EXCL|os.O_WRONLY, mode)
	if err != nil {
		return err
	}
	_, err = io.Copy(out, in)
	if syncErr := out.Sync(); err == nil {
		err = syncErr
	}
	if closeErr := out.Close(); err == nil {
		err = closeErr
	}
	return err
}

func extractApp(ctx context.Context, archive, directory string) error {
	reader, err := zip.OpenReader(archive)
	if err != nil {
		return errors.New("无法读取更新应用压缩包")
	}
	defer closeRead(reader)
	var expanded uint64
	var bundleRoot string
	if len(reader.File) > 20000 {
		return errors.New("更新包文件数量超过限制")
	}
	for _, file := range reader.File {
		if err = ctx.Err(); err != nil {
			return err
		}
		name := strings.TrimSuffix(file.Name, "/")
		if name == "__MACOSX" || strings.HasPrefix(name, "__MACOSX/") {
			continue
		}
		root := strings.SplitN(name, "/", 2)[0]
		if bundleRoot != "" && root != bundleRoot {
			return errors.New("更新包包含多个应用目录")
		}
		bundleRoot = root
		expanded += file.UncompressedSize64
		if expanded > 1<<30 {
			return errors.New("更新包解压大小超过限制")
		}
		if err = extractAppFile(file, name, directory); err != nil {
			return err
		}
	}
	return nil
}

func appArchivePath(name, directory string) (string, error) {
	root := strings.SplitN(name, "/", 2)[0]
	if root != appBundleName && root != legacyAppBundleName {
		return "", errors.New("更新包包含应用目录之外的文件")
	}
	clean := filepath.Clean(filepath.FromSlash(name))
	if filepath.IsAbs(clean) || clean != filepath.FromSlash(name) || strings.Contains(name, "\\") {
		return "", errors.New("更新包包含无效的文件路径")
	}
	destination := filepath.Join(directory, clean)
	// Never write through a link supplied by an earlier archive entry.
	for parent := filepath.Dir(destination); parent != directory; parent = filepath.Dir(parent) {
		if parent == filepath.Dir(parent) {
			return "", errors.New("更新包包含无效路径")
		}
		if info, err := os.Lstat(parent); err == nil && info.Mode()&os.ModeSymlink != 0 {
			return "", errors.New("更新包试图通过符号链接写入文件")
		}
	}
	return destination, nil
}

func extractAppFile(file *zip.File, name, directory string) error {
	destination, err := appArchivePath(name, directory)
	if err != nil {
		return err
	}
	if file.FileInfo().IsDir() {
		// #nosec G301 -- App bundle directories need execute/read permissions inside private 0700 staging.
		return os.MkdirAll(destination, 0o755)
	}
	// #nosec G301 -- Preserve shared app bundle directory permissions inside private staging.
	if err = os.MkdirAll(filepath.Dir(destination), 0o755); err != nil {
		return err
	}
	input, err := file.Open()
	if err != nil {
		return err
	}
	defer closeRead(input)
	if file.Mode()&os.ModeSymlink != 0 {
		return extractAppLink(input, name, destination)
	}
	if !file.Mode().IsRegular() {
		return errors.New("更新包包含不支持的文件类型")
	}
	output, err := os.OpenFile(destination, os.O_WRONLY|os.O_CREATE|os.O_EXCL, file.Mode().Perm()&0o755)
	if err != nil {
		return err
	}
	_, err = io.Copy(output, io.LimitReader(input, 1<<30+1))
	if closeErr := output.Close(); err == nil {
		err = closeErr
	}
	return err
}

func extractAppLink(input io.Reader, name, destination string) error {
	data, err := io.ReadAll(io.LimitReader(input, 4097))
	if err != nil || len(data) > 4096 {
		return errors.New("更新包包含无效符号链接")
	}
	link := string(data)
	bundleRoot := strings.SplitN(filepath.FromSlash(name), string(filepath.Separator), 2)[0]
	resolved := filepath.Clean(filepath.Join(filepath.Dir(filepath.FromSlash(name)), link))
	if filepath.IsAbs(link) || (resolved != bundleRoot && !strings.HasPrefix(resolved, bundleRoot+string(filepath.Separator))) {
		return errors.New("更新包符号链接指向应用目录之外")
	}
	return os.Symlink(link, destination)
}

func launchHelper(plan installPlan) error {
	helper := filepath.Join(plan.WorkDir, "zhusuan-update-helper")
	if plan.Kind == kindWindows {
		helper += ".exe"
	}
	source, err := os.Executable()
	if err != nil {
		return err
	}
	if err = copyFile(source, helper, 0o700); err != nil {
		return err
	}
	data, err := json.Marshal(plan)
	if err != nil {
		return err
	}
	planPath := filepath.Join(plan.WorkDir, "plan.json")
	if err = os.WriteFile(planPath, data, 0o600); err != nil {
		return err
	}
	// #nosec G204 -- helper is a private copy of the running executable; arguments are a private plan file.
	cmd := exec.Command(helper, "--zhusuan-update-helper", planPath)
	detach(cmd)
	if err = cmd.Start(); err != nil {
		return err
	}
	// An acknowledgement prevents closing the app if the helper cannot initialize.
	exit := make(chan error, 1)
	go func() { exit <- cmd.Wait() }()
	timer := time.NewTimer(10 * time.Second)
	defer timer.Stop()
	tick := time.NewTicker(50 * time.Millisecond)
	defer tick.Stop()
	for {
		select {
		case err = <-exit:
			return fmt.Errorf("更新助手未就绪: %v", err)
		case <-timer.C:
			if killErr := cmd.Process.Kill(); killErr != nil {
				slog.Debug("Unable to stop update helper", "error", killErr)
			}
			return errors.New("更新助手启动超时")
		case <-tick.C:
			if _, err = os.Stat(filepath.Join(plan.WorkDir, "ready")); err == nil {
				return nil
			}
		}
	}
}

// RunHelper handles a private updater invocation before database, HTTP, or window startup.
func RunHelper(args []string) (handled bool, err error) {
	if len(args) == 0 || (args[0] != "--zhusuan-update-helper" && args[0] != "--orange-update-helper") {
		return false, nil
	}
	if len(args) != 2 {
		return true, errors.New("更新助手参数无效")
	}
	file, err := os.Open(args[1])
	if err != nil {
		return true, err
	}
	data, err := io.ReadAll(io.LimitReader(file, 16<<10+1))
	closeRead(file)
	if err != nil || len(data) > 16<<10 {
		return true, errors.New("更新助手计划无效")
	}
	var plan installPlan
	if err = json.Unmarshal(data, &plan); err != nil {
		return true, err
	}
	if err = validatePlan(plan, args[1]); err != nil {
		return true, err
	}
	if err = os.WriteFile(filepath.Join(plan.WorkDir, "ready"), []byte("ready"), 0o600); err != nil {
		return true, err
	}
	if err = waitForExit(plan.ParentPID, 90*time.Second); err != nil {
		writeResult(plan, false, err.Error())
		return true, err
	}
	err = installAndRestart(plan, runInstaller, restartApplication)
	cleanupHelper(plan)
	return true, err
}

func cleanupHelper(plan installPlan) {
	removeUpdatePath(plan.WorkDir)
	if plan.Staged != "" {
		// A failed rollback leaves the only old copy here. Never remove that backup.
		if _, statErr := os.Lstat(filepath.Join(filepath.Dir(plan.Staged), "previous")); errors.Is(statErr, os.ErrNotExist) {
			removeUpdatePath(filepath.Dir(plan.Staged))
		}
	}
}

func validatePlan(plan installPlan, planPath string) error {
	for _, p := range []string{plan.Target, plan.Executable, plan.Package, plan.WorkDir, plan.ResultPath} {
		if !filepath.IsAbs(p) || filepath.Clean(p) == string(filepath.Separator) {
			return errors.New("更新助手路径无效")
		}
	}
	if planPath != filepath.Join(plan.WorkDir, "plan.json") || filepath.Dir(plan.Package) != plan.WorkDir ||
		plan.ResultPath != filepath.Join(filepath.Dir(plan.WorkDir), "result.json") ||
		!strings.HasPrefix(filepath.Base(plan.WorkDir), "update-") || plan.ParentPID <= 1 || plan.ParentPID == os.Getpid() {
		return errors.New("更新助手计划无效")
	}
	if !IsNewer(plan.Version, "0.0.0") {
		return errors.New("更新版本无效")
	}
	return validateInstallTarget(plan)
}

func validateInstallTarget(plan installPlan) error {
	switch plan.Kind {
	case kindWindows:
		if filepath.Dir(plan.Executable) != plan.Target || !isWindowsExecutable(filepath.Base(plan.Executable)) {
			return errors.New("更新安装目录无效")
		}
	case kindDarwin, kindAppImage:
		if plan.Staged == "" || !filepath.IsAbs(plan.Staged) ||
			filepath.Dir(filepath.Dir(plan.Staged)) != filepath.Dir(plan.Target) ||
			(!strings.HasPrefix(filepath.Base(filepath.Dir(plan.Staged)), ".zhusuan-update-") && !strings.HasPrefix(filepath.Base(filepath.Dir(plan.Staged)), ".Orange-update-")) {
			return errors.New("更新暂存目录无效")
		}
		if plan.Kind == kindDarwin && (filepath.Ext(plan.Target) != ".app" || (filepath.Base(plan.Staged) != appBundleName && filepath.Base(plan.Staged) != legacyAppBundleName)) {
			return errors.New("更新应用目录无效")
		}
	case kindDeb, kindRPM:
	default:
		return errors.New("更新安装类型无效")
	}
	return nil
}

func isWindowsExecutable(name string) bool {
	return strings.EqualFold(name, executableName+".exe") || strings.EqualFold(name, legacyExecutableName+".exe")
}

func writeResult(plan installPlan, success bool, message string) {
	data, err := json.Marshal(installResult{Success: success, Message: message})
	if err == nil {
		err = os.WriteFile(plan.ResultPath, data, 0o600)
	}
	if err != nil {
		slog.Warn("Unable to record update result", "error", err)
	}
}

func installAndRestart(plan installPlan, installer func(installPlan) error, restart func(installPlan) error) error {
	var backup string
	if plan.Kind == kindDarwin || plan.Kind == kindAppImage {
		backup = filepath.Join(filepath.Dir(plan.Staged), "previous")
		if err := os.Rename(plan.Target, backup); err != nil {
			return restartOnFailure(plan, restart, fmt.Errorf("无法备份当前应用: %w", err))
		}
		if err := os.Rename(plan.Staged, plan.Target); err != nil {
			restoreErr := os.Rename(backup, plan.Target)
			if restoreErr != nil {
				err := fmt.Errorf("更新失败，旧应用保存在 %s: %w", backup, restoreErr)
				writeResult(plan, false, err.Error())
				return err
			}
			return restartOnFailure(plan, restart, fmt.Errorf("无法替换应用，已恢复旧版本: %w", err))
		}
	} else if err := installer(plan); err != nil {
		return restartOnFailure(plan, restart, err)
	}
	writeResult(plan, true, "更新完成")
	if err := restart(plan); err != nil {
		if backup != "" {
			if moveErr := os.Rename(plan.Target, plan.Staged); moveErr != nil {
				err := fmt.Errorf("新应用启动失败，旧应用保存在 %s: %w", backup, moveErr)
				writeResult(plan, false, err.Error())
				return err
			}
			if restoreErr := os.Rename(backup, plan.Target); restoreErr != nil {
				err := fmt.Errorf("新应用启动失败，旧应用保存在 %s: %w", backup, restoreErr)
				writeResult(plan, false, err.Error())
				return err
			}
			return restartOnFailure(plan, restart, fmt.Errorf("新应用启动失败，已恢复旧版本: %w", err))
		}
		failure := fmt.Errorf("更新已安装，但自动启动失败，请手动打开 zhusuan: %w", err)
		writeResult(plan, false, failure.Error())
		return failure
	}
	if backup != "" {
		removeUpdatePath(backup)
	}
	return nil
}

func restartOnFailure(plan installPlan, restart func(installPlan) error, err error) error {
	writeResult(plan, false, err.Error())
	if restartErr := restart(plan); restartErr != nil {
		failure := fmt.Errorf("%w；旧应用重启失败: %v", err, restartErr)
		writeResult(plan, false, failure.Error())
		return failure
	}
	return err
}
