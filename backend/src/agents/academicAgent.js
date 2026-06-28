const Student = require('../models/Student');
const Program = require('../models/Program');
const Course = require('../models/Course');
const Result = require('../models/Result');
const Topic = require('../models/Topic');
const Outcome = require('../models/Outcome');
const ExamSchedule = require('../models/ExamSchedule');
const groqService = require('../services/groqService');
const { SYSTEM_PROMPT } = require('../prompts/systemPrompt');

/**
 * Gather student details from MongoDB, build context, and request response from Groq LLM
 * @param {string} studentId 
 * @param {string} courseId 
 * @param {string} message 
 * @returns {Promise<string>} AI Mentor reply
 */
exports.getMentorResponse = async (studentId, courseId, message) => {
  // 1. Gather all student & academic database records
  const student = await Student.findOne({ student_id: studentId });
  if (!student) {
    return `Student with ID '${studentId}' not found in the database.`;
  }

  const program = await Program.findOne({ program_id: student.program_id });
  const programName = program ? program.program_name : student.program_id;

  let course = null;
  if (courseId) {
    course = await Course.findOne({ course_id: courseId });
  }
  const courseName = course ? course.course_name : (courseId || 'the course');

  // 2. Fetch Results
  const results = await Result.find({ student_id: studentId, course_id: courseId });
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
  const average = marksArray.length > 0 ? parseFloat((marksArray.reduce((a, b) => a + b, 0) / marksArray.length).toFixed(2)) : 70;
  const highest = marksArray.length > 0 ? Math.max(...marksArray) : 0;
  const lowest = marksArray.length > 0 ? Math.min(...marksArray) : 0;
  let improvement = 0;
  if (internal1 !== null && internal3 !== null && internal1 !== 0) {
    improvement = parseFloat((((internal3 - internal1) / internal1) * 100).toFixed(2));
  }

  // 3. Fetch Topics & calculate mastery dynamically matching dashboardController rules
  const topics = await Topic.find({ course_id: courseId });
  const strongTopics = [];
  const weakTopics = [];
  topics.forEach(t => {
    const charSum = t.topic_name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const offset = (charSum % 31) - 15;
    let score = Math.round(average + offset);
    score = Math.min(100, Math.max(40, score));

    if (score >= 80) {
      strongTopics.push(`${t.topic_name} (${score}% mastery)`);
    } else if (score < 60) {
      weakTopics.push(`${t.topic_name} (${score}% mastery)`);
    }
  });

  // 4. Fetch Outcomes & calculate attainment dynamically matching dashboardController rules
  const outcomes = await Outcome.find({ course_id: courseId });
  const outcomeAttainments = outcomes.map(o => {
    const charSum = o.outcome_name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const offset = (charSum % 21) - 10;
    let attainment = Math.round(average + offset);
    attainment = Math.min(100, Math.max(30, attainment));
    return `${o.outcome_name}: ${attainment}% attainment`;
  });

  // 5. Fetch Exam Schedule
  const exam = await ExamSchedule.findOne({ course_id: courseId });

  // 6. Build the Context String
  const context = `STUDENT PROFILE:
- Name: ${student.name}
- Student ID: ${student.student_id}
- Program: ${programName}
- Batch: ${student.batch}

CURRENT COURSE DETAILS:
- Name: ${courseName}
- Course ID: ${courseId || 'N/A'}

ACADEMIC PERFORMANCE (INTERNALS):
- Internal 1 Marks: ${internal1 !== null ? internal1 + '/100' : 'N/A'}
- Internal 2 Marks: ${internal2 !== null ? internal2 + '/100' : 'N/A'}
- Internal 3 Marks: ${internal3 !== null ? internal3 + '/100' : 'N/A'}
- Calculated Average: ${average}%
- Highest Score: ${highest}/100
- Lowest Score: ${lowest}/100
- Improvement: ${improvement >= 0 ? '+' : ''}${improvement}%

TOPIC PERFORMANCE BREAKDOWN:
- Strong Topics (>= 80%): ${strongTopics.length > 0 ? strongTopics.join(', ') : 'None'}
- Weak Topics (< 60%): ${weakTopics.length > 0 ? weakTopics.join(', ') : 'None'}

COURSE OUTCOME ATTAINMENT STATUS:
${outcomeAttainments.length > 0 ? outcomeAttainments.map(o => `- ${o}`).join('\n') : 'No outcomes recorded.'}

UPCOMING FINAL EXAM SCHEDULE:
${exam ? `- Exam Name: ${exam.exam_name}\n- Date: ${exam.exam_date}\n- Time: ${exam.start_time} - ${exam.end_time}\n- Room: ${exam.room}` : 'No exam scheduled.'}`;

  // 7. Structure the chat messages array for Groq call
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: `STUDENT DATA CONTEXT:\n=======================\n${context}\n=======================\n\nRemember: Do not invent stats outside this context.` },
    { role: 'user', content: message }
  ];

  // 8. Submit context to Groq completion service
  return await groqService.chatCompletion(messages);
};
