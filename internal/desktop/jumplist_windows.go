//go:build windows

package desktop

import (
	"fmt"
	"log/slog"
	"runtime"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	ole32DLL           = windows.NewLazySystemDLL("ole32.dll")
	procCoInitializeEx = ole32DLL.NewProc("CoInitializeEx")
	procCoUninitialize = ole32DLL.NewProc("CoUninitialize")
	procCoCreateInst   = ole32DLL.NewProc("CoCreateInstance")
)

const (
	coinitApartmentThreaded = 0x2
	clsctxInprocServer      = 0x1
	vtLPWSTR                = 31
)

var (
	clsidDestinationList      = windows.GUID{Data1: 0x77f10cf0, Data2: 0x3db5, Data3: 0x4966, Data4: [8]byte{0xb5, 0x20, 0xb7, 0xc5, 0x4f, 0xd3, 0x5e, 0xd6}}
	iidICustomDestinationList = windows.GUID{Data1: 0x6332debf, Data2: 0x87b5, Data3: 0x4670, Data4: [8]byte{0x90, 0xc0, 0x5e, 0x57, 0xb4, 0x08, 0xa4, 0x9e}}
	clsidEnumerableObjectColl = windows.GUID{Data1: 0x2d3468c1, Data2: 0x36a7, Data3: 0x43b6, Data4: [8]byte{0xac, 0x24, 0xd3, 0xf0, 0x2f, 0xd9, 0x60, 0x7a}}
	iidIObjectCollection      = windows.GUID{Data1: 0x5632b1a4, Data2: 0xe38a, Data3: 0x400a, Data4: [8]byte{0x92, 0x8a, 0xd4, 0xcd, 0x63, 0x23, 0x02, 0x95}}
	iidIObjectArray           = windows.GUID{Data1: 0x92ca9dcd, Data2: 0x5622, Data3: 0x4bba, Data4: [8]byte{0xa8, 0x05, 0x5e, 0x9f, 0x54, 0x1b, 0xd8, 0xc9}}
	clsidShellLink            = windows.GUID{Data1: 0x00021401, Data2: 0x0000, Data3: 0x0000, Data4: [8]byte{0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46}}
	iidIShellLinkW            = windows.GUID{Data1: 0x000214f9, Data2: 0x0000, Data3: 0x0000, Data4: [8]byte{0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46}}
	iidIPropertyStore         = windows.GUID{Data1: 0x886d8eeb, Data2: 0x8cf2, Data3: 0x4446, Data4: [8]byte{0x8d, 0x02, 0xcd, 0xba, 0x1d, 0xbd, 0xcf, 0x99}}
	pkeyTitleFormatID         = windows.GUID{Data1: 0xf29f85e0, Data2: 0x4ff9, Data3: 0x1068, Data4: [8]byte{0xab, 0x91, 0x08, 0x00, 0x2b, 0x27, 0xb3, 0xd9}}
)

type comObject struct {
	vtbl *[32]uintptr
}

func (o *comObject) release() {
	if o == nil {
		return
	}
	_, _, _ = syscall.SyscallN(o.vtbl[2], uintptr(unsafe.Pointer(o)))
}

func (o *comObject) queryInterface(iid *windows.GUID) (*comObject, error) {
	var out *comObject
	hr, _, _ := syscall.SyscallN(
		o.vtbl[0],
		uintptr(unsafe.Pointer(o)),
		uintptr(unsafe.Pointer(iid)),
		uintptr(unsafe.Pointer(&out)),
	)
	if int32(hr) < 0 {
		return nil, fmt.Errorf("QueryInterface failed: 0x%x", uint32(hr))
	}
	return out, nil
}

type propertyKey struct {
	fmtid windows.GUID
	pid   uint32
}

type propVariant struct {
	vt         uint16
	wReserved1 uint16
	wReserved2 uint16
	wReserved3 uint16
	val        uintptr
	pad        uintptr
}

