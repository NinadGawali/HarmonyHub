const express = require('express');
const cors = require('cors');
const roomRoutes = require('./routes/roomRoutes');
const songRoutes = require('./routes/songRoutes');
const spotifyRoutes = require('./routes/spotifyRoutes');
const spotifyAuthRoutes = require('./routes/spotifyAuthRoutes');
const locationRoutes = require('./routes/locationRoutes');
const playlistRoutes = require('./routes/playlistRoutes');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/rooms', roomRoutes);
app.use('/api/rooms', songRoutes);
app.use('/api/spotify', spotifyRoutes);
app.use('/api/spotify/auth', spotifyAuthRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/playlists', playlistRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
