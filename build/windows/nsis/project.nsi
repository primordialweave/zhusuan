Unicode true

; Stable project identities must not depend on generated include defaults.
!define INFO_PROJECTNAME "zhusuan"
!define INFO_COMPANYNAME "PrimordialWeave"
!define INFO_PRODUCTNAME "珠算"
!define INFO_COPYRIGHT "(c) 2026, PrimordialWeave"
!define PRODUCT_EXECUTABLE "zhusuan.exe"
!define UNINST_KEY_NAME "PrimordialWeaveZhusuan"
!define LEGACY_EXECUTABLE "Orange.exe"
!define REQUEST_EXECUTION_LEVEL "user"
!ifndef INFO_PRODUCTVERSION
    !searchparse /file "..\..\config.yml" '  version: "' INFO_PRODUCTVERSION '"'
!endif
!include "wails_tools.nsh"
!include "MUI.nsh"
!include "LogicLib.nsh"
!include "WordFunc.nsh"

VIProductVersion "${INFO_PRODUCTVERSION}.0"
VIFileVersion "${INFO_PRODUCTVERSION}.0"
VIAddVersionKey "CompanyName" "${INFO_COMPANYNAME}"
VIAddVersionKey "FileDescription" "${INFO_PRODUCTNAME} Installer"
VIAddVersionKey "ProductVersion" "${INFO_PRODUCTVERSION}"
VIAddVersionKey "FileVersion" "${INFO_PRODUCTVERSION}"
VIAddVersionKey "LegalCopyright" "${INFO_COPYRIGHT}"
VIAddVersionKey "ProductName" "${INFO_PRODUCTNAME}"
ManifestDPIAware true

Var ZhusuanUpdate
Var ZhusuanPreviousVersion
Var ZhusuanExistingKey
Var ZhusuanBinaryBackup
Var ZhusuanInstallScope
Var ZhusuanUninstallerBackup
Var ZhusuanNewWritten
Var ZhusuanUninstallerWritten

; Require a usable runtime before replacing any installed application files.
!macro ZhusuanReadWebView2 ROOT VIEW
    SetRegView ${VIEW}
    ReadRegStr $2 ${ROOT} "Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
    ${If} $2 != ""
        ${VersionCompare} "$2" "0.0.0.0" $3
        ${If} $3 == "1"
            StrCpy $0 "1"
        ${EndIf}
    ${EndIf}
!macroend

Function ZhusuanWebView2Present
    StrCpy $0 "0"
    !insertmacro ZhusuanReadWebView2 HKLM 32
    !insertmacro ZhusuanReadWebView2 HKLM 64
    !insertmacro ZhusuanReadWebView2 HKCU 32
    !insertmacro ZhusuanReadWebView2 HKCU 64
    SetRegView 64
FunctionEnd

Function ZhusuanEnsureWebView2
    Call ZhusuanWebView2Present
    ${If} $0 == "1"
        Return
    ${EndIf}
    DetailPrint "正在安装 WebView2 运行时"
    InitPluginsDir
    SetOutPath "$PLUGINSDIR\webview2bootstrapper"
    File "MicrosoftEdgeWebview2Setup.exe"
    ClearErrors
    ExecWait '"$PLUGINSDIR\webview2bootstrapper\MicrosoftEdgeWebview2Setup.exe" /silent /install' $1
    ${If} ${Errors}
        Abort "无法启动 WebView2 运行时安装。"
    ${EndIf}
    ${If} $1 != "0"
    ${AndIf} $1 != "3010"
        DetailPrint "WebView2 安装返回 $1"
        Abort "WebView2 运行时安装失败，请检查网络后重试。"
    ${EndIf}
    Call ZhusuanWebView2Present
    ${If} $0 != "1"
        Abort "安装后仍未检测到 WebView2 运行时，请重启 Windows 后重试。"
    ${EndIf}
FunctionEnd

