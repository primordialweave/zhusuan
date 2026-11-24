//go:build windows

package main

import _ "embed"

var nativeAppIcon []byte
var nativeAppIconDark []byte
var nativeTrayTemplateIcon []byte

// Embed the same normalized multi-size ICO resources used by Windows app windows and shortcuts.
//
//go:embed build/windows/icon.ico
var nativeWindowsTrayIcon []byte

//go:embed build/windows/icon-dark.ico
var nativeWindowsTrayDarkIcon []byte
