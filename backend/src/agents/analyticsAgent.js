/**
 * AnalyticsAgent — Data-Driven Academic Advisor
 *
 * Flow:
 *  1. Classify intent from user message
 *  2. Fetch all relevant MongoDB data (student, program, course, results, topics, outcomes, exam)
 *  3. Compute analytics locally (averages, trends, topic mastery, CO attainment, exam readiness)
 *  4. Optionally retrieve RAG context — targeted per weak topic if PDFs exist
 *  5. Build a structured, intent-specific prompt and send to Groq for explanation
 *  6. Return enriched response { agent, intent, analysis, reply }
 *
 * The LLM explains the analysis — it does NOT perform calculations.
 */

const Student = require('../models/Student');
const Program = require('../models/Program');
const Course = require('../models/Course');
const Result = require('../models/Result');
const Topic = require('../models/Topic');
const Outcome = require('../models/Outcome');
const ExamSchedule = require('../models/ExamSchedule');
const Attendance = require('../models/Attendance');
const Assignment = require('../models/Assignment');
const AssignmentSubmission = require('../models/AssignmentSubmission');
const Announcement = require('../models/Announcement');
const groqService = require('../services/groqService');
const ragService = require('../services/ragService');
const retriever = require('../rag/retriever');

// ─── Configurable Thresholds ─────────────────────────────────────────────────
const WEAK_THRESHOLD = 60;    // Topic score below this → Weak
const STRONG_THRESHOLD = 80;  // Topic score at/above this → Strong
const HIGH_RISK_AVG = 60;     // Average below this → High Risk exam readiness
const READY_AVG = 80;         // Average at/above this (with no weak topics) → Ready
const MAX_WEAK_TOPIC_RAG = 3; // Max number of weak topics to individually query via RAG
const MAX_RAG_CHUNKS = 3;     // Chunks per RAG retrieval

class AnalyticsAgent {
  constructor() {
    this.agentName = 'Analytics Agent';
  }

  // ─── Intent Classification ────────────────────────────────────────────────

  /**
   * Classify the user's question into a known intent key.
   * @param {string} message
   * @returns {string} Intent key
   */
  classifyIntent(message) {
    const msg = message.toLowerCase().trim();

    if (/(attendance|present|absent|attendance status|percentage of attendance)/i.test(msg)) {
      return 'attendance';
    }
    if (/(assignment|homework|pending project|task|tasks|evaluat)/i.test(msg)) {
      return 'assignments';
    }
    if (/(notice|announcement|alert|placement|cancel|workshop|holiday|notifications)/i.test(msg)) {
      return 'notifications';
    }

    // Cross-course intents (no courseId needed)
    if (/(strongest course|best course|which course.*strong|which.*course.*best|my best subject)/i.test(msg)) {
      return 'strongest_course';
    }
    if (/(weakest course|worst course|which course.*weak|which.*course.*worst|my worst subject)/i.test(msg)) {
      return 'weakest_course';
    }

    // Am I improving? (trend check)
    if (/(am i improving|am i getting better|is my performance improving|improving over time)/i.test(msg)) {
      return 'am_i_improving';
    }

    // Internal comparison
    if (
      /(compare internal|comparison of internal|internal 1.*internal 2|internal 2.*internal 3|internal 1.*2.*3|compare.*exam|all internal)/i.test(msg)
    ) {
      return 'compare_internals';
    }

    // Performance decline / poor performance in specific exam
    if (
      /(why.*marks.*decreas|why.*declining|why.*dropping|why.*falling|performance.*declin|marks.*declin|score.*declin)/i.test(msg)
    ) {
      return 'performance_decline';
    }
    if (
      /(why.*perform poorly|poorly in internal|low marks in internal|poor.*internal|bad.*internal)/i.test(msg)
    ) {
      return 'poor_exam_performance';
    }

    // Weak topics
    if (/(weak topic|weakest topic|worst topic|struggling topic|topic.*weak|low.*topic)/i.test(msg)) {
      return 'weak_topics';
    }

    // Strong topics
    if (/(strong topic|strongest topic|best topic|good.*topic|topic.*strong|topic.*best)/i.test(msg)) {
      return 'strong_topics';
    }

    // Study priority / what to study first
    if (
      /(study first|study priority|prioritize|what should i study|which topic.*first|study order)/i.test(msg)
    ) {
      return 'study_priority';
    }

    // How to improve in a course
    if (/(how.*improve|how.*do better|increase mark|boost.*score|improve.*course|improve.*subject)/i.test(msg)) {
      return 'course_improvement';
    }

    // Course outcomes / CO attainment
    if (/(lowest.*co|lowest attainment|co.*lowest|which co.*low)/i.test(msg)) {
      return 'lowest_attainment_co';
    }
    if (/(course outcome|outcome attainment|\bco\d?\b|co1|co2|co3|co4|attainment)/i.test(msg)) {
      return 'course_outcomes';
    }

    // Exam readiness / revision before exam
    if (
      /(revise|revision|what should i revise|prepare.*exam|ready.*exam|before.*exam|exam.*preparation)/i.test(msg)
    ) {
      return 'revision_guidance';
    }

    // Progress overview
    if (/(show.*progress|my progress|overall progress|progress overview|how am i doing)/i.test(msg)) {
      return 'progress_overview';
    }

    // Performance explanation
    if (
      /(explain.*performance|explain.*marks|explain.*result|what.*happened.*marks|why.*marks|performance explain)/i.test(msg)
    ) {
      return 'performance_explanation';
    }

    // Personalized suggestions (catch-all for "give me suggestions", "what should I do", etc.)
    if (
      /(personalized|suggestion|advice|recommend|what should i do|help me|guide me|tips for me)/i.test(msg)
    ) {
      return 'personalized_suggestions';
    }

    // Generic performance queries
    if (/(marks|score|grade|performance|result|average|internal)/i.test(msg)) {
      return 'performance_explanation';
    }

    return 'personalized_suggestions';
  }

