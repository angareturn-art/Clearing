@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

title 백엔드 서버 - 포트 5000

echo.
echo ====================================================
echo  백엔드 서버 (포트 5000) 시작
echo ====================================================
echo.

REM 현재 디렉토리 확인
cd /d %~dp0

REM server 디렉토리 이동
if not exist "server" (
    echo [오류] server 폴더를 찾을 수 없습니다.
    echo 현재 위치: %cd%
    pause
    exit /b 1
)

cd server

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

echo [정보] 백엔드 서버를 시작합니다...
echo [정보] 포트: 5000
echo [정보] 데이터베이스: construction.db
echo.

REM 백엔드 서버 실행
node index.js

if errorlevel 1 (
    echo.
    echo [오류] 서버 시작 중 문제가 발생했습니다.
    echo 로그를 확인하세요.
    pause
)

exit /b 0
