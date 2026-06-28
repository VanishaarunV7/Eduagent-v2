const express = require('express');
const router = express.Router();
const { getTopics } = require('../controllers/topicController');

router.get('/:studentId/:courseId', getTopics);

module.exports = router;
