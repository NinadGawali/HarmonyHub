const spotifyService = require('../services/spotifyService');

// Search for songs
const searchSongs = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim() === '') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const songs = await spotifyService.searchSongs(q);

    res.json({ songs });
  } catch (error) {
    console.error('Error searching songs:', error);
    res.status(500).json({ error: error.message || 'Failed to search songs' });
  }
};

// Get track details
const getTrackDetails = async (req, res) => {
  try {
    const { trackId } = req.params;

    if (!trackId) {
      return res.status(400).json({ error: 'Track ID is required' });
    }

    const track = await spotifyService.getTrackDetails(trackId);

    res.json({ track });
  } catch (error) {
    console.error('Error getting track details:', error);
    res.status(500).json({ error: error.message || 'Failed to get track details' });
  }
};

module.exports = {
  searchSongs,
  getTrackDetails
};
