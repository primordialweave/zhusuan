//go:build darwin && !ios

package desktop

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Cocoa
#import <Cocoa/Cocoa.h>

static void zhusuanSetDockVisible(int visible) {
	NSApplicationActivationPolicy policy = visible
		? NSApplicationActivationPolicyRegular
		: NSApplicationActivationPolicyAccessory;
	if ([NSApp activationPolicy] != policy) {
		[NSApp setActivationPolicy:policy];
	}
	if (visible) {
		[NSApp activateIgnoringOtherApps:YES];
	}
}
*/
import "C"

import "github.com/wailsapp/wails/v3/pkg/application"

func setPlatformDockVisible(visible bool) {
	if application.Get() == nil {
		return
	}
	v := C.int(0)
	if visible {
		v = 1
	}
	application.InvokeSync(func() {
		C.zhusuanSetDockVisible(v)
	})
}
