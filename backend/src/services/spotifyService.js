const axios = require('axios');
const { getSpotifyToken } = require('../config/spotify');

// Search for songs
const searchSongs = async (query) => {
  try {
    const token = await getSpotifyToken();

    const response = await axios.get('https://api.spotify.com/v1/search', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      params: {
        q: query,
        type: 'track',
        limit: 10
      }
    });

    // Format the response
    const songs = response.data.tracks.items.map(track => ({
      songId: track.id,
      title: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      image: track.album.images[0]?.url || '',
      spotifyUrl: track.external_urls.spotify,
      previewUrl: track.preview_url,
      duration: track.duration_ms,
      album: track.album.name
    }));

    return songs;
  } catch (error) {
    console.error('Error searching Spotify:', error.response?.data || error.message);
    throw new Error('Failed to search for songs');
  }
};

// Get track details
const getTrackDetails = async (trackId) => {
  try {
    const token = await getSpotifyToken();

    const response = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const track = response.data;

    return {
      songId: track.id,
      title: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      image: track.album.images[0]?.url || '',
      spotifyUrl: track.external_urls.spotify,
      previewUrl: track.preview_url,
      duration: track.duration_ms,
      album: track.album.name
    };
  } catch (error) {
    console.error('Error getting track details:', error.response?.data || error.message);
    throw new Error('Failed to get track details');
  }
};

module.exports = {
  searchSongs,
  getTrackDetails
};
