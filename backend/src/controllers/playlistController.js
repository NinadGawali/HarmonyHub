const { nanoid } = require('nanoid');
const {
  RecommenderUnavailableError,
  generatePlaylistRecommendations
} = require('../services/playlistRecommendationService');

const MAX_PROMPT_LENGTH = 500;
const MAX_ARTIST_LENGTH = 100;

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

    return res.status(200).json({
      message: recommendation.assistantMessage,
      usedFallback: recommendation.usedFallback,
      // Suggestions are not matched to Spotify tracks yet, so they get temporary ids.
      songs: recommendation.songs.map((song) => ({
        songId: `generated_${nanoid(10)}`,
        title: song.title,
        artist: song.artist,
        reason: song.reason,
        image: '',
        spotifyUrl: ''
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
