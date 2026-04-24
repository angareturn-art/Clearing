@echo off
chcp 65001 > nul
setlocal
set "CURRENT_DIR=%~dp0"
cd /d "%CURRENT_DIR%"

:: 날짜와 시간 형식을 안전하게 가져오기 (PowerShell 활용)
for /f "tokens=*" %%i in ('powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd HH:mm'"') do set datetime=%%i

echo ========================================
echo   GitHub 자동 업로드 프로세스 (v2)
echo   시각: %datetime%
echo ========================================

:: 1. 변경 사항 추가
echo [+] 스테이징 중...
git add .

:: 2. 변경 사항 확인 및 커밋
echo [+] 변경 사항 확인 및 커밋 중...
git diff --cached --quiet
if %errorlevel% neq 0 (
    git commit -m "Auto Update: %datetime%"
) else (
    echo [정보] 변경된 내용이 없어 커밋을 건너뜁니다.
)

:: 3. 푸시 (현재 활성화된 브랜치로 자동 푸시)
echo [+] GitHub 서버로 전송 중...
for /f "tokens=*" %%b in ('git rev-parse --abbrev-ref HEAD') do set branch=%%b
git push origin %branch%

if %errorlevel% neq 0 (
    echo ----------------------------------------
    echo [오류] 업로드 실패! 
    echo 1. 인터넷 연결을 확인하세요.
    echo 2. 원격 저장소에 새로운 내용이 있다면 먼저 Pull 해야 합니다.
    echo 3. 권한(토큰) 인증을 확인하세요.
    echo ----------------------------------------
    pause
) else (
    echo ----------------------------------------
    echo [성공] GitHub 업로드가 완료되었습니다.
    echo ----------------------------------------
    timeout /t 3
)

endlocal
