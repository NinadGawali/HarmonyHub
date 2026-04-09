const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');

router.post('/', locationController.receiveLocation);
router.get('/latest', locationController.getLatestLocation);

module.exports = router;
