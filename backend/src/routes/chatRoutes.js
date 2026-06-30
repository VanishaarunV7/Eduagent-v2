const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// Middleware to restrict chat to students (and admin/system roles)
const restrictTeacherChat = (req, res, next) => {
  if (req.user && req.user.role === 'teacher') {
    return res.status(403).json({ message: 'Access denied. AI Chat is not authorized for teachers.' });
  }
  next();
};

// Apply restriction to all chat routes
router.use(restrictTeacherChat);

// POST /api/chat
router.post('/', chatController.handleChat);

// GET /api/chat/history/:studentId
router.get('/history/:studentId', chatController.getHistory);

// DELETE /api/chat/history/:sessionId
router.delete('/history/:sessionId', chatController.clearSession);

module.exports = router;
