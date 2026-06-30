@echo off
chcp 65001 > nul

echo Requesting administrator privileges...
powershell -Command "Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command \"New-NetFirewallRule -DisplayName ''Vite Dev 3000'' -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Any; Write-Host OK -ForegroundColor Green; Start-Sleep 2\"' -Verb RunAs"