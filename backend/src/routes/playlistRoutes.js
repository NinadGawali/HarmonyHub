const express = require('express');
const playlistController = require('../controllers/playlistController');

const router = express.Router();

router.post('/generate', playlistController.generate);
router.post('/export', playlistController.exportToSpotify);
// Old path, kept for one release.
router.post('/recommendations', playlistController.generate);

module.exports = router;
