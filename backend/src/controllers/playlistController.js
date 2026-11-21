const { config } = require('../config/env');
const { allowRequest } = require('../utils/rateLimit');
const { RecommenderUnavailableError, generatePlaylist } = require('../services/playlistRecommendationService');
const { SpotifyBusyError, SpotifyPermissionError, exportPlaylist } = require('../services/spotifyPlaylistService');
const { SpotifyReauthRequiredError } = require('../services/userService');

const MAX_PROMPT_LENGTH = 500;
const MAX_ARTIST_LENGTH = 100;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 300;
const MAX_EXPORT_TRACKS = 200;
const EXPORTS_PER_MINUTE = 5;
const DEFAULT_PLAYLIST_NAME = 'HarmonyHub playlist';
const SPOTIFY_TRACK_ID = /^[A-Za-z0-9]{22}$/;

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

// Rate limits fail open: a Redis hiccup should not block the feature.
const withinLimit = async (key, limit) => {
  try {
    return await allowRequest(key, limit, RATE_LIMIT_WINDOW_SECONDS);
  } catch (error) {
    console.error('Rate limit check failed:', error.message);
    return true;
  }
};

// POST /api/playlists/export { name, description?, trackIds }
// Saves the tracks as a private playlist in the signed-in user's Spotify account.
const exportToSpotify = async (req, res) => {
  const name = (readText(req.body?.name) || DEFAULT_PLAYLIST_NAME).slice(0, MAX_NAME_LENGTH);
  // Spotify rejects line breaks in playlist descriptions.
  const description = readText(req.body?.description).replace(/\s+/g, ' ').slice(0, MAX_DESCRIPTION_LENGTH)
    || 'Made with HarmonyHub';
  const rawIds = Array.isArray(req.body?.trackIds) ? req.body.trackIds : [];
  const trackIds = [...new Set(rawIds.filter((id) => typeof id === 'string' && SPOTIFY_TRACK_ID.test(id)))];

  if (!trackIds.length) {
    return res.status(400).json({ error: 'There are no Spotify songs to save.' });
  }
  if (trackIds.length > MAX_EXPORT_TRACKS) {
    return res.status(400).json({ error: `A playlist can be saved with at most ${MAX_EXPORT_TRACKS} songs.` });
  }

  if (!(await withinLimit(`playlist-export:${req.user.id}`, EXPORTS_PER_MINUTE))) {
    res.set('Retry-After', String(RATE_LIMIT_WINDOW_SECONDS));
    return res.status(429).json({ error: 'You are saving playlists very quickly. Wait a minute and try again.' });
  }

  try {
    const playlist = await exportPlaylist(req.user.id, { name, description, trackIds });
    return res.status(201).json(playlist);
  } catch (error) {
    if (error instanceof SpotifyReauthRequiredError) {
      return res.status(401).json({ error: error.message, code: 'SPOTIFY_LOGIN_REQUIRED' });
    }
    if (error instanceof SpotifyPermissionError) {
      return res.status(403).json({ error: error.message, code: 'SPOTIFY_RECONNECT' });
    }
    if (error instanceof SpotifyBusyError) {
      return res.status(503).json({ error: error.message });
    }
    console.error('Error saving playlist to Spotify:', error.response?.data || error.message);
    return res.status(502).json({ error: 'Could not save the playlist to Spotify.' });
  }
};

module.exports = { generate, exportToSpotify };
