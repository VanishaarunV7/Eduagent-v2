const agentService = require('../services/agentService');
const mongoose = require('mongoose');
const chatHistoryService = require('../memory/chatHistoryService');
const Student = require('../models/Student');

/**
 * Handle incoming chat message request
 * @param {Express.Request} req 
 * @param {Express.Response} res 
 */
exports.handleChat = async (req, res) => {
  try {
    const student_id = req.user.role === 'student' ? req.user.student_id : req.body.student_id;
    const { course_id, message, session_id } = req.body;

    // Request validation
    if (!student_id || typeof student_id !== 'string' || !student_id.trim()) {
      return res.status(400).json({ message: 'Missing or invalid required field: student_id' });
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ message: 'Missing or invalid required field: message' });
    }

    // Verify MongoDB Connection state
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: "Database is not connected. Please check connection."
      });
    }

    // Delegate query to the Multi-Agent System
    const result = await agentService.handleChatQuery(student_id, course_id, message, session_id);

    // Return response containing agent metadata, reply content, session_id, and any other metrics
    return res.status(200).json({
      ...result,
      agent: result.agent,
      reply: result.reply,
      session_id: result.session_id
    });

  } catch (error) {
    console.error('[Chat API Error]:', error);
    return res.status(500).json({ message: error.message || 'An unexpected error occurred processing your request' });
  }
};

/**
 * Retrieve previous conversations for a student
 * @param {Express.Request} req 
 * @param {Express.Response} res 
 */
exports.getHistory = async (req, res) => {
  try {
    const studentId = req.user.role === 'student' ? req.user.student_id : req.params.studentId;

    if (!studentId || typeof studentId !== 'string' || !studentId.trim()) {
      return res.status(400).json({ message: 'Missing or invalid required parameter: studentId' });
    }

    // Verify MongoDB Connection state
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: "Database is not connected. Please check connection."
      });
    }

    // Security check: Verify if student exists
    const student = await Student.findOne({ student_id: studentId });
    if (!student) {
      return res.status(404).json({ message: `Student with ID '${studentId}' not found.` });
    }

    const history = await chatHistoryService.getStudentHistory(studentId);
    return res.status(200).json(history);

  } catch (error) {
    console.error('[Chat History API Error]:', error);
    return res.status(500).json({ message: error.message || 'An unexpected error occurred retrieving conversation history' });
  }
};

/**
 * Clear a specific chat session
 * @param {Express.Request} req 
 * @param {Express.Response} res 
 */
exports.clearSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
      return res.status(400).json({ message: 'Missing or invalid required parameter: sessionId' });
    }

    // Verify MongoDB Connection state
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: "Database is not connected. Please check connection."
      });
    }

    await chatHistoryService.clearSession(sessionId);
    return res.status(200).json({ message: `Chat session '${sessionId}' cleared successfully.` });

  } catch (error) {
    console.error('[Clear Session API Error]:', error);
    return res.status(500).json({ message: error.message || 'An unexpected error occurred clearing session' });
  }
};


