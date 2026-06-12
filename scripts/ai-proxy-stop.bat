@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo   AI Proxy - Stop Service
echo ========================================
echo.

if not exist .pid (
    echo [WARN] .pid file not found. Service may not be running.
    echo.
    echo Trying to find node.exe processes...
    tasklist /fi "imagename eq node.exe" /fo table | findstr /i "node"
    echo.
    echo To force stop all node processes: taskkill /IM node.exe /F
    pause
    exit /b 1
)

set /p PID=< .pid
echo Stopping AI Proxy (PID: %PID%)...
taskkill /PID %PID% /F >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Service stopped.
    del .pid >nul 2>&1
) else (
    echo [WARN] Process %PID% not found. Service may have already stopped.
    del .pid >nul 2>&1
)

echo.
pause
