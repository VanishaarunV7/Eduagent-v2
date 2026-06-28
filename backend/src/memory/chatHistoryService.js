const ChatHistory = require('../models/ChatHistory');

class ChatHistoryService {
  /**
   * Save a single chat message
   * @param {string} studentId 
   * @param {string} courseId 
   * @param {string} sessionId 
   * @param {string} role - 'user' | 'assistant'
   * @param {string} message 
   * @param {string} agentUsed 
   * @returns {Promise<Object>} Created document
   */
  async saveMessage(studentId, courseId, sessionId, role, message, agentUsed = null) {
    try {
      const chatMessage = new ChatHistory({
        student_id: studentId,
        course_id: courseId,
        session_id: sessionId,
        role: role,
        message: message,
        agent_used: agentUsed
      });
      return await chatMessage.save();
    } catch (error) {
      console.error('[ChatHistoryService] Error saving message:', error);
      throw error;
    }
  }

  /**
   * Retrieve the last 10 messages for a session (sorted by timestamp ascending)
   * @param {string} studentId 
   * @param {string} courseId 
   * @param {string} sessionId 
   * @param {number} limit 
   * @returns {Promise<Object[]>}
   */
  async getRecentHistory(studentId, courseId, sessionId, limit = 10) {
    try {
      const query = {
        student_id: studentId,
        session_id: sessionId
      };
      if (courseId) {
        query.course_id = courseId;
      }

      return await ChatHistory.find(query)
        .sort({ timestamp: -1 }) // Sort desc to get latest first
        .limit(limit)
        .then(docs => docs.reverse()); // Reverse to return ascending order (oldest first)
    } catch (error) {
      console.error('[ChatHistoryService] Error fetching history:', error);
      throw error;
    }
  }

  /**
   * Clear all messages in one session
   * @param {string} sessionId 
   * @returns {Promise<Object>} Delete result
   */
  async clearSession(sessionId) {
    try {
      return await ChatHistory.deleteMany({ session_id: sessionId });
    } catch (error) {
      console.error('[ChatHistoryService] Error clearing session:', error);
      throw error;
    }
  }

  /**
   * Retrieve previous conversations for a specific student (ordered by time)
   * @param {string} studentId 
   * @returns {Promise<Object[]>}
   */
  async getStudentHistory(studentId) {
    try {
      return await ChatHistory.find({ student_id: studentId })
        .sort({ timestamp: 1 });
    } catch (error) {
      console.error('[ChatHistoryService] Error fetching student history:', error);
      throw error;
    }
  }
}

module.exports = new ChatHistoryService();
