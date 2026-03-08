const express = require('express');
const router = express.Router();
const songController = require('../controllers/songController');

// Get leaderboard for a room
router.get('/:roomId/leaderboard', songController.getLeaderboard);

// Add a song to a room
router.post('/:roomId/songs', songController.addSong);

// Remove a song from a room
router.delete('/:roomId/songs/:songId', songController.removeSong);

module.exports = router;
