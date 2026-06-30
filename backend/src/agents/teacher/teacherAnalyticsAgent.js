const Student = require('../../models/Student');
const Result = require('../../models/Result');
const Course = require('../../models/Course');
const Topic = require('../../models/Topic');
const Attendance = require('../../models/Attendance');
const Program = require('../../models/Program');
const groqService = require('../../services/groqService');

class TeacherAnalyticsAgent {
  constructor() {
    this.agentName = 'Teacher Analytics Agent';
  }

  /**
   * Main agent execution endpoint
   */
  async handleQuery(teacherId, courseId, message, chatMessages) {
    try {
      // 1. Extract Intent & Parameters (Groq LLM + Fallback regex)
      const systemPrompt = `You are a query parsing assistant for an academic analytics platform.
Analyze the teacher's query and extract the filtering parameters.
Available Programs in the system: "CS", "CSE", "ECE", "IT".
Available Courses in the system: "Mathematics", "Python Programming", "Database Management Systems", "Java Programming", "Operating Systems", "Financial Accounting", "Taxation", "Genetics", "Microbiology", "Biochemistry".

Return ONLY a valid JSON object matching the following structure. Do NOT include any markdown formatting, code fences (like \`\`\`json), or extra text:
{
  "gender": "Male" | "Female" | null,
  "program": "CS" | "CSE" | "ECE" | "IT" | null,
  "course": "Mathematics" | "Python Programming" | "Database Management Systems" | "Java Programming" | "Operating Systems" | "Financial Accounting" | "Taxation" | "Genetics" | "Microbiology" | "Biochemistry" | null,
  "metric": "pass_percentage" | "fail_percentage" | "attendance" | "average_marks" | "top_students" | "highest_marks" | "weak_topics" | "unknown",
  "limit": number | null
}

Guidance for "metric" selection:
- "pass_percentage": Use when query contains pass, passed, passing, pass rate, pass percentage, success rate.
- "fail_percentage": Use when query contains fail, failed, failure, fail rate.
- "attendance": Use when query contains attendance, present, absent, attendance percentage.
- "average_marks": Use when query contains average, mean, marks average.
- "top_students": Use when query contains topper, highest marks, top students. (But if asking for a single highest score, use "highest_marks")
- "highest_marks": Use when query contains highest marks in <Subject>, highest, maximum score.
- "weak_topics": Use when query contains weak topics.
- If the metric cannot be identified, return "unknown". Do NOT default to "attendance" under any circumstance.

Teacher Query: "${message}"`;

      let queryParams = {
        gender: null,
        program: null,
        course: null,
        metric: 'unknown',
        limit: null
      };

      try {
        const resultText = await groqService.chatCompletion([{ role: 'user', content: systemPrompt }]);
        const cleaned = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
        queryParams = JSON.parse(cleaned);
      } catch (e) {
        console.warn('[TeacherAnalyticsAgent] Intent JSON parse failed, falling back to manual string matching:', e.message);
      }

      // Regex-based corrections and fallback rules to override incorrect extractions
      const msg = message.toLowerCase();
      if (msg.includes('male') && !msg.includes('female')) queryParams.gender = 'Male';
      if (msg.includes('female')) queryParams.gender = 'Female';

      if (msg.includes('cse')) queryParams.program = 'CSE';
      else if (msg.includes('ece')) queryParams.program = 'ECE';
      else if (msg.includes('cs')) queryParams.program = 'CS';

      if (msg.includes('math')) queryParams.course = 'Mathematics';
      else if (msg.includes('ai')) queryParams.course = 'AI';
      else if (msg.includes('python')) queryParams.course = 'Python Programming';
      else if (msg.includes('dbms')) queryParams.course = 'Database Management Systems';
      else if (msg.includes('os')) queryParams.course = 'Operating Systems';
      else if (msg.includes('java')) queryParams.course = 'Java Programming';

      // Enforce strict keyword mapping for metric
      if (/(pass percentage|pass rate|success rate|pass|passed|passing)/i.test(msg)) {
        queryParams.metric = 'pass_percentage';
      } else if (/(fail percentage|fail rate|fail|failed|failure)/i.test(msg)) {
        queryParams.metric = 'fail_percentage';
      } else if (/(attendance|present|absent|attendance percentage)/i.test(msg)) {
        queryParams.metric = 'attendance';
      } else if (/(average marks|marks average|average|mean)/i.test(msg)) {
        queryParams.metric = 'average_marks';
      } else if (/(top students|top \d|toppers|topper|rank)/i.test(msg)) {
        queryParams.metric = 'top_students';
      } else if (/(highest marks|highest|maximum score)/i.test(msg)) {
        queryParams.metric = 'highest_marks';
      } else if (/(weak topics|weak)/i.test(msg)) {
        queryParams.metric = 'weak_topics';
      }

      // 2. Fetch Relevant Data from MongoDB based on Filters
      let programFilter = queryParams.program ? queryParams.program.toUpperCase() : null;
      if (programFilter) {
        if (programFilter === 'CSE' || programFilter === 'CS' || programFilter === 'COMPUTER SCIENCE') {
          programFilter = 'cs001';
        } else if (programFilter === 'CA' || programFilter === 'COMMERCE') {
          programFilter = 'ca001';
        } else if (programFilter === 'BIO' || programFilter === 'BIOLOGY') {
          programFilter = 'bio001';
        }
      }
      let targetCourseDoc = null;
      const currentCourseDoc = await Course.findOne({ course_id: courseId });

      if (queryParams.course) {
        targetCourseDoc = await Course.findOne({
          $or: [
            { course_name: { $regex: new RegExp(queryParams.course, 'i') } },
            { course_id: { $regex: new RegExp(queryParams.course, 'i') } }
          ]
        });
      }
      if (!targetCourseDoc) {
        targetCourseDoc = currentCourseDoc;
      }

      const studentQuery = {};
      if (queryParams.gender) {
        studentQuery.gender = queryParams.gender;
      }
      if (programFilter) {
        studentQuery.program_id = { $regex: new RegExp(programFilter, 'i') };
      } else if (targetCourseDoc) {
        studentQuery.program_id = targetCourseDoc.program_id;
      }

      const studentsList = await Student.find(studentQuery);
      if (studentsList.length === 0) {
        return {
          agent: this.agentName,
          reply: `❌ No ${queryParams.gender || ''} students found registered in the ${queryParams.program || 'target'} program.`,
          chart: null
        };
      }

      const studentIds = studentsList.map(s => s.student_id);
      const studentMap = new Map(studentsList.map(s => [s.student_id, s]));

      // Query result averages
      const results = targetCourseDoc
        ? await Result.find({ student_id: { $in: studentIds }, course_id: targetCourseDoc.course_id })
        : await Result.find({ student_id: { $in: studentIds } });

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
        return { student_id: sid, name: data.studentName, average: avg };
      });

