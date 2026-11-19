//go:build darwin && !ios

package main

import _ "embed"

// Set the running app icon explicitly; reused dev bundles may retain a LaunchServices icon.
//
//go:embed build/darwin/icons.icns
var nativeAppIcon []byte
