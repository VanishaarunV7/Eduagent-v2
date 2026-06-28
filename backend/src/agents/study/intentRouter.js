const groqService = require('../../services/groqService');

// Lazy load handlers to prevent circular dependencies
const handlers = {
  'MCQ_GENERATION': () => require('./mcqGenerator'),
  'SUMMARY_GENERATION': () => require('./summaryGenerator'),
  'CONCEPT_EXPLANATION': () => require('./conceptExplainer'),
  'TOPIC_ANALYSIS': () => require('./topicAnalyzer'),
  'PYQ_ANALYSIS': () => require('./pyqAnalyzer'),
  'QUESTION_PREDICTION': () => require('./questionPredictionEngine'),
  'GENERAL_RAG': () => require('./generalRAGHandler')
};

/**
 * Route student study queries to specialized generators/analyzers using Groq Llama 3.3 intent detection.
 */
class IntentRouter {
  async route(studentId, courseId, query, contextChunks, historyMessages = []) {
    try {
      const systemPrompt = `You are the Intent Classifier for the EduAgent Study Assistant.
Your job is to analyze the student's question and classify its intent into exactly one of the following categories:

- "MCQ_GENERATION": If asking to generate multiple choice questions (MCQs), practice questions, 2-mark questions, 5-mark questions, 10-mark questions, test questions, quiz questions, or question sheets.
- "SUMMARY_GENERATION": If asking to summarize the document, write revision notes, make flashcards, explain chapters (e.g., "Explain Chapter 5"), list formulas, list definitions, or create a summary.
- "CONCEPT_EXPLANATION": If asking to explain a specific term, concept, topic, or theory in detail (e.g., "What is an AVL Tree?", "Explain Dijkstra's algorithm").
- "TOPIC_ANALYSIS": If asking for important topics, high weightage topics, what to study first, exam important concepts, or most important chapters.
- "PYQ_ANALYSIS": If asking for previous year questions, repeated university questions, past papers, or recurring question patterns.
- "QUESTION_PREDICTION": If asking to predict questions, expected exam questions, or likely/probable questions.
- "GENERAL_RAG": For general questions asking about the content of the uploaded materials that do not match the above categories.

Respond with ONLY the name of the intent in all capital letters (e.g., "MCQ_GENERATION"). Do not include any punctuation, quotes, formatting, or extra words.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Classify this message: "${query}"` }
      ];

      console.log(`[IntentRouter] Classifying study assistant query: "${query}"...`);
      const classification = await groqService.chatCompletion(messages);
      
      // Clean result (remove anything non-alphabetical or whitespace)
      const cleanClassification = classification.replace(/[^A-Z_]/g, '').trim();
      console.log(`[IntentRouter] Classified intent as: "${cleanClassification}"`);

      const selectedHandlerFactory = handlers[cleanClassification] || handlers['GENERAL_RAG'];
      const handler = selectedHandlerFactory();

      return await handler.process(studentId, courseId, query, contextChunks, historyMessages);

    } catch (error) {
      console.error('[IntentRouter Error]:', error);
      // Fail-safe graceful fallback to general RAG
      const fallbackHandler = handlers['GENERAL_RAG']();
      return await fallbackHandler.process(studentId, courseId, query, contextChunks, historyMessages);
    }
  }
}

module.exports = new IntentRouter();
