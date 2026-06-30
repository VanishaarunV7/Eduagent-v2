const Student = require('../../models/Student');
const Result = require('../../models/Result');
const Course = require('../../models/Course');

class TeacherAnalyticsAgent {
  constructor() {
    this.agentName = 'Teacher Analytics Agent';
  }

  /**
   * Handle teacher analytics queries locally without calling the LLM
   * @param {string} teacherId 
   * @param {string} courseId 
   * @param {string} message 
   * @param {Array} chatMessages 
   */
  async handleQuery(teacherId, courseId, message, chatMessages) {
    try {
      console.log('[TeacherAnalyticsAgent] Processing query locally (Zero-LLM)...');
      const msg = message.toLowerCase().trim();

      const course = await Course.findOne({ course_id: courseId });
      if (!course) {
        return { reply: "❌ Could not find course information. Please select a valid course." };
      }

      // Gather student results data for this course
      const results = await Result.find({ course_id: courseId });
      const students = await Student.find({ program_id: course.program_id });
      const studentMap = new Map(students.map(s => [s.student_id, s]));

      if (results.length === 0) {
        return { reply: `ℹ️ No marks data has been uploaded yet for course **${course.course_name}**.` };
      }

      // Compute statistics
      let classAverage = 0;
      let highestMarks = 0;
      let lowestMarks = 100;
      let highestStudent = 'N/A';
      let lowestStudent = 'N/A';
      const studentScores = {};

      results.forEach(r => {
        if (!studentScores[r.student_id]) {
          studentScores[r.student_id] = { sum: 0, count: 0, studentName: studentMap.get(r.student_id)?.name || r.student_id };
        }
        studentScores[r.student_id].sum += r.marks;
        studentScores[r.student_id].count += 1;
      });

      const studentAverages = Object.entries(studentScores).map(([sid, data]) => {
        const avg = parseFloat((data.sum / data.count).toFixed(2));
        if (avg > highestMarks) {
          highestMarks = avg;
          highestStudent = data.studentName;
        }
        if (avg < lowestMarks) {
          lowestMarks = avg;
          lowestStudent = data.studentName;
        }
        return { student_id: sid, name: data.studentName, average: avg };
      });

      const totalStudents = studentAverages.length;
      classAverage = parseFloat((studentAverages.reduce((sum, s) => sum + s.average, 0) / totalStudents).toFixed(2));

      // Calculate Median
      const sortedAverages = [...studentAverages].map(s => s.average).sort((a, b) => a - b);
      let median = 0;
      const mid = Math.floor(sortedAverages.length / 2);
      if (sortedAverages.length % 2 === 0) {
        median = parseFloat(((sortedAverages[mid - 1] + sortedAverages[mid]) / 2).toFixed(2));
      } else {
        median = sortedAverages[mid];
      }

      // Calculate Standard Deviation
      const variance = studentAverages.reduce((sum, s) => sum + Math.pow(s.average - classAverage, 2), 0) / totalStudents;
      const stdDev = parseFloat(Math.sqrt(variance).toFixed(2));

      // Sort topper rank list
      const sortedStudents = [...studentAverages].sort((a, b) => b.average - a.average);

      // Weak students (average < 60)
      const weakStudentsList = studentAverages.filter(s => s.average < 60);

      // Grade distribution
      const grades = { 'Excellent (>=90)': 0, 'A Grade (75-89)': 0, 'B Grade (60-74)': 0, 'C Grade (40-59)': 0, 'Fail (<40)': 0 };
      studentAverages.forEach(s => {
        if (s.average >= 90) grades['Excellent (>=90)']++;
        else if (s.average >= 75) grades['A Grade (75-89)']++;
        else if (s.average >= 60) grades['B Grade (60-74)']++;
        else if (s.average >= 40) grades['C Grade (40-59)']++;
        else grades['Fail (<40)']++;
      });

      let reply = '';
      let chartData = null;

      // Intent logic matching and response formatting
      if (msg.includes('topper') || msg.includes('rank') || msg.includes('top 10') || msg.includes('top10')) {
        reply = `### 🏆 Class Rank List & Toppers (${course.course_name})\n\n`;
        reply += `Here are the top performing students in **${course.course_name}** based on their average marks:\n\n`;
        reply += `| Rank | Student Name | Average Score |\n`;
        reply += `| :--- | :----------- | :------------ |\n`;
        sortedStudents.slice(0, 10).forEach((s, idx) => {
          const medal = idx === 0 ? '🥇 ' : (idx === 1 ? '🥈 ' : (idx === 2 ? '🥉 ' : ''));
          reply += `| **${idx + 1}** | ${medal}${s.name} | **${s.average}%** |\n`;
        });
        
        chartData = {
          type: 'bar',
          data: {
            labels: sortedStudents.slice(0, 10).map(s => s.name),
            datasets: [{
              label: 'Average Marks (%)',
              data: sortedStudents.slice(0, 10).map(s => s.average),
              backgroundColor: '#6366f1'
            }]
          },
          options: { responsive: true, plugins: { title: { display: true, text: `Top 10 Performers - ${course.course_name}` } } }
        };
      } 
      else if (msg.includes('bottom') || msg.includes('lowest') || msg.includes('weak student') || msg.includes('need mentoring') || msg.includes('risk')) {
        reply = `### ⚠️ Academic Performance Risk List (${course.course_name})\n\n`;
        reply += `The following students require mentoring or extra coaching as their average marks are below the **60%** benchmark:\n\n`;
        
        if (weakStudentsList.length > 0) {
          reply += `| Student Name | Average Score | Status | Action Required |\n`;
          reply += `| :----------- | :------------ | :----- | :-------------- |\n`;
          weakStudentsList.forEach(s => {
            const status = s.average < 40 ? '🔴 Critical Fail' : '🟡 Borderline Weak';
            const action = s.average < 40 ? 'Remedial coaching & Parental notification' : 'Revision session & Assignment check';
            reply += `| ${s.name} | **${s.average}%** | ${status} | ${action} |\n`;
          });
        } else {
          reply += `✨ **Great news!** No students in this class scored below 60% average. All students are meeting expectations.\n`;
        }

        chartData = {
          type: 'bar',
          data: {
            labels: sortedStudents.slice(-5).reverse().map(s => s.name),
            datasets: [{
              label: 'Lowest Average Marks (%)',
              data: sortedStudents.slice(-5).reverse().map(s => s.average),
              backgroundColor: '#ef4444'
            }]
          },
          options: { responsive: true, plugins: { title: { display: true, text: `Lowest 5 Performers - ${course.course_name}` } } }
        };
      }
      else if (msg.includes('grade') || msg.includes('distribution') || msg.includes('stat') || msg.includes('average') || msg.includes('median') || msg.includes('deviation')) {
        reply = `### 📊 Class Performance Statistics & Grade Distribution\n\n`;
        reply += `Academic statistical insights for **${course.course_name}**:\n\n`;
        reply += `* **Total Enrolled Students**: ${totalStudents}\n`;
        reply += `* **Class Average**: **${classAverage}%**\n`;
        reply += `* **Highest Score**: **${highestMarks}%** (${highestStudent})\n`;
        reply += `* **Lowest Score**: **${lowestMarks}%** (${lowestStudent})\n`;
        reply += `* **Median Marks**: **${median}%**\n`;
        reply += `* **Standard Deviation**: **${stdDev}**\n\n`;
        
        reply += `#### Grade Distribution Breakdown:\n`;
        reply += `| Grade Range | Number of Students | Percentage |\n`;
        reply += `| :---------- | :----------------- | :--------- |\n`;
        Object.entries(grades).forEach(([range, count]) => {
          const pct = ((count / totalStudents) * 100).toFixed(1);
          reply += `| **${range}** | ${count} students | ${pct}% |\n`;
        });

        chartData = {
          type: 'bar',
          data: {
            labels: Object.keys(grades),
            datasets: [{
              label: 'Students Count',
              data: Object.values(grades),
              backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444']
            }]
          },
          options: { responsive: true, plugins: { title: { display: true, text: `Grade Distribution - ${course.course_name}` } } }
        };
      }
      else {
        // Fallback generic response
        reply = `### 📊 Class Analytics Overview (${course.course_name})\n\n`;
        reply += `* **Total Class Strength**: ${totalStudents} students\n`;
        reply += `* **Class Average Marks**: **${classAverage}%**\n`;
        reply += `* **Class Topper**: **${highestStudent}** (${highestMarks}%)\n`;
        reply += `* **Lowest Score**: **${lowestStudent}** (${lowestMarks}%)\n\n`;
        reply += `For more details, try asking me specifically: *"Show top 10 students"*, *"Show grade distribution"*, or *"Who needs mentoring?"*`;
      }

      return {
        agent: this.agentName,
        reply,
        chart: chartData
      };
    } catch (error) {
      console.error('[TeacherAnalyticsAgent Error]:', error);
      return { reply: "❌ An error occurred while compiling academic analytics. Please try again." };
    }
  }
}

module.exports = new TeacherAnalyticsAgent();
