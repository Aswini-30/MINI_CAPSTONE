@echo off
echo.
echo ═══════════════════════════════════════════════════════════
echo     🔗 BlueCarbonMRV - Ganache Setup Script
echo ═══════════════════════════════════════════════════════════
echo.

REM Kill existing Ganache on port 7545
echo 🔄 Checking port 7545...
netstat -an | findstr :7545 >nul
if %errorlevel%==0 (
    echo ⚠️  Killing existing Ganache on port 7545...
    taskkill /F /IM ganache-cli.exe >nul 2>&1
)

REM Start fresh Ganache
echo 🚀 Starting Ganache CLI (port 7545, 10 accounts)...
echo.

npx ganache-cli -p 7545 -a 10 -h 0 --deterministic

REM Exit message
echo.
echo ═══════════════════════════════════════════════════════════
echo     📋 NEXT STEPS:
echo 1. Copy ACCOUNT[0] PRIVATE KEY above
echo 2. Create Backend/.env: OWNER_PRIVATE_KEY=0x...
echo 3. Ctrl+C ^<-- stop Ganache, then run again
echo 4. cd Truffle ^& truffle migrate --network development
echo ═══════════════════════════════════════════════════════════
pause
