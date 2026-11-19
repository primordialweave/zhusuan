Unicode true

; Stable project identities must not depend on generated include defaults.
!define INFO_PROJECTNAME "zhusuan"
!define INFO_COMPANYNAME "PrimordialWeave"
!define INFO_PRODUCTNAME "珠算"
!define INFO_COPYRIGHT "(c) 2026, PrimordialWeave"
!define PRODUCT_EXECUTABLE "zhusuan.exe"
!define UNINST_KEY_NAME "PrimordialWeaveZhusuan"
!define LEGACY_EXECUTABLE "Orange.exe"
!define LEGACY_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\FruitsAIOrange"
!ifndef INFO_PRODUCTVERSION
    !searchparse /file "..\..\config.yml" '  version: "' INFO_PRODUCTVERSION '"'
!endif
!include "wails_tools.nsh"
!include "MUI.nsh"
!include "LogicLib.nsh"

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
Var ZhusuanLegacyBackup
Var ZhusuanUninstallerBackup
Var ZhusuanNewWritten
Var ZhusuanUninstallerWritten

; Extract a bare path from historical quoted DisplayIcon/UninstallString values.
Function ZhusuanCommandDirectory
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

!macro ZhusuanReadInstallDir ROOT VIEW KEY
    ${If} $0 == ""
        SetRegView ${VIEW}
        ReadRegStr $1 ${ROOT} "${KEY}" "InstallLocation"
        ${If} $1 == ""
            ReadRegStr $1 ${ROOT} "${KEY}" ""
        ${EndIf}
        ${If} ${FileExists} "$1\${PRODUCT_EXECUTABLE}"
            StrCpy $0 $1
        ${ElseIf} ${FileExists} "$1\${LEGACY_EXECUTABLE}"
            StrCpy $0 $1
        ${EndIf}
        ${If} $0 == ""
            ReadRegStr $1 ${ROOT} "${KEY}" "DisplayIcon"
            ${If} $1 == ""
                ReadRegStr $1 ${ROOT} "${KEY}" "UninstallString"
            ${EndIf}
            ${If} $1 != ""
                Call ZhusuanCommandDirectory
                ${If} ${FileExists} "$1\${PRODUCT_EXECUTABLE}"
                    StrCpy $0 $1
                ${ElseIf} ${FileExists} "$1\${LEGACY_EXECUTABLE}"
                    StrCpy $0 $1
                ${EndIf}
            ${EndIf}
        ${EndIf}
    ${EndIf}
!macroend

!macro ZhusuanDeleteLegacyKey ROOT VIEW
    SetRegView ${VIEW}
    ReadRegStr $1 ${ROOT} "${LEGACY_UNINST_KEY}" "InstallLocation"
    ${If} $1 == ""
        ReadRegStr $1 ${ROOT} "${LEGACY_UNINST_KEY}" ""
    ${EndIf}
    ${If} $1 == ""
        ReadRegStr $1 ${ROOT} "${LEGACY_UNINST_KEY}" "DisplayIcon"
        ${If} $1 == ""
            ReadRegStr $1 ${ROOT} "${LEGACY_UNINST_KEY}" "UninstallString"
        ${EndIf}
        ${If} $1 != ""
            Call ZhusuanCommandDirectory
        ${EndIf}
    ${EndIf}
    ${If} $1 == $INSTDIR
        DeleteRegKey ${ROOT} "${LEGACY_UNINST_KEY}"
    ${EndIf}
!macroend

!define MUI_ICON "..\icon.ico"
!define MUI_UNICON "..\icon.ico"
!define MUI_FINISHPAGE_NOAUTOCLOSE
!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Name "${INFO_PRODUCTNAME}"
OutFile "..\..\..\bin\${INFO_PROJECTNAME}-${ARCH}-installer.exe"
InstallDir "$PROGRAMFILES64\${INFO_COMPANYNAME}\${INFO_PROJECTNAME}"
ShowInstDetails show

Function .onInit
    !insertmacro wails.checkArchitecture
    StrCpy $ZhusuanUpdate "0"
    StrCpy $ZhusuanBinaryBackup "0"
    StrCpy $ZhusuanLegacyBackup "0"
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

    ; NSIS /D overrides detection and must be the unquoted final argument.
    ClearErrors
    ${GetOptions} $CMDLINE "/D=" $1
    ${If} ${Errors}
        StrCpy $0 ""
        !insertmacro ZhusuanReadInstallDir HKLM 64 "${UNINST_KEY}"
        !insertmacro ZhusuanReadInstallDir HKCU 64 "${UNINST_KEY}"
        !insertmacro ZhusuanReadInstallDir HKLM 32 "${UNINST_KEY}"
        !insertmacro ZhusuanReadInstallDir HKCU 32 "${UNINST_KEY}"
        !insertmacro ZhusuanReadInstallDir HKLM 64 "${LEGACY_UNINST_KEY}"
        !insertmacro ZhusuanReadInstallDir HKCU 64 "${LEGACY_UNINST_KEY}"
        !insertmacro ZhusuanReadInstallDir HKLM 32 "${LEGACY_UNINST_KEY}"
        !insertmacro ZhusuanReadInstallDir HKCU 32 "${LEGACY_UNINST_KEY}"
        ${If} $0 != ""
            StrCpy $INSTDIR $0
        ${EndIf}
    ${EndIf}
    SetRegView 64
    ReadRegStr $ZhusuanExistingKey HKLM "${UNINST_KEY}" "DisplayName"
    ReadRegStr $ZhusuanPreviousVersion HKLM "${UNINST_KEY}" "DisplayVersion"
    ${If} $ZhusuanUpdate == "1"
        ${IfNot} ${FileExists} "$INSTDIR\${PRODUCT_EXECUTABLE}"
        ${AndIfNot} ${FileExists} "$INSTDIR\${LEGACY_EXECUTABLE}"
            SetErrorLevel 3
            Abort "An existing installation was not found."
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
    ${If} $ZhusuanLegacyBackup == "1"
        Rename "$INSTDIR\${LEGACY_EXECUTABLE}.update-backup" "$INSTDIR\${LEGACY_EXECUTABLE}"
        StrCpy $ZhusuanLegacyBackup "0"
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
        DeleteRegKey HKLM "${UNINST_KEY}"
    ${Else}
        WriteRegStr HKLM "${UNINST_KEY}" "DisplayVersion" "$ZhusuanPreviousVersion"
    ${EndIf}
