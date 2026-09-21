const path = require('path');
const dotenv = require('dotenv');

// Load order (first value wins): real environment, backend/.env (local overrides), repo-root .env.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 3000),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  recommenderUrl: process.env.PYTHON_RECOMMENDER_URL || 'http://127.0.0.1:5001',
  roomTtlSeconds: toInt(process.env.ROOM_TTL_SECONDS, 24 * 60 * 60),
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || ''
  }
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

  return problems;
};

module.exports = { config, validateConfig };
