const express = require('express');
const router = express.Router();
const outcomeController = require('../controllers/outcomeController');

router.get('/:studentId/:courseId', outcomeController.getOutcomeAttainment);

module.exports = router;
