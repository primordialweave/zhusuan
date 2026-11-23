//go:build darwin && !ios

package desktop

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBuildDarwinLaunchAgentPlistEscapesAndIncludesAutostartArg(t *testing.T) {
	body, err := buildDarwinLaunchAgentPlist(
		AutostartIdentifier,
		"/Applications/珠算 & Co.app/Contents/MacOS/zhusuan",
		[]string{AutostartLaunchArg},
	)
	require.NoError(t, err)
	text := string(body)
	require.Contains(t, text, "<string>org.primordialweave.zhusuan</string>")
	require.Contains(t, text, "<string>/Applications/珠算 &amp; Co.app/Contents/MacOS/zhusuan</string>")
	require.Contains(t, text, "<string>--autostart</string>")
	require.True(t, strings.Contains(text, "<key>RunAtLoad</key>\n\t<true/>"))
}
