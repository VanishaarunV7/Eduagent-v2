const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// POST /api/chat
router.post('/', chatController.handleChat);

// GET /api/chat/history/:studentId
router.get('/history/:studentId', chatController.getHistory);

// DELETE /api/chat/history/:sessionId
router.delete('/history/:sessionId', chatController.clearSession);

module.exports = router;
