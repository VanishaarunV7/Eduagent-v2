const routerAgent = require('../agents/routerAgent');
const analyticsAgent = require('../agents/analyticsAgent');
const ragAgent = require('../agents/ragAgent');
const examAgent = require('../agents/examAgent');
const studyPlannerAgent = require('../agents/studyPlannerAgent');
const mentorAgent = require('../agents/mentorAgent');
const memoryManager = require('../memory/memoryManager');
const chatHistoryService = require('../memory/chatHistoryService');
const retriever = require('../rag/retriever');
const intentRouter = require('../agents/study/intentRouter');

class AgentService {
  /**
   * Process a chat query by routing to the appropriate specialized AI agent
   * @param {string} studentId 
   * @param {string} courseId 
   * @param {string} message 
   * @param {string} sessionId
   * @returns {Promise<{ agent: string, reply: string, session_id: string }>} Response object with agent metadata and session ID
   */
  async handleChatQuery(studentId, courseId, message, sessionId = null) {
    const session_id = sessionId || memoryManager.generateSessionId();
    try {
      console.log(`[AgentService] Received chat request from Student: ${studentId}, Course: ${courseId}, Session: ${session_id}`);
      
      // 1. Store user message in MongoDB chat_history
      await chatHistoryService.saveMessage(studentId, courseId, session_id, 'user', message);

      // 2. Retrieve recent conversation memory context (last 10 messages excluding the current one)
      const { textBlock, chatMessages } = await memoryManager.loadMemory(studentId, courseId, session_id);

      // 3. Pass memory context to RouterAgent to classify the query
      const targetAgent = await routerAgent.classifyQuery(studentId, courseId, message, textBlock);
      console.log(`[AgentService] RouterAgent designated target agent: ${targetAgent}`);

      let reply = '';
      let agentLabel = '';
      let fullAnalyticsResult = null;

      // 4. Delegate to the correct specialized agent passing history messages
      switch (targetAgent) {
        case 'Forbidden':
          agentLabel = 'System';
          reply = "I'm designed specifically for educational assistance. I can only help with academic topics, student performance, study materials, previous-year questions, exams, and learning-related queries.";
          break;

        case 'GeneralEducational':
          agentLabel = 'Academic Agent';
          reply = await mentorAgent.handleGeneralEducationalQuery(message, chatMessages);
          break;

        case 'PYQ':
          agentLabel = 'RAG Agent';
          let pyqChunks = [];
          try {
            pyqChunks = await retriever.retrieveContext(message, studentId, courseId, 8);
          } catch (err) {
            console.log('[AgentService] Failed to retrieve context for PYQ (probably no uploaded materials):', err.message);
          }
          reply = await intentRouter.route(studentId, courseId, message, pyqChunks, chatMessages);
          break;

        case 'Analytics':
          agentLabel = analyticsAgent.agentName;
          const analyticsResult = await analyticsAgent.handleQuery(studentId, courseId, message, chatMessages);
          if (analyticsResult && typeof analyticsResult === 'object') {
            reply = analyticsResult.reply;
            fullAnalyticsResult = analyticsResult;
          } else {
            reply = analyticsResult;
          }
          break;

        case 'RAG':
          agentLabel = ragAgent.agentName;
          reply = await ragAgent.handleQuery(studentId, courseId, message, chatMessages);
          break;

        case 'Exam':
          agentLabel = examAgent.agentName;
          reply = await examAgent.handleQuery(studentId, courseId, message, chatMessages);
          break;

        case 'StudyPlan':
          agentLabel = studyPlannerAgent.agentName;
          const studyPlanResult = await studyPlannerAgent.handleQuery(studentId, courseId, message, chatMessages);
          if (studyPlanResult && typeof studyPlanResult === 'object' && studyPlanResult.downloadUrl) {
            // PDF was generated — pass full result through (reply, downloadUrl, preview)
            reply = studyPlanResult.reply;
            fullAnalyticsResult = studyPlanResult; // reuse the pass-through mechanism
          } else {
            reply = studyPlanResult?.reply || studyPlanResult;
          }
          break;

        case 'Mentoring':
        case 'General':
        default:
          agentLabel = mentorAgent.agentName;
          reply = await mentorAgent.handleQuery(studentId, courseId, message, chatMessages);
          break;
      }

      console.log(`[AgentService] Query successfully answered by: ${agentLabel}`);

      // 5. Store assistant reply in MongoDB chat_history
      await chatHistoryService.saveMessage(studentId, courseId, session_id, 'assistant', reply, agentLabel);

      if (fullAnalyticsResult) {
        return {
          ...fullAnalyticsResult,
          session_id: session_id
        };
      }

      return {
        agent: agentLabel,
        reply: reply,
        session_id: session_id
      };

    } catch (error) {
      console.error('[AgentService Error]:', error);
      // Fail-safe graceful fallback using Mentor Agent
      try {
        const { chatMessages } = await memoryManager.loadMemory(studentId, courseId, session_id);
        const fallbackReply = await mentorAgent.handleQuery(studentId, courseId, message, chatMessages);
        
        await chatHistoryService.saveMessage(studentId, courseId, session_id, 'assistant', fallbackReply, mentorAgent.agentName);
        
        return {
          agent: mentorAgent.agentName,
          reply: fallbackReply,
          session_id: session_id
        };
      } catch (fallbackErr) {
        return {
          agent: 'System',
          reply: 'I encountered an unexpected error processing your request. Please try again later.',
          session_id: session_id
        };
      }
    }
  }
}

module.exports = new AgentService();
