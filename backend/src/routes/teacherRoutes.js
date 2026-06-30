const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const { authenticateJWT } = require('../middleware/auth');

// Middleware to restrict access to Teachers and Admins only
const verifyTeacherRole = (req, res, next) => {
  if (req.user && (req.user.role === 'teacher' || req.user.role === 'admin')) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Teacher portal authorization required.' });
};

// Apply security to all routes
router.use(authenticateJWT, verifyTeacherRole);

// Dashboard stats and AI Insights
router.get('/dashboard', teacherController.getTeacherDashboard);

// Analytics routes
router.get('/class-analytics/:courseId', teacherController.getClassAnalytics);
router.get('/gender-performance/:courseId', teacherController.getGenderPerformance);
router.get('/outcome-analysis/:courseId', teacherController.getOutcomeAnalysis);
router.get('/grade-distribution/:courseId', teacherController.getGradeDistribution);
router.get('/attendance-performance/:courseId', teacherController.getAttendancePerformance);

// Attendance routes
router.get('/attendance/course/:courseId', teacherController.getCourseAttendance);
router.post('/attendance/save', teacherController.saveAttendance);

// Marks upload/edit routes
router.get('/marks/course/:courseId', teacherController.getCourseMarks);
router.post('/marks/save', teacherController.saveMarks);

// Assignments CRUD routes
router.get('/assignments/course/:courseId', teacherController.getAssignments);
router.post('/assignments', teacherController.createAssignment);
router.delete('/assignments/:assignmentId', teacherController.deleteAssignment);
router.get('/assignments/:assignmentId/submissions', teacherController.getAssignmentSubmissions);
router.post('/assignments/grade', teacherController.gradeSubmission);

// Announcements routes
router.get('/announcements', teacherController.getAnnouncements);
router.post('/announcements', teacherController.createAnnouncement);
router.delete('/announcements/:id', teacherController.deleteAnnouncement);

// Teacher AI Chat routes
const teacherChatController = require('../controllers/teacherChatController');
router.post('/chat', teacherChatController.handleChat);
router.get('/chat/history/:teacherId', teacherChatController.getHistory);
router.delete('/chat/history/:sessionId', teacherChatController.clearSession);

module.exports = router;
