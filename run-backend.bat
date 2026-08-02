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

REM 이전 실행에서 5010 포트를 이미 점유 중인 프로세스가 있으면 새 node index.js가 바인딩하지
REM 못한 채 조용히 실패하고, 옛 프로세스가 코드 변경 없이 계속 응답하는 문제가 있었음.
REM 그래서 새로 시작하기 전에 기존 점유 프로세스를 먼저 종료한다.
echo [INFO] Checking for existing process on port 5010...
set FOUND_OLD=0
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5010" ^| findstr "LISTENING"') do (
    if not "%%p"=="0" (
        set FOUND_OLD=1
        echo [INFO] Terminating existing process on port 5010 ^(PID %%p^) so new code is loaded...
        taskkill /F /PID %%p >nul 2>&1
    )
)
if "%FOUND_OLD%"=="1" (
    timeout /t 1 /nobreak > nul
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