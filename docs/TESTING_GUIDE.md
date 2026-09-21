# Testing Guide for New Features

## New Features Added
1. **Vote Limiting**: Users can only vote once per song
2. **Voting Controls**: Admin can open/close voting
3. **Music Player**: Auto-plays winning songs after voting closes

---

## Testing Vote Limiting

### Backend Changes
- ✅ `votingService.js`: Added Redis sets to track votes per user per song
- ✅ `votingSocket.js`: Vote event now requires `userId` and checks voting status

### Frontend Changes
- ✅ `Room.jsx`: Generates unique `userId` for each user, tracks voted songs
- ✅ `SongCard.jsx`: Shows "✓ Voted" button when user already voted
- ✅ `Leaderboard.jsx`: Passes `votedSongs` prop to cards

### Test Steps
1. **Start Backend**:
   ```powershell
   cd backend
   npm start
   ```

2. **Start Frontend**:
   ```powershell
   cd frontend
   npm run dev
   ```

3. **Create Room**: Go to http://localhost:5173, create admin room
4. **Join as User**: Open in incognito/different browser, join room
5. **Vote on Song**: Click vote button - it should show "✓ Voted" after voting
6. **Try Duplicate Vote**: Click the same song again - should show "Already voted"
7. **Check Console**: Backend should log "User already voted for this song"

---

## Testing Voting Controls

### Backend Changes
- ✅ `votingService.js`: Added `setVotingStatus()`, `getVotingStatus()` functions
- ✅ `votingSocket.js`: Added `toggle_voting` event handler

### Frontend Changes
- ✅ `Admin.jsx`: Added "Close Voting / Open Voting" button in header
- ✅ `Room.jsx`: Shows "🔒 Voting is closed" banner when closed

### Test Steps
1. **Admin Panel**: Open admin page after creating room
2. **See Button**: Top-right header shows green "Close Voting" button
3. **Close Voting**: Click button - it turns red "Open Voting"
4. **User View**: Go to user room view - banner shows "Voting is closed"
5. **Try Voting**: Vote buttons are hidden when closed
6. **Reopen**: Admin clicks "Open Voting" - users can vote again

---

## Testing Music Player

### New Components
- ✅ `MusicPlayer.jsx`: Full music player with play/pause, skip, volume controls
- ✅ Admin page integration: Shows player when voting is closed

### Test Steps
1. **Close Voting**: From admin panel, click "Close Voting"
2. **See Player**: Music player appears at top of admin page
3. **Shows Winner**: Displays #1 ranked song with album art
4. **Auto-Play**: Song preview should start playing automatically
5. **Controls**:
   - ▶️ Play/Pause button works
   - ⏭️ Skip button goes to next song
   - 🔊 Volume slider adjusts volume
   - 🔇 Mute button toggles sound
6. **Queue**: Shows "Playing 1 of X" at bottom
7. **Auto-Next**: When song ends (30 seconds), automatically plays next

### Notes
- Uses Spotify 30-second preview URLs
- If song has no preview, shows "Preview not available" with skip button
- Player only shows when voting is closed AND songs exist

---

## Feature Interactions

### Complete Workflow Test
1. **Admin creates room** → Add 5 songs from Spotify
2. **Users join** → 3+ different browsers/devices
3. **Vote freely** → Each user votes on songs
4. **Check limits** → Try voting same song twice (blocked)
5. **Close voting** → Admin clicks "Close Voting"
6. **Users see banner** → "Voting is closed - Results are final!"
7. **Music starts** → Admin page shows music player
8. **Auto-play** → Top song plays automatically
9. **Manual control** → Admin can play/pause/skip
10. **Reopen** → Admin clicks "Open Voting", player disappears

---

## Troubleshooting

### Issue: Vote limit not working
- **Check**: Redis is running (`redis-cli ping` returns `PONG`)
- **Check**: Backend logs show vote tracking
- **Check**: userId is generated in frontend console

### Issue: Music player not showing
- **Check**: Voting is actually closed (button should say "Open Voting")
- **Check**: Songs exist in leaderboard (at least 1 song)
- **Check**: Browser console for errors

### Issue: No audio playing
- **Check**: Song has preview URL (check Spotify API response)
- **Check**: Browser allows autoplay (some browsers block it)
- **Check**: Volume is not muted
- **Solution**: Click play button manually if autoplay blocked

### Issue: Voting status not syncing
- **Check**: WebSocket connection (status badge shows "Live")
- **Check**: Backend emitting `voting_status_changed` event
- **Check**: Frontend listening for event (check Room.jsx useEffect)

---

## Redis Data Structure

After testing, you can inspect Redis:
```bash
redis-cli

# Check voting status
GET voting:status:ROOMID

# Check votes for a song
SMEMBERS votes:ROOMID:SONGID

# Check leaderboard
ZRANGE leaderboard:ROOMID 0 -1 WITHSCORES
```

---

## Expected Console Logs

### Backend (Successful Vote)
```
vote_song event received
Room: abc123, Song: spotify:001, User: Alice_1234567890
✓ Valid: userVoted=false, votingOpen=true
Vote recorded successfully
Emitting vote_success to room
```

### Backend (Duplicate Vote)
```
vote_song event received
Room: abc123, Song: spotify:001, User: Alice_1234567890
✗ Error: You have already voted for this song
```

### Frontend (Voting Closed)
```
handleVote called
Error: Voting is closed!
Alert: Voting is closed!
```

---

## UI Elements to Verify

### ✅ Room.jsx (User View)
- [x] User badge with name
- [x] Connection status (green "Connected" / red "Disconnected")
- [x] "🔒 Voting is closed" banner (when closed)
- [x] Vote buttons hidden when closed
- [x] "✓ Voted" button shows for voted songs

### ✅ Admin.jsx (Admin View)
- [x] Admin badge with name
- [x] Room code badge
- [x] Connection status
- [x] Green "Close Voting" button (when open)
- [x] Red "Open Voting" button (when closed)
- [x] Music player section (when closed + songs exist)
- [x] Section heading changes: "🔥 Current Rankings" vs "🏆 Final Results"

### ✅ MusicPlayer.jsx
- [x] Album art image (80x80, rounded)
- [x] Song title and artist
- [x] Rank and vote count stats
- [x] Large play/pause button (60x60)
- [x] Skip button (48x48)
- [x] Volume control slider
- [x] Mute button
- [x] Queue position "Playing 1 of X"

---

## Performance Notes

- **Vote checking**: Redis `SISMEMBER` is O(1) - instant
- **Leaderboard**: Sorted sets maintain order automatically
- **WebSocket**: Real-time updates, no polling needed
- **Music Player**: Uses HTML5 audio, no external dependencies

---

## Next Steps / Future Enhancements

1. **Persistent userId**: Store in localStorage to maintain identity across refreshes
2. **Vote History**: Show user which songs they voted for on page load
3. **Playlist Export**: Download final results as Spotify playlist
4. **Full Track Playback**: Integrate Spotify Web Playback SDK for full songs
5. **Vote Animation**: Add confetti/animation when voting
6. **Room Stats**: Total votes, unique voters, most popular time

---

Happy Testing! 🎵
