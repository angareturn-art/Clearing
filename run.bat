@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

title 건설 현장 관리 시스템 (Clearing)

echo.
echo ====================================================
echo  건설 현장 관리 시스템 (Clearing) - 전체 실행
echo ====================================================
echo.
echo 백엔드 서버 (포트 5000) 실행 중...
echo 프론트엔드 (포트 5173) 실행 중...
echo.

REM 백엔드 서버 시작 (새 창)
start "백엔드 서버 (포트 5000)" cmd /k "cd /d %~dp0 && call run-backend.bat"

REM 1초 대기 (서버 시작 완료 대기)
timeout /t 1 /nobreak > nul

REM 프론트엔드 시작 (새 창)
start "프론트엔드 (포트 5173)" cmd /k "cd /d %~dp0 && call run-frontend.bat"

echo.
echo ====================================================
echo  실행 완료!
echo ====================================================
echo.
echo [백엔드 서버]
echo - 주소: http://localhost:5000
echo - 상태: 새 창에서 실행 중
echo.
echo [프론트엔드]
echo - 주소: http://localhost:3000 (개발 서버)
echo - 상태: 새 창에서 실행 중
echo.
echo  팁: 두 터미널 창이 자동으로 열립니다.
echo  종료하려면 각 창을 닫으세요.
echo.
pause