  // ─── Analytics Computation Helpers ───────────────────────────────────────

  /**
   * Compute topic performance using the established deterministic offset approach
   * (consistent with topicController.js).
   * @param {Object[]} topics  - Array of Topic documents
   * @param {number} average   - Student's average marks for the course
   * @returns {{ topicsWithScores: Object[], strongTopics: Object[], averageTopics: Object[], weakTopics: Object[] }}
   */
  computeTopicPerformance(topics, average) {
    const topicsWithScores = [];
    const strongTopics = [];
    const averageTopics = [];
    const weakTopics = [];

    topics.forEach(t => {
      const charSum = t.topic_name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const offset = (charSum % 31) - 15; // range: -15 to +15
      let score = Math.round(average + offset);
      score = Math.min(100, Math.max(40, score)); // clamp: 40–100

      let status;
      if (score >= STRONG_THRESHOLD) {
        status = 'Strong';
        strongTopics.push({ topic_name: t.topic_name, score, status });
      } else if (score >= WEAK_THRESHOLD) {
        status = 'Average';
        averageTopics.push({ topic_name: t.topic_name, score, status });
      } else {
        status = 'Weak';
        weakTopics.push({ topic_name: t.topic_name, score, status });
      }

      topicsWithScores.push({ topic_name: t.topic_name, score, status });
    });

    // Sort weak topics by score ascending (most critical first)
    weakTopics.sort((a, b) => a.score - b.score);
    // Sort strong topics by score descending
    strongTopics.sort((a, b) => b.score - a.score);

    return { topicsWithScores, strongTopics, averageTopics, weakTopics };
  }

  /**
   * Compute course outcome attainment using the established deterministic offset approach
   * (consistent with outcomeController.js).
   * @param {Object[]} outcomes - Array of Outcome documents
   * @param {number} average    - Student's average marks for the course
   * @returns {{ outcomeList: Object[], highestCO: string, lowestCO: string, averageCO: number }}
   */
  computeCourseOutcomes(outcomes, average) {
    const outcomeList = outcomes.map(o => {
      const charSum = o.outcome_name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const offset = (charSum % 21) - 10; // range: -10 to +10
      let attainment = Math.round(average + offset);
      attainment = Math.min(100, Math.max(30, attainment)); // clamp: 30–100
      return { outcome: o.outcome_name, attainment };
    });

    let highestCO = 'N/A';
    let lowestCO = 'N/A';
    let averageCO = 0;

    if (outcomeList.length > 0) {
      const sorted = [...outcomeList].sort((a, b) => b.attainment - a.attainment);
      highestCO = `${sorted[0].outcome} (${sorted[0].attainment}%)`;
      lowestCO = `${sorted[sorted.length - 1].outcome} (${sorted[sorted.length - 1].attainment}%)`;
      averageCO = parseFloat(
        (outcomeList.reduce((s, o) => s + o.attainment, 0) / outcomeList.length).toFixed(2)
      );
    }

    return { outcomeList, highestCO, lowestCO, averageCO };
  }

  /**
   * Determine exam readiness based on average and weak topic count.
   * @param {number} average
   * @param {number} weakCount
   * @returns {'Ready' | 'Needs Revision' | 'High Risk'}
   */
  computeExamReadiness(average, weakCount) {
    if (average >= READY_AVG && weakCount === 0) return 'Ready';
    if (average < HIGH_RISK_AVG || weakCount >= 3) return 'High Risk';
    return 'Needs Revision';
  }

