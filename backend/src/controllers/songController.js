const votingService = require('../services/votingService');

// Get leaderboard
const getLeaderboard = async (req, res) => {
  try {
    const { roomId } = req.params;

    if (!roomId) {
      return res.status(400).json({ error: 'Room ID is required' });
    }

    const leaderboard = await votingService.getLeaderboard(roomId);

    res.json({ leaderboard });
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
};

// Add song to room
const addSong = async (req, res) => {
  try {
    const { roomId } = req.params;
    const songData = req.body;

    if (!roomId) {
      return res.status(400).json({ error: 'Room ID is required' });
    }

    if (!songData.songId || !songData.title || !songData.artist) {
      return res.status(400).json({ error: 'Song data is incomplete' });
    }

    await votingService.addSongToRoom(roomId, songData);

    res.status(201).json({ message: 'Song added successfully' });
  } catch (error) {
    console.error('Error adding song:', error);
    res.status(500).json({ error: 'Failed to add song' });
  }
};

// Remove song from room
const removeSong = async (req, res) => {
  try {
    const { roomId, songId } = req.params;

    if (!roomId || !songId) {
      return res.status(400).json({ error: 'Room ID and Song ID are required' });
    }

    await votingService.removeSongFromRoom(roomId, songId);

    res.json({ message: 'Song removed successfully' });
  } catch (error) {
    console.error('Error removing song:', error);
    res.status(500).json({ error: 'Failed to remove song' });
  }
};

module.exports = {
  getLeaderboard,
  addSong,
  removeSong
};
