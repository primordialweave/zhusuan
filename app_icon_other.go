//go:build (!darwin || ios) && !windows

package main

// Other platforms fall back to bundled icon assets or embedded web PNGs.
var nativeAppIcon []byte
var nativeAppIconDark []byte
var nativeTrayTemplateIcon []byte
