const express = require('express');
const authController = require('../controllers/authController');
const { requireSpotifyUser } = require('../middleware/auth');

const router = express.Router();

router.get('/spotify/login', authController.spotifyLogin);
router.get('/spotify/callback', authController.spotifyCallback);
router.get('/spotify/token', requireSpotifyUser, authController.spotifyToken);
router.post('/guest', authController.joinAsGuest);
router.get('/me', authController.me);
router.post('/logout', authController.logout);

module.exports = router;
