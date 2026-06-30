const groqService = require('../../services/groqService');

/**
 * Handle standard RAG queries by answering strictly from uploaded materials
 */
exports.process = async (studentId, courseId, query, contextChunks, historyMessages = []) => {
  console.log(`[GeneralRAGHandler] Processing query: "${query}"`);

  if (!contextChunks || contextChunks.length === 0) {
    return "The requested information is not available in your uploaded study material.";
  }

  const contextText = contextChunks.map((doc, idx) => `[Document Chunk ${idx + 1}]:\n${doc.pageContent}`).join('\n\n');

  const systemPrompt = `You are an AI Academic Study Assistant. Your task is to answer the student's question based strictly on the provided context retrieved from their uploaded study materials.

CRITICAL INSTRUCTIONS:
1. Prioritize the provided study materials.
2. If the answer to the user's question "${query}" cannot be found or derived from the retrieved document chunks, respond exactly and only with:
   "The requested information is not available in your uploaded study material."
3. Do not assume, hallucinate, invent facts, or use external knowledge to answer if the details are missing from the uploaded files.
4. If you return the warning, do not include any other text, greetings, or formatting.

RETRIEVED STUDY MATERIAL:
=============================
${contextText}
=============================`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
    { role: 'user', content: query }
  ];

  return await groqService.chatCompletion(messages);
};
