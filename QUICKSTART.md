# 🎵 HarmonyHub - Quick Start Guide

Welcome to HarmonyHub! This guide will get you up and running in 5 minutes.

## ⚡ Quick Start

### Option 1: Automated Setup (Recommended)

**Windows:**
```powershell
.\setup.bat
```

**macOS/Linux:**
```bash
chmod +x setup.sh
./setup.sh
```

### Option 2: Manual Setup

1. **Install dependencies:**
   ```bash
   # Backend
   cd backend
   npm install
   
   # Frontend
   cd ../frontend
   npm install
   ```

2. **Configure Spotify API:**
   - Get credentials from [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Copy `backend/.env.example` to `backend/.env`
   - Add your `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`

3. **Start Redis:**
   ```bash
   redis-server
   ```

4. **Run the application:**
   
   **Terminal 1 (Backend):**
   ```bash
   cd backend
   npm run dev
   ```
   
   **Terminal 2 (Frontend):**
   ```bash
   cd frontend
   npm run dev
   ```

5. **Open your browser:**
   ```
   http://localhost:5173
   ```

## 🎮 How to Use

### As Admin:
1. Click "Create a Room"
2. Enter your name
3. Share the room code or QR code
4. Search and add songs from Spotify
5. Watch votes come in real-time!

### As User:
1. Click "Join a Room"
2. Enter your name and room code
3. Vote for your favorite songs
4. See the leaderboard update live!

## 📚 Need Help?

- **Full documentation:** See [README.md](README.md)
- **Troubleshooting:** Check the Troubleshooting section in README.md
- **API docs:** See the API Documentation section

## 🚀 Deploy to AWS (Free)

Follow the detailed AWS deployment guide in [README.md](README.md#-deployment-aws-free-tier)

---

**Enjoy your music party! 🎉**
