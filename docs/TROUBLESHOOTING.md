# 🔧 Troubleshooting: Songs Not Adding

## Quick Checklist

Run through these steps in order:

### 1. ✅ Is Redis Running?

**Test Redis:**
```powershell
redis-cli ping
```

**Expected:** `PONG`

**If not running:**
```powershell
# Start Redis
redis-server

# Or if installed via Chocolatey
redis-server
```

### 2. ✅ Is Backend Running?

**Check backend terminal:**
- Should show: `✅ Redis connected successfully`
- Should show: `✅ Server running on port 3000`

**Test backend manually:**
```powershell
# Open PowerShell
curl http://localhost:3000/health
```

**Expected:** `{"status":"ok","timestamp":"..."}`

**If backend not running:**
```powershell
cd C:\Users\JCIN\OneDrive\Desktop\HarmonyHub\backend
npm run dev
```

### 3. ✅ Is Frontend Running?

**Check frontend terminal:**
- Should show: `Local: http://localhost:5173/`

**If frontend not running:**
```powershell
cd C:\Users\JCIN\OneDrive\Desktop\HarmonyHub\frontend
npm run dev
```

### 4. ✅ Check Browser Console

1. Open browser (http://localhost:5173)
2. Press `F12` to open Developer Tools
3. Go to "Console" tab

**Look for:**
- ✅ `🔌 Connected to server` (good)
- ❌ `Socket connection error` (bad - backend not running)
- ❌ `NET::ERR_CONNECTION_REFUSED` (bad - wrong port)

### 5. ✅ Test Adding a Song

**Open browser console while adding:**

1. Go to Admin page (create a room)
2. Search for a song (e.g., "heat waves")
3. Click the `+` button
4. Watch the console for:
   - Socket events
   - API calls
   - Errors

**Check backend terminal for:**
```
Song added to room ABCD12: Heat Waves
```

### 6. ✅ Check Spotify Credentials

**Verify backend/.env has valid credentials:**
```env
SPOTIFY_CLIENT_ID=f33f3fd1373247a985c5f9880d3f4203
SPOTIFY_CLIENT_SECRET=5bb0e6ff995544388a1107217913333f
```

**Test Spotify API:**
```powershell
# In backend directory
cd C:\Users\JCIN\OneDrive\Desktop\HarmonyHub\backend
node -e "require('dotenv').config(); const {getSpotifyToken} = require('./src/config/spotify'); getSpotifyToken().then(t => console.log('✅ Token:', t.substring(0,20) + '...')).catch(e => console.log('❌ Error:', e.message))"
```

## Common Issues & Fixes

### Issue: "Cannot connect to server"

**Cause:** Backend not running or wrong port

**Fix:**
```powershell
# Kill any process on port 3000
netstat -ano | findstr :3000
# Note the PID and kill it:
taskkill /PID <PID> /F

# Restart backend
cd backend
npm run dev
```

### Issue: "Redis Client Error"

**Cause:** Redis not running

**Fix:**
```powershell
redis-server
```

### Issue: "Socket keeps disconnecting"

**Cause:** CORS or network issue

**Fix:**
Check `backend/.env`:
```env
CORS_ORIGIN=http://localhost:5173
```

Restart backend after changing.

### Issue: "Search works but add doesn't"

**Cause:** Socket not connected or room doesn't exist

**Fix:**
1. Check socket connection status (green "Live" badge)
2. Try refreshing the page
3. Create a new room and try again

### Issue: "401 Unauthorized" from Spotify

**Cause:** Invalid Spotify credentials

**Fix:**
1. Go to https://developer.spotify.com/dashboard
2. Verify your app exists
3. Copy Client ID and Secret
4. Update `backend/.env`
5. Restart backend

## Debug Mode

**Add console logs to see what's happening:**

Open `frontend/src/pages/Admin.jsx` and modify `handleAddSong`:

```javascript
const handleAddSong = (song) => {
  console.log('🎵 Adding song:', song);
  console.log('📍 Room ID:', roomId);
  console.log('🔌 Socket connected:', socket.connected);
  
  socket.emit('add_song', {
    roomId,
    songData: song
  });
  
  console.log('✅ Emitted add_song event');
  
  // Clear search
  setSearchQuery('');
  setSearchResults([]);
};
```

Then check browser console when clicking add.

## Still Not Working?

**Get detailed logs:**

1. Backend terminal - should show each event
2. Frontend console (F12) - shows all socket events
3. Redis CLI - check if data is stored:
   ```powershell
   redis-cli
   KEYS *
   HGETALL room:YOURCODE
   ZRANGE leaderboard:YOURCODE 0 -1 WITHSCORES
   ```

**Send me the output of:**
- Backend terminal when adding a song
- Browser console errors (F12)
- Redis KEYS output
