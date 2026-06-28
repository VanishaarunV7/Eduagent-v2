const PreviousYearAnalysis = require('../../models/PreviousYearAnalysis');
const pyqAnalyzer = require('./pyqAnalyzer');
const groqService = require('../../services/groqService');
const Course = require('../../models/Course');

/**
 * Handle AI Exam Question Prediction (Feature 6)
 */
exports.process = async (studentId, courseId, query, contextChunks, historyMessages = []) => {
  console.log(`[QuestionPredictionEngine] Processing prediction request for course: ${courseId}`);

  const noteContext = contextChunks.map((doc, idx) => `[Study Notes Chunk ${idx + 1}]:\n${doc.pageContent}`).join('\n\n');

  // 1. Fetch Course details
  let courseName = courseId;
  try {
    const course = await Course.findOne({ course_id: courseId });
    if (course && course.course_name) {
      courseName = course.course_name;
    }
  } catch (err) {
    console.warn('[QuestionPredictionEngine] Failed to get course:', err.message);
  }

  // 2. Fetch or trigger PYQ Analysis trends
  let pyqTrends = 'No previous year paper trends have been analyzed yet.';
  try {
    const cachedAnalysis = await PreviousYearAnalysis.findOne({ courseId });
    if (cachedAnalysis) {
      pyqTrends = cachedAnalysis.analysisData;
    } else {
      console.log('[QuestionPredictionEngine] No cached PYQs. Running on-the-fly PYQ analysis...');
      pyqTrends = await pyqAnalyzer.process(studentId, courseId, "Analyze previous year questions", contextChunks, []);
    }
  } catch (pyqErr) {
    console.warn('[QuestionPredictionEngine] Error fetching PYQs:', pyqErr.message);
  }

  // If previous year papers are missing or failed, reject prediction to prevent hallucinations
  if (!pyqTrends || pyqTrends === "No reliable previous year question papers were found for this subject." || pyqTrends.includes('No previous year paper trends')) {
    console.log('[QuestionPredictionEngine] PYQ papers unavailable. Returning standard empty papers response.');
    return "No reliable previous year question papers were found for this subject.";
  }

  const systemPrompt = `You are the AI Exam Question Prediction Engine for the EduAgent Study Assistant.
Your task is to predict likely exam questions for "${courseName}" (${courseId}) by combining the student's uploaded notes, previous-year question trends, and topic frequencies.

CRITICAL INSTRUCTIONS:
1. Base your predictions strictly on:
   - Uploaded study material chunks (which represent syllabus depth/emphasis)
   - Previous-year paper trends (which represent historical relevance)
2. Generate ranked predictions of questions.
3. For each predicted question, you MUST specify exactly these 5 fields in this structure:
   - **Question**: [The predicted question text]
   - **Confidence Score**: [Estimated confidence percentage, e.g. 94%]
   - **Reason**: [Reasoning based on notes/syllabus alignment]
   - **Frequency**: [How often it appears, e.g. "3 times in past 5 years"]
   - **Source Type**: [Where the source is found, e.g. "University Paper & Lecture Notes"]
4. Include the required disclaimer EXACTLY as written:
   "These predictions are generated using previous year trends and educational resources. They are not guaranteed examination questions."

Example Output format:
Question:
Explain AVL Tree Rotations.
Confidence Score:
94%
Reason:
Frequently repeated in previous papers and extensively covered in uploaded notes.
Frequency:
3 times in past 5 years.
Source Type:
University Paper & Lecture Notes.

Format with clean, premium Markdown styling.

INPUTS:
=============================
STUDY NOTES CHUNKS:
${noteContext || 'No study materials have been uploaded or matched.'}

PREVIOUS YEAR PAPER TRENDS:
${pyqTrends}
=============================`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
    { role: 'user', content: query }
  ];

  let responseText = await groqService.chatCompletion(messages);

  // Append disclaimer check to guarantee it's present in the response
  const requiredDisclaimer = "These predictions are generated using previous year trends and educational resources. They are not guaranteed examination questions.";
  if (!responseText.includes(requiredDisclaimer)) {
    responseText += `\n\n---\n> **Disclaimer:** ${requiredDisclaimer}`;
  }

  return responseText;
};