!macro ZhusuanCommandDirectoryFunction PREFIX
Function ${PREFIX}ZhusuanCommandDirectory
    StrCpy $2 $1 1
    ${If} $2 == '$\"'
        StrCpy $1 $1 "" 1
        StrCpy $3 0
        trim_command_loop:
        StrCpy $2 $1 1 $3
        ${If} $2 == '$\"'
            StrCpy $1 $1 $3
            Goto trim_command_done
        ${EndIf}
        ${If} $2 == ""
            Goto trim_command_done
        ${EndIf}
        IntOp $3 $3 + 1
        Goto trim_command_loop
        trim_command_done:
    ${EndIf}
    ${GetParent} "$1" $1
FunctionEnd
!macroend
!insertmacro ZhusuanCommandDirectoryFunction ""
!insertmacro ZhusuanCommandDirectoryFunction "un."

; Only the new product's registration and executable can supply an existing path.
!macro ZhusuanReadInstallDir ROOT VIEW
    ${If} $0 == ""
        SetRegView ${VIEW}
        ReadRegStr $1 ${ROOT} "${UNINST_KEY}" "InstallLocation"
        ${If} $1 == ""
            ReadRegStr $1 ${ROOT} "${UNINST_KEY}" ""
        ${EndIf}
        ${If} ${FileExists} "$1\${PRODUCT_EXECUTABLE}"
            StrCpy $0 $1
        ${EndIf}
        ${If} $0 == ""
            ReadRegStr $1 ${ROOT} "${UNINST_KEY}" "DisplayIcon"
            ${If} $1 == ""
                ReadRegStr $1 ${ROOT} "${UNINST_KEY}" "UninstallString"
            ${EndIf}
            ${If} $1 != ""
                Call ZhusuanCommandDirectory
                ${If} ${FileExists} "$1\${PRODUCT_EXECUTABLE}"
                    StrCpy $0 $1
                ${EndIf}
            ${EndIf}
        ${EndIf}
    ${EndIf}
!macroend

; Keep prior machine installations in their original scope; new installs stay per-user.
!macro ZhusuanReadMachineScope PREFIX VIEW
    SetRegView ${VIEW}
    ReadRegStr $1 HKLM "${UNINST_KEY}" "InstallLocation"
    ${If} $1 == ""
        ReadRegStr $1 HKLM "${UNINST_KEY}" ""
    ${EndIf}
    ${If} $1 == ""
        ReadRegStr $1 HKLM "${UNINST_KEY}" "DisplayIcon"
        ${If} $1 == ""
            ReadRegStr $1 HKLM "${UNINST_KEY}" "UninstallString"
        ${EndIf}
        ${If} $1 != ""
            Call ${PREFIX}ZhusuanCommandDirectory
        ${EndIf}
    ${EndIf}
    ${If} $1 == $INSTDIR
    ${AndIf} ${FileExists} "$INSTDIR\${PRODUCT_EXECUTABLE}"
        StrCpy $ZhusuanInstallScope "machine"
    ${EndIf}
!macroend

