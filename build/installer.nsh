!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "WordFunc.nsh"

Var AgzModeChoice
Var AgzPSExec

!macro preInit
  StrCpy $AgzModeChoice "terminal"
  StrCpy $AgzPSExec "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe"
!macroend

!macro customInit
  ; Base para modo Server/Terminal no instalador.
  ; Suporta seleção automática via parâmetro:
  ;   AgilizaPDV-Setup.exe /MODE=server
  ;   AgilizaPDV-Setup.exe /MODE=terminal
  ${GetParameters} $R0
  ${GetOptions} $R0 "/MODE=" $R1
  ${If} $R1 == "server"
    StrCpy $AgzModeChoice "server"
  ${ElseIf} $R1 == "terminal"
    StrCpy $AgzModeChoice "terminal"
  ${Else}
    ; Sem parâmetro /MODE: pergunta ao usuário na instalação interativa.
    ; Sim = Servidor | Não = Terminal
    IfSilent +4
    MessageBox MB_YESNO|MB_ICONQUESTION "Escolha o modo de instalação:$\r$\n$\r$\nSim = Servidor (PostgreSQL + API local)$\r$\nNão = Terminal (somente app)" IDYES +2 IDNO +3
    StrCpy $AgzModeChoice "server"
    Goto +2
    StrCpy $AgzModeChoice "terminal"
  ${EndIf}
!macroend

!macro customInstall
  ; Persistir modo para etapas futuras.
  WriteRegStr HKCU "Software\AgilizaPDV" "InstallMode" "$AgzModeChoice"
  CreateDirectory "$APPDATA\agiliza-pdv"
  FileOpen $0 "$APPDATA\agiliza-pdv\install-mode.txt" w
  FileWrite $0 "$AgzModeChoice"
  FileClose $0

  ; Instala runtime por modo (terminal/servidor) e configura startup/firewall.
  IfFileExists "$INSTDIR\resources\windows\install-runtime.ps1" 0 +3
    nsExec::ExecToLog '"$AgzPSExec" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\windows\install-runtime.ps1" -Mode "$AgzModeChoice" -InstallDir "$INSTDIR" -ResourcesDir "$INSTDIR\resources"'
    Pop $0
!macroend

!macro customUnInstall
  IfFileExists "$INSTDIR\resources\windows\uninstall-runtime.ps1" 0 +3
    nsExec::ExecToLog '"$AgzPSExec" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\windows\uninstall-runtime.ps1"'
    Pop $0
!macroend

