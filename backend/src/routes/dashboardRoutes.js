const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateJWT } = require('../middleware/auth');

// Protected route – uses studentId & courseId parameters
router.get('/:studentId/:courseId', authenticateJWT, dashboardController.getDashboardData);

module.exports = router;
