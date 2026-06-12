@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo   AI Proxy Server
echo ========================================
echo.

echo Validating config...
node ai-proxy.js --validate-only
if %errorlevel% neq 0 (
    echo.
    echo [FAILED] Startup failed. Check logs for details.
    echo ========================================
    pause
    exit /b 1
)

echo [OK] Config validated. Starting server...
powershell -Command "$p = Start-Process -FilePath 'node.exe' -ArgumentList 'ai-proxy.js' -WindowStyle Hidden -PassThru; $p.Id" > .pid
timeout /t 2 /nobreak >nul
set PID=
if exist .pid (
    set /p PID=< .pid
    del .pid >nul 2>&1
)
echo.
echo ========================================
echo [OK] AI Proxy is running in background
if defined PID echo [OK] PID: %PID%
echo [OK] Address: http://localhost:3000
echo ========================================
echo.
echo Press any key to close this window.
echo To stop: Task Manager ^> node.exe ^> End Task
pause >nul
