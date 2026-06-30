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
      // 1. Double check if student has uploaded materials for this course
      const hasDocs = await ragService.hasUploadedDocuments(studentId, courseId);
      if (!hasDocs) {
        return "The requested information is not available in your uploaded study material.";
      }

      // 2. Retrieve matching chunks from vector store (fetching up to 8 chunks to cover longer tasks)
      let chunks = [];
      try {
        chunks = await retriever.retrieveContext(message, studentId, courseId, 8);
      } catch (err) {
        console.warn('[RAGAgent] Vector store retrieval failed, continuing with empty context chunks:', err.message);
        chunks = [];
      }

      // 3. Delegate to Intent Router
      return await intentRouter.route(studentId, courseId, message, chunks, historyMessages);

    } catch (error) {
      console.error('[RAGAgent Error]:', error);
      return "The requested information is not available in your uploaded study material.";
    }
  }
}

module.exports = new RAGAgent();
