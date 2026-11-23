package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestAndroidDependencyCheckerHelperProcess(t *testing.T) {
	if os.Getenv("ZHUSUAN_ANDROID_DEPENDENCY_HELPER") != "true" {
		return
	}
	main()
	os.Exit(0)
}

func runAndroidFixture(t *testing.T, sdkIsFile, ndkIsFile bool) (string, error) {
	t.Helper()
	if os.PathSeparator != '/' {
		t.Skip("the isolated tool fixture uses POSIX shell executables")
	}
	root := t.TempDir()
	sdk := filepath.Join(root, "sdk")
	ndk := filepath.Join(root, "ndk")
	for path, isFile := range map[string]bool{sdk: sdkIsFile, ndk: ndkIsFile} {
		var err error
		if isFile {
			err = os.WriteFile(path, []byte("not a development directory"), 0o600)
		} else {
			err = os.Mkdir(path, 0o700)
		}
		if err != nil {
			t.Fatal(err)
		}
	}
	for _, name := range []string{"go", "adb", "emulator", "java"} {
		if err := os.WriteFile(filepath.Join(root, name), []byte("#!/bin/sh\nprintf 'fixture-tool\\n'\n"), 0o700); err != nil {
			t.Fatal(err)
		}
	}
	cmd := exec.Command(os.Args[0], "-test.run=^TestAndroidDependencyCheckerHelperProcess$") // #nosec G204 -- re-executes this test binary with a fixed helper-test selector.
	cmd.Env = append(os.Environ(), "PATH="+root, "ANDROID_HOME="+sdk,
		"ANDROID_SDK_ROOT=", "ANDROID_NDK_HOME="+ndk, "ZHUSUAN_ANDROID_DEPENDENCY_HELPER=true")
	output, err := cmd.CombinedOutput()
	return string(output), err
}

func TestAndroidDependencyCheckerRejectsFileAsSDK(t *testing.T) {
	output, err := runAndroidFixture(t, true, false)
	if err == nil || !strings.Contains(output, "Android SDK path is not a directory") {
		t.Fatalf("an existing file must not count as an SDK directory; err=%v\n%s", err, output)
	}
}

func TestAndroidDependencyCheckerRejectsFileAsNDK(t *testing.T) {
	output, err := runAndroidFixture(t, false, true)
	if err == nil || !strings.Contains(output, "Android NDK path is not a directory") {
		t.Fatalf("an existing file must not count as an NDK directory; err=%v\n%s", err, output)
	}
}

func TestAndroidDependencyCheckerAcceptsValidToolDirectories(t *testing.T) {
	output, err := runAndroidFixture(t, false, false)
	if err != nil || !strings.Contains(output, "All Android development dependencies are installed") {
		t.Fatalf("valid directories and successful tool checks should remain accepted; err=%v\n%s", err, output)
	}
}
