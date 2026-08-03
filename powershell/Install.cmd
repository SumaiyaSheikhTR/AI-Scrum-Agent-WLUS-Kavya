@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install.ps1"
if errorlevel 1 (
  echo.
  echo Installation failed. Review the error above.
  pause
  exit /b 1
)
echo.
echo Installation complete.
pause
