// Package main checks Android development tools without modifying SDK configuration.
package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

func main() {
	fmt.Println("Checking Android development dependencies...")
	fmt.Println()
	var issues []string
	issues = append(issues, checkRequiredCommand("go", []string{"version"}, "Go", "Go is not installed. Install from https://go.dev/dl/")...)

	androidHome, err := findAndroidSDK()
	if err != nil {
		issues = append(issues, err.Error())
	} else {
		fmt.Printf("✓ ANDROID_HOME: %s\n", androidHome)
	}
	issues = append(issues, checkADB(androidHome)...)
	issues = append(issues, checkEmulator(androidHome)...)
	ndkHome, err := findAndroidNDK(androidHome)
	if err != nil {
		issues = append(issues, err.Error())
	} else {
		fmt.Printf("✓ Android NDK: %s\n", ndkHome)
	}
	issues = append(issues, checkRequiredCommand("java", []string{"-version"}, "Java", "Java not found. Install JDK 11+ (OpenJDK recommended)")...)
	fmt.Println()
	if len(issues) > 0 {
		printAndroidSetup(issues)
		os.Exit(1)
	}
	fmt.Println("✓ All Android development dependencies are installed!")
}

func validateDirectory(label, path string) error {
	info, err := os.Stat(path) // #nosec G703 -- this local checker intentionally inspects SDK directories chosen by the developer; it does not read file contents or write them.
	if err != nil {
		return fmt.Errorf("%s path is unavailable: %w", label, err)
	}
	if !info.IsDir() {
		return fmt.Errorf("%s path is not a directory: %s", label, path)
	}
	return nil
}

func findAndroidSDK() (string, error) {
	androidHome := os.Getenv("ANDROID_HOME")
	if androidHome == "" {
		androidHome = os.Getenv("ANDROID_SDK_ROOT")
	}
	if androidHome != "" {
		return androidHome, validateDirectory("Android SDK", androidHome)
	}
	var paths []string
	// An unavailable home must not turn default SDK probes into relative paths.
	home, homeErr := os.UserHomeDir()
	if homeErr == nil {
		paths = append(paths, filepath.Join(home, "Android", "Sdk"), filepath.Join(home, "Library", "Android", "sdk"))
	}
	paths = append(paths, "/usr/local/share/android-sdk")
	for _, path := range paths {
		if validateDirectory("Android SDK", path) == nil {
			return path, nil
		}
	}
	if homeErr != nil {
		return "", fmt.Errorf("cannot find Android SDK or determine the user home directory: %w", homeErr)
	}
	return "", fmt.Errorf("ANDROID_HOME not set. Install Android Studio and set ANDROID_HOME environment variable")
}

func findAndroidNDK(androidHome string) (string, error) {
	if path := os.Getenv("ANDROID_NDK_HOME"); path != "" {
		return path, validateDirectory("Android NDK", path)
	}
	if androidHome != "" {
		ndkDir := filepath.Join(androidHome, "ndk")
		entries, err := os.ReadDir(ndkDir)
		if err == nil {
			for _, entry := range entries {
				if entry.IsDir() {
					return filepath.Join(ndkDir, entry.Name()), nil
				}
			}
		}
	}
	return "", fmt.Errorf("android NDK not found. Install NDK via Android Studio > SDK Manager > SDK Tools > NDK (Side by side)")
}

func checkRequiredCommand(name string, args []string, label, failure string) []string {
	if !checkCommand(name, args...) {
		return []string{failure}
	}
	fmt.Printf("✓ %s is installed\n", label)
	return nil
}

func checkADB(androidHome string) []string {
	failure := "adb not found. Install Android SDK Platform-Tools"
	if androidHome != "" {
		failure = fmt.Sprintf("adb not found. Add %s to PATH", filepath.Join(androidHome, "platform-tools"))
	}
	return checkRequiredCommand("adb", []string{"version"}, "adb", failure)
}

func checkEmulator(androidHome string) []string {
	output, err := exec.Command("emulator", "-list-avds").Output()
	if err != nil {
		if androidHome != "" {
			return []string{fmt.Sprintf("emulator not found. Add %s to PATH", filepath.Join(androidHome, "emulator"))}
		}
		return []string{"emulator not found. Install Android Emulator via SDK Manager"}
	}
	fmt.Println("✓ Android Emulator is installed")
	avds := strings.TrimSpace(string(output))
	if avds == "" {
		fmt.Println("⚠ No Android Virtual Devices found. Create one via Android Studio > Tools > Device Manager")
	} else {
		fmt.Printf("✓ Found %d Android Virtual Device(s)\n", len(strings.Split(avds, "\n")))
	}
	return nil
}

func printAndroidSetup(issues []string) {
	fmt.Println("❌ Missing dependencies:")
	for _, issue := range issues {
		fmt.Printf("   - %s\n", issue)
	}
	fmt.Println()
	fmt.Println("Setup instructions:")
	fmt.Println("1. Install Android Studio: https://developer.android.com/studio")
	fmt.Println("2. Open SDK Manager and install:")
	fmt.Println("   - Android SDK Platform (API 34)")
	fmt.Println("   - Android SDK Build-Tools")
	fmt.Println("   - Android SDK Platform-Tools")
	fmt.Println("   - Android Emulator")
	fmt.Println("   - NDK (Side by side)")
	fmt.Println("3. Set environment variables:")
	if runtime.GOOS == "darwin" {
		fmt.Println("   export ANDROID_HOME=$HOME/Library/Android/sdk")
	} else {
		fmt.Println("   export ANDROID_HOME=$HOME/Android/Sdk")
	}
	fmt.Println("   export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator")
	fmt.Println("4. Create an AVD via Android Studio > Tools > Device Manager")
}

func checkCommand(name string, args ...string) bool {
	cmd := exec.Command(name, args...) // #nosec G204 -- developer dependency checker runs fixed commands defined by this script.
	cmd.Stdout = nil
	cmd.Stderr = nil
	return cmd.Run() == nil
}
