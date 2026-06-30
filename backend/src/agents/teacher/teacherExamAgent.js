const Student = require('../../models/Student');
const Attendance = require('../../models/Attendance');
const Result = require('../../models/Result');
const ExamSchedule = require('../../models/ExamSchedule');
const Course = require('../../models/Course');

class TeacherExamAgent {
  constructor() {
    this.agentName = 'Teacher Exam Agent';
  }

  /**
   * Handle teacher exam queries locally without calling the LLM
   * @param {string} teacherId 
   * @param {string} courseId 
   * @param {string} message 
   * @param {Array} chatMessages 
   */
  async handleQuery(teacherId, courseId, message, chatMessages) {
    try {
      console.log('[TeacherExamAgent] Processing query locally (Zero-LLM)...');
      const msg = message.toLowerCase().trim();

      const course = await Course.findOne({ course_id: courseId });
      if (!course) {
        return { reply: "❌ Could not find course information. Please select a valid course." };
      }

      // 1. Fetch upcoming exam schedule
      const schedules = await ExamSchedule.find({ course_id: courseId });

      // 2. Fetch attendance logs to calculate eligibility
      const attendanceLogs = await Attendance.find({ course_id: courseId });
      const students = await Student.find({ program_id: course.program_id });
      const studentMap = new Map(students.map(s => [s.student_id, s]));

      const studentAttendance = {};
      attendanceLogs.forEach(log => {
        if (!studentAttendance[log.student_id]) {
          studentAttendance[log.student_id] = { present: 0, total: 0, studentName: studentMap.get(log.student_id)?.name || log.student_id };
        }
        studentAttendance[log.student_id].total++;
        if (log.status === 'Present') {
          studentAttendance[log.student_id].present++;
        }
      });

      const eligibilityList = Object.entries(studentAttendance).map(([sid, data]) => {
        const rate = parseFloat(((data.present / data.total) * 100).toFixed(1));
        const eligible = rate >= 75;
        return { student_id: sid, name: data.studentName, rate, eligible };
      });

      const eligibleCount = eligibilityList.filter(s => s.eligible).length;
      const ineligibleCount = eligibilityList.filter(s => !s.eligible).length;
      const ineligibleList = eligibilityList.filter(s => !s.eligible);

      // 3. Fetch overall pass / fail stats for End Sem
      const results = await Result.find({ course_id: courseId, exam_name: 'End Semester' });
      const appearedCount = results.length;
      const passedCount = results.filter(r => r.marks >= 40).length;
      const failedCount = results.filter(r => r.marks < 40).length;
      const passPercentage = appearedCount > 0 ? parseFloat(((passedCount / appearedCount) * 100).toFixed(1)) : 0;
      const failPercentage = appearedCount > 0 ? parseFloat(((failedCount / appearedCount) * 100).toFixed(1)) : 0;

      const failedStudentsList = results
        .filter(r => r.marks < 40)
        .map(r => ({ name: studentMap.get(r.student_id)?.name || r.student_id, marks: r.marks }));

      let reply = '';
      let chartData = null;

      if (msg.includes('eligible') || msg.includes('eligibility') || msg.includes('attendance')) {
        reply = `### 📋 End Semester Examination Eligibility Status - ${course.course_name}\n\n`;
        reply += `Summary of student eligibility based on the **75% minimum attendance rule**:\n\n`;
        reply += `* **Total Eligible Students**: **${eligibleCount}**\n`;
        reply += `* **Total Ineligible Students**: **${ineligibleCount}**\n\n`;

        if (ineligibleList.length > 0) {
          reply += `#### ❌ Blocked/Ineligible Students list:\n`;
          reply += `| Student Name | Current Attendance Rate | Status |\n`;
          reply += `| :----------- | :---------------------- | :----- |\n`;
          ineligibleList.forEach(s => {
            reply += `| ${s.name} | **${s.rate}%** | Debarred from Exam |\n`;
          });
        } else {
          reply += `✨ **Excellent!** All students meet the minimum attendance requirement and are eligible for the exam.\n`;
        }
      } 
      else if (msg.includes('pass') || msg.includes('fail') || msg.includes('result') || msg.includes('appeared')) {
        reply = `### 📊 End Semester Exam Performance Results (${course.course_name})\n\n`;
        reply += `Here is the academic pass/fail analysis of the class based on the End Semester Examination:\n\n`;
        reply += `* **Students Appeared**: **${appearedCount}**\n`;
        reply += `* **Students Passed**: **${passedCount}** (${passPercentage}%)\n`;
        reply += `* **Students Failed**: **${failedCount}** (${failPercentage}%)\n\n`;

        if (failedStudentsList.length > 0) {
          reply += `#### ❌ Failed Students list (Marks < 40):\n`;
          reply += `| Student Name | Marks Obtained | Status |\n`;
          reply += `| :----------- | :------------- | :----- |\n`;
          failedStudentsList.forEach(s => {
            reply += `| ${s.name} | **${s.marks}/100** | Fail |\n`;
          });
        } else {
          reply += `🎉 **Zero Failures!** All students passed the End Semester Exam.\n`;
        }

        chartData = {
          type: 'pie',
          data: {
            labels: ['Passed', 'Failed'],
            datasets: [{
              label: 'End Sem Results',
              data: [passedCount, failedCount],
              backgroundColor: ['#10b981', '#ef4444']
            }]
          },
          options: { responsive: true }
        };
      }
      else {
        // Exam timetable/schedule
        reply = `### 📅 Academic Examination Schedules - ${course.course_name}\n\n`;
        
        if (schedules.length > 0) {
          reply += `Here are the scheduled exams for **${course.course_name}**:\n\n`;
          reply += `| Exam Name | Date & Time | Room | Duration | Max Marks |\n`;
          reply += `| :-------- | :---------- | :--- | :------- | :-------- |\n`;
          schedules.forEach(s => {
            reply += `| **${s.exam_name}** | ${new Date(s.date).toDateString()} | ${s.room || 'LH-101'} | ${s.duration} | ${s.max_marks || 100} |\n`;
          });
        } else {
          reply += `ℹ️ No upcoming exam schedule has been released yet for this course.\n`;
        }
      }

      return {
        agent: this.agentName,
        reply,
        chart: chartData
      };
    } catch (error) {
      console.error('[TeacherExamAgent Error]:', error);
      return { reply: "❌ An error occurred while compiling exam metrics. Please try again." };
    }
  }
}

module.exports = new TeacherExamAgent();
