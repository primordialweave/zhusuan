//go:build darwin && !ios

package main

import _ "embed"

// Embed the generated canonical icon so local dev bundles and released apps use the same artwork.
// Set it explicitly because reused dev bundles may retain a LaunchServices icon.
//
//go:embed build/appicon.png
var nativeAppIcon []byte
