const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateJWT } = require('../middleware/auth');

// Middleware to restrict access to Admins only
const verifyAdminRole = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Admin authorization required.' });
};

// Protect all routes
router.use(authenticateJWT, verifyAdminRole);

// Dashboard
router.get('/dashboard', adminController.getAdminDashboard);

// Students Management
router.get('/students', adminController.getStudents);
router.post('/students', adminController.createStudent);
router.delete('/students/:studentId', adminController.deleteStudent);

// Teachers Management
router.get('/teachers', adminController.getTeachers);
router.post('/teachers', adminController.createTeacher);
router.delete('/teachers/:teacherId', adminController.deleteTeacher);

// Departments Management
router.get('/departments', adminController.getDepartments);
router.post('/departments', adminController.createDepartment);
router.delete('/departments/:id', adminController.deleteDepartment);

// Programs Management
router.get('/programs', adminController.getPrograms);
router.post('/programs', adminController.createProgram);
router.delete('/programs/:id', adminController.deleteProgram);

// Courses Management
router.get('/courses', adminController.getCourses);
router.post('/courses', adminController.createCourse);
router.delete('/courses/:id', adminController.deleteCourse);

// Exams Scheduler
router.get('/exams', adminController.getExams);
router.post('/exams', adminController.createExam);
router.delete('/exams/:id', adminController.deleteExam);

// Audit & Users
router.get('/audit-logs', adminController.getAuditLogs);
router.post('/user/reset-password', adminController.resetUserPassword);

// Database backup exports
router.get('/backup/export', adminController.exportDatabase);

module.exports = router;
