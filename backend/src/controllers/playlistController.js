const { nanoid } = require('nanoid');
const spotifyService = require('../services/spotifyService');
const { generatePlaylistRecommendations } = require('../services/playlistRecommendationService');

const toSongObject = (song, fallbackPrefix = 'generated') => ({
  songId: song.songId || `${fallbackPrefix}_${nanoid(10)}`,
  title: song.title,
  artist: song.artist,
  image: song.image || '',
  spotifyUrl: song.spotifyUrl || '',
  previewUrl: song.previewUrl || '',
  reason: song.reason || ''
});

const hydrateSongsWithSpotify = async (songs) => {
  const hydrated = await Promise.all(
    songs.map(async (song) => {
      try {
        const query = `${song.title} ${song.artist}`.trim();
        const results = await spotifyService.searchSongs(query);

        if (results && results.length > 0) {
          return toSongObject({
            ...results[0],
            reason: song.reason
          }, 'spotify');
        }
      } catch (error) {
        // Fallback to generated metadata if Spotify lookup fails.
      }

      return toSongObject(song);
    })
  );

  return hydrated;
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
      count
    });

    const [aiRecommendations, regionalRecommendations] = await Promise.all([
      hydrateSongsWithSpotify(recommendation.aiSongs || []),
      hydrateSongsWithSpotify(recommendation.regionSongs || [])
    ]);

    return res.status(200).json({
      success: true,
      aiRecommendations,
      regionalRecommendations,
      regionName: recommendation.regionName || '',
      usedFallback: recommendation.usedFallback
    });
  } catch (error) {
    console.error('Error generating playlist recommendations:', error);
    return res.status(500).json({
      error: 'Failed to generate recommendations.'
    });
  }
};

module.exports = {
  generateRecommendations
};
