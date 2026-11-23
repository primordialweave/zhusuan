// Package main keeps the historical version-bump command backed by release metadata tooling.
package main

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// Keep the historical command while using the same metadata updater as CI.
func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "Usage: go run scripts/bump_version.go <new_version>")
		os.Exit(1)
	}
	tag := "v" + strings.TrimPrefix(os.Args[1], "v")
	cmd := exec.Command("python3", "scripts/release.py", "metadata", tag) // #nosec G204 G702 -- fixed interpreter/script without a shell; the tag is one argument, and release.py validates it before writing metadata.
	cmd.Stdout, cmd.Stderr = os.Stdout, os.Stderr
	if err := cmd.Run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
