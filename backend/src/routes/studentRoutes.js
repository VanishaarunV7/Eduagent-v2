const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const courseController = require('../controllers/courseController');

const { authenticateJWT } = require('../middleware/auth');

router.get('/', authenticateJWT, studentController.getStudents);
router.get('/:studentId', authenticateJWT, studentController.getStudentById);
router.get('/:studentId/courses', authenticateJWT, courseController.getCoursesByStudentId);
router.post('/:studentId/assignments/submit', authenticateJWT, studentController.submitAssignment);

module.exports = router;
