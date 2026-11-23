// Package main checks iOS development tools and offers explicit setup commands.
// Run with TASK_FORCE_YES=true to accept setup prompts. CI alone stays read-only.
package main

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

const simulatorTool = "simctl"

type dependency struct {
	CheckFunc  func() (bool, string)
	Required   bool
	InstallCmd []string
	InstallMsg string
	SuccessMsg string
	FailureMsg string
}

type simulatorRuntime struct {
	version    string
	identifier string
}

func main() {
	fmt.Println("Checking iOS development dependencies...")
	fmt.Println(strings.Repeat("=", 51))
	fmt.Println()

	hasErrors := checkDependencies(iosDependencies())
	if !checkIPhoneDevices() {
		hasErrors = true
	}
	fmt.Println()
	fmt.Println(strings.Repeat("=", 51))
	if hasErrors {
		printSetupGuide()
		os.Exit(1)
	}
	fmt.Println("✅ All required dependencies are installed!")
	fmt.Println("   You're ready for iOS development with Wails!")
}

func iosDependencies() []dependency {
	return []dependency{
		{
			CheckFunc:  checkXcode,
			Required:   true,
			InstallMsg: "Please install Xcode from the Mac App Store:\n   https://apps.apple.com/app/xcode/id497799835\n   Xcode is REQUIRED for iOS development (includes iOS SDKs, simulators, and frameworks)",
			SuccessMsg: "✅ Xcode found",
			FailureMsg: "❌ Xcode not found (REQUIRED)",
		},
		{
			CheckFunc:  checkDeveloperPath,
			Required:   true,
			InstallCmd: []string{"sudo", "xcode-select", "-s", "/Applications/Xcode.app/Contents/Developer"},
			InstallMsg: "Xcode developer path needs to be configured",
			SuccessMsg: "✅ Xcode developer path configured",
			FailureMsg: "❌ Xcode developer path not configured correctly",
		},
		{
			CheckFunc:  checkIOSSDK,
			Required:   true,
			InstallMsg: "iOS SDK comes with Xcode. Please ensure Xcode is properly installed.",
			SuccessMsg: "✅ iOS SDK found with UIKit framework",
			FailureMsg: "❌ iOS SDK not found or incomplete",
		},
		{
			CheckFunc:  checkSimulatorRuntime,
			Required:   true,
			InstallMsg: "iOS Simulator runtimes come with Xcode. You may need to download them:\n   Xcode → Settings → Platforms → iOS",
			SuccessMsg: "✅ iOS Simulator runtime available",
			FailureMsg: "❌ iOS Simulator runtime not available",
		},
	}
}

func commandOutput(name string, args ...string) ([]byte, error) {
	return exec.Command(name, args...).Output() // #nosec G204 -- only fixed developer-tool commands defined in this script are supplied.
}

func checkXcode() (bool, string) {
	out, err := commandOutput("xcodebuild", "-version")
	if err != nil {
		return false, ""
	}
	return true, strings.TrimSpace(strings.Split(string(out), "\n")[0])
}

func checkDeveloperPath() (bool, string) {
	out, err := commandOutput("xcode-select", "-p")
	if err != nil {
		return false, "xcode-select not configured"
	}
	path := strings.TrimSpace(string(out))
	if info, err := os.Stat(path); err != nil || !info.IsDir() {
		return false, "Invalid Xcode path"
	}
	if !strings.Contains(path, "Xcode.app") {
		return false, fmt.Sprintf("Points to %s (should be Xcode.app)", path)
	}
	return true, path
}

func checkIOSSDK() (bool, string) {
	output, err := commandOutput("xcrun", "--sdk", "iphonesimulator", "--show-sdk-path")
	if err != nil {
		return false, "Cannot find iOS SDK"
	}
	sdkPath := strings.TrimSpace(string(output))
	if info, err := os.Stat(sdkPath); err != nil || !info.IsDir() {
		return false, "iOS SDK path not found"
	}
	uikitPath := filepath.Join(sdkPath, "System", "Library", "Frameworks", "UIKit.framework")
	if info, err := os.Stat(uikitPath); err != nil || !info.IsDir() {
		return false, "UIKit.framework not found"
	}
	versionOut, err := commandOutput("xcrun", "--sdk", "iphonesimulator", "--show-sdk-version")
	version := strings.TrimSpace(string(versionOut))
	if err != nil || version == "" {
		return false, "Cannot determine iOS SDK version"
	}
	return true, fmt.Sprintf("iOS %s SDK", version)
}

func availableRuntimes(output string) []simulatorRuntime {
	var runtimes []simulatorRuntime
	for _, line := range strings.Split(output, "\n") {
		parts := strings.Fields(line)
		if len(parts) < 3 || parts[0] != "iOS" || strings.Contains(line, "unavailable") {
			continue
		}
		identifier := parts[len(parts)-1]
		if strings.HasPrefix(identifier, "com.apple.CoreSimulator.SimRuntime.iOS-") {
			runtimes = append(runtimes, simulatorRuntime{version: parts[1], identifier: identifier})
		}
	}
	return runtimes
}

