const { nanoid } = require('nanoid');
const {
  RecommenderUnavailableError,
  generatePlaylistRecommendations
} = require('../services/playlistRecommendationService');
const { searchSongs } = require('../services/spotifyService');

const MAX_PROMPT_LENGTH = 500;
const MAX_ARTIST_LENGTH = 100;

const matchRecommendation = async (song) => {
  try {
    const [match] = await searchSongs(`${song.title} ${song.artist}`);
    return match ? { ...song, ...match } : song;
  } catch (error) {
    console.error(`Could not match recommendation "${song.title}" to Spotify:`, error.message);
    return song;
  }
};

// POST /api/playlists/recommendations { description, artist?, count? }
const generateRecommendations = async (req, res) => {
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  const artist = typeof req.body?.artist === 'string' ? req.body.artist.trim() : '';

  if (!description) {
    return res.status(400).json({ error: 'Describe the playlist you want.' });
  }
  if (description.length > MAX_PROMPT_LENGTH || artist.length > MAX_ARTIST_LENGTH) {
    return res.status(400).json({ error: 'Prompt is too long.' });
  }

  try {
    const recommendation = await generatePlaylistRecommendations({
      moodPrompt: description,
      artist,
      count: req.body?.count
    });

    const matchedSongs = await Promise.all(
      recommendation.songs.map((song) => matchRecommendation(song))
    );

    return res.status(200).json({
      message: recommendation.assistantMessage,
      usedFallback: recommendation.usedFallback,
      songs: matchedSongs.map((song) => ({
        songId: song.songId || `generated_${nanoid(10)}`,
        title: song.title,
        artist: song.artist,
        reason: song.reason,
        image: song.image || '',
        spotifyUrl: song.spotifyUrl || '',
        previewUrl: song.previewUrl || '',
        duration: song.duration,
        album: song.album || ''
      }))
    });
  } catch (error) {
    if (error instanceof RecommenderUnavailableError) {
      return res.status(503).json({ error: error.message });
    }
    console.error('Error generating playlist recommendations:', error);
    return res.status(500).json({ error: 'Failed to generate recommendations.' });
  }
};

module.exports = { generateRecommendations };
