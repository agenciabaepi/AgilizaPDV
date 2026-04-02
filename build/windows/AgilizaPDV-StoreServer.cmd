@echo off
title Agiliza PDV - Servidor da loja
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0AgilizaPDV-StoreServer.ps1"
if errorlevel 1 pause
