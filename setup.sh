#!/bin/bash

echo "🎵 HarmonyHub Setup Script"
echo "=========================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18 or higher."
    exit 1
fi

echo "✅ Node.js $(node --version) found"

# Check Redis
if ! command -v redis-cli &> /dev/null; then
    echo "❌ Redis not found. Please install Redis."
    exit 1
fi

echo "✅ Redis found"

# Test Redis connection
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is running"
else
    echo "⚠️  Redis is not running. Starting Redis..."
    redis-server --daemonize yes
fi

echo ""
echo "Installing dependencies..."
echo "=========================="

# Backend
echo "📦 Installing backend dependencies..."
cd backend
if [ ! -f .env ]; then
    cp .env.example .env
    echo "⚠️  Created backend/.env - Please add your Spotify credentials!"
fi
npm install
cd ..

# Frontend
echo "📦 Installing frontend dependencies..."
cd frontend
if [ ! -f .env ]; then
    cp .env.example .env
fi
npm install
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Edit backend/.env and add your Spotify credentials"
echo "2. Run: npm run dev (in backend directory)"
echo "3. Run: npm run dev (in frontend directory)"
echo "4. Open http://localhost:5173"
echo ""
