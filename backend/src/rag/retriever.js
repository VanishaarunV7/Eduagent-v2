const vectorStoreService = require('./vectorstore/vectorStoreService');

/**
 * Retrieve relevant chunks from the vector store based on student and course filtering
 * @param {string} query - The query message
 * @param {string} studentId - Student identifier for filtering
 * @param {string} course - Course code/identifier for filtering
 * @param {number} limit - Maximum number of chunks to return (default 5)
 * @returns {Promise<Object[]>} - Array of matched documents
 */
async function retrieveContext(query, studentId, course, limit = 5) {
  try {
    // Build metadata filter
    const filter = {};
    if (studentId) filter.studentId = studentId;
    if (course) filter.course = course;

    console.log(`[Retriever] Retrieving context for query: "${query}", student: ${studentId}, course: ${course}`);
    const results = await vectorStoreService.similaritySearch(query, limit, filter);
    
    console.log(`[Retriever] Found ${results.length} relevant chunks.`);
    return results;
  } catch (error) {
    console.error("[Retriever Error]:", error);
    throw error;
  }
}

module.exports = {
  retrieveContext
};
