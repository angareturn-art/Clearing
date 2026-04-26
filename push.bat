@echo off
setlocal
cd /d %~dp0

echo Starting GitHub Push...
echo [+] 1. Adding changes...
git add .

for /f "tokens=*" %%a in ('git status --porcelain') do set HAS_CHANGES=true

if defined HAS_CHANGES (
    echo [+] 2. Committing changes...
    git commit -m "Auto Update: %date% %time%"
) else (
    echo [Info] No changes to commit.
)

echo [+] 3. Pushing to GitHub...
git push origin HEAD

if %errorlevel% neq 0 (
    echo ----------------------------------------
    echo [Error] Push Failed!
    echo ----------------------------------------
    pause
) else (
    echo ----------------------------------------
    echo [Success] GitHub Upload Completed.
    echo ----------------------------------------
    timeout /t 3
)

endlocal
