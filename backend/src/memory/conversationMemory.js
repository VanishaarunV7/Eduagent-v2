class ConversationMemory {
  /**
   * Format history documents as a single text string block
   * @param {Object[]} historyDocs - Documents from MongoDB chat_history
   * @returns {string} Formatted history block
   */
  formatAsTextBlock(historyDocs) {
    if (!historyDocs || historyDocs.length === 0) {
      return 'No previous conversation history.';
    }

    return historyDocs.map(msg => {
      const senderLabel = msg.role === 'user' ? 'Student' : 'Assistant';
      return `${senderLabel}: ${msg.message}`;
    }).join('\n');
  }

  /**
   * Format history documents as an array of Groq chat messages
   * @param {Object[]} historyDocs 
   * @returns {Array<{ role: string, content: string }>}
   */
  formatAsChatMessages(historyDocs) {
    if (!historyDocs || historyDocs.length === 0) {
      return [];
    }

    return historyDocs.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.message
    }));
  }
}

module.exports = new ConversationMemory();
