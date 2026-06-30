const Student = require('../../models/Student');
const Attendance = require('../../models/Attendance');
const Result = require('../../models/Result');
const Course = require('../../models/Course');
const groqService = require('../../services/groqService');

class TeacherRecommendationAgent {
  constructor() {
    this.agentName = 'Teacher Recommendation Agent';
  }

  /**
   * Handle reasoning queries via Groq with compressed, highly-targeted context data
   */
  async handleQuery(teacherId, courseId, message, chatMessages) {
    try {
      console.log('[TeacherRecommendationAgent] Compressing context and querying Groq for reasoning...');
      const msg = message.toLowerCase().trim();

      const course = await Course.findOne({ course_id: courseId });
      if (!course) {
        return { reply: "❌ Could not find course information. Please select a valid course." };
      }

      // 1. Determine if a specific student is mentioned in the query
      let targetStudent = null;
      const students = await Student.find({ program_id: course.program_id });
      
      for (const s of students) {
        if (msg.includes(s.name.toLowerCase()) || msg.includes(s.student_id.toLowerCase())) {
          targetStudent = s;
          break;
        }
      }

      let dataSummary = '';

      if (targetStudent) {
        // OPTIMIZATION: Pull ONLY the targeted student's records to minimize tokens
        console.log(`[TeacherRecommendationAgent] Targeted Student Identified: ${targetStudent.name}`);
        const studentResults = await Result.find({ student_id: targetStudent.student_id, course_id: courseId });
        const studentAttendance = await Attendance.find({ student_id: targetStudent.student_id, course_id: courseId });

        const resultsStr = studentResults.map(r => `- ${r.exam_name}: ${r.marks}/${r.total_marks}`).join('\n');
        const presentCount = studentAttendance.filter(a => a.status === 'Present').length;
        const totalSessions = studentAttendance.length;
        const attRate = totalSessions > 0 ? ((presentCount / totalSessions) * 100).toFixed(1) : 0;

        dataSummary = `TARGET STUDENT INFORMATION:
Name: ${targetStudent.name} (ID: ${targetStudent.student_id})
Course: ${course.course_name}
Marks History:
${resultsStr || 'No marks logged.'}
Attendance Rate: ${attRate}% (${presentCount}/${totalSessions} sessions)`;
      } 
      else {
        // GENERAL CLASS OPTIMIZATION: Fetch ONLY key aggregate summaries and top risk profiles
        const results = await Result.find({ course_id: courseId });
        const attendanceLogs = await Attendance.find({ course_id: courseId });
        const studentMap = new Map(students.map(s => [s.student_id, s]));

        // Calculate student averages
        const studentScores = {};
        results.forEach(r => {
          if (!studentScores[r.student_id]) {
            studentScores[r.student_id] = { sum: 0, count: 0, name: studentMap.get(r.student_id)?.name || r.student_id };
          }
          studentScores[r.student_id].sum += r.marks;
          studentScores[r.student_id].count++;
        });

        const sortedAverages = Object.entries(studentScores)
          .map(([sid, d]) => ({ student_id: sid, name: d.name, average: parseFloat((d.sum / d.count).toFixed(1)) }))
          .sort((a, b) => a.average - b.average);

        const weakPerformers = sortedAverages.filter(s => s.average < 60).slice(0, 5);

        // Attendance risks
        const attendanceRates = {};
        attendanceLogs.forEach(l => {
          if (!attendanceRates[l.student_id]) {
            attendanceRates[l.student_id] = { present: 0, total: 0, name: studentMap.get(l.student_id)?.name || l.student_id };
          }
          attendanceRates[l.student_id].total++;
          if (l.status === 'Present') attendanceRates[l.student_id].present++;
        });

        const weakAttendance = Object.entries(attendanceRates)
          .map(([sid, d]) => ({ student_id: sid, name: d.name, rate: parseFloat(((d.present / d.total) * 100).toFixed(1)) }))
          .filter(s => s.rate < 75)
          .slice(0, 5);

        dataSummary = `CLASS SUMMARY INFO FOR ${course.course_name}:
Total Enrolled: ${students.length}
Academically Weak Students (Bottom 5):
${weakPerformers.map(s => `- ${s.name} (${s.average}%)`).join('\n') || 'None.'}

Attendance At-Risk Students (Bottom 5):
${weakAttendance.map(s => `- ${s.name} (${s.rate}% attendance)`).join('\n') || 'None.'}`;
      }

      // Build structured system prompt
      const systemPrompt = `You are the Teacher Recommendation Agent for EduAgent-V2.
Your goal is to provide insightful mentoring recommendations, coaching tips, or individual student analysis.
Keep your answer professional, clear, and actionable.

${dataSummary}

INSTRUCTIONS:
1. Explain student or class academic trends using the data above.
2. Outline specific remedial planning (e.g., remedial slots, focused chapters, parent alerts).
3. Do NOT make up any marks or attendance percentages not present in the data summary above.
4. Keep the output extremely focused, direct, and formatted in clean Markdown.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...chatMessages.slice(-3), // Prune history to last 3 messages to avoid token bloat
        { role: 'user', content: message }
      ];

      const reply = await groqService.chatCompletion(messages);

      return {
        agent: this.agentName,
        reply
      };
    } catch (error) {
      console.error('[TeacherRecommendationAgent Error]:', error);
      return { reply: "❌ An error occurred while generating mentoring recommendations. Please try again." };
    }
  }
}

module.exports = new TeacherRecommendationAgent();
