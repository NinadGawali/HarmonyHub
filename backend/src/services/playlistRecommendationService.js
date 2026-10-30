const axios = require('axios');
const { config } = require('../config/env');

const MIN_COUNT = 4;
const MAX_COUNT = 15;
const DEFAULT_COUNT = 10;

class RecommenderUnavailableError extends Error {
  constructor() {
    super('The AI playlist service is unavailable right now. Please try again in a moment.');
    this.name = 'RecommenderUnavailableError';
  }
}

const normalizeCount = (count) => {
  const parsed = Number(count);
  return Number.isFinite(parsed) ? Math.max(MIN_COUNT, Math.min(MAX_COUNT, Math.round(parsed))) : DEFAULT_COUNT;
};

// Same shape as Spotify search results, so the frontend treats both alike.
const toSong = (track) => ({
  songId: track.spotify_id,
  title: track.title,
  artist: track.artist,
  album: track.album || '',
  image: track.image || '',
  spotifyUrl: track.spotify_url || '',
  previewUrl: track.preview_url || '',
  duration: track.duration_ms ?? null,
  reason: track.reason || '',
  source: track.source === 'ai' ? 'ai' : 'search'
});

// Thin client for the Python recommender. All AI work, Spotify matching and caching happen there.
const generatePlaylist = async ({ prompt, artist, count, market }) => {
  const headers = config.recommender.internalToken ? { 'X-Internal-Token': config.recommender.internalToken } : {};

  let data;
  try {
    ({ data } = await axios.post(
      `${config.recommender.url}/v1/recommend`,
      { prompt, artist, count: normalizeCount(count), market: market || null },
      { headers, timeout: config.recommender.timeoutMs }
    ));
  } catch (error) {
    const detail = error.response ? `${error.response.status} ${JSON.stringify(error.response.data)}` : error.message;
    console.error('Recommender request failed:', detail);
    throw new RecommenderUnavailableError();
  }

  return {
    message: String(data?.assistant_message || 'Here is your playlist.').trim(),
    usedFallback: Boolean(data?.used_fallback),
    fallbackReason: data?.fallback_reason || null,
    songs: (data?.tracks || []).filter((track) => track?.spotify_id && track?.title).map(toSong)
  };
};

module.exports = { RecommenderUnavailableError, generatePlaylist, normalizeCount };