; The installer stays asInvoker. Only an existing machine installation needs UAC.
; ShellExecuteEx supplies a process handle so the original caller gets the real result.
Function ZhusuanElevateInstaller
    ${GetParameters} $0
    ClearErrors
    ${GetOptions} $0 "/ZHUSUAN_ELEVATED" $1
    ${IfNot} ${Errors}
        MessageBox MB_OK|MB_ICONEXCLAMATION "无法取得更新已有珠算所需的管理员权限，原安装未改动。" /SD IDOK
        SetErrorLevel 5
        Quit
    ${EndIf}
    ; NSIS removed /D from $CMDLINE, so append the already resolved path last.
    StrCpy $0 '$0 /ZHUSUAN_ELEVATED /D=$INSTDIR'
    System::Call '*(&l4, i 0x140, p $HWNDPARENT, t "runas", t "$EXEPATH", t "$0", p 0, i 1, p 0, p 0, p 0, p 0, i 0, p 0, p 0) p.r0'
    System::Call 'shell32::ShellExecuteExW(p r0) i.r1 ?e'
    Pop $3
    ${If} $1 == "0"
        System::Free $0
        ${If} $3 == "1223"
            MessageBox MB_OK|MB_ICONINFORMATION "已取消管理员授权，原安装未改动。" /SD IDOK
        ${Else}
            MessageBox MB_OK|MB_ICONEXCLAMATION "无法启动管理员安装，请重试。原安装未改动。" /SD IDOK
        ${EndIf}
        ${If} $3 == "0"
            StrCpy $3 "5"
        ${EndIf}
        SetErrorLevel $3
        Quit
    ${EndIf}
    System::Call '*$0(i, i, p, p, p, p, p, i, p, p, p, p, i, p, p.r2)'
    System::Free $0
    ${If} $2 == "0"
        SetErrorLevel 5
        Quit
    ${EndIf}
    System::Call 'kernel32::WaitForSingleObject(p r2, i -1) i.r1'
    ${If} $1 != "0"
        System::Call 'kernel32::CloseHandle(p r2)'
        SetErrorLevel 5
        Quit
    ${EndIf}
    System::Call 'kernel32::GetExitCodeProcess(p r2, *i.r3) i.r1'
    System::Call 'kernel32::CloseHandle(p r2)'
    ${If} $1 == "0"
        SetErrorLevel 5
        Quit
    ${EndIf}
    SetErrorLevel $3
    Quit
FunctionEnd

!macro ZhusuanScopeFunction PREFIX
Function ${PREFIX}ZhusuanSelectScope
    StrCpy $ZhusuanInstallScope "user"
    !insertmacro ZhusuanReadMachineScope "${PREFIX}" 64
    !insertmacro ZhusuanReadMachineScope "${PREFIX}" 32
    SetRegView 64
    ${If} $ZhusuanInstallScope == "machine"
        SetShellVarContext all
        System::Call 'shell32::IsUserAnAdmin() i.r0'
        ${If} $0 == "0"
            !if "${PREFIX}" == ""
                Call ZhusuanElevateInstaller
            !else
                MessageBox MB_OK|MB_ICONEXCLAMATION "此珠算安装位于全局目录，请以管理员身份卸载。" /SD IDOK
                SetErrorLevel 5
                Abort
            !endif
        ${EndIf}
    ${Else}
        SetShellVarContext current
    ${EndIf}
FunctionEnd
!macroend
!insertmacro ZhusuanScopeFunction ""
!insertmacro ZhusuanScopeFunction "un."

!define MUI_ICON "..\icon.ico"
!define MUI_UNICON "..\icon.ico"
!define MUI_FINISHPAGE_NOAUTOCLOSE
!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"

Name "${INFO_PRODUCTNAME}"
OutFile "..\..\..\bin\${INFO_PROJECTNAME}-${ARCH}-installer.exe"
; Leave the header default empty so NSIS's built-in /D can be distinguished in .onInit.
InstallDir ""
ShowInstDetails show

