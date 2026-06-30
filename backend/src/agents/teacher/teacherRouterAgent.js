const groqService = require('../../services/groqService');

class TeacherRouterAgent {
  constructor() {
    this.modelName = 'llama-3.3-70b-versatile';
  }

  /**
   * Classify user query and return the target specialized agent name
   * @param {string} teacherId 
   * @param {string} courseId 
   * @param {string} message 
   * @param {string} conversationMemory 
   * @returns {Promise<string>} Target agent key
   */
  async classifyQuery(teacherId, courseId, message, conversationMemory = '') {
    try {
      const msg = message.toLowerCase().trim();

      // 1. Fast regex checks for obvious routing to reduce latency (Zero-LLM)
      if (/(attendance sheet|attendance logs|log attendance|mark present|mark absent|view attendance log)/i.test(msg)) {
        return 'Attendance';
      }
      if (/(schedule|timetable|room|date|time|calendar|when is|eligible|eligibility)/i.test(msg)) {
        return 'Exam';
      }
      if (/(assignment|homework|pending assignment|missing submission|submission status)/i.test(msg)) {
        return 'Assignment';
      }
      if (/(mentor|remedial|recommend|action|coaching|counselling|counseling|suggestion|advice)/i.test(msg)) {
        return 'Recommendation';
      }
      if (/(marks|score|grade|topper|top|rank|average|highest|lowest|median|std dev|standard deviation|weak student|grade distribution|distribution chart|marks distribution|pass|fail|success rate|attendance|present|absent)/i.test(msg)) {
        return 'Analytics';
      }

      // 2. Groq LLM routing for intelligent classification
      const systemPrompt = `You are the central Router Agent for the Teacher AI Assistant in EduAgent-V2.
Your job is to classify the teacher's message into exactly one of the following specialized agent categories:

1. "Analytics": If the teacher is asking about grades, exam marks, rank list, toppers, pass percentage, fail percentage, average attendance, average marks, or any statistical calculations, metrics, averages, comparisons, or charts.
2. "Attendance": If the teacher is asking about daily attendance log sheets, absentees lists for a date, marking present/absent, or raw logs.
3. "Exam": If the teacher is asking about exam timetables, room numbers, dates, schedules, or eligibility rules.
4. "Assignment": If the teacher is asking about assignment submission logs, late lists, or homework tasks.
5. "Recommendation": If the teacher is asking for recommendations, suggestions, mentoring actions, or coaching advice.

Respond with ONLY the exact name of the category (e.g., "Analytics", "Attendance", "Exam", "Assignment", "Recommendation").
Do NOT include any formatting, markdown, punctuation, or explanations. Just return the single word.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'system', content: `CONVERSATION HISTORY:\n=======================\n${conversationMemory || 'No previous history.'}\n=======================\n` },
        { role: 'user', content: `Message to classify: "${message}"` }
      ];

      console.log('[TeacherRouterAgent] Querying Groq to classify teacher query...');
      const classification = await groqService.chatCompletion(messages);
      const cleanClassification = classification.replace(/[^a-zA-Z]/g, '').trim();

      const validCategories = ['Analytics', 'Attendance', 'Exam', 'Assignment', 'Recommendation'];
      if (validCategories.includes(cleanClassification)) {
        console.log(`[TeacherRouterAgent] Classified as: ${cleanClassification}`);
        return cleanClassification;
      }

      return 'Analytics'; // Default fallback
    } catch (error) {
      console.error('[TeacherRouterAgent Error]:', error);
      return 'Analytics';
    }
  }
}

module.exports = new TeacherRouterAgent();
