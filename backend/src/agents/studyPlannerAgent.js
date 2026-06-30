/**
 * StudyPlannerAgent — Personalized PDF Study Plan Generator
 *
 * Flow:
 *  1. Classify whether it's a study plan request
 *  2. Fetch all MongoDB data (student, program, course, results, topics, outcomes, exam)
 *  3. Compute analytics (same pattern as AnalyticsAgent)
 *  4. Retrieve RAG context for weak topics if PDF exists
 *  5. Call Groq Llama 3.3 to generate structured plan sections
 *  6. Pass all data to pdfGeneratorService → build PDF
 *  7. Return { agent, reply, downloadUrl, preview } — NOT raw text
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
const groqService = require('../services/groqService');
const ragService = require('../services/ragService');
const retriever = require('../rag/retriever');
const { generateStudyPlanPDF } = require('../services/pdfGeneratorService');

// ─── Thresholds (consistent with AnalyticsAgent) ─────────────────────────────
const WEAK_THRESHOLD   = 60;
const STRONG_THRESHOLD = 80;
const MAX_RAG_CHUNKS   = 3;
const MAX_WEAK_RAG     = 3;
const PLAN_DURATION    = '14 Days';

class StudyPlannerAgent {
  constructor() {
    this.agentName = 'Study Planner Agent';
  }

  // ─── Analytics Helpers (mirrors AnalyticsAgent) ───────────────────────────

  computeResultsSummary(results) {
    let internal1 = null, internal2 = null, internal3 = null;
    results.forEach(r => {
      const name = r.exam_name.toLowerCase();
      if (name.includes('internal 1')) internal1 = r.marks;
      else if (name.includes('internal 2')) internal2 = r.marks;
      else if (name.includes('internal 3')) internal3 = r.marks;
    });
    const marksArray = [internal1, internal2, internal3].filter(m => m !== null);
    const average  = marksArray.length > 0 ? parseFloat((marksArray.reduce((a, b) => a + b, 0) / marksArray.length).toFixed(2)) : 0;
    const highest  = marksArray.length > 0 ? Math.max(...marksArray) : 0;
    const lowest   = marksArray.length > 0 ? Math.min(...marksArray) : 0;

    let trend = 'Stable';
    if (internal1 !== null && internal3 !== null)      trend = internal3 > internal1 ? 'Improving' : internal3 < internal1 ? 'Declining' : 'Stable';
    else if (internal1 !== null && internal2 !== null) trend = internal2 > internal1 ? 'Improving' : internal2 < internal1 ? 'Declining' : 'Stable';

    let improvementPct = 0;
    if (internal1 !== null && internal3 !== null && internal1 !== 0)
      improvementPct = parseFloat((((internal3 - internal1) / internal1) * 100).toFixed(2));
    else if (internal1 !== null && internal2 !== null && internal1 !== 0)
      improvementPct = parseFloat((((internal2 - internal1) / internal1) * 100).toFixed(2));

    return { internal1, internal2, internal3, average, highest, lowest, trend, improvementPct };
  }

  computeTopics(topics, average) {
    const weakTopics = [], averageTopics = [], strongTopics = [], all = [];
    topics.forEach(t => {
      const charSum = t.topic_name.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
      const offset  = (charSum % 31) - 15;
      let score = Math.round(average + offset);
      score = Math.min(100, Math.max(40, score));
      const status = score >= STRONG_THRESHOLD ? 'Strong' : score >= WEAK_THRESHOLD ? 'Average' : 'Weak';
      all.push({ name: t.topic_name, score, status });
      if (status === 'Strong')  strongTopics.push({ name: t.topic_name, score });
      else if (status === 'Average') averageTopics.push({ name: t.topic_name, score });
      else weakTopics.push({ name: t.topic_name, score });
    });
    weakTopics.sort((a, b) => a.score - b.score);
    return { weakTopics, averageTopics, strongTopics, all };
  }

  computeCourseOutcomes(outcomes, average) {
    const outcomeList = outcomes.map(o => {
      const charSum = o.outcome_name.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
      const offset  = (charSum % 21) - 10;
      let attainment = Math.round(average + offset);
      attainment = Math.min(100, Math.max(30, attainment));
      return { outcome: o.outcome_name, attainment };
    });
    const sorted = [...outcomeList].sort((a, b) => b.attainment - a.attainment);
    const highestCO = outcomeList.length > 0 ? `${sorted[0].outcome} (${sorted[0].attainment}%)` : 'N/A';
    const lowestCO  = outcomeList.length > 0 ? `${sorted[sorted.length - 1].outcome} (${sorted[sorted.length - 1].attainment}%)` : 'N/A';
    return { outcomeList, highestCO, lowestCO };
  }

  computeExamReadiness(average, weakCount) {
    if (average >= 80 && weakCount === 0) return 'Ready';
    if (average < 60 || weakCount >= 3)   return 'High Risk';
    return 'Needs Revision';
  }

  // ─── RAG Context ──────────────────────────────────────────────────────────

  async buildRagContext(studentId, courseId, weakTopics) {
    const hasPdfs = await ragService.hasUploadedDocuments(studentId, courseId).catch(() => false);
    if (!hasPdfs) return null;

    const sections = [];
    const topicsToQuery = weakTopics.slice(0, MAX_WEAK_RAG);
    for (const t of topicsToQuery) {
      const chunks = await retriever.retrieveContext(`${t.name} concepts study notes`, studentId, courseId, MAX_RAG_CHUNKS).catch(() => []);
      if (chunks && chunks.length > 0) {
        const text = chunks.map((c, i) => `[${i + 1}] ${c.pageContent.trim()}`).join('\n');
        sections.push(`Topic: ${t.name}\n${text}`);
      }
    }
    return sections.length > 0 ? sections.join('\n\n---\n\n') : null;
  }

  // ─── Groq Plan Generator ─────────────────────────────────────────────────

  /**
   * Ask Groq to generate plan sections as JSON.
   * Returns a parsed object with dailyTimetable, weeklyPlan, resources,
   * revisionStrategy, aiTips, checklist.
   */
  async generatePlanSections(studentName, courseName, average, trend, weakTopics, strongTopics, examReadiness, upcomingExam, ragContext, historyMessages, attendancePercentage, pendingAssignments) {
    const weakStr   = weakTopics.length > 0 ? weakTopics.map(t => `${t.name} (${t.score}%)`).join(', ') : 'None';
    const strongStr = strongTopics.length > 0 ? strongTopics.map(t => `${t.name} (${t.score}%)`).join(', ') : 'None';
    const examStr   = upcomingExam ? `${upcomingExam.exam_name} on ${upcomingExam.exam_date} (${upcomingExam.start_time}–${upcomingExam.end_time}) in ${upcomingExam.room}` : 'No upcoming exam';
    const ragStr    = ragContext ? `\nSTUDY MATERIAL EXCERPTS (from uploaded PDF):\n${ragContext}\n` : '';
    const pendingStr = pendingAssignments.length > 0 ? pendingAssignments.map(a => `"${a.title}" (Due: ${a.due_date.toISOString().split('T')[0]})`).join(', ') : 'None';

    const systemPrompt = `You are the Study Planner Agent for EduAgent. Generate a personalized study plan for ${studentName} studying ${courseName}.

STUDENT DATA:
- Average: ${average}%
- Trend: ${trend}
- Attendance: ${attendancePercentage}%
- Pending Assignments to prioritize: ${pendingStr}
- Weak Topics (< 60%): ${weakStr}
- Strong Topics (≥ 80%): ${strongStr}
- Exam Readiness: ${examReadiness}
- Upcoming Exam: ${examStr}
${ragStr}

RULES:
1. Focus revision heavily on weak topics. Allocate more days/sessions to them.
2. Schedule specific times/days to complete pending assignments.
3. Reference uploaded study material naturally when relevant.
4. Be specific, practical, and encouraging.
5. For the daily timetable, cover 7 days (Mon–Sun).
6. For the weekly plan, cover 2 weeks with 7 tasks each.

Respond ONLY with a valid JSON object in this exact structure (no markdown, no explanation outside JSON):
{
  "dailyTimetable": [
    { "morning": "...", "afternoon": "...", "evening": "..." },
    ... (7 entries for Mon-Sun)
  ],
  "weeklyPlan": [
    { "week": "Week 1 — Foundation & Weak Topics", "tasks": ["Day 1: ...", "Day 2: ...", "Day 3: ...", "Day 4: ...", "Day 5: ...", "Day 6: ...", "Day 7: ..."] },
    { "week": "Week 2 — Practice & Revision", "tasks": ["Day 1: ...", "Day 2: ...", "Day 3: ...", "Day 4: ...", "Day 5: ...", "Day 6: ...", "Day 7: ..."] }
  ],
  "resources": ["...", "...", "...", "...", "..."],
  "revisionStrategy": ["...", "...", "...", "...", "..."],
  "aiTips": ["...", "...", "...", "...", "..."],
  "checklist": ["...", "...", "...", "...", "...", "...", "...", "...", "...", "..."]
}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...historyMessages.slice(-4),
      { role: 'user', content: `Generate a 14-day personalized study plan for ${studentName} in ${courseName}` }
    ];

    console.log('[Study Planner Agent] Requesting structured plan JSON from Groq...');
    const raw = await groqService.chatCompletion(messages);

    // Parse the JSON — strip any markdown fences if model adds them
    try {
      const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const firstBrace = cleaned.indexOf('{');
      const lastBrace  = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      }
    } catch (e) {
      console.warn('[Study Planner Agent] JSON parse failed, using fallback structure:', e.message);
    }

    // Fallback — minimal structure if JSON parsing fails
    return this.buildFallbackPlanSections(studentName, courseName, weakTopics);
  }

  buildFallbackPlanSections(studentName, courseName, weakTopics) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const wt = weakTopics.map(t => t.name);

    const dailyTimetable = days.map((_, i) => ({
      morning:   wt[i % wt.length] ? `Study ${wt[i % wt.length]}` : `Review ${courseName} notes`,
      afternoon: 'Practice problems from textbook',
      evening:   'Revise today\'s material & notes'
    }));

    const week1Tasks = days.map((d, i) => `${d}: Focus on ${wt[i % Math.max(wt.length, 1)] || courseName}`);
    const week2Tasks = days.map(d => `${d}: Practice problems & mock test preparation`);

    return {
      dailyTimetable,
      weeklyPlan: [
        { week: 'Week 1 — Foundation & Weak Topics', tasks: week1Tasks },
        { week: 'Week 2 — Practice & Revision',      tasks: week2Tasks }
      ],
      resources: [
        `${courseName} textbook (recommended chapters)`,
        'NPTEL online lectures',
        'Previous year question papers',
        'GeeksforGeeks / Khan Academy for concept clarity',
        'Self-made notes from classroom sessions'
      ],
      revisionStrategy: [
        'Dedicate the first week entirely to weak topics',
        'Use the Pomodoro technique: 25 min study + 5 min break',
        'Summarize each topic in your own words after studying',
        'Attempt at least 10 practice problems per topic',
        'Do a full mock test in Week 2 before the exam'
      ],
      aiTips: [
        `Your average of ${weakTopics.length > 0 ? 'below 80%' : '80%+'} means ${weakTopics.length > 0 ? 'targeted revision is essential' : 'maintain momentum'}`,
        'Study during your peak focus hours — usually morning for most students',
        'Teach concepts to someone else to validate your understanding',
        'Take short breaks to prevent mental fatigue during long sessions',
        'Track your progress daily and celebrate small wins'
      ],
      checklist: [
        'Complete all weak topic notes',
        'Solve 20 practice problems per weak topic',
        'Attend all remaining classes before exam',
        'Review previous year questions',
        'Summarize each CO in 5 bullet points',
        'Complete at least one full mock test',
        'Revise formulas and key definitions',
        'Create a mind map for each topic',
        'Sleep 7-8 hours before exam day',
        'Review all notes one day before exam'
      ]
    };
  }

  // ─── Main Handler ────────────────────────────────────────────────────────

  /**
   * Handle a study plan query.
   * Returns { agent, reply, downloadUrl, preview } — never raw text.
   */
  async handleQuery(studentId, courseId, message, historyMessages = []) {
    // ===== BREAKPOINT 36 =====
    // Mentor Demo:
    // Request enters Study Planner Agent.
    // DB Queries (Promise.all) fetch student, results, syllabus topics, outcomes, exams, and attendance.
    try {
      console.log(`[Study Planner Agent] Generating personalized PDF study plan for student: ${studentId}, course: ${courseId}`);

      // ── 1. Fetch student & program ────────────────────────────────────────
      const student = await Student.findOne({ student_id: studentId });
      if (!student) {
        return {
          agent: this.agentName,
          reply: `Student with ID '${studentId}' not found. Please check your student profile.`,
          downloadUrl: null,
          preview: null
        };
      }

      const program    = await Program.findOne({ program_id: student.program_id });
      const programName = program ? program.program_name : student.program_id;

      // ── 2. Fetch course ───────────────────────────────────────────────────
      const course    = courseId ? await Course.findOne({ course_id: courseId }) : null;
      const courseName = course ? course.course_name : (courseId || 'Your Course');

      // ── 3. Fetch academic data & ERP logs in Parallel ─────────────────────
      const [results, topicDocs, outcomeDocs, upcomingExam, attendanceLogs, assignments, submissions] = await Promise.all([
        Result.find({ student_id: studentId, course_id: courseId }),
        Topic.find({ course_id: courseId }),
        Outcome.find({ course_id: courseId }),
        ExamSchedule.findOne({ course_id: courseId }, { _id: 0, __v: 0 }),
        Attendance.find({ student_id: studentId, course_id: courseId }),
        Assignment.find({ course_id: courseId }),
        AssignmentSubmission.find({ student_id: studentId })
      ]);

      const resultsSummary = results && results.length > 0
        ? this.computeResultsSummary(results)
        : { internal1: null, internal2: null, internal3: null, average: 75, highest: 75, lowest: 75, trend: 'Stable', improvementPct: 0 };
      const { internal1, internal2, internal3, average, highest, lowest, trend, improvementPct } = resultsSummary;

      // Calculate Attendance stats from DB
      const totalAtt = attendanceLogs.length;
      const presentAtt = attendanceLogs.filter(a => a.status === 'Present').length;
      const attendancePercentage = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 85;

      // Calculate pending assignments
      const pendingAssignments = [];
      assignments.forEach(a => {
        const sub = submissions.find(s => s.assignment_id.toString() === a._id.toString());
        if (!sub) {
          pendingAssignments.push({
            title: a.title,
            due_date: a.due_date
          });
        }
      });

      // ── 4. Topic performance ──────────────────────────────────────────────
      const { weakTopics, averageTopics, strongTopics } = this.computeTopics(topicDocs, average);

      // ── 5. Course outcomes ────────────────────────────────────────────────
      const { outcomeList, highestCO, lowestCO } = this.computeCourseOutcomes(outcomeDocs, average);

      // ── 6. Exam schedule & readiness ──────────────────────────────────────
      const examReadiness = this.computeExamReadiness(average, weakTopics.length);

      // ── 7. RAG context (weak topic targeted) ──────────────────────────────
      const ragContext = await this.buildRagContext(studentId, courseId, weakTopics);

      // ===== BREAKPOINT 37 =====
      // Mentor Demo:
      // Gathering metrics and calling generatePlanSections to generate daily/weekly plan JSON via Groq.
      const planSections = await this.generatePlanSections(
        student.name, courseName, average, trend,
        weakTopics, strongTopics, examReadiness, upcomingExam,
        ragContext, historyMessages, attendancePercentage, pendingAssignments
      );

      // ===== BREAKPOINT 38 =====
      // Mentor Demo:
      // Passing plan JSON and metrics to pdfGeneratorService to build the binary PDF document.
      // Returns: fileId.
      const generatedAt = new Date().toISOString();

      const planData = {
        student,
        programName,
        courseName,
        courseId,
        internals: { internal1, internal2, internal3 },
        average,
        highest,
        lowest,
        trend,
        improvementPct,
        weakTopics,
        averageTopics,
        strongTopics,
        courseOutcomes: outcomeList,
        highestCO,
        lowestCO,
        examReadiness,
        upcomingExam: upcomingExam ? {
          exam_name:  upcomingExam.exam_name,
          exam_date:  upcomingExam.exam_date,
          start_time: upcomingExam.start_time,
          end_time:   upcomingExam.end_time,
          room:       upcomingExam.room
        } : null,
        planSections,
        duration:    PLAN_DURATION,
        generatedAt
      };

      console.log('[Study Planner Agent] Building PDF with pdfGeneratorService...');
      const { fileId } = await generateStudyPlanPDF(planData);
      console.log(`[Study Planner Agent] PDF generated successfully. File ID: ${fileId}`);

      const downloadUrl = `/api/study-plans/download/${fileId}`;

      // ===== BREAKPOINT 39 =====
      // Mentor Demo:
      // Returning study plan payload containing downloadUrl and preview variables back to client.
      return {
        agent:       this.agentName,
        reply:       `Your personalized study plan for **${courseName}** has been generated successfully! It covers ${PLAN_DURATION} of structured study, ${weakTopics.length} weak topic(s) to focus on, daily timetable, weekly goals, and AI-powered revision tips.`,
        downloadUrl,
        preview: {
          course:      courseName,
          duration:    PLAN_DURATION,
          generatedAt,
          weakCount:   weakTopics.length,
          strongCount: strongTopics.length,
          average,
          trend,
          examReadiness
        }
      };

    } catch (error) {
      console.error('[StudyPlannerAgent Error]:', error);
      throw error;
    }
  }
}

module.exports = new StudyPlannerAgent();
