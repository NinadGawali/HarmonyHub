const path = require('path');
const dotenv = require('dotenv');

// Load order (first value wins): real environment, backend/.env (local overrides), repo-root .env.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const frontendUrl = (process.env.FRONTEND_URL || 'http://127.0.0.1:5173').replace(/\/+$/, '');

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 3000),
  frontendUrl,
  // Comma-separated list of extra allowed origins; the frontend URL is always allowed.
  corsOrigins: [...new Set([
    frontendUrl,
    ...(process.env.CORS_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean)
  ])],
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  recommenderUrl: process.env.PYTHON_RECOMMENDER_URL || 'http://127.0.0.1:5001',
  roomTtlSeconds: toInt(process.env.ROOM_TTL_SECONDS, 24 * 60 * 60),
  // Base64-encoded 32-byte key used to encrypt Spotify refresh tokens at rest.
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY || '',
  // Guest accounts per client IP per hour
  guestCreationLimitPerHour: toInt(process.env.GUEST_CREATION_LIMIT_PER_HOUR, 30),
  session: {
    cookieName: 'hh_sid',
    userTtlSeconds: toInt(process.env.SESSION_TTL_SECONDS, 7 * 24 * 60 * 60),
    guestTtlSeconds: toInt(process.env.GUEST_SESSION_TTL_SECONDS, 24 * 60 * 60),
    // Cookies are marked Secure only when the app is served over HTTPS.
    secureCookies: frontendUrl.startsWith('https://')
  },
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
    redirectUri: process.env.SPOTIFY_REDIRECT_URI || `${frontendUrl}/api/auth/spotify/callback`
  }
};

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '[::1]']);

// Spotify only accepts HTTPS redirect URIs, or plain HTTP on an explicit loopback IP.
const redirectUriProblem = (uri) => {
  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    return `SPOTIFY_REDIRECT_URI "${uri}" is not a valid URL.`;
  }

  if (parsed.hostname === 'localhost') {
    return 'SPOTIFY_REDIRECT_URI uses "localhost", which Spotify rejects. Use http://127.0.0.1:<port>/... instead.';
  }
  if (parsed.protocol !== 'https:' && !LOOPBACK_HOSTS.has(parsed.hostname)) {
    return 'SPOTIFY_REDIRECT_URI must use HTTPS unless it points to 127.0.0.1 or [::1].';
  }
  return null;
};

// Returns human-readable problems; the server logs them at startup instead of failing later.
const validateConfig = () => {
  const problems = [];

  if (!config.databaseUrl) {
    problems.push('DATABASE_URL is not set. Copy .env.example to .env at the repo root.');
  }
  if (!config.spotify.clientId || !config.spotify.clientSecret) {
    problems.push('SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are not set. Spotify search and login will fail.');
  }
  if (Buffer.from(config.tokenEncryptionKey, 'base64').length !== 32) {
    problems.push('TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key; Spotify login is disabled until it is set. '
      + 'Generate one with: npm run secrets (repo root).');
  }

  const uriProblem = redirectUriProblem(config.spotify.redirectUri);
  if (uriProblem) {
    problems.push(uriProblem);
  }

  return problems;
};

module.exports = { config, validateConfig };
