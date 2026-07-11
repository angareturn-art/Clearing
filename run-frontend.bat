@echo off
chcp 65001 > nul

title Frontend Dev Server - Port 3000

cd /d %~dp0

if not exist "node_modules" (
    echo [INFO] Installing packages...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

echo [INFO] Starting frontend dev server...
echo [INFO] PC:     http://localhost:3000
echo [INFO] Proxy:  http://localhost:5010
echo.

call npm run dev

if errorlevel 1 (
    echo.
    echo [ERROR] Server failed to start.
    pause
)

exit /b 0