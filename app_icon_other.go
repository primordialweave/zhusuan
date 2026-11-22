//go:build !darwin || ios

package main

// Other platforms fall back to bundled icon assets or embedded web PNGs.
var nativeAppIcon []byte
var nativeAppIconDark []byte
