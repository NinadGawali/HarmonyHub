const axios = require('axios');
const { config } = require('../config/env');

const MIN_COUNT = 4;
const MAX_COUNT = 15;
const DEFAULT_COUNT = 8;
const REQUEST_TIMEOUT_MS = 20000;

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

// Asks the Python recommender for AI song suggestions.
const generatePlaylistRecommendations = async ({ moodPrompt, artist, count }) => {
  const normalizedCount = normalizeCount(count);

  let data;
  try {
    ({ data } = await axios.post(
      `${config.recommenderUrl}/recommend/ai`,
      { moodPrompt, artist, count: normalizedCount },
      { timeout: REQUEST_TIMEOUT_MS }
    ));
  } catch (error) {
    console.error('Recommendation request failed:', error.message);
    throw new RecommenderUnavailableError();
  }

  const songs = (data?.songs || [])
    .filter((song) => song?.title && song?.artist)
    .slice(0, normalizedCount)
    .map((song) => ({
      title: String(song.title).trim(),
      artist: String(song.artist).trim(),
      reason: song.reason ? String(song.reason).trim() : 'Matches your request.'
    }));

  return {
    assistantMessage: data?.assistantMessage ? String(data.assistantMessage).trim() : 'Here are your recommendations.',
    songs,
    usedFallback: Boolean(data?.usedFallback)
  };
};

module.exports = { RecommenderUnavailableError, generatePlaylistRecommendations };
