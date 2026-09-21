const crypto = require('crypto');
const axios = require('axios');
const { config } = require('../config/env');
const { redis } = require('../config/redis');

const SPOTIFY_ACCOUNTS_URL = 'https://accounts.spotify.com';
const SPOTIFY_API_URL = 'https://api.spotify.com/v1';
const OAUTH_STATE_TTL_SECONDS = 10 * 60;

const SPOTIFY_SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-modify-private',
  'playlist-modify-public'
].join(' ');

class OAuthStateError extends Error {}

const getCredentials = () => {
  const { clientId, clientSecret } = config.spotify;
  if (!clientId || !clientSecret) {
    throw new Error('Spotify credentials are not configured');
  }
  return { clientId, clientSecret };
};

const basicAuthHeader = () => {
  const { clientId, clientSecret } = getCredentials();
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
};

const requestToken = async (params) => {
  const response = await axios.post(
    `${SPOTIFY_ACCOUNTS_URL}/api/token`,
    new URLSearchParams(params).toString(),
    {
      headers: {
        Authorization: basicAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000
    }
  );
  return response.data;
};

// Only same-site relative paths are allowed, which prevents open redirects.
const sanitizeReturnTo = (returnTo) => (
  typeof returnTo === 'string' && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/'
);

// Creates the Spotify authorize URL. State and PKCE verifier are kept server-side for 10 minutes.
const beginLogin = async (returnTo) => {
  const { clientId } = getCredentials();
  const state = crypto.randomBytes(24).toString('base64url');
  const codeVerifier = crypto.randomBytes(48).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  await redis.set(
    `oauth:${state}`,
    JSON.stringify({ codeVerifier, returnTo: sanitizeReturnTo(returnTo) }),
    { EX: OAUTH_STATE_TTL_SECONDS }
  );

  const url = new URL(`${SPOTIFY_ACCOUNTS_URL}/authorize`);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SPOTIFY_SCOPES,
    redirect_uri: config.spotify.redirectUri,
    state,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge
  }).toString();

  return url.toString();
};

// Validates and consumes the state (single use), then exchanges the code for tokens.
const completeLogin = async ({ code, state }) => {
  const stored = state ? await redis.getDel(`oauth:${state}`) : null;
  if (!stored) {
    throw new OAuthStateError('Login link expired or was already used. Please try again.');
  }

  const { codeVerifier, returnTo } = JSON.parse(stored);
  const tokens = await requestToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.spotify.redirectUri,
    code_verifier: codeVerifier
  });

  return { tokens, returnTo };
};

const refreshAccessToken = (refreshToken) => requestToken({
  grant_type: 'refresh_token',
  refresh_token: refreshToken
});

const fetchProfile = async (accessToken) => {
  const response = await axios.get(`${SPOTIFY_API_URL}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 10000
  });
  return response.data;
};

module.exports = {
  OAuthStateError,
  SPOTIFY_SCOPES,
  sanitizeReturnTo,
  beginLogin,
  completeLogin,
  refreshAccessToken,
  fetchProfile
};