func checkSimulatorRuntime() (bool, string) {
	out, err := commandOutput("xcrun", simulatorTool, "list", "runtimes")
	if err != nil {
		return false, "Cannot access simulator"
	}
	runtimes := availableRuntimes(string(out))
	if len(runtimes) == 0 {
		return false, "No iOS runtimes installed"
	}
	versions := make([]string, len(runtimes))
	for i, current := range runtimes {
		versions[i] = current.version
	}
	return true, fmt.Sprintf("%d runtime(s): %s", len(runtimes), strings.Join(versions, ", "))
}

func checkDependencies(dependencies []dependency) bool {
	hasErrors := false
	for _, dep := range dependencies {
		success, details := dep.CheckFunc()
		if success {
			message := dep.SuccessMsg
			if details != "" {
				message = fmt.Sprintf("%s (%s)", message, details)
			}
			fmt.Println(message)
			continue
		}
		fmt.Println(dep.FailureMsg)
		if details != "" {
			fmt.Printf("   Details: %s\n", details)
		}
		if dep.Required {
			hasErrors = true
			offerDependencySetup(dep)
		}
	}
	return hasErrors
}

func offerDependencySetup(dep dependency) {
	if len(dep.InstallCmd) == 0 {
		fmt.Println("   " + dep.InstallMsg)
		return
	}
	fmt.Println()
	fmt.Println("   " + dep.InstallMsg)
	fmt.Printf("   Fix command: %s\n", strings.Join(dep.InstallCmd, " "))
	if !promptUser("Do you want to run this command?") {
		fmt.Printf("   Please run manually: %s\n", strings.Join(dep.InstallCmd, " "))
		return
	}
	fmt.Println("Running command...")
	if err := runSetupCommand(dep.InstallCmd); err != nil {
		fmt.Printf("Command failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("✅ Command completed. Please run this check again.")
}

func runSetupCommand(args []string) error {
	cmd := exec.Command(args[0], args[1:]...) // #nosec G204 -- commands come from fixed setup descriptors and run only after an explicit prompt/force override.
	cmd.Stdout, cmd.Stderr, cmd.Stdin = os.Stdout, os.Stderr, os.Stdin
	return cmd.Run()
}

func checkIPhoneDevices() bool {
	fmt.Println()
	fmt.Println("Checking for iPhone simulator devices...")
	out, err := commandOutput("xcrun", simulatorTool, "list", "devices")
	if err != nil {
		fmt.Println("❌ Failed to list simulator devices")
		return false
	}
	count := 0
	for _, line := range strings.Split(string(out), "\n") {
		if strings.Contains(line, "iPhone") && !strings.Contains(line, "unavailable") {
			count++
		}
	}
	if count > 0 {
		fmt.Printf("✅ %d iPhone simulator device(s) available\n", count)
		return true
	}
	fmt.Println("⚠️  No iPhone simulator devices found")
	fmt.Println()
	offerSimulatorCreation()
	return true
}

func offerSimulatorCreation() {
	out, err := commandOutput("xcrun", simulatorTool, "list", "runtimes")
	if err != nil {
		fmt.Println("   Failed to get iOS runtimes:", err)
		return
	}
	runtimes := availableRuntimes(string(out))
	if len(runtimes) == 0 {
		fmt.Println("   No iOS runtime found. Please install iOS simulators in Xcode:")
		fmt.Println("   Xcode → Settings → Platforms → iOS")
		return
	}
	createCmd := []string{"xcrun", simulatorTool, "create", "iPhone 15 Pro", "iPhone 15 Pro", runtimes[len(runtimes)-1].identifier}
	fmt.Println("   Would you like to create an iPhone 15 Pro simulator?")
	fmt.Printf("   Command: %s\n", strings.Join(createCmd, " "))
	if !promptUser("Create simulator?") {
		fmt.Println("   Skipping simulator creation")
		fmt.Printf("   Create manually: %s\n", strings.Join(createCmd, " "))
		return
	}
	if err := runSetupCommand(createCmd); err != nil {
		fmt.Printf("   Failed to create simulator: %v\n", err)
		return
	}
	fmt.Println("   ✅ iPhone 15 Pro simulator created")
}

func printSetupGuide() {
	fmt.Println("❌ Some required dependencies are missing or misconfigured.")
	fmt.Println()
	fmt.Println("Quick setup guide:")
	fmt.Println("1. Install Xcode from Mac App Store (if not installed)")
	fmt.Println("2. Open Xcode once and agree to the license")
	fmt.Println("3. Install additional components when prompted")
	fmt.Println("4. Run: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer")
	fmt.Println("5. Download iOS simulators: Xcode → Settings → Platforms → iOS")
	fmt.Println("6. Run this check again")
}

func promptUser(question string) bool {
	if os.Getenv("TASK_FORCE_YES") == "true" {
		fmt.Printf("%s [y/N]: y (explicitly auto-accepted)\n", question)
		return true
	}
	if os.Getenv("CI") != "" {
		fmt.Printf("%s [y/N]: n (CI check only)\n", question)
		return false
	}
	reader := bufio.NewReader(os.Stdin)
	fmt.Printf("%s [y/N]: ", question)
	response, err := reader.ReadString('\n')
	if err != nil {
		return false
	}
	response = strings.ToLower(strings.TrimSpace(response))
	return response == "y" || response == "yes"
}
