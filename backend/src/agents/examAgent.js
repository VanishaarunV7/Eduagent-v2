const Student = require('../models/Student');
const Course = require('../models/Course');
const ExamSchedule = require('../models/ExamSchedule');
const groqService = require('../services/groqService');

class ExamAgent {
  constructor() {
    this.agentName = 'Exam Agent';
  }

  /**
   * Handle exam schedule or room query
   * @param {string} studentId 
   * @param {string} courseId 
   * @param {string} message 
   * @returns {Promise<string>}
   */
  async handleQuery(studentId, courseId, message, historyMessages = []) {
    try {
      // 1. Fetch Student from MongoDB
      const student = await Student.findOne({ student_id: studentId });
      if (!student) {
        return `Student with ID '${studentId}' not found.`;
      }

      // 2. Fetch enrolled courses or targeted course
      let targetCourses = [];
      if (courseId) {
        const course = await Course.findOne({ course_id: courseId });
        if (course) {
          targetCourses = [course];
        }
      }

      if (targetCourses.length === 0) {
        // Find all enrolled courses under student's program
        targetCourses = await Course.find({ program_id: student.program_id });
      }

      const courseIds = targetCourses.map(c => c.course_id);
      const courseMap = {};
      targetCourses.forEach(c => {
        courseMap[c.course_id] = c.course_name;
      });

      // 3. Retrieve Exam Schedule records
      const schedules = await ExamSchedule.find({ course_id: { $in: courseIds } });

      // 4. Format context
      const formattedExams = schedules.map((exam, index) => {
        const courseName = courseMap[exam.course_id] || exam.course_id;
        return `${index + 1}. Course: ${courseName} (${exam.course_id})
   - Exam Name: ${exam.exam_name}
   - Date: ${exam.exam_date}
   - Time: ${exam.start_time} - ${exam.end_time}
   - Room Number: ${exam.room}`;
      }).join('\n\n');

      const context = `STUDENT PROFILE:
- Name: ${student.name}
- Student ID: ${student.student_id}

UPCOMING EXAM SCHEDULE:
=======================
${formattedExams || 'No upcoming final exams scheduled for enrolled courses.'}
=======================`;

      // 5. Call Groq
      const systemPrompt = `You are the specialized Exam Agent for EduAgent.
Your job is to provide students with clear, accurate information regarding their upcoming exams, exam timetables, room assignments, and scheduling reminders.

RULES:
1. Base your response strictly on the UPCOMING EXAM SCHEDULE context provided below.
2. Present the exam timetable using clear formatting, Markdown bullet points, or tables.
3. Be friendly and wish the student luck if appropriate.
4. If there are no exams scheduled, state that clearly.
5. Do not fabricate dates or room numbers.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'system', content: `EXAM CONTEXT:\n=======================\n${context}\n=======================\n` },
        ...historyMessages,
        { role: 'user', content: message }
      ];

      console.log('[Exam Agent] Querying Groq for exam response...');
      return await groqService.chatCompletion(messages);

    } catch (error) {
      console.error('[ExamAgent Error]:', error);
      throw error;
    }
  }
}

module.exports = new ExamAgent();
