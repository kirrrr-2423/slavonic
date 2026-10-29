; UTF-8, NSIS 3.13. Per-user installation; generated payload include files are explicit.
Unicode true
ManifestSupportedOS all
ManifestDPIAware true
!include MUI2.nsh
!include LogicLib.nsh
!include x64.nsh
!include WinVer.nsh

!define APPID "ru.slavonic.reference"
!define APPNAME "Церковнославянский язык"
!ifndef VERSION
 !error "Build using windows/build.py; VERSION is supplied from release.json."
!endif
!define UKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPID}"
!define MARKER ".slavonic-installation"

Name "${APPNAME}"
OutFile "../build/windows-Slavonic-${VERSION}-Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\Slavonic"
RequestExecutionLevel user
SetCompressor /SOLID bzip2
SetDatablockOptimize on
SetOverwrite on
Icon "slavonic.ico"
UninstallIcon "slavonic.ico"
VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=1049 "ProductName" "${APPNAME}"
VIAddVersionKey /LANG=1049 "FileDescription" "Установщик программы для церковнославянского языка"
VIAddVersionKey /LANG=1049 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=1049 "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=1049 "LegalCopyright" "2026; материалы и лицензии — в программе"

!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "${APPNAME}"
!define MUI_WELCOMEPAGE_TEXT "Клавиатура и проверка правописания, словарь, справочник и практика.$\r$\n$\r$\nПрограмма работает без подключения к интернету. Установка выполняется только для вашей учётной записи и не требует прав администратора.$\r$\n$\r$\nWindows 10/11: установщик автоматически выбирает x64 или ARM64. Перед обновлением закройте программу."
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_TITLE "Программа установлена"
!define MUI_FINISHPAGE_TEXT "Открывайте программу с рабочего стола или из меню «Пуск».$\r$\n$\r$\nРабочие тексты и учебный прогресс хранятся отдельно от файлов программы. При обновлении и удалении они сохраняются."
!define MUI_FINISHPAGE_RUN "$INSTDIR\Slavonic.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Открыть программу"
!insertmacro MUI_PAGE_FINISH
!define MUI_UNCONFIRMPAGE_TEXT_TOP "Будут удалены файлы программы и её ярлыки.$\r$\n$\r$\nВаши тексты, настройки и учебный прогресс останутся в профиле Windows."
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Russian"

Var MutexHandle

; Restrict all destructive actions to our own installation and never delete a whole tree.
!macro CHECK_OWNERSHIP
 !define OWN_LABEL ownership_${__COUNTER__}
 IfFileExists "$INSTDIR\${MARKER}" marker_present_${OWN_LABEL}
 IfFileExists "$INSTDIR\*.*" 0 ownership_done_${OWN_LABEL}
 MessageBox MB_OK|MB_ICONSTOP "Папка $INSTDIR уже существует и не отмечена как установленная этой программой. Чтобы сохранить её содержимое, установка остановлена."
 Abort
 marker_present_${OWN_LABEL}:
 ClearErrors
 FileOpen $0 "$INSTDIR\${MARKER}" r
 IfErrors ownership_failed_${OWN_LABEL}
 FileRead $0 $1
 FileClose $0
 StrCmp $1 "${APPID}" ownership_done_${OWN_LABEL}
 ownership_failed_${OWN_LABEL}:
 MessageBox MB_OK|MB_ICONSTOP "Не удалось подтвердить принадлежность папки $INSTDIR этой программе. Операция остановлена."
 Abort
 ownership_done_${OWN_LABEL}:
 !undef OWN_LABEL
!macroend

!macro CHECK_APP_CLOSED
 !define CLOSED_LABEL app_closed_${__COUNTER__}
 ; Electron keeps this caption on its main window. The file check also catches headless processes.
 FindWindow $0 "Chrome_WidgetWin_1" "${APPNAME}"
 ${If} $0 != 0
  MessageBox MB_OK|MB_ICONSTOP "Сначала закройте «${APPNAME}», чтобы сохранить тексты и завершить работу. Затем запустите установщик или удаление ещё раз."
  Abort
 ${EndIf}
 IfFileExists "$INSTDIR\Slavonic.exe" 0 ${CLOSED_LABEL}
 System::Call 'kernel32::CreateFileW(w "$INSTDIR\Slavonic.exe", i 0x40000000, i 0, p 0, i 3, i 0x80, p 0) p .r0'
 ${If} $0 == -1
  MessageBox MB_OK|MB_ICONSTOP "Нет доступа к файлу программы. Закройте «${APPNAME}» и повторите операцию. Если программа уже закрыта, проверьте права доступа к $INSTDIR."
  Abort
 ${EndIf}
 System::Call 'kernel32::CloseHandle(p r0)'
 ${CLOSED_LABEL}:
 !undef CLOSED_LABEL
!macroend

