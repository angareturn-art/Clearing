@echo off
chcp 65001 > nul

title Clearing - Start All

cd /d %~dp0

set LOCAL_IP=
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do set _raw=%%a
for /f "tokens=1" %%b in ("%_raw%") do set LOCAL_IP=%%b

echo.
echo ================================================
echo   Clearing - Backend + Frontend Start
echo ================================================
echo.

start "Backend (5010)" cmd /k "cd /d %~dp0 && call run-backend.bat"
timeout /t 2 /nobreak > nul
start "Frontend (3000)" cmd /k "cd /d %~dp0 && call run-frontend.bat"

echo.
echo  [PC]     http://localhost:3000
echo.
if defined LOCAL_IP (
    echo  [Mobile] http://%LOCAL_IP%:3000
) else (
    echo  [Mobile] Check IPv4 address in ipconfig, then add :3000
)
echo.
echo  Close each window to stop servers.
echo.
pause