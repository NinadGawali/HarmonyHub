const { nanoid } = require('nanoid');
const { generatePlaylistRecommendations } = require('../services/playlistRecommendationService');

const toSongObject = (song, fallbackPrefix = 'generated') => ({
  songId: song.songId || `${fallbackPrefix}_${nanoid(10)}`,
  title: song.title,
  artist: song.artist,
  image: song.image || '',
  spotifyUrl: song.spotifyUrl || '',
  previewUrl: song.previewUrl || '',
  reason: song.reason || '',
  source: song.source || 'ai'
});

const normalizeResponse = (recommendation) => {
  const hydratedSongs = (recommendation.songs || []).map((song) => toSongObject(song));
  const aiRecommendations = hydratedSongs.filter((song) => (song.source || 'ai') !== 'regional');
  const regionalRecommendations = hydratedSongs.filter((song) => song.source === 'regional');

  return {
    success: true,
    chatResponse: recommendation.assistantMessage || 'Here are your recommendations.',
    recommendations: hydratedSongs,
    aiRecommendations,
    regionalRecommendations,
    regionName: recommendation.locationLabel || '',
    usedFallback: recommendation.usedFallback
  };
};

const generateRecommendations = async (req, res) => {
  try {
    const { description, artist, location, count } = req.body;

    if (!description || !String(description).trim()) {
      return res.status(400).json({
        error: 'Playlist description is required.'
      });
    }

    const recommendation = await generatePlaylistRecommendations({
      moodPrompt: String(description).trim(),
      artist: artist ? String(artist).trim() : '',
      location,
      count,
      mode: 'ai'
    });

    return res.status(200).json(normalizeResponse(recommendation));
  } catch (error) {
    console.error('Error generating playlist recommendations:', error);
    return res.status(500).json({
      error: 'Failed to generate recommendations.'
    });
  }
};

const generateAiRecommendations = async (req, res) => {
  try {
    const { description, artist, location, count } = req.body;

    if (!description || !String(description).trim()) {
      return res.status(400).json({ error: 'Playlist description is required.' });
    }

    const recommendation = await generatePlaylistRecommendations({
      moodPrompt: String(description).trim(),
      artist: artist ? String(artist).trim() : '',
      location,
      count,
      mode: 'ai'
    });

    return res.status(200).json(normalizeResponse(recommendation));
  } catch (error) {
    console.error('Error generating AI recommendations:', error);
    return res.status(500).json({ error: 'Failed to generate AI recommendations.' });
  }
};

const generateLocationRecommendations = async (req, res) => {
  try {
    const { description, artist, location, count } = req.body;
    const state = location?.state ? String(location.state).trim() : '';

    if (!state) {
      return res.status(400).json({
        error: 'Location-based recommendations require state information.'
      });
    }

    const recommendation = await generatePlaylistRecommendations({
      moodPrompt: description ? String(description).trim() : 'Regional vibe',
      artist: artist ? String(artist).trim() : '',
      location,
      count,
      mode: 'location'
    });

    return res.status(200).json(normalizeResponse(recommendation));
  } catch (error) {
    console.error('Error generating location recommendations:', error);
    return res.status(500).json({ error: 'Failed to generate location recommendations.' });
  }
};

module.exports = {
  generateRecommendations,
  generateAiRecommendations,
  generateLocationRecommendations
};
