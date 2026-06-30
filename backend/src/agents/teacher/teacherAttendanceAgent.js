const Student = require('../../models/Student');
const Attendance = require('../../models/Attendance');
const Course = require('../../models/Course');

class TeacherAttendanceAgent {
  constructor() {
    this.agentName = 'Teacher Attendance Agent';
  }

  /**
   * Handle teacher attendance queries locally without calling the LLM
   * @param {string} teacherId 
   * @param {string} courseId 
   * @param {string} message 
   * @param {Array} chatMessages 
   */
  async handleQuery(teacherId, courseId, message, chatMessages) {
    try {
      console.log('[TeacherAttendanceAgent] Processing query locally (Zero-LLM)...');
      const msg = message.toLowerCase().trim();

      const course = await Course.findOne({ course_id: courseId });
      if (!course) {
        return { reply: "❌ Could not find course information. Please select a valid course." };
      }

      // Gather attendance logs
      const attendanceLogs = await Attendance.find({ course_id: courseId });
      const students = await Student.find({ program_id: course.program_id });
      const studentMap = new Map(students.map(s => [s.student_id, s]));

      if (attendanceLogs.length === 0) {
        return { reply: `ℹ️ No attendance sheets have been logged yet for course **${course.course_name}**.` };
      }

      // Calculate attendance per student
      const studentStats = {};
      attendanceLogs.forEach(log => {
        if (!studentStats[log.student_id]) {
          studentStats[log.student_id] = { present: 0, total: 0, studentName: studentMap.get(log.student_id)?.name || log.student_id };
        }
        studentStats[log.student_id].total++;
        if (log.status === 'Present') {
          studentStats[log.student_id].present++;
        }
      });

      const list = Object.entries(studentStats).map(([sid, data]) => {
        const rate = parseFloat(((data.present / data.total) * 100).toFixed(1));
        return { student_id: sid, name: data.studentName, rate };
      });

      const classAvg = parseFloat((list.reduce((sum, s) => sum + s.rate, 0) / list.length).toFixed(1));
      const atRisk = list.filter(s => s.rate < 75);
      const perfect = list.filter(s => s.rate === 100);

      // Sort by attendance rate ascending
      list.sort((a, b) => a.rate - b.rate);

      const lowestAttendance = list.slice(0, 5);
      const highestAttendance = [...list].sort((a, b) => b.rate - a.rate).slice(0, 5);

      let reply = '';
      let chartData = null;

      if (msg.includes('risk') || msg.includes('below 75') || msg.includes('defaulter')) {
        reply = `### ⚠️ Attendance Risk Log (<75% Attendance) - ${course.course_name}\n\n`;
        reply += `The university requires a minimum of **75%** attendance to qualify for the end semester examinations.\n\n`;
        
        if (atRisk.length > 0) {
          reply += `We have identified **${atRisk.length} students** currently at risk:\n\n`;
          reply += `| Student Name | Attendance Rate | Status | Action Required |\n`;
          reply += `| :----------- | :-------------- | :----- | :-------------- |\n`;
          atRisk.forEach(s => {
            const urgency = s.rate < 60 ? '🔴 Critical' : '🟡 Low Attendance';
            reply += `| ${s.name} | **${s.rate}%** | ${urgency} | Issue warning alert & notification |\n`;
          });
        } else {
          reply += `✨ **Excellent!** All students are above the 75% attendance threshold.\n`;
        }

        chartData = {
          type: 'bar',
          data: {
            labels: atRisk.map(s => s.name),
            datasets: [{
              label: 'Attendance Rate (%)',
              data: atRisk.map(s => s.rate),
              backgroundColor: '#ef4444'
            }]
          },
          options: { responsive: true, plugins: { title: { display: true, text: `Attendance Risk Students - ${course.course_name}` } } }
        };
      } 
      else if (msg.includes('perfect') || msg.includes('100')) {
        reply = `### 🌟 Perfect Attendance Honors (100%) - ${course.course_name}\n\n`;
        reply += `The following **${perfect.length} students** have logged perfect attendance (100% present):\n\n`;
        
        if (perfect.length > 0) {
          perfect.forEach(s => {
            reply += `- ⭐ **${s.name}**\n`;
          });
        } else {
          reply += `No students have logged 100% attendance across all sessions.\n`;
        }
      }
      else {
        // Class average attendance report
        reply = `### 📊 Class Attendance Summary (${course.course_name})\n\n`;
        reply += `* **Average Class Attendance**: **${classAvg}%**\n`;
        reply += `* **Perfect Attendance Count**: **${perfect.length} students**\n`;
        reply += `* **Attendance Risk Count (<75%)**: **${atRisk.length} students**\n\n`;
        
        reply += `#### Lowest Attendance Performers:\n`;
        reply += `| Student Name | Attendance % | Status |\n`;
        reply += `| :----------- | :----------- | :----- |\n`;
        lowestAttendance.forEach(s => {
          const status = s.rate < 75 ? '❌ At Risk' : '✅ Eligible';
          reply += `| ${s.name} | **${s.rate}%** | ${status} |\n`;
        });

        chartData = {
          type: 'bar',
          data: {
            labels: ['Class Average', 'At Risk Count', 'Perfect Count'],
            datasets: [{
              label: 'Attendance Summary Status',
              data: [classAvg, atRisk.length, perfect.length],
              backgroundColor: ['#6366f1', '#ef4444', '#10b981']
            }]
          },
          options: { responsive: true }
        };
      }

      return {
        agent: this.agentName,
        reply,
        chart: chartData
      };
    } catch (error) {
      console.error('[TeacherAttendanceAgent Error]:', error);
      return { reply: "❌ An error occurred while compiling attendance reports. Please try again." };
    }
  }
}

module.exports = new TeacherAttendanceAgent();
