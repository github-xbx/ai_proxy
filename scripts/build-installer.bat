@echo off
setlocal

echo ========================================
echo   AI Proxy Installer Builder
echo ========================================
echo.

cd /d "%~dp0.."

set INSTALLER_DIR=installer
set BUILD_DIR=%INSTALLER_DIR%\build
set RELEASE_DIR=release\installer
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

:: Bundle with esbuild (single file, no external dependencies)
echo [3/6] Bundling with esbuild...
call npx esbuild src/index.ts --bundle --platform=node --target=node22 --format=cjs --outfile="%APP_DIR%\ai-proxy.js"
if %errorLevel% neq 0 (
    echo [ERROR] Bundle failed
    pause
    exit /b 1
)

:: Copy Node.js portable
echo [4/6] Copying Node.js...
for /f "tokens=*" %%i in ('where node') do set NODE_PATH=%%i
if not exist "%NODE_PATH%" (
    echo [ERROR] Node.js not found
    pause
    exit /b 1
)
copy "%NODE_PATH%" "%NODE_DIR%\node.exe" >nul

:: Copy config and readme
echo [5/6] Copying config...
xcopy /e /i /y config "%APP_DIR%\config" >nul
copy installer\README.txt "%APP_DIR%\README.txt" >nul
copy scripts\ai-proxy-start.bat "%APP_DIR%\ai-proxy-start.bat" >nul

:: Build installer with NSIS
echo [6/6] Building installer...
if not exist "%RELEASE_DIR%" mkdir "%RELEASE_DIR%"
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
    echo   Installer created: %RELEASE_DIR%\ai-proxy-setup.exe
    echo ========================================
) else (
    echo [ERROR] NSIS build failed
)

pause
