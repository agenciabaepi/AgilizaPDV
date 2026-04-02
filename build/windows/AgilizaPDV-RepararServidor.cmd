@echo off
title Agiliza PDV - Reparar servidor
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0AgilizaPDV-RepararServidor.ps1"
