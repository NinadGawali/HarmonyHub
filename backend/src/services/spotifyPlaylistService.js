const axios = require('axios');
const { config } = require('../config/env');
const userService = require('./userService');

const SPOTIFY_TIMEOUT_MS = 10000;
// Spotify accepts at most 100 items per "add items" request.
const MAX_ITEMS_PER_REQUEST = 100;

// The user's Spotify login does not allow creating playlists (old login without the scope, or access revoked).
class SpotifyPermissionError extends Error {
  constructor() {
    super('Reconnect Spotify to let HarmonyHub save playlists to your account.');
    this.name = 'SpotifyPermissionError';
  }
}

class SpotifyBusyError extends Error {
  constructor() {
    super('Spotify is busy right now. Try again in a minute.');
    this.name = 'SpotifyBusyError';
  }
}

// Creates a private playlist in the user's Spotify account and adds the tracks in order.
const exportPlaylist = async (userId, { name, description, trackIds }) => {
  const { accessToken } = await userService.getSpotifyAccessToken(userId);
  const options = { headers: { Authorization: `Bearer ${accessToken}` }, timeout: SPOTIFY_TIMEOUT_MS };

  try {
    const { data: playlist } = await axios.post(
      `${config.spotify.apiUrl}/me/playlists`,
      { name, description, public: false },
      options
    );

    for (let start = 0; start < trackIds.length; start += MAX_ITEMS_PER_REQUEST) {
      const uris = trackIds.slice(start, start + MAX_ITEMS_PER_REQUEST).map((id) => `spotify:track:${id}`);
      await axios.post(`${config.spotify.apiUrl}/playlists/${playlist.id}/items`, { uris }, options);
    }

    return {
      id: playlist.id,
      name: playlist.name || name,
      url: playlist.external_urls?.spotify || `https://open.spotify.com/playlist/${playlist.id}`,
      trackCount: trackIds.length
    };
  } catch (error) {
    const status = error.response?.status;
    if (status === 401 || status === 403) throw new SpotifyPermissionError();
    if (status === 429) throw new SpotifyBusyError();
    throw error;
  }
};

module.exports = { SpotifyPermissionError, SpotifyBusyError, exportPlaylist };
