const groqService = require('../../services/groqService');

/**
 * Handle concept explanation requests
 */
exports.process = async (studentId, courseId, query, contextChunks, historyMessages = []) => {
  console.log(`[ConceptExplainer] Processing query: "${query}"`);

  const contextText = contextChunks.map((doc, idx) => `[Study Notes Chunk ${idx + 1}]:\n${doc.pageContent}`).join('\n\n');

  const systemPrompt = `You are the Concept Explainer for the EduAgent Study Assistant. Your task is to explain a difficult concept, term, or topic step-by-step to the student based strictly on the uploaded study materials.

CRITICAL INSTRUCTIONS:
1. Explain the concept using the terminology and context found in the uploaded study material chunks provided below.
2. If the study materials do not contain explanation or details about the specific concept asked, you MUST respond exactly:
   "The requested information is not available in your uploaded study material."
3. Do not formulate general explanations or guess definitions if the concept is not present in the uploaded materials.

RETRIEVED STUDY MATERIAL:
=============================
${contextText || 'No study materials have been uploaded or matched.'}
=============================`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
    { role: 'user', content: query }
  ];

  return await groqService.chatCompletion(messages);
};
