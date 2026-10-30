const { config } = require('../config/env');
const { allowRequest } = require('../utils/rateLimit');
const { RecommenderUnavailableError, generatePlaylist } = require('../services/playlistRecommendationService');

const MAX_PROMPT_LENGTH = 500;
const MAX_ARTIST_LENGTH = 100;
const RATE_LIMIT_WINDOW_SECONDS = 60;

const readText = (value) => (typeof value === 'string' ? value.trim() : '');

// POST /api/playlists/generate { prompt, artist?, count? }
// (`description` is accepted as the old name for `prompt`.)
const generate = async (req, res) => {
  const prompt = readText(req.body?.prompt) || readText(req.body?.description);
  const artist = readText(req.body?.artist);

  if (!prompt) {
    return res.status(400).json({ error: 'Describe the playlist you want.' });
  }
  if (prompt.length > MAX_PROMPT_LENGTH || artist.length > MAX_ARTIST_LENGTH) {
    return res.status(400).json({ error: 'Prompt is too long.' });
  }

  let allowed = true;
  try {
    allowed = await allowRequest(
      `playlist-generate:${req.user.id}`,
      config.recommender.generationsPerMinute,
      RATE_LIMIT_WINDOW_SECONDS
    );
  } catch (error) {
    console.error('Playlist rate limit check failed:', error.message);
  }
  if (!allowed) {
    res.set('Retry-After', String(RATE_LIMIT_WINDOW_SECONDS));
    return res.status(429).json({ error: 'You are generating playlists very quickly. Wait a minute and try again.' });
  }

  try {
    const playlist = await generatePlaylist({ prompt, artist, count: req.body?.count, market: req.user.country });
    return res.status(200).json(playlist);
  } catch (error) {
    if (error instanceof RecommenderUnavailableError) {
      return res.status(503).json({ error: error.message });
    }
    console.error('Error generating playlist:', error);
    return res.status(500).json({ error: 'Failed to generate a playlist.' });
  }
};

module.exports = { generate };