FunctionEnd

Function .onInstFailed
    Call ZhusuanRollback
    SetErrorLevel 4
FunctionEnd

Section
    !insertmacro wails.setShellContext
    !insertmacro wails.webview2runtime
    SetOutPath $INSTDIR

    ; Back up either identity, refusing replacement while an executable is in use.
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
    ${If} ${FileExists} "$INSTDIR\${LEGACY_EXECUTABLE}"
        System::Call 'kernel32::CreateFileW(t "$INSTDIR\${LEGACY_EXECUTABLE}", i 0x40000000, i 0, p 0, i 3, i 0, p 0) p.r0'
        ${If} $0 == -1
            Goto zhusuan_install_failed
        ${EndIf}
        System::Call 'kernel32::CloseHandle(p r0)'
        IfFileExists "$INSTDIR\${LEGACY_EXECUTABLE}.update-backup" zhusuan_install_failed
        ClearErrors
        Rename "$INSTDIR\${LEGACY_EXECUTABLE}" "$INSTDIR\${LEGACY_EXECUTABLE}.update-backup"
        IfErrors zhusuan_install_failed
        StrCpy $ZhusuanLegacyBackup "1"
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
    WriteRegStr HKLM "${UNINST_KEY}" "Publisher" "${INFO_COMPANYNAME}"
    WriteRegStr HKLM "${UNINST_KEY}" "DisplayName" "${INFO_PRODUCTNAME}"
    WriteRegStr HKLM "${UNINST_KEY}" "DisplayVersion" "${INFO_PRODUCTVERSION}"
    WriteRegStr HKLM "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${PRODUCT_EXECUTABLE}"
    WriteRegStr HKLM "${UNINST_KEY}" "UninstallString" "$\"$INSTDIR\uninstall.exe$\""
    WriteRegStr HKLM "${UNINST_KEY}" "QuietUninstallString" "$\"$INSTDIR\uninstall.exe$\" /S"
    WriteRegStr HKLM "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
    WriteRegStr HKLM "${UNINST_KEY}" "" "$INSTDIR"
    IfErrors zhusuan_install_failed
    ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    IntFmt $0 "0x%08X" $0
    WriteRegDWORD HKLM "${UNINST_KEY}" "EstimatedSize" "$0"
    IfErrors zhusuan_install_failed

    ; Commit the new identity only after executable/uninstaller/registry writes succeeded.
    CreateShortcut "$SMPROGRAMS\${INFO_PRODUCTNAME}.lnk" "$INSTDIR\${PRODUCT_EXECUTABLE}"
    CreateShortCut "$DESKTOP\${INFO_PRODUCTNAME}.lnk" "$INSTDIR\${PRODUCT_EXECUTABLE}"
    !insertmacro wails.associateFiles
    !insertmacro wails.associateCustomProtocols
    ${If} $ZhusuanLegacyBackup == "1"
        Delete "$SMPROGRAMS\Orange.lnk"
        Delete "$DESKTOP\Orange.lnk"
        SetShellVarContext current
        Delete "$SMPROGRAMS\Orange.lnk"
        Delete "$DESKTOP\Orange.lnk"
        !insertmacro wails.setShellContext
    ${EndIf}
    !insertmacro ZhusuanDeleteLegacyKey HKLM 64
    !insertmacro ZhusuanDeleteLegacyKey HKCU 64
    !insertmacro ZhusuanDeleteLegacyKey HKLM 32
    !insertmacro ZhusuanDeleteLegacyKey HKCU 32
    SetRegView 64
    Delete "$INSTDIR\${PRODUCT_EXECUTABLE}.update-backup"
    Delete "$INSTDIR\${LEGACY_EXECUTABLE}.update-backup"
    Delete "$INSTDIR\uninstall.exe.update-backup"
    SetErrorLevel 0
    Goto zhusuan_install_done

    zhusuan_install_failed:
    Call ZhusuanRollback
    SetErrorLevel 4
    Abort "The installation could not be completed. Previous files were restored."
    zhusuan_install_done:
SectionEnd

Section "uninstall"
    !insertmacro wails.setShellContext
    ; Retain databases, credentials, profiles and unrelated files in custom directories.
    Delete "$INSTDIR\${PRODUCT_EXECUTABLE}"
    Delete "$SMPROGRAMS\${INFO_PRODUCTNAME}.lnk"
    Delete "$DESKTOP\${INFO_PRODUCTNAME}.lnk"
    !insertmacro wails.unassociateFiles
    !insertmacro wails.unassociateCustomProtocols
    !insertmacro wails.deleteUninstaller
    RMDir "$INSTDIR"
SectionEnd
