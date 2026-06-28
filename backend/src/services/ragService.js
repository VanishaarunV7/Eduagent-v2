const Student = require('../models/Student');
const Course = require('../models/Course');
const StudyMaterial = require('../models/StudyMaterial');
const retriever = require('../rag/retriever');
const contextBuilder = require('../rag/contextBuilder');
const groqService = require('./groqService');
const intentRouter = require('../agents/study/intentRouter');

/**
 * Check if the student has uploaded study materials for the given course
 * @param {string} studentId 
 * @param {string} courseId 
 * @returns {Promise<boolean>}
 */
async function hasUploadedDocuments(studentId, courseId) {
  try {
    const query = { studentId };
    if (courseId) {
      query.courseId = courseId;
    }
    const count = await StudyMaterial.countDocuments(query);
    return count > 0;
  } catch (error) {
    console.error("[RAG Service] Error counting study materials:", error);
    return false;
  }
}

/**
 * Coordinate RAG execution pipeline
 * @param {string} studentId 
 * @param {string} courseId 
 * @param {string} question 
 * @returns {Promise<string>} AI reply matching retrieved context
 */
async function processRAGQuery(studentId, courseId, question) {
  try {
    const hasDocs = await hasUploadedDocuments(studentId, courseId);
    if (!hasDocs) {
      return "The requested information is not available in your uploaded study material.";
    }

    const chunks = await retriever.retrieveContext(question, studentId, courseId, 8);
    return await intentRouter.route(studentId, courseId, question, chunks, []);
  } catch (error) {
    console.error("[RAG Service Error]:", error);
    throw error;
  }
}

module.exports = {
  hasUploadedDocuments,
  processRAGQuery
};