type jumpListTask struct {
	title       string
	description string
	arguments   string
}

func registerPlatformTaskbarActions() {
	go func() {
		if err := registerWindowsJumpList(); err != nil {
			slog.Debug("Unable to register Windows taskbar JumpList", "error", err)
		}
	}()
}

func registerWindowsJumpList() error {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	exe, err := resolveDesktopExecutable()
	if err != nil {
		return err
	}

	hr, _, _ := procCoInitializeEx.Call(0, coinitApartmentThreaded)
	// S_OK (0) and S_FALSE (1) require matching CoUninitialize; RPC_E_CHANGED_MODE does not.
	if hr == 0 || hr == 1 {
		defer procCoUninitialize.Call()
	} else if int32(hr) < 0 {
		return fmt.Errorf("CoInitializeEx failed: 0x%x", uint32(hr))
	}

	var destList *comObject
	hr, _, _ = procCoCreateInst.Call(
		uintptr(unsafe.Pointer(&clsidDestinationList)),
		0,
		clsctxInprocServer,
		uintptr(unsafe.Pointer(&iidICustomDestinationList)),
		uintptr(unsafe.Pointer(&destList)),
	)
	if int32(hr) < 0 || destList == nil {
		return fmt.Errorf("create ICustomDestinationList failed: 0x%x", uint32(hr))
	}
	defer destList.release()

	// BeginList(uint32 *pcMinSlots, REFIID riid, void **ppv) -> vtable slot 4
	var minSlots uint32
	var removed *comObject
	hr, _, _ = syscall.SyscallN(
		destList.vtbl[4],
		uintptr(unsafe.Pointer(destList)),
		uintptr(unsafe.Pointer(&minSlots)),
		uintptr(unsafe.Pointer(&iidIObjectArray)),
		uintptr(unsafe.Pointer(&removed)),
	)
	if int32(hr) < 0 {
		return fmt.Errorf("BeginList failed: 0x%x", uint32(hr))
	}
	if removed != nil {
		defer removed.release()
	}

	var coll *comObject
	hr, _, _ = procCoCreateInst.Call(
		uintptr(unsafe.Pointer(&clsidEnumerableObjectColl)),
		0,
		clsctxInprocServer,
		uintptr(unsafe.Pointer(&iidIObjectCollection)),
		uintptr(unsafe.Pointer(&coll)),
	)
	if int32(hr) < 0 || coll == nil {
		return fmt.Errorf("create IObjectCollection failed: 0x%x", uint32(hr))
	}
	defer coll.release()

	tasks := []jumpListTask{
		{title: "记一笔收款", description: "快速录入项目收款", arguments: "--action=" + LaunchActionQuickReceipt},
		{title: "新建项目", description: "创建新合同项目", arguments: "--action=" + LaunchActionNewProject},
		{title: "收款日历", description: "查看每日收款与到期计划", arguments: "--action=" + LaunchActionCalendar},
	}

	for _, task := range tasks {
		link, err := createJumpListShellLink(exe, task)
		if err != nil {
			return err
		}
		// IObjectCollection::AddObject -> vtable slot 5
		hr, _, _ = syscall.SyscallN(
			coll.vtbl[5],
			uintptr(unsafe.Pointer(coll)),
			uintptr(unsafe.Pointer(link)),
		)
		link.release()
		if int32(hr) < 0 {
			return fmt.Errorf("AddObject failed: 0x%x", uint32(hr))
		}
	}

	objArray, err := coll.queryInterface(&iidIObjectArray)
	if err != nil {
		return err
	}
	defer objArray.release()

	// ICustomDestinationList::AddUserTasks -> vtable slot 7
	hr, _, _ = syscall.SyscallN(
		destList.vtbl[7],
		uintptr(unsafe.Pointer(destList)),
		uintptr(unsafe.Pointer(objArray)),
	)
	if int32(hr) < 0 {
		return fmt.Errorf("AddUserTasks failed: 0x%x", uint32(hr))
	}

	// ICustomDestinationList::CommitList -> vtable slot 8
	hr, _, _ = syscall.SyscallN(
		destList.vtbl[8],
		uintptr(unsafe.Pointer(destList)),
	)
	if int32(hr) < 0 {
		return fmt.Errorf("CommitList failed: 0x%x", uint32(hr))
	}
	return nil
}

