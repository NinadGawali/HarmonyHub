const axios = require('axios');

const PYTHON_RECOMMENDER_URL = process.env.PYTHON_RECOMMENDER_URL || 'http://127.0.0.1:5001';

const fallbackSongs = (artist, mood, count = 8, source = 'ai') => {
  const baseArtists = artist
    ? [artist, 'The Weeknd', 'Atif Aslam', 'Jal', 'Arijit Singh', 'Bad Bunny']
    : ['The Weeknd', 'Atif Aslam', 'Jal', 'Arijit Singh', 'Bad Bunny', 'Burna Boy'];

  return Array.from({ length: count }).map((_, index) => ({
    title: `${mood || 'Vibe'} Track ${index + 1}`,
    artist: baseArtists[index % baseArtists.length],
    reason: 'Fast fallback recommendation.',
    source
  }));
};

const buildFallbackResponse = ({ moodPrompt, artist, locationLabel, count, mode }) => {
  const normalizedCount = Number.isFinite(Number(count)) ? Math.max(4, Math.min(15, Number(count))) : 8;
  const source = mode === 'location' ? 'regional' : 'ai';

  return {
    assistantMessage: mode === 'location'
      ? (locationLabel
        ? `Using fallback: local picks based on ${locationLabel}.`
        : 'Using fallback: local style picks.')
      : 'Using fallback: AI picks for your prompt.',
    songs: fallbackSongs(artist, moodPrompt, normalizedCount, source),
    locationLabel,
    usedFallback: true
  };
};

const requestPythonRecommendations = async (payload) => {
  const { mode } = payload;
  const endpoint = mode === 'location' ? '/recommend/location' : '/recommend/ai';

  const response = await axios.post(`${PYTHON_RECOMMENDER_URL}${endpoint}`, payload, {
    timeout: 12000
  });

  return response.data;
};

const generatePlaylistRecommendations = async ({ moodPrompt, artist, location, count = 8, mode = 'ai' }) => {
  const normalizedCount = Number.isFinite(Number(count)) ? Math.max(4, Math.min(15, Number(count))) : 8;
  const state = location?.state ? String(location.state).trim() : '';
  const locationLabel = state;

  if (mode === 'location' && !locationLabel) {
    return buildFallbackResponse({
      moodPrompt: 'Regional Mix',
      artist,
      locationLabel: '',
      count: normalizedCount,
      mode
    });
  }

  try {
    const pythonResponse = await requestPythonRecommendations({
      mode,
      moodPrompt,
      artist,
      state,
      count: normalizedCount
    });

    const songs = (pythonResponse?.songs || [])
      .filter((song) => song && song.title && song.artist)
      .slice(0, normalizedCount)
      .map((song) => ({
        title: String(song.title).trim(),
        artist: String(song.artist).trim(),
        reason: song.reason ? String(song.reason).trim() : 'Matches your request.',
        source: mode === 'location' ? 'regional' : (song.source === 'regional' ? 'regional' : 'ai')
      }));

    if (!songs.length) {
      throw new Error('Python recommender returned empty songs.');
    }

    return {
      assistantMessage: pythonResponse?.assistantMessage
        ? String(pythonResponse.assistantMessage).trim()
        : 'Here are your recommendations.',
      songs,
      locationLabel,
      usedFallback: Boolean(pythonResponse?.usedFallback)
    };
  } catch (error) {
    console.error('Recommendation request failed:', error.message);
    return buildFallbackResponse({
      moodPrompt,
      artist,
      locationLabel,
      count: normalizedCount,
      mode
    });
  }
};

module.exports = {
  generatePlaylistRecommendations
};
