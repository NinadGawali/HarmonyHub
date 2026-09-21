const express = require('express');
const playlistController = require('../controllers/playlistController');

const router = express.Router();

router.post('/recommendations', playlistController.generateRecommendations);

module.exports = router;
