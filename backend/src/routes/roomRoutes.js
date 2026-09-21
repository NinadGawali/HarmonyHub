const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const { requireSpotifyUser } = require('../middleware/auth');

// Create a new room
router.post('/', requireSpotifyUser, roomController.createRoom);

// Get room details
router.get('/:roomId', roomController.getRoomDetails);

// Join a room
router.post('/:roomId/join', roomController.joinRoom);

// Delete a room
router.delete('/:roomId', roomController.deleteRoom);

module.exports = router;
