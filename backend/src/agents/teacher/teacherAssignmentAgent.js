const Student = require('../../models/Student');
const Assignment = require('../../models/Assignment');
const AssignmentSubmission = require('../../models/AssignmentSubmission');
const Course = require('../../models/Course');

class TeacherAssignmentAgent {
  constructor() {
    this.agentName = 'Teacher Assignment Agent';
  }

  /**
   * Handle teacher assignment queries locally without calling the LLM
   * @param {string} teacherId 
   * @param {string} courseId 
   * @param {string} message 
   * @param {Array} chatMessages 
   */
  async handleQuery(teacherId, courseId, message, chatMessages) {
    try {
      console.log('[TeacherAssignmentAgent] Processing query locally (Zero-LLM)...');
      const msg = message.toLowerCase().trim();

      const course = await Course.findOne({ course_id: courseId });
      if (!course) {
        return { reply: "❌ Could not find course information. Please select a valid course." };
      }

      // Gather assignments
      const assignments = await Assignment.find({ course_id: courseId });
      const students = await Student.find({ program_id: course.program_id });
      const studentMap = new Map(students.map(s => [s.student_id, s]));

      if (assignments.length === 0) {
        return { reply: `ℹ️ No assignments have been created yet for course **${course.course_name}**.` };
      }

      const assignmentSummaryList = [];

      for (const a of assignments) {
        const submissions = await AssignmentSubmission.find({ assignment_id: a._id });
        const submittedStudentIds = new Set(submissions.map(s => s.student_id));
        const pendingStudents = students.filter(s => !submittedStudentIds.has(s.student_id));

        const submissionRate = students.length > 0 ? parseFloat(((submissions.length / students.length) * 100).toFixed(1)) : 0;
        
        let highestScore = 0;
        submissions.forEach(s => {
          if (s.marks_obtained !== null && s.marks_obtained > highestScore) {
            highestScore = s.marks_obtained;
          }
        });

        // Check for late submissions (submitted_at > due_date)
        const lateSubmissions = submissions.filter(s => new Date(s.submitted_at) > new Date(a.due_date));

        assignmentSummaryList.push({
          title: a.title,
          dueDate: new Date(a.due_date).toDateString(),
          totalSubmitted: submissions.length,
          submissionRate,
          highestScore,
          totalLate: lateSubmissions.length,
          pendingCount: pendingStudents.length,
          pendingList: pendingStudents.map(ps => ps.name)
        });
      }

      const classAvgSubmissionRate = parseFloat(
        (assignmentSummaryList.reduce((sum, item) => sum + item.submissionRate, 0) / assignmentSummaryList.length).toFixed(1)
      );

      let reply = '';
      let chartData = null;

      if (msg.includes('missing') || msg.includes('pending') || msg.includes('who didn\'t') || msg.includes('no submission') || msg.includes('not submit')) {
        reply = `### ⚠️ Outstanding / Pending Assignment Submissions - ${course.course_name}\n\n`;
        reply += `List of students who have not yet submitted their assigned coursework:\n\n`;
        
        let hasPending = false;
        assignmentSummaryList.forEach(a => {
          if (a.pendingCount > 0) {
            hasPending = true;
            reply += `* **Assignment**: "${a.title}" (Due: ${a.dueDate})\n`;
            reply += `  * Missing Submissions: **${a.pendingCount} students**\n`;
            reply += `  * Pending Student List: *${a.pendingList.join(', ')}*\n\n`;
          }
        });

        if (!hasPending) {
          reply += `✨ **Perfect record!** No pending submissions found for any assignments. All students have submitted their tasks.\n`;
        }
      } 
      else {
        // Generic/Class submission status overview
        reply = `### 📝 Assignment Submissions & Completion Rates (${course.course_name})\n\n`;
        reply += `Class average assignment submission rate is **${classAvgSubmissionRate}%**:\n\n`;
        
        reply += `| Assignment Title | Due Date | Submitted | Rate | Late Submissions | Highest Marks |\n`;
        reply += `| :--------------- | :------- | :-------- | :--- | :--------------- | :------------ |\n`;
        assignmentSummaryList.forEach(a => {
          reply += `| **${a.title}** | ${a.dueDate} | ${a.totalSubmitted}/${students.length} | **${a.submissionRate}%** | ${a.totalLate} late | ${a.highestScore} marks |\n`;
        });

        chartData = {
          type: 'bar',
          data: {
            labels: assignmentSummaryList.map(a => a.title),
            datasets: [{
              label: 'Submission Rate (%)',
              data: assignmentSummaryList.map(a => a.submissionRate),
              backgroundColor: '#8b5cf6'
            }]
          },
          options: { responsive: true, plugins: { title: { display: true, text: `Assignment Completion Rates - ${course.course_name}` } } }
        };
      }

      return {
        agent: this.agentName,
        reply,
        chart: chartData
      };
    } catch (error) {
      console.error('[TeacherAssignmentAgent Error]:', error);
      return { reply: "❌ An error occurred while compiling assignment statistics. Please try again." };
    }
  }
}

module.exports = new TeacherAssignmentAgent();
