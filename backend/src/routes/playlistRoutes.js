const express = require('express');
const router = express.Router();
const playlistController = require('../controllers/playlistController');

router.post('/recommendations/ai', playlistController.generateAiRecommendations);
router.post('/recommendations/location', playlistController.generateLocationRecommendations);
router.post('/recommendations', playlistController.generateRecommendations);

module.exports = router;