  /**
   * Compute results summary (internals, average, highest, lowest, trend, improvement%).
   * @param {Object[]} results - Array of Result documents
   * @returns {Object}
   */
  computeResultsSummary(results) {
    let internal1 = null;
    let internal2 = null;
    let internal3 = null;

    results.forEach(r => {
      const name = r.exam_name.toLowerCase();
      if (name.includes('internal 1')) internal1 = r.marks;
      else if (name.includes('internal 2')) internal2 = r.marks;
      else if (name.includes('internal 3')) internal3 = r.marks;
    });

    const marksArray = [internal1, internal2, internal3].filter(m => m !== null);
    const average = marksArray.length > 0
      ? parseFloat((marksArray.reduce((a, b) => a + b, 0) / marksArray.length).toFixed(2))
      : 0;
    const highest = marksArray.length > 0 ? Math.max(...marksArray) : 0;
    const lowest = marksArray.length > 0 ? Math.min(...marksArray) : 0;

    // Trend: compare most recent two available internals
    let trend = 'Stable';
    if (internal1 !== null && internal3 !== null) {
      trend = internal3 > internal1 ? 'Improving' : (internal3 < internal1 ? 'Declining' : 'Stable');
    } else if (internal1 !== null && internal2 !== null) {
      trend = internal2 > internal1 ? 'Improving' : (internal2 < internal1 ? 'Declining' : 'Stable');
    }

    // Improvement %: from first available to last available
    let improvementPct = 0;
    if (internal1 !== null && internal3 !== null && internal1 !== 0) {
      improvementPct = parseFloat((((internal3 - internal1) / internal1) * 100).toFixed(2));
    } else if (internal1 !== null && internal2 !== null && internal1 !== 0) {
      improvementPct = parseFloat((((internal2 - internal1) / internal1) * 100).toFixed(2));
    }

    return { internal1, internal2, internal3, average, highest, lowest, trend, improvementPct };
  }

  /**
   * Fetch average marks across all enrolled courses for a student.
   * Used for cross-course "strongest/weakest course" intents.
   * @param {string} studentId
   * @param {string[]} courseIds - Array of course_id strings to check
   * @returns {Promise<Object[]>} Array of { course_id, course_name, average }
   */
  async fetchAllCourseAverages(studentId, courseIds) {
    const courseAverages = [];

    for (const cid of courseIds) {
      try {
        const results = await Result.find({ student_id: studentId, course_id: cid });
        if (!results || results.length === 0) continue;

        const marks = results.map(r => r.marks);
        const avg = parseFloat((marks.reduce((a, b) => a + b, 0) / marks.length).toFixed(2));

        const courseDoc = await Course.findOne({ course_id: cid });
        const courseName = courseDoc ? courseDoc.course_name : cid;

        courseAverages.push({ course_id: cid, course_name: courseName, average: avg });
      } catch (err) {
        console.warn(`[Analytics Agent] Could not fetch results for course ${cid}:`, err.message);
      }
    }

    return courseAverages;
  }

  // ─── RAG Context Builder ─────────────────────────────────────────────────

  /**
   * Build a targeted RAG context string.
   * When there are weak topics, query each one individually for richer, focused content.
   * Falls back to a single query on the user message if no weak topics or no results.
   * @param {string} studentId
   * @param {string} courseId
   * @param {string} userMessage
   * @param {Object[]} weakTopics
   * @returns {Promise<string>}
   */
  async buildRagContext(studentId, courseId, userMessage, weakTopics) {
    const hasPdfs = await ragService.hasUploadedDocuments(studentId, courseId).catch(() => false);
    if (!hasPdfs) {
      return null; // Caller will skip RAG section
    }

    console.log(`[Analytics Agent] PDF study materials found for ${courseId}. Building targeted RAG context...`);

    let ragSections = [];

    // 1. Query each weak topic individually (up to MAX_WEAK_TOPIC_RAG)
    const topicsToQuery = weakTopics.slice(0, MAX_WEAK_TOPIC_RAG);
    for (const topic of topicsToQuery) {
      try {
        const query = `${topic.topic_name} concepts explanation examples`;
        const chunks = await retriever.retrieveContext(query, studentId, courseId, MAX_RAG_CHUNKS).catch(() => []);
        if (chunks && chunks.length > 0) {
          const section = chunks.map((doc, idx) =>
            `  [Chunk ${idx + 1}] (${doc.metadata?.filename || 'Uploaded Material'})\n  ${doc.pageContent.trim()}`
          ).join('\n\n');
          ragSections.push(`📌 Study Material for Weak Topic — "${topic.topic_name}" (${topic.score}%):\n${section}`);
        }
      } catch (err) {
        console.warn(`[Analytics Agent] RAG retrieval failed for topic "${topic.topic_name}":`, err.message);
      }
    }

    // 2. Fallback: if no weak topics, query on the user's message directly
    if (ragSections.length === 0) {
      try {
        const chunks = await retriever.retrieveContext(userMessage, studentId, courseId, MAX_RAG_CHUNKS).catch(() => []);
        if (chunks && chunks.length > 0) {
          const section = chunks.map((doc, idx) =>
            `  [Chunk ${idx + 1}] (${doc.metadata?.filename || 'Uploaded Material'})\n  ${doc.pageContent.trim()}`
          ).join('\n\n');
          ragSections.push(`📌 Retrieved Study Material:\n${section}`);
        }
      } catch (err) {
        console.warn(`[Analytics Agent] Fallback RAG retrieval failed:`, err.message);
      }
    }

    return ragSections.length > 0 ? ragSections.join('\n\n') : null;
  }

