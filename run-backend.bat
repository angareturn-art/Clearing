@echo off
chcp 65001 > nul

title Backend Server - Port 5010

cd /d %~dp0

if not exist "server" (
    echo [ERROR] server folder not found: %cd%
    pause
    exit /b 1
)

cd server

if not exist "node_modules" (
    echo [INFO] Installing packages...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

echo [INFO] Starting backend server...
echo [INFO] Port: 5010
echo [INFO] DB: construction.db
echo.

node index.js

if errorlevel 1 (
    echo.
    echo [ERROR] Server failed to start.
    pause
)

exit /b 0