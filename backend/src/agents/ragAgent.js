const Student = require('../models/Student');
const Course = require('../models/Course');
const retriever = require('../rag/retriever');
const intentRouter = require('./study/intentRouter');
const ragService = require('../services/ragService');

class RAGAgent {
  constructor() {
    this.agentName = 'RAG Agent';
  }

  /**
   * Handle academic or concept query using uploaded study materials
   * delegates to intent router and specialized study engines
   * @param {string} studentId 
   * @param {string} courseId 
   * @param {string} message 
   * @param {Array} historyMessages
   * @returns {Promise<string>}
   */
  async handleQuery(studentId, courseId, message, historyMessages = []) {
    try {
      // ===== BREAKPOINT 33 =====
      // Mentor Demo: MongoDB Query.
      // Collection Name: studymaterials
      // Purpose: Check if documents exist in MongoDB before querying ChromaDB.
      const hasDocs = await ragService.hasUploadedDocuments(studentId, courseId);
      if (!hasDocs) {
        return "The requested information is not available in your uploaded study material.";
      }

      // ===== BREAKPOINT 34 =====
      // Mentor Demo:
      // Querying Vector Store (ChromaDB) to retrieve matching contexts.
      // Method called: retriever.retrieveContext.
      // Returns: Array of similar chunks matching the student's question.
      let chunks = [];
      try {
        chunks = await retriever.retrieveContext(message, studentId, courseId, 8);
      } catch (err) {
        console.warn('[RAGAgent] Vector store retrieval failed, continuing with empty context chunks:', err.message);
        chunks = [];
      }

      // ===== BREAKPOINT 35 =====
      // Mentor Demo:
      // Delegating retrieved chunks to intentRouter.route to structure the prompt and query Groq.
      // Inspect: chunks (context segments).
      return await intentRouter.route(studentId, courseId, message, chunks, historyMessages);

    } catch (error) {
      console.error('[RAGAgent Error]:', error);
      return "The requested information is not available in your uploaded study material.";
    }
  }
}

module.exports = new RAGAgent();