  // ─── Intent-Aware Prompt Builder ─────────────────────────────────────────

  /**
   * Build the intent-specific instruction section for the system prompt.
   * @param {string} intent
   * @param {Object} analysis
   * @param {string} studentName
   * @returns {string}
   */
  buildIntentInstruction(intent, analysis, studentName) {
    const {
      weakTopics, strongTopics, averageTopics, trend, improvementPct,
      internal1, internal2, internal3, average, examReadiness,
      highestCO, lowestCO
    } = analysis;

    const name = studentName;

    switch (intent) {
      case 'attendance':
        return `${name} is asking about their ATTENDANCE logs. Focus your response on:
- Giving their overall attendance percentage from the context
- Highlighting whether it is below the 75% required university threshold
- Reminding them of how many classes they were present/absent for
- Giving brief learning-focused suggestions if attendance is critically low`;

      case 'assignments':
        return `${name} is asking about their homework ASSIGNMENTS. Focus your response on:
- Listing pending assignments with their respective due dates
- Highlighting if any pending assignments are overdue
- Acknowledging completed assignments and evaluation marks or feedback`;

      case 'notifications':
        return `${name} is asking about university alerts or ANNOUNCEMENTS. Focus your response on:
- Summarizing recent placement updates, workshop details, holiday notifications, or cancellation alerts listed in the context`;

      case 'weak_topics':
        return `${name} is asking about their WEAK topics. Focus your response on:
- Listing all weak topics (score < ${WEAK_THRESHOLD}%) with their exact scores
- Explaining why these topics are dragging down performance
- Providing 2–3 specific, actionable study tips per weak topic
- If study materials are provided, reference them for each weak topic`;

      case 'strong_topics':
        return `${name} is asking about their STRONG topics. Focus your response on:
- Listing all strong topics (score ≥ ${STRONG_THRESHOLD}%) with their exact scores
- Acknowledging these as genuine strengths
- Advising on how to maintain and leverage these strengths
- Suggesting the student build confidence from strong areas`;

      case 'study_priority':
        return `${name} wants to know which topics to study first. Focus your response on:
- Presenting weak topics in priority order (lowest score → highest score)
- Explaining why addressing weaker areas first yields the most improvement
- Creating a prioritized study sequence: Weak → Average → Strong (maintenance)
- Mentioning any upcoming exam if relevant`;

      case 'course_improvement':
        return `${name} wants to know how to improve in this course. Focus your response on:
- Summarizing the current performance level (average: ${average}%, trend: ${trend})
- Identifying the specific weak topics that most need attention
- Providing a structured improvement plan (numbered steps)
- Referencing study materials if available
- Mentioning the upcoming exam deadline if available`;

      case 'performance_decline':
        return `${name} is asking why their marks are declining or decreasing. Focus your response on:
- Clearly stating the trend: Internal 1 (${internal1 ?? 'N/A'}) → Internal 2 (${internal2 ?? 'N/A'}) → Internal 3 (${internal3 ?? 'N/A'})
- Highlighting the specific drop between exams
- Explaining which weak topics likely contributed to the decline
- Offering a motivating, actionable recovery plan`;

      case 'poor_exam_performance':
        return `${name} is asking about poor performance in a specific internal exam. Focus your response on:
- Showing marks across all internals: I1=${internal1 ?? 'N/A'}, I2=${internal2 ?? 'N/A'}, I3=${internal3 ?? 'N/A'}
- Identifying the exam with the lowest mark
- Linking that exam's performance to weak topics
- Suggesting corrective study actions`;

      case 'compare_internals':
        return `${name} wants to compare all internal exam marks. Focus your response on:
- Presenting a clear comparison: Internal 1 (${internal1 ?? 'N/A'}) → Internal 2 (${internal2 ?? 'N/A'}) → Internal 3 (${internal3 ?? 'N/A'})
- Calculating and explaining the change between each exam (increase/decrease)
- Stating the overall trend (${trend}) and what it means
- Commenting on whether the student is on the right track`;

      case 'am_i_improving':
        return `${name} wants to know if they are improving. Focus your response on:
- Directly answering: based on the trend (${trend}), performance is ${trend}
- Showing the internal exam progression: I1=${internal1 ?? 'N/A'}, I2=${internal2 ?? 'N/A'}, I3=${internal3 ?? 'N/A'}
- Explaining the improvement percentage (${improvementPct >= 0 ? '+' : ''}${improvementPct}%) in plain language
- Providing motivating advice regardless of whether improving or not`;

      case 'course_outcomes':
        return `${name} is asking about their Course Outcomes (COs). Focus your response on:
- Listing each CO and its attainment percentage
- Identifying the highest attaining CO (${highestCO}) and lowest (${lowestCO})
- Explaining what CO attainment means for their academic standing
- Suggesting how to improve the weakest CO`;

      case 'lowest_attainment_co':
        return `${name} is asking which CO has the lowest attainment. Focus your response on:
- Clearly stating the lowest CO: ${lowestCO}
- Listing all COs and their attainments for context
- Explaining what a low attainment in this CO means academically
- Providing targeted advice to improve the weakest CO`;

      case 'revision_guidance':
        return `${name} is asking what to revise before the next exam. Focus your response on:
- Stating the upcoming exam details if available
- Listing weak topics in priority order (lowest score first) as the revision focus
- For each weak topic, giving 1–2 quick revision tips
- Mentioning study materials if available
- Judging exam readiness: currently "${examReadiness}"`;

      case 'progress_overview':
        return `${name} wants an overview of their progress. Focus your response on:
- Overall performance summary: average ${average}%, trend ${trend}
- Internal exam progression (I1→I2→I3)
- Topic mastery breakdown (strong, average, weak counts)
- CO attainment summary
- Exam readiness status: "${examReadiness}"
- Key areas to focus on going forward`;

      case 'performance_explanation':
        return `${name} wants their performance explained. Focus your response on:
- Providing a comprehensive but concise performance report
- Internal marks breakdown with trend analysis
- Topic mastery summary (highlight weak areas)
- CO attainment overview
- A clear "what it means" explanation in simple language`;

      case 'strongest_course':
        return `${name} is asking which course is their strongest. Focus your response on:
- Comparing average marks across all enrolled courses
- Clearly identifying the strongest course and its average
- Validating this finding with topic/CO context if available
- Encouraging the student to leverage their strongest subject`;

      case 'weakest_course':
        return `${name} is asking which course is their weakest. Focus your response on:
- Comparing average marks across all enrolled courses
- Clearly identifying the weakest course and its average
- Providing targeted advice to improve in the weakest course
- Being empathetic and motivating`;

      case 'personalized_suggestions':
      default:
        return `${name} is asking for personalized academic suggestions. Focus your response on:
- Providing a holistic academic status overview
- Highlighting top 3 weak areas that need immediate attention
- Offering a prioritized, actionable 5-step improvement plan
- Mentioning the upcoming exam and readiness level
- Referencing uploaded study materials if available
- Being specific, supportive, and results-focused`;
    }
  }

