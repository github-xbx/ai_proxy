@echo off
setlocal

echo ========================================
echo   AI Proxy Installer Builder
echo ========================================
echo.

cd /d "%~dp0.."

set INSTALLER_DIR=installer
set BUILD_DIR=%INSTALLER_DIR%\build
set NODE_DIR=%BUILD_DIR%\node
set APP_DIR=%BUILD_DIR%\app

:: Clean
echo [1/6] Cleaning build directory...
if exist "%BUILD_DIR%" rmdir /s /q "%BUILD_DIR%"
mkdir "%BUILD_DIR%"
mkdir "%NODE_DIR%"
mkdir "%APP_DIR%"

:: Build TypeScript
echo [2/6] Building TypeScript...
call npm run build
if %errorLevel% neq 0 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)

:: Bundle with esbuild
echo [3/6] Bundling with esbuild...
call npx esbuild dist/src/index.js --bundle --platform=node --outfile="%APP_DIR%\ai-proxy.js"
if %errorLevel% neq 0 (
    echo [ERROR] Bundle failed
    pause
    exit /b 1
)

:: Copy Node.js portable
echo [4/6] Copying Node.js...
:: Get node.exe path
for /f "tokens=*" %%i in ('where node') do set NODE_PATH=%%i
if not exist "%NODE_PATH%" (
    echo [ERROR] Node.js not found
    pause
    exit /b 1
)
copy "%NODE_PATH%" "%NODE_DIR%\node.exe" >nul

:: Copy plugins, shared modules and config
echo [5/6] Copying plugins and config...
xcopy /e /i /y dist\plugins "%APP_DIR%\plugins" >nul
xcopy /e /i /y dist\plugin-sdk "%APP_DIR%\plugin-sdk" >nul
xcopy /e /i /y dist\src "%APP_DIR%\src" >nul
xcopy /e /i /y config "%APP_DIR%\config" >nul
if exist .env.example copy .env.example "%APP_DIR%\.env.example" >nul
if exist README.md copy README.md "%APP_DIR%\README.md" >nul

:: Create start script (background mode)
echo @echo off > "%APP_DIR%\ai-proxy-start.bat"
echo cd /d "%%~dp0" >> "%APP_DIR%\ai-proxy-start.bat"
echo echo ======================================== >> "%APP_DIR%\ai-proxy-start.bat"
echo echo   AI Proxy Server >> "%APP_DIR%\ai-proxy-start.bat"
echo echo ======================================== >> "%APP_DIR%\ai-proxy-start.bat"
echo echo. >> "%APP_DIR%\ai-proxy-start.bat"
echo echo Starting AI Proxy in background... >> "%APP_DIR%\ai-proxy-start.bat"
echo start /b node.exe ai-proxy.js >> "%APP_DIR%\ai-proxy-start.bat"
echo timeout /t 2 /nobreak ^>nul >> "%APP_DIR%\ai-proxy-start.bat"
echo echo. >> "%APP_DIR%\ai-proxy-start.bat"
echo echo [OK] AI Proxy is running in background! >> "%APP_DIR%\ai-proxy-start.bat"
echo echo [OK] Access at: http://localhost:3000 >> "%APP_DIR%\ai-proxy-start.bat"
echo echo. >> "%APP_DIR%\ai-proxy-start.bat"
echo echo You can close this window. >> "%APP_DIR%\ai-proxy-start.bat"
echo echo To stop: Task Manager ^> node.exe ^> End Task >> "%APP_DIR%\ai-proxy-start.bat"
echo echo ======================================== >> "%APP_DIR%\ai-proxy-start.bat"
echo pause >> "%APP_DIR%\ai-proxy-start.bat"

:: Convert PNG to ICO if needed
if not exist "ai-proxy.ico" (
    if exist "ai-proxy.png" (
        echo [INFO] ai-proxy.ico not found, using default icon
    )
)

:: Build installer with NSIS
echo [6/6] Building installer...
where makensis >nul 2>&1
if %errorLevel% equ 0 (
    makensis "%INSTALLER_DIR%\ai-proxy.nsi"
) else if exist "D:\Program Files\NSIS\makensis.exe" (
    "D:\Program Files\NSIS\makensis.exe" "%INSTALLER_DIR%\ai-proxy.nsi"
) else if exist "C:\Program Files (x86)\NSIS\makensis.exe" (
    "C:\Program Files (x86)\NSIS\makensis.exe" "%INSTALLER_DIR%\ai-proxy.nsi"
) else (
    echo [ERROR] NSIS not found. Please install NSIS or add to PATH.
    pause
    exit /b 1
)
if %errorLevel% equ 0 (
    echo.
    echo ========================================
    echo   Installer created: ai-proxy-setup.exe
    echo ========================================
) else (
    echo [ERROR] NSIS build failed
)

pause
