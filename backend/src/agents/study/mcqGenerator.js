const groqService = require('../../services/groqService');
const AIGeneratedQuestion = require('../../models/AIGeneratedQuestion');

/**
 * Handle MCQ, 2-mark, 5-mark, and 10-mark question generation
 */
exports.process = async (studentId, courseId, query, contextChunks, historyMessages = []) => {
  console.log(`[MCQGenerator] Processing question generation query: "${query}"`);

  const contextText = contextChunks.map((doc, idx) => `[Study Material Chunk ${idx + 1}]:\n${doc.pageContent}`).join('\n\n');

  // Determine question type from query
  let questionType = 'mcq';
  const lowercaseQuery = query.toLowerCase();
  if (lowercaseQuery.includes('2-mark') || lowercaseQuery.includes('2 mark') || lowercaseQuery.includes('two-mark') || lowercaseQuery.includes('two mark')) {
    questionType = 'two_mark';
  } else if (lowercaseQuery.includes('5-mark') || lowercaseQuery.includes('5 mark') || lowercaseQuery.includes('five-mark') || lowercaseQuery.includes('five mark')) {
    questionType = 'five_mark';
  } else if (lowercaseQuery.includes('10-mark') || lowercaseQuery.includes('10 mark') || lowercaseQuery.includes('ten-mark') || lowercaseQuery.includes('ten mark')) {
    questionType = 'ten_mark';
  }

  const systemPrompt = `You are the Exam Question Generator for the EduAgent Study Assistant.
Your task is to generate exam preparation questions based strictly on the uploaded study materials.

CRITICAL INSTRUCTIONS:
1. Generate questions based ONLY on the uploaded study material chunks provided below.
2. If the study materials do not contain sufficient content to generate questions, you MUST respond exactly:
   "The requested information is not available in your uploaded study material."
3. Do not formulate questions on general external concepts if they are not in the uploaded documents.

QUESTION SPECIFICATIONS:
- If the type requested is MCQ: Generate 5 Multiple Choice Questions (with options A, B, C, D, and clearly state the correct answer with brief explanation).
- If the type requested is 2-mark: Generate 5 short-answer questions with concise model answers.
- If the type requested is 5-mark: Generate 3 medium-length conceptual questions with model answer outline points.
- If the type requested is 10-mark: Generate 2 long-form essay/detailed analysis questions with structural model answer guidelines.

Format the response using clean, premium Markdown headers, bold highlights, and code blocks if appropriate.

RETRIEVED STUDY MATERIAL:
=============================
${contextText || 'No study materials have been uploaded or matched.'}
=============================`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
    { role: 'user', content: query }
  ];

  const responseText = await groqService.chatCompletion(messages);

  // Save the generated questions to MongoDB if it was successfully generated
  if (!responseText.includes("The requested information is not available in your uploaded study material.")) {
    try {
      const generatedRecord = new AIGeneratedQuestion({
        studentId: studentId,
        courseId: courseId,
        type: questionType,
        content: responseText
      });
      await generatedRecord.save();
      console.log(`[MCQGenerator] Successfully saved generated ${questionType} questions to MongoDB`);
    } catch (saveErr) {
      console.error('[MCQGenerator MongoDB Save Error]:', saveErr.message);
    }
  }

  return responseText;
};