!macro ACQUIRE_MUTEX
 System::Call 'kernel32::CreateMutexW(p 0, i 0, w "Local\${APPID}.installer") p .r0 ?e'
 Pop $1
 StrCpy $MutexHandle $0
 ${If} $1 == 183
  MessageBox MB_OK|MB_ICONSTOP "Установка или удаление этой программы уже выполняется. Дождитесь завершения."
  Abort
 ${EndIf}
!macroend

Function .onInit
 SetShellVarContext current
 SetRegView 64
 ${IfNot} ${AtLeastWin10}
  MessageBox MB_OK|MB_ICONSTOP "Эта версия предназначена для Windows 10 и Windows 11."
  Abort
 ${EndIf}
 ${IfNot} ${IsNativeAMD64}
  ${IfNot} ${IsNativeARM64}
   MessageBox MB_OK|MB_ICONSTOP "Эта версия предназначена для Windows x64 или ARM64. 32-разрядная Windows не поддерживается."
   Abort
  ${EndIf}
 ${EndIf}
 !insertmacro ACQUIRE_MUTEX
 !insertmacro CHECK_OWNERSHIP
 !insertmacro CHECK_APP_CLOSED
FunctionEnd

Function .onGUIEnd
 System::Call 'kernel32::CloseHandle(p $MutexHandle)'
FunctionEnd

Section "Программа" SEC_MAIN
 SetShellVarContext current
 !insertmacro CHECK_OWNERSHIP
 !insertmacro CHECK_APP_CLOSED
 SetOutPath "$INSTDIR"
 ClearErrors
 ; Mark ownership before the first payload file, so an interrupted first install can be repaired.
 FileOpen $0 "$INSTDIR\${MARKER}" w
 IfErrors marker_write_failed
 FileWrite $0 "${APPID}"
 FileClose $0
 IfErrors marker_write_failed marker_write_done
 marker_write_failed:
 MessageBox MB_OK|MB_ICONSTOP "Не удалось подготовить папку установки. Проверьте свободное место и права доступа к $INSTDIR."
 Abort
 marker_write_done:
 WriteUninstaller "$INSTDIR\Uninstall.exe"
 ${If} ${Errors}
  MessageBox MB_OK|MB_ICONSTOP "Не удалось создать удаление программы. Проверьте свободное место и повторите установку."
  Abort
 ${EndIf}
 ClearErrors
 ${If} ${IsNativeARM64}
  !include "payload-arm64.nsh"
 ${Else}
  !include "payload-x64.nsh"
 ${EndIf}
 ${If} ${Errors}
  MessageBox MB_OK|MB_ICONSTOP "Не удалось скопировать все файлы. Закройте программу, проверьте свободное место и повторите установку."
  Abort
 ${EndIf}
 SetOutPath "$INSTDIR"
 File "slavonic.ico"
 CreateDirectory "$SMPROGRAMS\${APPNAME}"
 CreateShortcut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\Slavonic.exe" "" "$INSTDIR\slavonic.ico"
 CreateShortcut "$SMPROGRAMS\${APPNAME}\Удалить программу.lnk" "$INSTDIR\Uninstall.exe"
 CreateShortcut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\Slavonic.exe" "" "$INSTDIR\slavonic.ico"
 WriteRegStr HKCU "${UKEY}" "DisplayName" "${APPNAME}"
 WriteRegStr HKCU "${UKEY}" "DisplayVersion" "${VERSION}"
 WriteRegStr HKCU "${UKEY}" "Publisher" "Slavonic"
 WriteRegStr HKCU "${UKEY}" "DisplayIcon" "$INSTDIR\slavonic.ico"
 WriteRegStr HKCU "${UKEY}" "InstallLocation" "$INSTDIR"
 WriteRegStr HKCU "${UKEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
 WriteRegStr HKCU "${UKEY}" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
 WriteRegDWORD HKCU "${UKEY}" "NoModify" 1
 WriteRegDWORD HKCU "${UKEY}" "NoRepair" 1
 WriteRegDWORD HKCU "${UKEY}" "EstimatedSize" 340000
SectionEnd

Function un.onInit
 SetShellVarContext current
 SetRegView 64
 !insertmacro ACQUIRE_MUTEX
 !insertmacro CHECK_OWNERSHIP
 !insertmacro CHECK_APP_CLOSED
FunctionEnd

Function un.onGUIEnd
 System::Call 'kernel32::CloseHandle(p $MutexHandle)'
FunctionEnd

Section "Uninstall"
 SetShellVarContext current
 !insertmacro CHECK_APP_CLOSED
 Delete "$DESKTOP\${APPNAME}.lnk"
 Delete "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk"
 Delete "$SMPROGRAMS\${APPNAME}\Удалить программу.lnk"
 RMDir "$SMPROGRAMS\${APPNAME}"
 !include "uninstall-files.nsh"
 Delete "$INSTDIR\slavonic.ico"
 Delete "$INSTDIR\${MARKER}"
 Delete "$INSTDIR\Uninstall.exe"
 RMDir "$INSTDIR"
 DeleteRegKey HKCU "${UKEY}"
SectionEnd
