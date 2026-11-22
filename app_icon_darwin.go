//go:build darwin && !ios

package main

import _ "embed"

// Embed the generated canonical light and dark icons so local dev bundles and released apps
// share the exact same dual-appearance artwork and can switch live from Appearance settings.
//
//go:embed build/appicon.png
var nativeAppIcon []byte

//go:embed build/appicon-dark.png
var nativeAppIconDark []byte
