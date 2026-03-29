const spotifyAuthService = require('../services/spotifyAuthService');

const getLoginUrl = async (req, res) => {
  try {
    const { redirectUri, state, scope } = req.query;

    if (!redirectUri) {
      return res.status(400).json({ error: 'redirectUri is required' });
    }

    const url = spotifyAuthService.buildAuthorizationUrl({
      redirectUri,
      state,
      scope
    });

    return res.json({ url });
  } catch (error) {
    console.error('Error creating Spotify login URL:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Failed to create Spotify login URL' });
  }
};

const exchangeToken = async (req, res) => {
  try {
    const { code, redirectUri } = req.body || {};

    if (!code || !redirectUri) {
      return res.status(400).json({ error: 'code and redirectUri are required' });
    }

    const tokenData = await spotifyAuthService.exchangeCodeForToken({ code, redirectUri });
    return res.json(tokenData);
  } catch (error) {
    console.error('Error exchanging Spotify auth code:', error.response?.data || error.message);
    const status = error.response?.status || 500;
    return res.status(status).json({ error: 'Failed to exchange Spotify auth code' });
  }
};

const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body || {};

    if (!token) {
      return res.status(400).json({ error: 'refreshToken is required' });
    }

    const tokenData = await spotifyAuthService.refreshAccessToken(token);
    return res.json(tokenData);
  } catch (error) {
    console.error('Error refreshing Spotify token:', error.response?.data || error.message);
    const status = error.response?.status || 500;
    return res.status(status).json({ error: 'Failed to refresh Spotify token' });
  }
};

module.exports = {
  getLoginUrl,
  exchangeToken,
  refreshToken
};