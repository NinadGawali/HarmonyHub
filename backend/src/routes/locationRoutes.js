const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');

router.post('/', locationController.receiveLocation);

module.exports = router;
