@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo   AI Proxy - Stop Service
echo ========================================
echo.

:: Try to find and kill process on port 3000
set FOUND=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    echo Stopping process PID: %%a
    taskkill /PID %%a /F >nul 2>&1
    set FOUND=1
)

if %FOUND% equ 1 (
    echo [OK] Service stopped.
    if exist .pid del .pid >nul 2>&1
) else (
    echo [INFO] No running service found on port 3000.
    if exist .pid del .pid >nul 2>&1
)

echo.
pause
