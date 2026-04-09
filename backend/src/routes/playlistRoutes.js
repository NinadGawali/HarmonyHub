const express = require('express');
const router = express.Router();
const playlistController = require('../controllers/playlistController');

router.post('/recommendations', playlistController.generateRecommendations);

module.exports = router;
