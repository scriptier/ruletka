@echo off
REM ruletka network helper — double-click to run (Windows 64-bit)
REM Opens a console, downloads bridge + tunnel if needed, starts your mini-hub.
setlocal EnableExtensions
title ruletka · network helper
cd /d "%~dp0"

echo.
echo   ruletka · network helper
echo   ────────────────────────
echo   Double-click launcher for Windows.
echo   First run downloads components (needs internet).
echo.

REM Prefer PowerShell 7 if installed, else Windows PowerShell 5
set "PS=powershell"
where pwsh >nul 2>&1 && set "PS=pwsh"

REM -ExecutionPolicy Bypass avoids "scripts disabled" for this one run only
REM -NoProfile keeps it fast; -File runs the helper next to this .bat
"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0rulet-helper.ps1" %*
set "ERR=%ERRORLEVEL%"

if not "%ERR%"=="0" (
  echo.
  echo   Helper exited with code %ERR%.
  echo   If Windows blocked the download, allow the file or check antivirus.
  echo.
  pause
  exit /b %ERR%
)

echo.
pause
endlocal
