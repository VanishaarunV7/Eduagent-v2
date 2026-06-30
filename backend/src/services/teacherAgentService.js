const teacherRouterAgent = require('../agents/teacher/teacherRouterAgent');
const teacherAnalyticsAgent = require('../agents/teacher/teacherAnalyticsAgent');
const teacherAttendanceAgent = require('../agents/teacher/teacherAttendanceAgent');
const teacherExamAgent = require('../agents/teacher/teacherExamAgent');
const teacherAssignmentAgent = require('../agents/teacher/teacherAssignmentAgent');
const teacherRecommendationAgent = require('../agents/teacher/teacherRecommendationAgent');
const teacherChatHistoryService = require('../memory/teacherChatHistoryService');
const crypto = require('crypto');

// Student-facing agents and resolver
const studentResolver = require('./studentResolver');
const routerAgent = require('../agents/routerAgent');
const analyticsAgent = require('../agents/analyticsAgent');
const ragAgent = require('../agents/ragAgent');
const examAgent = require('../agents/examAgent');
const studyPlannerAgent = require('../agents/studyPlannerAgent');
const mentorAgent = require('../agents/mentorAgent');

class TeacherAgentService {
  generateSessionId() {
    return crypto.randomUUID();
  }

  /**
   * Process a teacher's chat query by routing to the appropriate specialized AI agent
   * @param {string} teacherId 
   * @param {string} courseId 
   * @param {string} message 
   * @param {string} sessionId
   * @returns {Promise<{ agent: string, reply: string, session_id: string, chart?: Object }>} Response object
   */
  async handleChatQuery(teacherId, courseId, message, sessionId = null) {
    const session_id = sessionId || this.generateSessionId();
    try {
      console.log(`[TeacherAgentService] Received chat request from Teacher: ${teacherId}, Course: ${courseId}, Session: ${session_id}`);
      
      // 1. Store user message in MongoDB teacher_chat_history
      await teacherChatHistoryService.saveMessage(teacherId, courseId, session_id, 'user', message);

      // 2. Attempt to resolve student from the user query
      const resolvedRes = await studentResolver.resolveStudent(message);

      if (resolvedRes.errorReply) {
        console.log(`[Teacher Agent] Student resolve error: ${resolvedRes.errorReply}`);
        // Store assistant reply in MongoDB teacher_chat_history and return the error
        await teacherChatHistoryService.saveMessage(teacherId, courseId, session_id, 'assistant', resolvedRes.errorReply, 'System');
        return {
          agent: 'System',
          reply: resolvedRes.errorReply,
          session_id
        };
      }

      if (resolvedRes.resolved) {
        const studentId = resolvedRes.studentId;

        // Retrieve recent conversation memory context (last 10 messages)
        const rawHistory = await teacherChatHistoryService.getRecentHistory(teacherId, courseId, session_id, 10);
        
        // Map to plain objects expected by the LLM
        const chatMessages = rawHistory.map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.message
        }));

        const textBlock = chatMessages.map(m => `${m.role === 'user' ? 'Teacher' : 'Assistant'}: ${m.content}`).join('\n');

        // RouterAgent intent classification using student context
        console.log('[Teacher Agent]\nSelected Agent: routing via RouterAgent...');
        const targetAgent = await routerAgent.classifyQuery(studentId, courseId, message, textBlock);
        
        console.log(`Selected Agent:\n${targetAgent}\n`);
        console.log(`Executing ${targetAgent}Agent...\n`);

        let reply = '';
        let agentLabel = '';
        let chartData = null;

