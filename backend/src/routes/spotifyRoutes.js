const express = require('express');
const router = express.Router();
const spotifyController = require('../controllers/spotifyController');

// Search for songs on Spotify
router.get('/search', spotifyController.searchSongs);

// Get track details
router.get('/track/:trackId', spotifyController.getTrackDetails);

module.exports = router;
