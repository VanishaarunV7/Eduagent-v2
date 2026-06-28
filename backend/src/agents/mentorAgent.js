const Student = require('../models/Student');
const groqService = require('../services/groqService');

class MentorAgent {
  constructor() {
    this.agentName = 'Mentor Agent';
  }

  /**
   * Respond to motivation, learning strategies, career advice, or general academic guidance queries
   * @param {string} studentId 
   * @param {string} courseId 
   * @param {string} message 
   * @returns {Promise<string>}
   */
  async handleQuery(studentId, courseId, message, historyMessages = []) {
    try {
      const student = await Student.findOne({ student_id: studentId });
      const studentName = student ? student.name : '';

      const systemPrompt = `You are the specialized Mentor Agent for EduAgent.
Your job is to provide inspiration, motivation, career advice, productivity tips, learning strategies, and general academic guidance to the student.

RULES:
1. Address the student by name if available (Student Name: ${studentName}).
2. Be highly inspiring, supportive, empathetic, and strategic in your counseling.
3. Suggest concrete study hacks and cognitive science learning techniques (such as Pomodoro, Active Recall, Spaced Repetition, or Feynman Technique) when explaining how to study.
4. Provide structured, actionable steps for career path questions.
5. Keep the tone encouraging, positive, and professional.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: message }
      ];

      console.log('[Mentor Agent] Querying Groq for mentoring advice...');
      return await groqService.chatCompletion(messages);

    } catch (error) {
      console.error('[MentorAgent Error]:', error);
      throw error;
    }
  }

  /**
   * Answer generic educational/academic questions directly using Groq's pre-existing knowledge
   * @param {string} query 
   * @param {Array} historyMessages 
   * @returns {Promise<string>}
   */
  async handleGeneralEducationalQuery(query, historyMessages = []) {
    try {
      const systemPrompt = `You are the specialized Academic Agent for EduAgent.
Your job is to explain academic concepts, answer general-knowledge questions related to subjects, theories, and concepts (e.g. explain a data structure, define an algorithm, explain operating systems, etc.) directly using your pre-existing knowledge.

RULES:
1. Explain the concepts clearly, step-by-step, with appropriate structure, markdown formatting, lists, or code block examples where relevant.
2. Ensure the response is highly educational, accurate, and concise.
3. If the request is not related to academics, education, or learning, you must politely decline to answer.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: query }
      ];

      console.log('[Mentor Agent] Answering general educational query using Groq general knowledge...');
      return await groqService.chatCompletion(messages);
    } catch (error) {
      console.error('[MentorAgent GeneralEducational Error]:', error);
      throw error;
    }
  }
}

module.exports = new MentorAgent();
