const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const courseController = require('../controllers/courseController');

router.get('/', studentController.getStudents);
router.get('/:studentId', studentController.getStudentById);
router.get('/:studentId/courses', courseController.getCoursesByStudentId);

module.exports = router;
