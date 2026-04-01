import axios from 'axios';

const APP_API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';

export class SpotifyApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'SpotifyApiError';
    this.status = status;
    this.payload = payload;
  }
}

async function requestSpotify({ method, path, accessToken, params, data }) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new SpotifyApiError('You are offline. Reconnect to the internet and try again.', 0, null);
  }

  try {
    const response = await axios({
      method,
      url: `${SPOTIFY_API_BASE_URL}${path}`,
      params,
      data,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data || null;
  } catch (error) {
    if (error?.code === 'ERR_NETWORK' || /network error/i.test(error?.message || '')) {
      throw new SpotifyApiError('Network error. Check your internet connection and try again.', 0, null);
    }

    const status = error.response?.status || 500;
    const payload = error.response?.data || null;
    const message = payload?.error?.message || error.message || 'Spotify API request failed';
    throw new SpotifyApiError(message, status, payload);
  }
}

export const spotifyAuthApi = {
  async getLoginUrl({ redirectUri, state }) {
    const response = await axios.get(`${APP_API_BASE_URL}/spotify/auth/login-url`, {
      params: { redirectUri, state }
    });
    return response.data;
  },

  async exchangeCodeForToken({ code, redirectUri }) {
    const response = await axios.post(`${APP_API_BASE_URL}/spotify/auth/token`, {
      code,
      redirectUri
    });
    return response.data;
  },

  async refreshAccessToken(refreshToken) {
    const response = await axios.post(`${APP_API_BASE_URL}/spotify/auth/refresh`, {
      refreshToken
    });
    return response.data;
  }
};

export const spotifyPlaybackApi = {
  async getDevices({ accessToken }) {
    return requestSpotify({
      method: 'get',
      path: '/me/player/devices',
      accessToken
    });
  },

  async transferPlayback({ accessToken, deviceId, play = false }) {
    return requestSpotify({
      method: 'put',
      path: '/me/player',
      accessToken,
      data: {
        device_ids: [deviceId],
        play
      }
    });
  },

  async playTrack({ accessToken, deviceId, trackUri, positionMs = 0 }) {
    return requestSpotify({
      method: 'put',
      path: '/me/player/play',
      accessToken,
      params: deviceId ? { device_id: deviceId } : undefined,
      data: {
        uris: [trackUri],
        position_ms: Math.max(0, Number(positionMs) || 0)
      }
    });
  },

  async pausePlayback({ accessToken, deviceId }) {
    return requestSpotify({
      method: 'put',
      path: '/me/player/pause',
      accessToken,
      params: deviceId ? { device_id: deviceId } : undefined
    });
  },

  async resumePlayback({ accessToken, deviceId }) {
    return requestSpotify({
      method: 'put',
      path: '/me/player/play',
      accessToken,
      params: deviceId ? { device_id: deviceId } : undefined
    });
  },

  async seekTo({ accessToken, positionMs, deviceId }) {
    return requestSpotify({
      method: 'put',
      path: '/me/player/seek',
      accessToken,
      params: {
        position_ms: Math.max(0, Number(positionMs) || 0),
        ...(deviceId ? { device_id: deviceId } : {})
      }
    });
  }
};