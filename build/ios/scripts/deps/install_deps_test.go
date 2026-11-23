package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestPromptUserDoesNotAuthorizeSystemChangesFromCIAlone(t *testing.T) {
	t.Setenv("CI", "true")
	t.Setenv("TASK_FORCE_YES", "false")
	if promptUser("Configure developer path?") {
		t.Fatal("a CI environment must not authorize changing developer tools")
	}
}

func TestPromptUserHonorsExplicitForceYes(t *testing.T) {
	t.Setenv("CI", "true")
	t.Setenv("TASK_FORCE_YES", "true")
	if !promptUser("Configure developer path?") {
		t.Fatal("the explicit setup override should still authorize the command")
	}
}

func TestIOSDependencyCheckerHelperProcess(t *testing.T) {
	if os.Getenv("ZHUSUAN_IOS_DEPENDENCY_HELPER") != "true" {
		return
	}
	main()
	os.Exit(0)
}

func runDependencyFixture(t *testing.T, failVersion, unavailableDevice bool) (string, error) {
	t.Helper()
	if os.PathSeparator != '/' {
		t.Skip("the isolated tool fixture uses POSIX shell executables")
	}
	root := t.TempDir()
	developerPath := filepath.Join(root, "Xcode.app", "Contents", "Developer")
	sdkPath := filepath.Join(root, "sdk")
	for _, path := range []string{developerPath, filepath.Join(sdkPath, "System", "Library", "Frameworks", "UIKit.framework")} {
		if err := os.MkdirAll(path, 0o700); err != nil {
			t.Fatal(err)
		}
	}
	tools := map[string]string{
		"xcodebuild":   "#!/bin/sh\nprintf 'Xcode 26.0\\n'\n",
		"xcode-select": "#!/bin/sh\nprintf '%s\\n' \"$ZHUSUAN_FIXTURE_DEVELOPER_PATH\"\n",
		"xcrun": `#!/bin/sh
case "$*" in
  "--sdk iphonesimulator --show-sdk-path") printf '%s\n' "$ZHUSUAN_FIXTURE_SDK_PATH" ;;
  "--sdk iphonesimulator --show-sdk-version")
    if [ "$ZHUSUAN_FIXTURE_FAIL_VERSION" = true ]; then exit 4; fi
    printf '26.0\n' ;;
  "simctl list runtimes") printf 'iOS 26.0 (26.0 - 23A) - com.apple.CoreSimulator.SimRuntime.iOS-26-0\n' ;;
  "simctl list devices")
    if [ "$ZHUSUAN_FIXTURE_UNAVAILABLE_DEVICE" = true ]; then
      printf 'iPhone 15 Pro (00000000-0000-0000-0000-000000000000) (unavailable)\n'
    else
      printf 'iPhone 15 Pro (00000000-0000-0000-0000-000000000000) (Shutdown)\n'
    fi ;;
  "simctl help") exit 0 ;;
  *) exit 3 ;;
esac
`,
	}
	for name, script := range tools {
		if err := os.WriteFile(filepath.Join(root, name), []byte(script), 0o700); err != nil {
			t.Fatal(err)
		}
	}
	cmd := exec.Command(os.Args[0], "-test.run=^TestIOSDependencyCheckerHelperProcess$") // #nosec G204 -- re-executes this test binary with a fixed helper-test selector.
	cmd.Env = append(os.Environ(),
		"PATH="+root,
		"CI=true", "TASK_FORCE_YES=false", "ZHUSUAN_IOS_DEPENDENCY_HELPER=true",
		"ZHUSUAN_FIXTURE_DEVELOPER_PATH="+developerPath, "ZHUSUAN_FIXTURE_SDK_PATH="+sdkPath,
		"ZHUSUAN_FIXTURE_FAIL_VERSION="+boolString(failVersion),
		"ZHUSUAN_FIXTURE_UNAVAILABLE_DEVICE="+boolString(unavailableDevice),
	)
	output, err := cmd.CombinedOutput()
	return string(output), err
}

func boolString(value bool) string {
	if value {
		return "true"
	}
	return "false"
}

func TestIOSDependencyCheckerRejectsUnreadableSDKVersion(t *testing.T) {
	output, err := runDependencyFixture(t, true, false)
	if err == nil || !strings.Contains(output, "Cannot determine iOS SDK version") {
		t.Fatalf("SDK version failure must fail the required check; err=%v\n%s", err, output)
	}
}

func TestIOSDependencyCheckerDoesNotCountUnavailableIPhones(t *testing.T) {
	output, err := runDependencyFixture(t, false, true)
	if err != nil {
		t.Fatalf("a missing optional device should not invalidate the installed SDK: %v\n%s", err, output)
	}
	if strings.Contains(output, "✅ 0 iPhone") || !strings.Contains(output, "No iPhone simulator devices found") {
		t.Fatalf("unavailable devices must not be reported as ready\n%s", output)
	}
}
