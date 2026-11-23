//go:build !linux || android

package desktop

import "runtime"

func probePlatformTrayAvailable() bool {
	return runtime.GOOS == platformDarwin || runtime.GOOS == platformWindows
}
