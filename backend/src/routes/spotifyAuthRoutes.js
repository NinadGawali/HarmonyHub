const express = require('express');
const spotifyAuthController = require('../controllers/spotifyAuthController');

const router = express.Router();

router.get('/login-url', spotifyAuthController.getLoginUrl);
router.post('/token', spotifyAuthController.exchangeToken);
router.post('/refresh', spotifyAuthController.refreshToken);

module.exports = router;