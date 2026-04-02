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
    ; Sem /MODE:
    ; - Em instalação silenciosa: preserva o modo já instalado (sem prompt).
    ; - Em instalação interativa normal: pergunta ao usuário (mesmo se existir InstallMode no registry),
    ;   para ficar consistente com o comportamento esperado.
    ReadRegStr $R2 HKCU "Software\AgilizaPDV" "InstallMode"
    ${If} $R2 == "server"
      StrCpy $AgzModeChoice "server"
    ${ElseIf} $R2 == "terminal"
      StrCpy $AgzModeChoice "terminal"
    ${EndIf}

    ; Se a instalação estiver silenciosa, não exibe UI e mantém o valor carregado do registry (ou terminal padrão).
    IfSilent +4
    ; Instalação interativa: pergunta ao usuário.
    ; YES (Sim) cai no fallthrough -> server | NO (Não) pula +3 -> terminal
    MessageBox MB_YESNO|MB_ICONQUESTION "Escolha o modo de instalação:$\r$\n$\r$\nSim = Servidor (PostgreSQL + API local)$\r$\nNão = Terminal (somente app)" IDNO +3
    StrCpy $AgzModeChoice "server"
    Goto +2
    StrCpy $AgzModeChoice "terminal"
  ${EndIf}

  ; Persiste já no init para evitar segunda pergunta em relançamentos internos do NSIS.
  WriteRegStr HKCU "Software\AgilizaPDV" "InstallMode" "$AgzModeChoice"
!macroend

!macro customInstall
  ; Persistir modo para etapas futuras.
  WriteRegStr HKCU "Software\AgilizaPDV" "InstallMode" "$AgzModeChoice"
  CreateDirectory "$APPDATA\agiliza-pdv"
  FileOpen $0 "$APPDATA\agiliza-pdv\install-mode.txt" w
  FileWrite $0 "$AgzModeChoice"
  FileClose $0

  ; Instala runtime por modo (terminal/servidor) e configura startup/firewall.
  IfFileExists "$INSTDIR\resources\windows\install-runtime.ps1" 0 +6
    nsExec::ExecToLog '"$AgzPSExec" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\windows\install-runtime.ps1" -Mode "$AgzModeChoice" -InstallDir "$INSTDIR" -ResourcesDir "$INSTDIR\resources"'
    Pop $0
    ${If} $0 != 0
      MessageBox MB_OK|MB_ICONEXCLAMATION "Falha ao configurar o modo $AgzModeChoice (codigo $0).$\r$\nTente instalar como Administrador.$\r$\nSe for Servidor, a tarefa AgilizaPDV Store Server pode nao ter sido criada."
    ${EndIf}

  ; Modo servidor: atalho para subir API manualmente (nao depende do Agendador).
  ${If} $AgzModeChoice == "server"
    CreateDirectory "$SMPROGRAMS\Agiliza PDV"
    IfFileExists "$INSTDIR\AgilizaPDV-StoreServer.cmd" 0 +2
      CreateShortCut "$SMPROGRAMS\Agiliza PDV\Iniciar servidor da loja.lnk" "$INSTDIR\AgilizaPDV-StoreServer.cmd" "" "$INSTDIR" 0
  ${EndIf}
!macroend

!macro customUnInstall
  Delete "$SMPROGRAMS\Agiliza PDV\Iniciar servidor da loja.lnk"
  IfFileExists "$INSTDIR\resources\windows\uninstall-runtime.ps1" 0 +3
    nsExec::ExecToLog '"$AgzPSExec" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\windows\uninstall-runtime.ps1"'
    Pop $0
!macroend

