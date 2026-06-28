const groqService = require('../../services/groqService');

/**
 * Handle Important Topic Generation (Feature 4)
 */
exports.process = async (studentId, courseId, query, contextChunks, historyMessages = []) => {
  console.log(`[TopicAnalyzer] Processing important topics query: "${query}"`);

  const contextText = contextChunks.map((doc, idx) => `[Study Notes Chunk ${idx + 1}]:\n${doc.pageContent}`).join('\n\n');

  const systemPrompt = `You are the Important Topic Generator for the EduAgent Study Assistant.
Your task is to analyze the student's study materials and identify:
- Frequently discussed concepts
- Chapter headings
- Key definitions
- Important formulas
- Repeated keywords

CRITICAL INSTRUCTIONS:
1. Base your topic analysis ONLY on the uploaded study material chunks provided below.
2. If the study materials are empty, uninformative, or missing, you MUST respond exactly:
   "The requested information is not available in your uploaded study material."
3. Do not list general topics of the subject if they are not discussed in the provided notes.
4. Output a ranked list of important topics with star ratings (★★★★★ down to ★★★☆☆) and clear explanations.

Example Output format:
★★★★★ Binary Trees
Reason:
Core chapter with multiple subtopics and high conceptual importance.

★★★★ Graph Traversal
Reason:
Frequently emphasized in the uploaded notes.

Format using clean, premium Markdown headers and text styling.

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