func createJumpListShellLink(exe string, task jumpListTask) (*comObject, error) {
	var link *comObject
	hr, _, _ := procCoCreateInst.Call(
		uintptr(unsafe.Pointer(&clsidShellLink)),
		0,
		clsctxInprocServer,
		uintptr(unsafe.Pointer(&iidIShellLinkW)),
		uintptr(unsafe.Pointer(&link)),
	)
	if int32(hr) < 0 || link == nil {
		return nil, fmt.Errorf("create IShellLinkW failed: 0x%x", uint32(hr))
	}

	exePtr, err := windows.UTF16PtrFromString(exe)
	if err != nil {
		link.release()
		return nil, err
	}
	argsPtr, err := windows.UTF16PtrFromString(task.arguments)
	if err != nil {
		link.release()
		return nil, err
	}
	descPtr, err := windows.UTF16PtrFromString(task.description)
	if err != nil {
		link.release()
		return nil, err
	}
	titlePtr, err := windows.UTF16PtrFromString(task.title)
	if err != nil {
		link.release()
		return nil, err
	}

	// IShellLinkW::SetPath -> slot 20
	if hr, _, _ := syscall.SyscallN(link.vtbl[20], uintptr(unsafe.Pointer(link)), uintptr(unsafe.Pointer(exePtr))); int32(hr) < 0 {
		link.release()
		return nil, fmt.Errorf("SetPath failed: 0x%x", uint32(hr))
	}
	// IShellLinkW::SetArguments -> slot 11
	if hr, _, _ := syscall.SyscallN(link.vtbl[11], uintptr(unsafe.Pointer(link)), uintptr(unsafe.Pointer(argsPtr))); int32(hr) < 0 {
		link.release()
		return nil, fmt.Errorf("SetArguments failed: 0x%x", uint32(hr))
	}
	// IShellLinkW::SetDescription -> slot 7
	_, _, _ = syscall.SyscallN(link.vtbl[7], uintptr(unsafe.Pointer(link)), uintptr(unsafe.Pointer(descPtr)))
	// IShellLinkW::SetIconLocation -> slot 17
	_, _, _ = syscall.SyscallN(link.vtbl[17], uintptr(unsafe.Pointer(link)), uintptr(unsafe.Pointer(exePtr)), 0)

	propStore, err := link.queryInterface(&iidIPropertyStore)
	if err != nil {
		link.release()
		return nil, err
	}
	defer propStore.release()

	key := propertyKey{fmtid: pkeyTitleFormatID, pid: 2}
	pv := propVariant{vt: vtLPWSTR, val: uintptr(unsafe.Pointer(titlePtr))}
	// IPropertyStore::SetValue -> slot 6
	if hr, _, _ := syscall.SyscallN(
		propStore.vtbl[6],
		uintptr(unsafe.Pointer(propStore)),
		uintptr(unsafe.Pointer(&key)),
		uintptr(unsafe.Pointer(&pv)),
	); int32(hr) < 0 {
		link.release()
		return nil, fmt.Errorf("SetValue failed: 0x%x", uint32(hr))
	}
	// IPropertyStore::Commit -> slot 7
	if hr, _, _ := syscall.SyscallN(propStore.vtbl[7], uintptr(unsafe.Pointer(propStore))); int32(hr) < 0 {
		link.release()
		return nil, fmt.Errorf("Commit failed: 0x%x", uint32(hr))
	}

	return link, nil
}
