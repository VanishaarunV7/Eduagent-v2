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
      // Check if study materials exist for the student
      const hasDocs = await ragService.hasUploadedDocuments(studentId, courseId);
      if (!hasDocs) {
        return "The requested information is not available in your uploaded study material.";
      }

      // Run similarity search query against ChromaDB Vector Store
      let chunks = [];
      try {
        chunks = await retriever.retrieveContext(message, studentId, courseId, 8);
      } catch (err) {
        console.warn('[RAGAgent] Vector store retrieval failed, continuing with empty context chunks:', err.message);
        chunks = [];
      }

      // ===========================================
      // MENTOR DEMO - BREAKPOINT 14
      // Place breakpoint here.
      //
      // Explain:
      // How RAG retrieves information from uploaded PDFs.
      // The RAG Agent check verifies if documents exist for this course in MongoDB.
      // It then runs a similarity search by embedding the user's question and querying the ChromaDB Vector Store to retrieve the most relevant text chunks.
      // Finally, these text chunks are injected as reference context in the LLM system prompt sent to Groq.
      //
      // Inspect:
      // studentId
      // courseId
      // message
      // chunks
      //
      // Expected value:
      // studentId: "STU10001"
      // courseId: "CS101"
      // message: "What is Paging?"
      // chunks: Array of objects containing text snippets from the uploaded PDF document (e.g., page contents describing paging memory management)
      //
      // Press F10.
      // ===========================================
      return await intentRouter.route(studentId, courseId, message, chunks, historyMessages);

    } catch (error) {
      console.error('[RAGAgent Error]:', error);
      return "The requested information is not available in your uploaded study material.";
    }
  }
}

module.exports = new RAGAgent();
