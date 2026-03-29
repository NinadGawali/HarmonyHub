const axios = require('axios');

const SPOTIFY_ACCOUNTS_BASE_URL = 'https://accounts.spotify.com';
const DEFAULT_SPOTIFY_SCOPE = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing'
].join(' ');

function getSpotifyCredentials() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Spotify OAuth credentials are not configured');
  }

  return { clientId, clientSecret };
}

function buildAuthorizationUrl({ state, redirectUri, scope = DEFAULT_SPOTIFY_SCOPE }) {
  const { clientId } = getSpotifyCredentials();
  const url = new URL(`${SPOTIFY_ACCOUNTS_BASE_URL}/authorize`);

  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', scope);
  url.searchParams.set('state', state || 'harmonyhub');
  url.searchParams.set('redirect_uri', redirectUri);

  return url.toString();
}

async function exchangeCodeForToken({ code, redirectUri }) {
  const { clientId, clientSecret } = getSpotifyCredentials();

  const response = await axios.post(
    `${SPOTIFY_ACCOUNTS_BASE_URL}/api/token`,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    }).toString(),
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  return response.data;
}

async function refreshAccessToken(refreshToken) {
  const { clientId, clientSecret } = getSpotifyCredentials();

  const response = await axios.post(
    `${SPOTIFY_ACCOUNTS_BASE_URL}/api/token`,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    }).toString(),
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  return response.data;
}

module.exports = {
  DEFAULT_SPOTIFY_SCOPE,
  buildAuthorizationUrl,
  exchangeCodeForToken,
  refreshAccessToken
};