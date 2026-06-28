const groqService = require('../../services/groqService');

/**
 * Handle summary, revision notes, flashcards, formulas, and definitions requests
 */
exports.process = async (studentId, courseId, query, contextChunks, historyMessages = []) => {
  console.log(`[SummaryGenerator] Processing query: "${query}"`);

  const contextText = contextChunks.map((doc, idx) => `[Study Material Chunk ${idx + 1}]:\n${doc.pageContent}`).join('\n\n');

  const systemPrompt = `You are the Summary Generator for the EduAgent Study Assistant. Your task is to process the student's request (e.g. summarize notes, create revision notes, generate flashcards, list important definitions, or list important formulas) based strictly on the uploaded study materials.

CRITICAL INSTRUCTIONS:
1. Base your summaries, notes, flashcards, formulas, or definitions ONLY on the uploaded study material chunks provided below.
2. If the study materials do not contain the details needed to compile the requested summary, notes, flashcards, formulas, or definitions, you MUST respond exactly:
   "The requested information is not available in your uploaded study material."
3. Do not invent formulas, write generic definitions, or summarize general topics if they are not present in the uploaded materials.

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
