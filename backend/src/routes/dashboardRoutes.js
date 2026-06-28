const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateJWT } = require('../middleware/auth');

// Protected route – uses JWT to identify student & course
router.get('/', authenticateJWT, dashboardController.getDashboardData);

module.exports = router;
