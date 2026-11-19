package updater

import (
	"path"
	"strings"
)

// windowsInstallerVerb keeps user installations in the original user's security context.
// Only existing machine registration or a protected Program Files location needs UAC.
func windowsInstallerVerb(target string, machineDirectories, programFilesDirectories []string) string {
	normalized := normalizeWindowsInstallPath(target)
	for _, directory := range machineDirectories {
		if candidate := normalizeWindowsInstallPath(directory); candidate != "" && candidate == normalized {
			return "runas"
		}
	}
	for _, directory := range programFilesDirectories {
		if candidate := normalizeWindowsInstallPath(directory); candidate != "" && (normalized == candidate || strings.HasPrefix(normalized, candidate+"/")) {
			return "runas"
		}
	}
	return "open"
}

func normalizeWindowsInstallPath(value string) string {
	if strings.TrimSpace(value) == "" {
		return ""
	}
	return strings.ToLower(strings.TrimSuffix(path.Clean(strings.ReplaceAll(strings.TrimSpace(value), `\`, "/")), "/"))
}

func windowsRegistrationCommandDirectory(value string) string {
	value = strings.TrimSpace(value)
	if strings.HasPrefix(value, `"`) {
		value = strings.TrimPrefix(value, `"`)
		if end := strings.Index(value, `"`); end >= 0 {
			value = value[:end]
		}
	} else if index := strings.LastIndex(value, ","); index >= 0 {
		value = value[:index]
	}
	value = strings.ReplaceAll(value, `\`, "/")
	base := strings.ToLower(path.Base(value))
	if base != executableName+".exe" && base != "uninstall.exe" {
		return ""
	}
	return path.Dir(value)
}