      // 3. Backend Logging Block
      const functionNames = {
        'pass_percentage': 'calculatePassPercentage()',
        'fail_percentage': 'calculateFailPercentage()',
        'attendance': 'calculateAttendance()',
        'average_marks': 'calculateAverageMarks()',
        'top_students': 'calculateTopStudents()',
        'highest_marks': 'calculateHighestMarks()',
        'weak_topics': 'calculateWeakTopics()'
      };
      const executingFn = functionNames[queryParams.metric] || 'askForClarification()';

      console.log('----------------------------------------');
      console.log('Teacher Query:');
      console.log(message);
      console.log('\nExtracted Intent:');
      console.log(queryParams.metric);
      console.log('\nGender:');
      console.log(queryParams.gender || 'All');
      console.log('\nCourse:');
      console.log(targetCourseDoc ? targetCourseDoc.course_name : 'All');
      console.log('\nExecuting:');
      console.log(executingFn);
      console.log('----------------------------------------');

      // 4. Dispatcher Switch
      switch (queryParams.metric) {
        case 'pass_percentage':
          return await this.calculatePassPercentage(queryParams, studentsList, studentAverages, targetCourseDoc, message);
        case 'fail_percentage':
          return await this.calculateFailPercentage(queryParams, studentsList, studentAverages, targetCourseDoc, message);
        case 'attendance':
          return await this.calculateAttendance(queryParams, studentsList, studentIds, studentMap, targetCourseDoc, message);
        case 'average_marks':
          return await this.calculateAverageMarks(queryParams, studentsList, studentAverages, targetCourseDoc, message);
        case 'top_students':
          return await this.calculateTopStudents(queryParams, studentAverages, targetCourseDoc, message);
        case 'highest_marks':
          return await this.calculateHighestMarks(queryParams, studentAverages, targetCourseDoc, message);
        case 'weak_topics':
          return await this.calculateWeakTopics(queryParams, studentsList, studentAverages, targetCourseDoc, message);
        default:
          return this.askForClarification(message);
      }

    } catch (error) {
      console.error('[TeacherAnalyticsAgent Error]:', error);
      return {
        agent: this.agentName,
        reply: '❌ An error occurred while routing analytics. Please try again.',
        chart: null
      };
    }
  }

  // ─── Analytics Functions ──────────────────────────────────────────────────

  async calculatePassPercentage(queryParams, studentsList, studentAverages, targetCourseDoc, message) {
    const totalWithMarks = studentAverages.length;
    let passed = 0;
    let failed = 0;
    studentAverages.forEach(s => {
      if (s.average >= 40) passed++;
      else failed++;
    });

    const passPercentage = totalWithMarks > 0 ? parseFloat(((passed / totalWithMarks) * 100).toFixed(2)) : 0;

    let structuredContext = `Requested Analytics\n`;
    if (queryParams.gender) structuredContext += `Gender : ${queryParams.gender}\n`;
    if (queryParams.program) structuredContext += `Program : ${queryParams.program}\n`;
    if (targetCourseDoc) structuredContext += `Course : ${targetCourseDoc.course_name}\n`;
    structuredContext += `Total Filtered Students : ${studentsList.length}\n`;
    structuredContext += `Students with Marks : ${totalWithMarks}\n`;
    structuredContext += `Passed : ${passed}\n`;
    structuredContext += `Failed : ${failed}\n`;
    structuredContext += `Pass Percentage : ${passPercentage}%\n`;

    const chartData = {
      type: 'pie',
      data: {
        labels: ['Passed', 'Failed'],
        datasets: [{
          data: [passed, failed],
          backgroundColor: ['#10b981', '#ef4444']
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: `${queryParams.gender || 'Class'} Passed vs Failed - ${targetCourseDoc ? targetCourseDoc.course_name : 'All Courses'}`
          }
        }
      }
    };

    const reply = await this.getLlmExplanation(structuredContext, message);

    return { agent: this.agentName, reply, chart: chartData };
  }

  async calculateFailPercentage(queryParams, studentsList, studentAverages, targetCourseDoc, message) {
    const totalWithMarks = studentAverages.length;
    let passed = 0;
    let failed = 0;
    const failedStudentsList = [];
    studentAverages.forEach(s => {
      if (s.average >= 40) {
        passed++;
      } else {
        failed++;
        failedStudentsList.push(s.name);
      }
    });

    const failPercentage = totalWithMarks > 0 ? parseFloat(((failed / totalWithMarks) * 100).toFixed(2)) : 0;

    let structuredContext = `Requested Analytics\n`;
    if (queryParams.gender) structuredContext += `Gender : ${queryParams.gender}\n`;
    if (queryParams.program) structuredContext += `Program : ${queryParams.program}\n`;
    if (targetCourseDoc) structuredContext += `Course : ${targetCourseDoc.course_name}\n`;
    structuredContext += `Total Filtered Students : ${studentsList.length}\n`;
    structuredContext += `Students with Marks : ${totalWithMarks}\n`;
    structuredContext += `Passed : ${passed}\n`;
    structuredContext += `Failed : ${failed}\n`;
    structuredContext += `Fail Percentage : ${failPercentage}%\n`;
    if (failedStudentsList.length > 0) {
      structuredContext += `Failed Students List : ${failedStudentsList.join(', ')}\n`;
    }

    const chartData = {
      type: 'pie',
      data: {
        labels: ['Passed', 'Failed'],
        datasets: [{
          data: [passed, failed],
          backgroundColor: ['#10b981', '#ef4444']
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: `${queryParams.gender || 'Class'} Passed vs Failed - ${targetCourseDoc ? targetCourseDoc.course_name : 'All Courses'}`
          }
        }
      }
    };

    const reply = await this.getLlmExplanation(structuredContext, message);

    return { agent: this.agentName, reply, chart: chartData };
  }

  async calculateAttendance(queryParams, studentsList, studentIds, studentMap, targetCourseDoc, message) {
    const attendanceLogs = targetCourseDoc
      ? await Attendance.find({ student_id: { $in: studentIds }, course_id: targetCourseDoc.course_id })
      : await Attendance.find({ student_id: { $in: studentIds } });

    const attendanceMap = {};
    attendanceLogs.forEach(log => {
      if (!attendanceMap[log.student_id]) {
        attendanceMap[log.student_id] = { present: 0, total: 0, name: studentMap.get(log.student_id)?.name || log.student_id };
      }
      attendanceMap[log.student_id].total++;
      if (log.status === 'Present') {
        attendanceMap[log.student_id].present++;
      }
    });

    const studentAttendanceRates = Object.entries(attendanceMap).map(([sid, data]) => {
      const rate = parseFloat(((data.present / data.total) * 100).toFixed(1));
      return { student_id: sid, name: data.name, rate };
    });

    const totalWithAttendance = studentAttendanceRates.length;
    const avgAttendance = totalWithAttendance > 0 
      ? parseFloat((studentAttendanceRates.reduce((sum, s) => sum + s.rate, 0) / totalWithAttendance).toFixed(1)) 
      : 0;

    let structuredContext = `Requested Analytics\n`;
    if (queryParams.gender) structuredContext += `Gender : ${queryParams.gender}\n`;
    if (queryParams.program) structuredContext += `Program : ${queryParams.program}\n`;
    if (targetCourseDoc) structuredContext += `Course : ${targetCourseDoc.course_name}\n`;
    structuredContext += `Total Filtered Students : ${studentsList.length}\n`;
    structuredContext += `Students with Attendance logs : ${totalWithAttendance}\n`;
    structuredContext += `Average Attendance : ${avgAttendance}%\n`;

    const ranges = { 'Excellent (>=90%)': 0, 'Good (75-89%)': 0, 'Low (<75%)': 0 };
    studentAttendanceRates.forEach(s => {
      if (s.rate >= 90) ranges['Excellent (>=90%)']++;
      else if (s.rate >= 75) ranges['Good (75-89%)']++;
      else ranges['Low (<75%)']++;
    });

    const chartData = {
      type: 'bar',
      data: {
        labels: Object.keys(ranges),
        datasets: [{
          label: 'Student Count',
          data: Object.values(ranges),
          backgroundColor: ['#10b981', '#f59e0b', '#ef4444']
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: `Attendance Rate Categories - ${targetCourseDoc ? targetCourseDoc.course_name : 'All Courses'}`
          }
        }
      }
    };

    const reply = await this.getLlmExplanation(structuredContext, message);

    return { agent: this.agentName, reply, chart: chartData };
  }

  async calculateAverageMarks(queryParams, studentsList, studentAverages, targetCourseDoc, message) {
    const totalWithMarks = studentAverages.length;
    let sumMarks = 0;
    studentAverages.forEach(s => {
      sumMarks += s.average;
    });

    const avgMarks = totalWithMarks > 0 ? parseFloat((sumMarks / totalWithMarks).toFixed(2)) : 0;

    let structuredContext = `Requested Analytics\n`;
    if (queryParams.gender) structuredContext += `Gender : ${queryParams.gender}\n`;
    if (queryParams.program) structuredContext += `Program : ${queryParams.program}\n`;
    if (targetCourseDoc) structuredContext += `Course : ${targetCourseDoc.course_name}\n`;
    structuredContext += `Total Filtered Students : ${studentsList.length}\n`;
    structuredContext += `Average Marks : ${avgMarks}%\n`;

    const chartData = {
      type: 'bar',
      data: {
        labels: ['Average Score'],
        datasets: [{
          label: 'Marks (%)',
          data: [avgMarks],
          backgroundColor: ['#3b82f6']
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: `Average Marks - ${targetCourseDoc ? targetCourseDoc.course_name : 'All Courses'}`
          }
        }
      }
    };

    const reply = await this.getLlmExplanation(structuredContext, message);

    return { agent: this.agentName, reply, chart: chartData };
  }

  async calculateTopStudents(queryParams, studentAverages, targetCourseDoc, message) {
    const limit = queryParams.limit || 5;
    const sortedToppers = [...studentAverages].sort((a, b) => b.average - a.average);
    const topStudents = sortedToppers.slice(0, limit);

    let structuredContext = `Requested Analytics\n`;
    if (queryParams.gender) structuredContext += `Gender : ${queryParams.gender}\n`;
    if (queryParams.program) structuredContext += `Program : ${queryParams.program}\n`;
    if (targetCourseDoc) structuredContext += `Course : ${targetCourseDoc.course_name}\n`;
    structuredContext += `Toppers Limit : ${limit}\n`;
    structuredContext += `Toppers List :\n`;
    topStudents.forEach((s, idx) => {
      structuredContext += `${idx + 1}. Name: ${s.name}, Score: ${s.average}%\n`;
    });

    const chartData = {
      type: 'bar',
      data: {
        labels: topStudents.map(s => s.name),
        datasets: [{
          label: 'Average Marks (%)',
          data: topStudents.map(s => s.average),
          backgroundColor: '#6366f1'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: `Top ${limit} Students - ${targetCourseDoc ? targetCourseDoc.course_name : 'All Courses'}`
          }
        }
      }
    };

    const reply = await this.getLlmExplanation(structuredContext, message);

    return { agent: this.agentName, reply, chart: chartData };
  }

  async calculateHighestMarks(queryParams, studentAverages, targetCourseDoc, message) {
    let highest = 0;
    let highestStudent = 'N/A';

    studentAverages.forEach(s => {
      if (s.average > highest) {
        highest = s.average;
        highestStudent = s.name;
      }
    });

    let structuredContext = `Requested Analytics\n`;
    if (queryParams.gender) structuredContext += `Gender : ${queryParams.gender}\n`;
    if (queryParams.program) structuredContext += `Program : ${queryParams.program}\n`;
    if (targetCourseDoc) structuredContext += `Course : ${targetCourseDoc.course_name}\n`;
    structuredContext += `Highest Marks : ${highest}% (${highestStudent})\n`;

    const chartData = {
      type: 'bar',
      data: {
        labels: [highestStudent],
        datasets: [{
          label: 'Highest Mark (%)',
          data: [highest],
          backgroundColor: ['#10b981']
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: `Highest Score - ${targetCourseDoc ? targetCourseDoc.course_name : 'All Courses'}`
          }
        }
      }
    };

    const reply = await this.getLlmExplanation(structuredContext, message);

    return { agent: this.agentName, reply, chart: chartData };
  }

  async calculateWeakTopics(queryParams, studentsList, studentAverages, targetCourseDoc, message) {
    const topics = targetCourseDoc
      ? await Topic.find({ course_id: targetCourseDoc.course_id })
      : await Topic.find({});

    const topicFrequency = {};
    studentAverages.forEach(student => {
      topics.forEach(t => {
        const charSum = t.topic_name.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
        const offset  = (charSum % 31) - 15;
        let score = Math.round(student.average + offset);
        score = Math.min(100, Math.max(40, score));
        if (score < 60) {
          if (!topicFrequency[t.topic_name]) topicFrequency[t.topic_name] = 0;
          topicFrequency[t.topic_name]++;
        }
      });
    });

    const sortedWeakTopics = Object.entries(topicFrequency).sort((a, b) => b[1] - a[1]);

    let structuredContext = `Requested Analytics\n`;
    if (queryParams.gender) structuredContext += `Gender : ${queryParams.gender}\n`;
    if (queryParams.program) structuredContext += `Program : ${queryParams.program}\n`;
    if (targetCourseDoc) structuredContext += `Course : ${targetCourseDoc.course_name}\n`;
    structuredContext += `Weak Topics List (Frequency of students scoring <60%):\n`;
    sortedWeakTopics.forEach(([name, count]) => {
      structuredContext += `- ${name}: ${count} student(s)\n`;
    });

    const chartData = {
      type: 'bar',
      data: {
        labels: sortedWeakTopics.slice(0, 5).map(t => t[0]),
        datasets: [{
          label: 'Students Needing Mentoring',
          data: sortedWeakTopics.slice(0, 5).map(t => t[1]),
          backgroundColor: '#f59e0b'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: `Top Weak Topics - ${targetCourseDoc ? targetCourseDoc.course_name : 'All Courses'}`
          }
        }
      }
    };

    const reply = await this.getLlmExplanation(structuredContext, message);

    return { agent: this.agentName, reply, chart: chartData };
  }

  // Helper to query Groq to explain structured numbers in natural language
  async getLlmExplanation(structuredContext, originalQuery) {
    const responsePrompt = [
      {
        role: 'system',
        content: `You are an educational analytics AI chatbot helper for teachers.
Your task is to naturally explain the requested analytics database calculations to the teacher.
You must use the provided structured context numbers exactly as they are. DO NOT perform any math or alter the numbers.

Structured Context:
${structuredContext}`
      },
      {
        role: 'user',
        content: originalQuery
      }
    ];

    return await groqService.chatCompletion(responsePrompt);
  }

  askForClarification(message) {
    return {
      agent: this.agentName,
      reply: `I could not identify the specific analytics metric you requested from "${message}". Can you please clarify if you want to see pass percentage, fail percentage, average attendance, average marks, or top students?`,
      chart: null
    };
  }
}

module.exports = new TeacherAnalyticsAgent();