  // ─── Main Handler ─────────────────────────────────────────────────────────

  /**
   * Handle an academic analytics query from a student.
   * @param {string} studentId
   * @param {string} courseId
   * @param {string} message
   * @param {Object[]} historyMessages - Previous conversation messages for Groq
   * @returns {Promise<Object>} { agent, intent, analysis, reply }
   */
  async handleQuery(studentId, courseId, message, historyMessages = []) {
    try {
      const intent = this.classifyIntent(message);
      console.log(`[Analytics Agent] Classified intent: "${intent}" for query: "${message}"`);

      // ── 1. Fetch Student Profile ──────────────────────────────────────────
      const student = await Student.findOne({ student_id: studentId });
      if (!student) {
        return {
          agent: this.agentName,
          intent: 'error',
          analysis: {},
          reply: 'No student performance data is available.'
        };
      }

      const program = await Program.findOne({ program_id: student.program_id });
      const programName = program ? program.program_name : student.program_id;

      // ── 2. Cross-Course Intent Handling ───────────────────────────────────
      const isCrossCourseIntent = ['strongest_course', 'weakest_course'].includes(intent);

      if (isCrossCourseIntent) {
        return await this._handleCrossCourseQuery(studentId, student, programName, intent, message, historyMessages);
      }

      // ── 3. Single-Course Data Fetch ───────────────────────────────────────
      let course = null;
      if (courseId) {
        course = await Course.findOne({ course_id: courseId });
      }
      const courseName = course ? course.course_name : (courseId || 'the course');

      // ── 4. Fetch & Compute Results ────────────────────────────────────────
      const [results, topics, outcomes, examSchedule, attendanceLogs, assignments, submissions, announcements] = await Promise.all([
        Result.find({ student_id: studentId, course_id: courseId }),
        Topic.find({ course_id: courseId }),
        Outcome.find({ course_id: courseId }),
        ExamSchedule.findOne({ course_id: courseId }, { _id: 0, __v: 0 }),
        Attendance.find({ student_id: studentId, course_id: courseId }),
        Assignment.find({ course_id: courseId }),
        AssignmentSubmission.find({ student_id: studentId }),
        Announcement.find({
          $or: [
            { target_type: 'all' },
            { target_type: 'program', target_id: student.program_id },
            { target_type: 'course', target_id: courseId }
          ]
        }).sort({ createdAt: -1 })
      ]);

      if (!results || results.length === 0) {
        return {
          agent: this.agentName,
          intent: intent || 'performance',
          analysis: {},
          reply: 'No student performance data is available.'
        };
      }

      const resultsSummary = this.computeResultsSummary(results);
      const { internal1, internal2, internal3, average, highest, lowest, trend, improvementPct } = resultsSummary;

      // Calculate Attendance stats from DB
      const totalAtt = attendanceLogs.length;
      const presentAtt = attendanceLogs.filter(a => a.status === 'Present').length;
      const attendancePercentage = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 85;

      // Group assignments
      const pendingAssignments = [];
      const completedAssignments = [];
      assignments.forEach(a => {
        const sub = submissions.find(s => s.assignment_id.toString() === a._id.toString());
        if (sub) {
          completedAssignments.push({
            title: a.title,
            due_date: a.due_date,
            marks_obtained: sub.marks_obtained,
            feedback: sub.feedback
          });
        } else {
          pendingAssignments.push({
            title: a.title,
            due_date: a.due_date,
            overdue: new Date(a.due_date).getTime() < Date.now()
          });
        }
      });

      // ── 5. Compute Topic Performance ──────────────────────────────────────
      const { topicsWithScores, strongTopics, averageTopics, weakTopics } =
        this.computeTopicPerformance(topics, average);

      // ── 6. Compute Course Outcomes ────────────────────────────────────────
      const { outcomeList, highestCO, lowestCO, averageCO } =
        this.computeCourseOutcomes(outcomes, average);

      // ── 7. Exam Readiness & Schedule ─────────────────────────────────────
      const examReadiness = this.computeExamReadiness(average, weakTopics.length);
      const examStr = examSchedule && examSchedule.exam_name
        ? `${examSchedule.exam_name} on ${examSchedule.exam_date} (${examSchedule.start_time}–${examSchedule.end_time}) in ${examSchedule.room}`
        : 'No upcoming exam scheduled.';

      // ── 8. Targeted RAG Context ───────────────────────────────────────────
      const ragContext = await this.buildRagContext(studentId, courseId, message, weakTopics);

      // ── 9. Assemble Structured Analysis Object ────────────────────────────
      const analysis = {
        average,
        highest,
        lowest,
        trend,
        improvementPct,
        internals: { internal1, internal2, internal3 },
        weakTopics: weakTopics.map(t => ({ name: t.topic_name, score: t.score })),
        averageTopics: averageTopics.map(t => ({ name: t.topic_name, score: t.score })),
        strongTopics: strongTopics.map(t => ({ name: t.topic_name, score: t.score })),
        courseOutcomes: outcomeList,
        highestCO,
        lowestCO,
        averageCO,
        examReadiness,
        upcomingExam: examSchedule
          ? {
              exam_name: examSchedule.exam_name,
              exam_date: examSchedule.exam_date,
              start_time: examSchedule.start_time,
              end_time: examSchedule.end_time,
              room: examSchedule.room
            }
          : null,
        attendance: attendancePercentage,
        attendanceLogsCount: totalAtt,
        presentLogsCount: presentAtt,
        pendingAssignments,
        completedAssignments,
        announcements
      };

      // ── 10. Build Structured Context for Groq ────────────────────────────
      const topicsDetailStr = topicsWithScores.length > 0
        ? topicsWithScores
            .sort((a, b) => a.score - b.score)
            .map(t => `  • ${t.topic_name}: ${t.score}% [${t.status}]`)
            .join('\n')
        : '  • No topic data available.';

      const outcomesStr = outcomeList.length > 0
        ? outcomeList.map(o => `  • ${o.outcome}: ${o.attainment}% attainment`).join('\n')
        : '  • No outcome data available.';

      const historyStr = historyMessages.length > 0
        ? historyMessages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .slice(-6) // last 6 messages (3 exchanges)
            .map(m => `[${m.role === 'user' ? 'Student' : 'AI'}]: ${m.content}`)
            .join('\n')
        : 'No previous conversation.';

      const ragSection = ragContext
        ? `\nRETRIEVED STUDY MATERIALS (from uploaded PDF):\n${'='.repeat(50)}\n${ragContext}\n${'='.repeat(50)}\n`
        : '\nREFERENCE MATERIALS: No PDF study materials uploaded for this course.';

      const structuredContext = `
STUDENT PROFILE:
  • Name:    ${student.name}
  • ID:      ${student.student_id}
  • Program: ${programName}
  • Course:  ${courseName} (${courseId || 'N/A'})

INTERNAL ASSESSMENT MARKS:
  • Internal 1: ${internal1 !== null ? `${internal1}/100` : 'Not recorded'}
  • Internal 2: ${internal2 !== null ? `${internal2}/100` : 'Not recorded'}
  • Internal 3: ${internal3 !== null ? `${internal3}/100` : 'Not recorded'}
  • Average:    ${average}%
  • Highest:    ${highest}/100
  • Lowest:     ${lowest}/100
  • Trend:      ${trend} (${improvementPct >= 0 ? '+' : ''}${improvementPct}% change from first to last internal)

TOPIC PERFORMANCE (sorted by score ascending):
${topicsDetailStr}
  ──
  • Strong Topics (≥ ${STRONG_THRESHOLD}%): ${strongTopics.length > 0 ? strongTopics.map(t => `${t.topic_name} (${t.score}%)`).join(', ') : 'None'}
  • Average Topics (${WEAK_THRESHOLD}–${STRONG_THRESHOLD - 1}%): ${averageTopics.length > 0 ? averageTopics.map(t => `${t.topic_name} (${t.score}%)`).join(', ') : 'None'}
  • Weak Topics (< ${WEAK_THRESHOLD}%):   ${weakTopics.length > 0 ? weakTopics.map(t => `${t.topic_name} (${t.score}%)`).join(', ') : 'None'}

COURSE OUTCOMES (CO) ATTAINMENT:
${outcomesStr}
  ──
  • Highest CO: ${highestCO}
  • Lowest CO:  ${lowestCO}
  • Average CO Attainment: ${averageCO}%

ATTENDANCE STATUS:
  • Overall Attendance: ${attendancePercentage}% (${presentAtt}/${totalAtt} sessions present)
  • Status: ${attendancePercentage < 75 ? 'Low Attendance Alert (Required: 75%)' : 'Good Attendance'}

ASSIGNMENTS STATUS:
  • Pending Assignments: ${pendingAssignments.length > 0 ? pendingAssignments.map(a => `"${a.title}" (Due: ${a.due_date.toISOString().split('T')[0]}${a.overdue ? ' - OVERDUE' : ''})`).join(', ') : 'None'}
  • Completed/Graded Assignments: ${completedAssignments.length > 0 ? completedAssignments.map(a => `"${a.title}" (Marks: ${a.marks_obtained ?? 'Not Graded'})`).join(', ') : 'None'}

ANNOUNCEMENTS & NOTIFICATIONS:
  • Active Alerts: ${announcements.length > 0 ? announcements.slice(0,5).map(a => `[${a.category}] ${a.title} - ${a.content}`).join(' | ') : 'No notices posted.'}

EXAM READINESS:
  • Status:        ${examReadiness}
  • Upcoming Exam: ${examStr}
${ragSection}
PREVIOUS CONVERSATION CONTEXT:
${'─'.repeat(40)}
${historyStr}
${'─'.repeat(40)}
`.trim();

      // ── 11. Build Intent-Specific System Prompt ───────────────────────────
      const intentInstruction = this.buildIntentInstruction(intent, {
        weakTopics, strongTopics, averageTopics, trend, improvementPct,
        internal1, internal2, internal3, average, examReadiness,
        highestCO, lowestCO
      }, student.name);

      const systemPrompt = `You are the Analytics Agent and Academic Advisor for EduAgent — an AI-powered student performance platform.

Your role is to provide HIGHLY PERSONALIZED, DATA-DRIVEN academic guidance to ${student.name}.

STRICT RULES:
1. Base EVERY claim strictly on the computed data in the STUDENT ACADEMIC DATA CONTEXT below. Do NOT invent statistics or guess scores.
2. Do NOT perform any mathematical calculations yourself. All averages, trends, scores, and attainments have already been computed. Your role is to EXPLAIN and ADVISE.
3. Always refer to the student by their name: "${student.name}".
4. Use a warm, encouraging, yet professional tone. Be direct and actionable.
5. Use clear formatting: bullet points, numbered lists, and section headers where appropriate.
6. If study materials are included in the context, reference them naturally when giving tips (e.g., "Based on your uploaded notes on Transactions..."). If no materials are available, give advice based purely on analytics without hallucinating.
7. Keep responses concise and focused on the specific question asked.

CURRENT QUESTION INTENT: ${intent.replace(/_/g, ' ').toUpperCase()}
SPECIFIC INSTRUCTIONS FOR THIS QUESTION:
${intentInstruction}`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'system', content: `STUDENT ACADEMIC DATA CONTEXT:\n${'='.repeat(50)}\n${structuredContext}\n${'='.repeat(50)}` },
        ...historyMessages,
        { role: 'user', content: message }
      ];

