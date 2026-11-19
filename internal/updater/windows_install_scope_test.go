package updater

import "testing"

func TestWindowsInstallerVerbUsesOriginalUserUnlessMachineLocation(t *testing.T) {
	for _, tc := range []struct {
		name, target, want string
		machine, protected []string
	}{
		{"new per-user default", `C:\Users\Alice\AppData\Local\PrimordialWeave\zhusuan`, "open", nil, []string{`C:\Program Files`, `C:\Program Files (x86)`}},
		{"custom user directory", `D:\My apps\zhusuan`, "open", nil, []string{`C:\Program Files`}},
		{"existing 1.0 machine directory", `D:\Company Apps\zhusuan`, "runas", []string{`d:\company apps\zhusuan\`}, nil},
		{"Program Files version", `C:\Program Files\PrimordialWeave\zhusuan`, "runas", nil, []string{`C:\Program Files`}},
		{"Program Files x86", `C:\Program Files (x86)\PrimordialWeave\zhusuan`, "runas", nil, []string{`C:\Program Files (x86)`}},
		{"prefix lookalike remains user", `C:\Program Files Backup\zhusuan`, "open", nil, []string{`C:\Program Files`}},
		{"machine sibling is not same install", `D:\Company Apps\zhusuan-user`, "open", []string{`D:\Company Apps\zhusuan`}, nil},
		{"normalized path inside protected location", `C:\Program Files\PrimordialWeave\temporary\..\zhusuan`, "runas", nil, []string{`C:\Program Files\`}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := windowsInstallerVerb(tc.target, tc.machine, tc.protected); got != tc.want {
				t.Fatalf("installer verb = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestWindowsMachineRegistryCommandParsingDoesNotAdoptOrange(t *testing.T) {
	for _, tc := range []struct{ command, want string }{
		{`"C:\Company Apps\zhusuan\zhusuan.exe",0`, "C:/Company Apps/zhusuan"},
		{`C:\Company Apps\zhusuan\zhusuan.exe,0`, "C:/Company Apps/zhusuan"},
		{`"D:\Apps\zhusuan\uninstall.exe" /S`, "D:/Apps/zhusuan"},
		{`"D:\Apps\Orange\Orange.exe"`, ""},
	} {
		if got := windowsRegistrationCommandDirectory(tc.command); got != tc.want {
			t.Errorf("directory for %q = %q, want %q", tc.command, got, tc.want)
		}
	}
}