Function .onInit
    !insertmacro wails.checkArchitecture
    StrCpy $ZhusuanUpdate "0"
    StrCpy $ZhusuanBinaryBackup "0"
    StrCpy $ZhusuanInstallScope "user"
    SetShellVarContext current
    StrCpy $ZhusuanUninstallerBackup "0"
    StrCpy $ZhusuanNewWritten "0"
    StrCpy $ZhusuanUninstallerWritten "0"
    ${GetParameters} $0
    ClearErrors
    ${GetOptions} $0 "/UPDATE" $1
    ${IfNot} ${Errors}
        StrCpy $ZhusuanUpdate "1"
        SetSilent silent
    ${EndIf}

    ; NSIS consumes /D before .onInit and removes it from $CMDLINE.
    ; An explicit /D is already in $INSTDIR; only discover a path when no /D was given.
    ${If} $INSTDIR == ""
        StrCpy $INSTDIR "$LOCALAPPDATA\${INFO_COMPANYNAME}\${INFO_PROJECTNAME}"
        StrCpy $0 ""
        !insertmacro ZhusuanReadInstallDir HKCU 64
        !insertmacro ZhusuanReadInstallDir HKCU 32
        !insertmacro ZhusuanReadInstallDir HKLM 64
        !insertmacro ZhusuanReadInstallDir HKLM 32
        ${If} $0 != ""
            StrCpy $INSTDIR $0
        ${EndIf}
    ${EndIf}
    Call ZhusuanSelectScope
    ReadRegStr $ZhusuanExistingKey SHCTX "${UNINST_KEY}" "DisplayName"
    ReadRegStr $ZhusuanPreviousVersion SHCTX "${UNINST_KEY}" "DisplayVersion"
    ${If} $ZhusuanUpdate == "1"
        ${IfNot} ${FileExists} "$INSTDIR\${PRODUCT_EXECUTABLE}"
            SetErrorLevel 3
            Abort "未找到已有的珠算安装。"
        ${EndIf}
    ${EndIf}
FunctionEnd

Function ZhusuanRollback
    ${If} $ZhusuanNewWritten == "1"
        Delete "$INSTDIR\${PRODUCT_EXECUTABLE}"
        StrCpy $ZhusuanNewWritten "0"
    ${EndIf}
    ${If} $ZhusuanBinaryBackup == "1"
        Rename "$INSTDIR\${PRODUCT_EXECUTABLE}.update-backup" "$INSTDIR\${PRODUCT_EXECUTABLE}"
        StrCpy $ZhusuanBinaryBackup "0"
    ${EndIf}
    ${If} $ZhusuanUninstallerWritten == "1"
        Delete "$INSTDIR\uninstall.exe"
        StrCpy $ZhusuanUninstallerWritten "0"
    ${EndIf}
    ${If} $ZhusuanUninstallerBackup == "1"
        Rename "$INSTDIR\uninstall.exe.update-backup" "$INSTDIR\uninstall.exe"
        StrCpy $ZhusuanUninstallerBackup "0"
    ${EndIf}
    SetRegView 64
    ${If} $ZhusuanExistingKey == ""
        DeleteRegKey SHCTX "${UNINST_KEY}"
    ${Else}
        WriteRegStr SHCTX "${UNINST_KEY}" "DisplayVersion" "$ZhusuanPreviousVersion"
    ${EndIf}
FunctionEnd

Function .onInstFailed
    Call ZhusuanRollback
    SetErrorLevel 4
FunctionEnd

