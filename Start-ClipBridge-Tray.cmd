@echo off
setlocal
cd /d "%~dp0"
start "" powershell.exe -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0ClipBridge-Tray.ps1"
exit /b 0
