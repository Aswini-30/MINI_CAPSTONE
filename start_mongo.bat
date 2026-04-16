@echo off
echo.
echo ═══════════════════════════════════════════════════════════
echo     🗄️  BlueCarbonMRV - MongoDB Setup  
echo ═══════════════════════════════════════════════════════════
echo.

REM Check if MongoDB is running on port 27017
netstat -an | findstr :27017 >nul
if %errorlevel%==0 (
    echo ✅ MongoDB already running on port 27017
) else (
    echo ⚠️  MongoDB not running on 27017
    echo.
    echo 📥 Install MongoDB Community Server:
    echo 1. Download: https://www.mongodb.com/try/download/community
    echo 2. Windows installer → Complete setup
    echo 3. Start MongoDB service: services.msc → MongoDB → Start
    echo.
    echo 🔄 Or run MongoDB manually:
    echo cd "C:\Program Files\MongoDB\Server\7.0\bin"
    echo mongod.exe --dbpath ./data
    echo.
    pause
    exit /b 1
)

echo.
echo ✅ MongoDB ready! Database: bluecarbonmrv
echo.
pause
