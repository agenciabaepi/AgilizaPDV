!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!include "WordFunc.nsh"
!include "WinMessages.nsh"

Var InstallMode
Var ModeForced
Var PSExec
Var RadioServer
Var RadioTerminal

!macro preInit
  StrCpy $InstallMode "terminal"
  StrCpy $ModeForced "0"
  StrCpy $PSExec "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe"
!macroend

!macro customInit
  ; Base para modo Server/Terminal no instalador.
  ; Suporta seleção automática via parâmetro:
  ;   AgilizaPDV-Setup.exe /MODE=server
  ;   AgilizaPDV-Setup.exe /MODE=terminal
  ${GetParameters} $R0
  ${GetOptions} $R0 "/MODE=" $R1
  ${If} $R1 == "server"
    StrCpy $InstallMode "server"
    StrCpy $ModeForced "1"
  ${ElseIf} $R1 == "terminal"
    StrCpy $InstallMode "terminal"
    StrCpy $ModeForced "1"
  ${EndIf}
!macroend

!macro customWelcomePage
  ; Se o modo já veio por parâmetro, não exibe seleção.
  ${If} $ModeForced == "1"
    Return
  ${EndIf}
  ; Em modo silencioso, mantém padrão terminal.
  IfSilent done

  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 28u "Escolha o modo de instalação:"
  Pop $1
  ${NSD_CreateLabel} 0 20u 100% 18u "Selecione como este computador será usado na loja."
  Pop $2

  ${NSD_CreateRadioButton} 0 48u 100% 14u "Servidor (instala PostgreSQL + API/WebSocket local)"
  Pop $RadioServer
  ${NSD_CreateRadioButton} 0 66u 100% 14u "Computador terminal (somente aplicativo)"
  Pop $RadioTerminal

  ${If} $InstallMode == "server"
    SendMessage $RadioServer ${BM_SETCHECK} ${BST_CHECKED} 0
  ${Else}
    SendMessage $RadioTerminal ${BM_SETCHECK} ${BST_CHECKED} 0
  ${EndIf}

  nsDialogs::Show

  ${NSD_GetState} $RadioServer $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $InstallMode "server"
  ${Else}
    StrCpy $InstallMode "terminal"
  ${EndIf}

done:
!macroend

!macro customInstall
  ; Persistir modo para etapas futuras.
  WriteRegStr HKCU "Software\AgilizaPDV" "InstallMode" "$InstallMode"
  CreateDirectory "$APPDATA\agiliza-pdv"
  FileOpen $0 "$APPDATA\agiliza-pdv\install-mode.txt" w
  FileWrite $0 "$InstallMode"
  FileClose $0

  ; Instala runtime por modo (terminal/servidor) e configura startup/firewall.
  IfFileExists "$INSTDIR\resources\windows\install-runtime.ps1" 0 +3
    nsExec::ExecToLog '"$PSExec" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\windows\install-runtime.ps1" -Mode "$InstallMode" -InstallDir "$INSTDIR" -ResourcesDir "$INSTDIR\resources"'
    Pop $0
!macroend

!macro customUnInstall
  IfFileExists "$INSTDIR\resources\windows\uninstall-runtime.ps1" 0 +3
    nsExec::ExecToLog '"$PSExec" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\windows\uninstall-runtime.ps1"'
    Pop $0
!macroend

