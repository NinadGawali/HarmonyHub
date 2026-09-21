const express = require('express');
const cors = require('cors');
const { config } = require('./config/env');
const { getHealth } = require('./services/healthService');
const { loadSession, requireSession, requireSpotifyUser } = require('./middleware/auth');
const authRoutes = require('./routes/authRoutes');
const roomRoutes = require('./routes/roomRoutes');
const songRoutes = require('./routes/songRoutes');
const spotifyRoutes = require('./routes/spotifyRoutes');
const locationRoutes = require('./routes/locationRoutes');
const playlistRoutes = require('./routes/playlistRoutes');

const app = express();

// Requests arrive through the Vite dev proxy or nginx; trust them for the client IP.
app.set('trust proxy', 'loopback, linklocal, uniquelocal');

app.use(cors({
  origin: config.corsOrigins,
  credentials: true
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));

// Health check: 200 when required dependencies are up, 503 otherwise
app.get(['/health', '/api/health'], async (req, res) => {
  const health = await getHealth();
  res.status(health.status === 'ok' ? 200 : 503).json(health);
});

app.use('/api', loadSession);

app.use('/api/auth', authRoutes);
app.use('/api/rooms', requireSession, roomRoutes);
app.use('/api/rooms', requireSession, songRoutes);
app.use('/api/spotify', requireSpotifyUser, spotifyRoutes);
app.use('/api/location', requireSession, locationRoutes);
app.use('/api/playlists', requireSpotifyUser, playlistRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
