@echo off
echo 🎵 HarmonyHub Setup Script
echo ==========================
echo.

REM Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js not found. Please install Node.js 18 or higher.
    exit /b 1
)

echo ✅ Node.js found
node --version

REM Check Redis
where redis-cli >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Redis not found. Please install Redis.
    echo Download from: https://github.com/tporadowski/redis/releases
    exit /b 1
)

echo ✅ Redis found

REM Test Redis connection
redis-cli ping >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ Redis is running
) else (
    echo ⚠️  Redis is not running. Please start Redis manually.
)

echo.
echo Installing dependencies...
echo ==========================

REM Backend
echo 📦 Installing backend dependencies...
cd backend
if not exist .env (
    copy .env.example .env
    echo ⚠️  Created backend/.env - Please add your Spotify credentials!
)
call npm install
cd ..

REM Frontend
echo 📦 Installing frontend dependencies...
cd frontend
if not exist .env (
    copy .env.example .env
)
call npm install
cd ..

echo.
echo ✅ Setup complete!
echo.
echo 📝 Next steps:
echo 1. Edit backend/.env and add your Spotify credentials
echo 2. Run: npm run dev (in backend directory)
echo 3. Run: npm run dev (in frontend directory)
echo 4. Open http://localhost:5173
echo.
pause
