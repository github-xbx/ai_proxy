; AI Proxy NSIS Installation Script
; Requires NSIS to be installed (https://nsis.sourceforge.io/)

!define APP_NAME "AI Proxy"
!define APP_VERSION "1.0.0"
!define APP_PUBLISHER "AI Proxy"
!define APP_EXE "ai-proxy.exe"
!define APP_URL "https://github.com/ai-proxy"

; Installer attributes
Name "${APP_NAME}"
OutFile "..\release\installer\ai-proxy-setup.exe"
InstallDir "$PROGRAMFILES\${APP_NAME}"
InstallDirRegKey HKLM "Software\${APP_NAME}" "InstallDir"
RequestExecutionLevel admin

; Modern UI
!include "MUI2.nsh"

; Interface settings
!define MUI_ABORTWARNING
!define MUI_ICON "..\ai-proxy.ico"
!define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall.ico"

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Languages
!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"

; Version info
VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "${APP_NAME}"
VIAddVersionKey "ProductVersion" "${APP_VERSION}"
VIAddVersionKey "FileDescription" "${APP_NAME} Installer"
VIAddVersionKey "LegalCopyright" "© ${APP_PUBLISHER}"

Section "Install"
    SetOutPath "$INSTDIR"

    ; Copy Node.js runtime
    File /r "build\node\*.*"

    ; Copy application files
    File /r "build\app\*.*"

    ; Create .env if not exists
    IfFileExists "$INSTDIR\.env" env_exists
    FileOpen $0 "$INSTDIR\.env" w
    FileWrite $0 "# DeepSeek API$\r$\nDEEPSEEK_API_KEY=$\r$\n$\r$\n# MiMo API$\r$\nMIMO_API_KEY=$\r$\n"
    FileClose $0
    env_exists:

    ; Create uninstaller
    WriteUninstaller "$INSTDIR\uninstall.exe"

    ; Copy icon
    File "..\ai-proxy.ico"

    ; Start menu shortcuts
    CreateDirectory "$SMPROGRAMS\${APP_NAME}"
    CreateShortCut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\ai-proxy-start.bat" "" "$INSTDIR\ai-proxy.ico"
    CreateShortCut "$SMPROGRAMS\${APP_NAME}\Uninstall.lnk" "$INSTDIR\uninstall.exe"

    ; Desktop shortcut
    CreateShortCut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\ai-proxy-start.bat" "" "$INSTDIR\ai-proxy.ico"

    ; Registry keys for uninstaller
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "DisplayName" "${APP_NAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "UninstallString" '"$INSTDIR\uninstall.exe"'
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "DisplayIcon" "$INSTDIR\ai-proxy-start.bat"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "Publisher" "${APP_PUBLISHER}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" "DisplayVersion" "${APP_VERSION}"

    ; Store install path
    WriteRegStr HKLM "Software\${APP_NAME}" "InstallDir" "$INSTDIR"

    ; Firewall rule
    Exec 'netsh advfirewall firewall add rule name="${APP_NAME}" dir=in action=allow program="$INSTDIR\node.exe" enable=yes'

SectionEnd

Section "Uninstall"
    ; Remove firewall rule
    Exec 'netsh advfirewall firewall delete rule name="${APP_NAME}"'

    ; Remove files
    RMDir /r "$INSTDIR"

    ; Remove shortcuts
    RMDir /r "$SMPROGRAMS\${APP_NAME}"
    Delete "$DESKTOP\${APP_NAME}.lnk"

    ; Remove registry keys
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"
    DeleteRegKey HKLM "Software\${APP_NAME}"
SectionEnd