        // Delegate to student-facing agents passing the resolved studentId
        if (targetAgent === 'Analytics') {
          agentLabel = analyticsAgent.agentName;
          const anaRes = await analyticsAgent.handleQuery(studentId, courseId, message, chatMessages);
          if (anaRes && typeof anaRes === 'object') {
            reply = anaRes.reply;
            chartData = anaRes.chart;
          } else {
            reply = anaRes;
          }
        } else if (targetAgent === 'RAG') {
          agentLabel = ragAgent.agentName;
          reply = await ragAgent.handleQuery(studentId, courseId, message, chatMessages);
        } else if (targetAgent === 'Exam') {
          agentLabel = examAgent.agentName;
          reply = await examAgent.handleQuery(studentId, courseId, message, chatMessages);
        } else if (targetAgent === 'StudyPlan') {
          agentLabel = studyPlannerAgent.agentName;
          const spRes = await studyPlannerAgent.handleQuery(studentId, courseId, message, chatMessages);
          if (spRes && typeof spRes === 'object') {
            reply = spRes.reply;
          } else {
            reply = spRes;
          }
        } else {
          // Mentoring / GeneralEducational
          agentLabel = mentorAgent.agentName;
          reply = await mentorAgent.handleQuery(studentId, courseId, message, chatMessages);
        }

        // Store assistant reply in MongoDB teacher_chat_history
        await teacherChatHistoryService.saveMessage(teacherId, courseId, session_id, 'assistant', reply, agentLabel);

        return {
          agent: agentLabel,
          reply,
          session_id,
          chart: chartData
        };
      }

      // 3. Fallback: retrieve recent conversation memory context for class-level query
      const chatMessages = await teacherChatHistoryService.getRecentHistory(teacherId, courseId, session_id, 10);
      const textBlock = chatMessages.map(m => `${m.role === 'user' ? 'Teacher' : 'Assistant'}: ${m.message}`).join('\n');

      // Pass memory context to RouterAgent to classify the query
      const targetAgent = await teacherRouterAgent.classifyQuery(teacherId, courseId, message, textBlock);
      console.log(`[TeacherAgentService] RouterAgent designated target agent: ${targetAgent}`);

      let reply = '';
      let agentLabel = '';
      let chartData = null;

      // Delegate to the correct specialized agent passing history messages
      switch (targetAgent) {
        case 'Attendance':
          agentLabel = teacherAttendanceAgent.agentName;
          const attRes = await teacherAttendanceAgent.handleQuery(teacherId, courseId, message, chatMessages);
          reply = attRes.reply;
          chartData = attRes.chart;
          break;

        case 'Exam':
          agentLabel = teacherExamAgent.agentName;
          const exRes = await teacherExamAgent.handleQuery(teacherId, courseId, message, chatMessages);
          reply = exRes.reply;
          chartData = exRes.chart;
          break;

        case 'Assignment':
          agentLabel = teacherAssignmentAgent.agentName;
          const asgRes = await teacherAssignmentAgent.handleQuery(teacherId, courseId, message, chatMessages);
          reply = asgRes.reply;
          chartData = asgRes.chart;
          break;

        case 'Recommendation':
          agentLabel = teacherRecommendationAgent.agentName;
          const recRes = await teacherRecommendationAgent.handleQuery(teacherId, courseId, message, chatMessages);
          reply = recRes.reply;
          chartData = recRes.chart;
          break;

        case 'Analytics':
        default:
          agentLabel = teacherAnalyticsAgent.agentName;
          const anaRes = await teacherAnalyticsAgent.handleQuery(teacherId, courseId, message, chatMessages);
          reply = anaRes.reply;
          chartData = anaRes.chart;
          break;
      }

      console.log(`[TeacherAgentService] Query successfully answered by: ${agentLabel}`);

      // Store assistant reply in MongoDB teacher_chat_history
      await teacherChatHistoryService.saveMessage(teacherId, courseId, session_id, 'assistant', reply, agentLabel);

      return {
        agent: agentLabel,
        reply,
        session_id,
        chart: chartData
      };

    } catch (error) {
      console.error('[TeacherAgentService Error]:', error);
      return {
        agent: 'System',
        reply: 'An unexpected internal error occurred while processing your request. Please try again.',
        session_id
      };
    }
  }
}

module.exports = new TeacherAgentService();