Section
    Call ZhusuanSelectScope
    ; Never overwrite Orange's executable or uninstaller, even with an explicit /D.
    ${If} ${FileExists} "$INSTDIR\${LEGACY_EXECUTABLE}"
        SetErrorLevel 6
        Abort "该目录包含旧 Orange，请为珠算选择新的安装目录。旧数据将在首次启动时迁移。"
    ${EndIf}
    ReadRegStr $ZhusuanExistingKey SHCTX "${UNINST_KEY}" "DisplayName"
    ReadRegStr $ZhusuanPreviousVersion SHCTX "${UNINST_KEY}" "DisplayVersion"
    Call ZhusuanEnsureWebView2
    SetOutPath $INSTDIR

    ; Back up only zhusuan, refusing replacement while its executable is in use.
    ${If} ${FileExists} "$INSTDIR\${PRODUCT_EXECUTABLE}"
        System::Call 'kernel32::CreateFileW(t "$INSTDIR\${PRODUCT_EXECUTABLE}", i 0x40000000, i 0, p 0, i 3, i 0, p 0) p.r0'
        ${If} $0 == -1
            Goto zhusuan_install_failed
        ${EndIf}
        System::Call 'kernel32::CloseHandle(p r0)'
        IfFileExists "$INSTDIR\${PRODUCT_EXECUTABLE}.update-backup" zhusuan_install_failed
        ClearErrors
        Rename "$INSTDIR\${PRODUCT_EXECUTABLE}" "$INSTDIR\${PRODUCT_EXECUTABLE}.update-backup"
        IfErrors zhusuan_install_failed
        StrCpy $ZhusuanBinaryBackup "1"
    ${EndIf}
    ${If} ${FileExists} "$INSTDIR\uninstall.exe"
        IfFileExists "$INSTDIR\uninstall.exe.update-backup" zhusuan_install_failed
        ClearErrors
        Rename "$INSTDIR\uninstall.exe" "$INSTDIR\uninstall.exe.update-backup"
        IfErrors zhusuan_install_failed
        StrCpy $ZhusuanUninstallerBackup "1"
    ${EndIf}
    ClearErrors
    StrCpy $ZhusuanNewWritten "1"
    !insertmacro wails.files
    IfErrors zhusuan_install_failed

    ClearErrors
    StrCpy $ZhusuanUninstallerWritten "1"
    WriteUninstaller "$INSTDIR\uninstall.exe"
    IfErrors zhusuan_install_failed
    SetRegView 64
    WriteRegStr SHCTX "${UNINST_KEY}" "Publisher" "${INFO_COMPANYNAME}"
    WriteRegStr SHCTX "${UNINST_KEY}" "DisplayName" "${INFO_PRODUCTNAME}"
    WriteRegStr SHCTX "${UNINST_KEY}" "DisplayVersion" "${INFO_PRODUCTVERSION}"
    WriteRegStr SHCTX "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${PRODUCT_EXECUTABLE}"
    WriteRegStr SHCTX "${UNINST_KEY}" "UninstallString" "$\"$INSTDIR\uninstall.exe$\""
    WriteRegStr SHCTX "${UNINST_KEY}" "QuietUninstallString" "$\"$INSTDIR\uninstall.exe$\" /S"
    WriteRegStr SHCTX "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
    WriteRegStr SHCTX "${UNINST_KEY}" "" "$INSTDIR"
    IfErrors zhusuan_install_failed
    ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    IntFmt $0 "0x%08X" $0
    WriteRegDWORD SHCTX "${UNINST_KEY}" "EstimatedSize" "$0"
    IfErrors zhusuan_install_failed

    ; Commit the new identity only after executable/uninstaller/registry writes succeeded.
    CreateShortcut "$SMPROGRAMS\${INFO_PRODUCTNAME}.lnk" "$INSTDIR\${PRODUCT_EXECUTABLE}"
    CreateShortCut "$DESKTOP\${INFO_PRODUCTNAME}.lnk" "$INSTDIR\${PRODUCT_EXECUTABLE}"
    !insertmacro wails.associateFiles
    !insertmacro wails.associateCustomProtocols
    SetRegView 64
    Delete "$INSTDIR\${PRODUCT_EXECUTABLE}.update-backup"
    Delete "$INSTDIR\uninstall.exe.update-backup"
    SetErrorLevel 0
    Goto zhusuan_install_done

    zhusuan_install_failed:
    Call ZhusuanRollback
    SetErrorLevel 4
    Abort "安装未完成，已恢复原珠算程序。请关闭运行中的珠算后重试。"
    zhusuan_install_done:
SectionEnd

Function un.onInit
    Call un.ZhusuanSelectScope
FunctionEnd

Section "uninstall"
    ; Retain databases, credentials, profiles and unrelated files in custom directories.
    Delete "$INSTDIR\${PRODUCT_EXECUTABLE}"
    Delete "$SMPROGRAMS\${INFO_PRODUCTNAME}.lnk"
    Delete "$DESKTOP\${INFO_PRODUCTNAME}.lnk"
    !insertmacro wails.unassociateFiles
    !insertmacro wails.unassociateCustomProtocols
    Delete "$INSTDIR\uninstall.exe"
    SetRegView 64
    DeleteRegKey SHCTX "${UNINST_KEY}"
    RMDir "$INSTDIR"
SectionEnd
