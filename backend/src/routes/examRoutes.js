const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');

router.get('/:studentId', examController.getExamsByStudentId);

module.exports = router;
