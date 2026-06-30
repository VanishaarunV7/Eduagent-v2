const teacherAgentService = require('../services/teacherAgentService');
const teacherChatHistoryService = require('../memory/teacherChatHistoryService');
const mongoose = require('mongoose');

/**
 * Handle incoming teacher chat message request
 * @param {Express.Request} req 
 * @param {Express.Response} res 
 */
exports.handleChat = async (req, res) => {
  try {
    const teacher_id = req.user.role === 'teacher' ? req.user.teacher_id : req.body.teacher_id;
    const { course_id, message, session_id } = req.body;

    // Request validation
    if (!teacher_id || typeof teacher_id !== 'string' || !teacher_id.trim()) {
      return res.status(400).json({ message: 'Missing or invalid required field: teacher_id' });
    }
    if (!course_id || typeof course_id !== 'string' || !course_id.trim()) {
      return res.status(400).json({ message: 'Missing or invalid required field: course_id' });
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ message: 'Missing or invalid required field: message' });
    }

    // Verify MongoDB Connection state
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Database is not connected. Please check connection." });
    }

    // Delegate query to the Teacher Agent Service
    const result = await teacherAgentService.handleChatQuery(teacher_id, course_id, message, session_id);

    return res.status(200).json(result);
  } catch (error) {
    console.error('[TeacherChat API Error]:', error);
    return res.status(500).json({ message: error.message || 'An unexpected error occurred processing your request' });
  }
};

/**
 * Retrieve previous conversations for a teacher
 * @param {Express.Request} req 
 * @param {Express.Response} res 
 */
exports.getHistory = async (req, res) => {
  try {
    const teacherId = req.user.role === 'teacher' ? req.user.teacher_id : req.params.teacherId;

    if (!teacherId || typeof teacherId !== 'string' || !teacherId.trim()) {
      return res.status(400).json({ message: 'Missing or invalid required parameter: teacherId' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Database is not connected. Please check connection." });
    }

    const history = await teacherChatHistoryService.getTeacherHistory(teacherId);
    return res.status(200).json(history);
  } catch (error) {
    console.error('[TeacherChat History API Error]:', error);
    return res.status(500).json({ message: error.message || 'An unexpected error occurred retrieving conversation history' });
  }
};

/**
 * Clear a specific chat session for a teacher
 * @param {Express.Request} req 
 * @param {Express.Response} res 
 */
exports.clearSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
      return res.status(400).json({ message: 'Missing or invalid required parameter: sessionId' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Database is not connected. Please check connection." });
    }

    await teacherChatHistoryService.clearSession(sessionId);
    return res.status(200).json({ message: `Chat session '${sessionId}' cleared successfully.` });
  } catch (error) {
    console.error('[TeacherClear Session API Error]:', error);
    return res.status(500).json({ message: error.message || 'An unexpected error occurred clearing session' });
  }
};
