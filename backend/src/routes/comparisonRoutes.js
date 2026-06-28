const express = require('express');
const router = express.Router();
const comparisonController = require('../controllers/comparisonController');

router.get('/:studentId/:courseId', comparisonController.getComparisonData);

module.exports = router;
