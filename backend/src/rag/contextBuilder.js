/**
 * Context Builder for the RAG prompt
 * Combines Student Profile, Current Course, Retrieved PDF chunks, and the user's question.
 */

/**
 * Builds the RAG prompt content by joining student info, course info, context chunks, and user query
 * @param {Object} student - Student database object
 * @param {Object} course - Course database object
 * @param {Object[]} chunks - Retrieved document chunks from ChromaDB
 * @param {string} question - The user's query
 * @returns {string} Fully compiled context prompt
 */
function buildRAGPrompt(student, course, chunks, question) {
  // Format the retrieved document context
  const formattedChunks = chunks && chunks.length > 0
    ? chunks.map((doc, idx) => `[Document Chunk ${idx + 1}] (Source File: ${doc.metadata.filename || 'Unknown'})\n${doc.pageContent}`).join("\n\n")
    : "No relevant documents found.";

  // Format student details
  const studentStr = student
    ? `- Name: ${student.name}\n- ID: ${student.student_id}\n- Program: ${student.program_id || 'N/A'}\n- Batch: ${student.batch || 'N/A'}`
    : "N/A";

  // Format course details
  const courseStr = course
    ? `- Name: ${course.course_name}\n- ID: ${course.course_id}`
    : "N/A";

  return `STUDENT PROFILE:
===================
${studentStr}
===================

CURRENT COURSE:
===================
${courseStr}
===================

RETRIEVED STUDY MATERIALS CONTEXT:
==================================
${formattedChunks}
==================================

USER QUESTION:
"${question}"`;
}

/**
 * Gets the system prompt for the Groq RAG model, enforcing the strict rules.
 * @returns {string} System prompt
 */
function getRAGSystemPrompt() {
  return `You are an AI Academic Analytics & Student Mentor RAG System.
Your job is to answer the student's question ONLY using the provided "RETRIEVED STUDY MATERIALS CONTEXT" above.

STRICT RULES:
1. You must answer the question using ONLY the facts and information present in the "RETRIEVED STUDY MATERIALS CONTEXT".
2. If the answer is not explicitly present in the provided context, or if the context is empty/unrelated, you MUST reply exactly:
"I couldn't find this information in your uploaded study materials."
3. Do not fabricate, extrapolate, or use any of your pre-trained model knowledge to answer the question if it is not supported by the context.
4. Do not offer any preambles or general model knowledge answers. If the information is not in the context, output ONLY the exact error reply specified above.
5. If the answer is present, keep your response direct, professional, clear, and based strictly on the retrieved chunks. Refer to student profile or course info only if relevant to the question.`;
}

module.exports = {
  buildRAGPrompt,
  getRAGSystemPrompt
};
