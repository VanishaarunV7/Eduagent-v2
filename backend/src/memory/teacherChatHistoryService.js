const TeacherChatHistory = require('../models/TeacherChatHistory');

class TeacherChatHistoryService {
  /**
   * Save a single chat message
   * @param {string} teacherId 
   * @param {string} courseId 
   * @param {string} sessionId 
   * @param {string} role - 'user' | 'assistant'
   * @param {string} message 
   * @param {string} agentUsed 
   * @returns {Promise<Object>} Created document
   */
  async saveMessage(teacherId, courseId, sessionId, role, message, agentUsed = null) {
    try {
      const chatMessage = new TeacherChatHistory({
        teacher_id: teacherId,
        course_id: courseId,
        session_id: sessionId,
        role: role,
        message: message,
        agent_used: agentUsed
      });
      return await chatMessage.save();
    } catch (error) {
      console.error('[TeacherChatHistoryService] Error saving message:', error);
      throw error;
    }
  }

  /**
   * Retrieve the last 10 messages for a session (sorted by timestamp ascending)
   * @param {string} teacherId 
   * @param {string} courseId 
   * @param {string} sessionId 
   * @param {number} limit 
   * @returns {Promise<Object[]>}
   */
  async getRecentHistory(teacherId, courseId, sessionId, limit = 10) {
    try {
      const query = {
        teacher_id: teacherId,
        session_id: sessionId
      };
      if (courseId) {
        query.course_id = courseId;
      }

      return await TeacherChatHistory.find(query)
        .sort({ timestamp: -1 }) // Sort desc to get latest first
        .limit(limit)
        .then(docs => docs.reverse()); // Reverse to return ascending order (oldest first)
    } catch (error) {
      console.error('[TeacherChatHistoryService] Error fetching history:', error);
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
      return await TeacherChatHistory.deleteMany({ session_id: sessionId });
    } catch (error) {
      console.error('[TeacherChatHistoryService] Error clearing session:', error);
      throw error;
    }
  }

  /**
   * Retrieve previous conversations for a specific teacher (ordered by time)
   * @param {string} teacherId 
   * @returns {Promise<Object[]>}
   */
  async getTeacherHistory(teacherId) {
    try {
      return await TeacherChatHistory.find({ teacher_id: teacherId })
        .sort({ timestamp: 1 });
    } catch (error) {
      console.error('[TeacherChatHistoryService] Error fetching teacher history:', error);
      throw error;
    }
  }
}

module.exports = new TeacherChatHistoryService();
