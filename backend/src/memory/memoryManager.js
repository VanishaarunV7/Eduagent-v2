const crypto = require('crypto');
const chatHistoryService = require('./chatHistoryService');
const conversationMemory = require('./conversationMemory');

class MemoryManager {
  /**
   * Generate a unique session ID
   * @returns {string} Unique session ID
   */
  generateSessionId() {
    return crypto.randomUUID();
  }

  /**
   * Retrieve active memory context for the session
   * @param {string} studentId 
   * @param {string} courseId 
   * @param {string} sessionId 
   * @returns {Promise<{ textBlock: string, chatMessages: Object[] }>}
   */
  async loadMemory(studentId, courseId, sessionId) {
    try {
      if (!sessionId) {
        return { textBlock: 'No previous conversation history.', chatMessages: [] };
      }
      
      // Load 11 messages in case the current query was already saved to DB
      const historyDocs = await chatHistoryService.getRecentHistory(studentId, courseId, sessionId, 11);
      
      // If the last message is a user message, it represents the current user question.
      // We exclude it from the historical context to avoid duplicating it with the current user message payload.
      if (historyDocs.length > 0 && historyDocs[historyDocs.length - 1].role === 'user') {
        historyDocs.pop();
      }
      
      // Keep at most the last 10 messages for history
      const recentDocs = historyDocs.slice(-10);
      
      return {
        textBlock: conversationMemory.formatAsTextBlock(recentDocs),
        chatMessages: conversationMemory.formatAsChatMessages(recentDocs)
      };
    } catch (error) {
      console.error('[MemoryManager] Error loading memory:', error);
      return { textBlock: 'No previous conversation history.', chatMessages: [] };
    }
  }
}

module.exports = new MemoryManager();