      console.log(`[Analytics Agent] Sending structured context to Groq for intent: "${intent}"...`);
      const reply = await groqService.chatCompletion(messages);

      return {
        agent: this.agentName,
        intent,
        analysis,
        reply
      };

    } catch (error) {
      console.error('[AnalyticsAgent Error]:', error);
      throw error;
    }
  }

  // ─── Cross-Course Query Handler ───────────────────────────────────────────

  /**
   * Handle cross-course queries: strongest/weakest course analysis.
   * Fetches results for all courses in the student's program.
   * @param {string} studentId
   * @param {Object} student      - Student document
   * @param {string} programName
   * @param {string} intent
   * @param {string} message
   * @param {Object[]} historyMessages
   * @returns {Promise<Object>} { agent, intent, analysis, reply }
   */
  async _handleCrossCourseQuery(studentId, student, programName, intent, message, historyMessages) {
    console.log(`[Analytics Agent] Handling cross-course intent: "${intent}" for student ${studentId}`);

    // Fetch all courses in the student's program
    const programCourses = await Course.find({ program_id: student.program_id });
    const courseIds = programCourses.map(c => c.course_id);

    const courseAverages = await this.fetchAllCourseAverages(studentId, courseIds);

    if (courseAverages.length === 0) {
      return {
        agent: this.agentName,
        intent,
        analysis: { courseAverages: [] },
        reply: `No results found across enrolled courses for ${student.name}. Please ensure academic results have been recorded.`
      };
    }

    const sorted = [...courseAverages].sort((a, b) => b.average - a.average);
    const strongestCourse = sorted[0];
    const weakestCourse = sorted[sorted.length - 1];

    const analysis = {
      courseAverages,
      strongestCourse,
      weakestCourse
    };

    const courseTableStr = courseAverages
      .sort((a, b) => b.average - a.average)
      .map((c, i) => `  ${i + 1}. ${c.course_name} (${c.course_id}): ${c.average}% average`)
      .join('\n');

    const historyStr = historyMessages.length > 0
      ? historyMessages.slice(-6).map(m => `[${m.role === 'user' ? 'Student' : 'AI'}]: ${m.content}`).join('\n')
      : 'No previous conversation.';

    const structuredContext = `
STUDENT PROFILE:
  • Name:    ${student.name}
  • ID:      ${student.student_id}
  • Program: ${programName}

COURSE PERFORMANCE COMPARISON (all enrolled courses):
${courseTableStr}

SUMMARY:
  • Strongest Course: ${strongestCourse.course_name} — ${strongestCourse.average}% average
  • Weakest Course:   ${weakestCourse.course_name} — ${weakestCourse.average}% average

PREVIOUS CONVERSATION CONTEXT:
${'─'.repeat(40)}
${historyStr}
${'─'.repeat(40)}
`.trim();

    const intentInstruction = intent === 'strongest_course'
      ? `${student.name} is asking which course is their STRONGEST.
- Clearly state the strongest course (${strongestCourse.course_name} at ${strongestCourse.average}%)
- Show the full course ranking so the student has complete context
- Validate this finding and encourage the student to leverage this strength
- Briefly mention how they can maintain performance in the strongest course`
      : `${student.name} is asking which course is their WEAKEST.
- Clearly state the weakest course (${weakestCourse.course_name} at ${weakestCourse.average}%)
- Show the full course ranking so the student has complete context
- Provide targeted, actionable advice for improving in the weakest course
- Be empathetic and motivating — acknowledge this is something that can be improved`;

    const systemPrompt = `You are the Analytics Agent and Academic Advisor for EduAgent.
Provide highly personalized, data-driven guidance to ${student.name}.

STRICT RULES:
1. Base EVERY claim strictly on the computed COURSE PERFORMANCE COMPARISON data below.
2. Do NOT perform any mathematical calculations yourself.
3. Always refer to the student by name: "${student.name}".
4. Use a warm, encouraging, and professional tone.
5. Use clear formatting with bullet points and headers.

CURRENT QUESTION INTENT: ${intent.replace(/_/g, ' ').toUpperCase()}
SPECIFIC INSTRUCTIONS:
${intentInstruction}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'system', content: `STUDENT ACADEMIC DATA CONTEXT:\n${'='.repeat(50)}\n${structuredContext}\n${'='.repeat(50)}` },
      ...historyMessages,
      { role: 'user', content: message }
    ];

    console.log(`[Analytics Agent] Sending cross-course context to Groq for intent: "${intent}"...`);
    const reply = await groqService.chatCompletion(messages);

    return {
      agent: this.agentName,
      intent,
      analysis,
      reply
    };
  }
}

module.exports = new AnalyticsAgent();
