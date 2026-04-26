@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

title 프론트엔드 개발 서버 - 포트 5173

echo.
echo ====================================================
echo  프론트엔드 개발 서버 (포트 5173) 시작
echo ====================================================
echo.

REM 현재 디렉토리 확인
cd /d %~dp0

REM node_modules 확인
if not exist "node_modules" (
    echo [안내] 필요한 패키지를 설치합니다...
    call npm install
    if errorlevel 1 (
        echo [오류] npm install 실패했습니다.
        pause
        exit /b 1
    )
)

echo [정보] 프론트엔드 개발 서버를 시작합니다...
echo [정보] 포트: 5173
echo [정보] API 프록시: http://localhost:5000
echo.

REM 프론트엔드 개발 서버 실행
call npm run dev

if errorlevel 1 (
    echo.
    echo [오류] 서버 시작 중 문제가 발생했습니다.
    echo 로그를 확인하세요.
    pause
)

exit /b 0
