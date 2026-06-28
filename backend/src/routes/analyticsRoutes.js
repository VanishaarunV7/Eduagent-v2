const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

router.get('/:studentId/:courseId', analyticsController.getAnalytics);

module.exports = router;
