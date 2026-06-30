require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');

// Import Models
const Program = require('./src/models/Program');
const Course = require('./src/models/Course');
const Student = require('./src/models/Student');
const Result = require('./src/models/Result');
const Topic = require('./src/models/Topic');
const Outcome = require('./src/models/Outcome');
const ExamSchedule = require('./src/models/ExamSchedule');
const User = require('./src/models/User');
const Attendance = require('./src/models/Attendance');
const Assignment = require('./src/models/Assignment');
const AssignmentSubmission = require('./src/models/AssignmentSubmission');
const Announcement = require('./src/models/Announcement');

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/eduagent';
    
    if (mongoose.connection.readyState !== 1) {
      console.log('Connecting to MongoDB...');
      await mongoose.connect(mongoUri);
      console.log('Connected to MongoDB.');
    }

    console.log('Clearing old collections...');
    await Promise.all([
      Program.deleteMany({}),
      Course.deleteMany({}),
      Student.deleteMany({}),
      Result.deleteMany({}),
      Topic.deleteMany({}),
      Outcome.deleteMany({}),
      ExamSchedule.deleteMany({}),
      User.deleteMany({}),
      Attendance.deleteMany({}),
      Assignment.deleteMany({}),
      AssignmentSubmission.deleteMany({}),
      Announcement.deleteMany({})
    ]);

    // 1. Seed Programs
    console.log('Seeding programs...');
    const programs = [
      { program_id: 'cs001', program_name: 'Computer Science & Engineering' },
      { program_id: 'ca001', program_name: 'Chartered Accountancy' },
      { program_id: 'bio001', program_name: 'Biotechnology' }
    ];
    await Program.insertMany(programs);

    // 2. Seed Courses (including current active and historical ones)
    console.log('Seeding courses...');
    const courses = [
      // Current Semester Courses
      { course_id: 'cs_math', course_name: 'Mathematics', program_id: 'cs001' },
      { course_id: 'cs_python', course_name: 'Python Programming', program_id: 'cs001' },
      { course_id: 'cs_dbms', course_name: 'Database Management Systems', program_id: 'cs001' },
      { course_id: 'cs_java', course_name: 'Java Programming', program_id: 'cs001' },
      { course_id: 'cs_os', course_name: 'Operating Systems', program_id: 'cs001' },
      
      // Historical Courses (for trend analysis)
      { course_id: 'cs_sem1_history', course_name: 'Introduction to Programming', program_id: 'cs001' },
      { course_id: 'cs_sem2_history', course_name: 'Data Structures & Algorithms', program_id: 'cs001' },
      { course_id: 'cs_sem3_history', course_name: 'Computer Organization', program_id: 'cs001' },
      
      // Non-CS Courses
      { course_id: 'ca_fin_acc', course_name: 'Financial Accounting', program_id: 'ca001' },
      { course_id: 'ca_tax', course_name: 'Taxation', program_id: 'ca001' },
      { course_id: 'bio_genetics', course_name: 'Genetics', program_id: 'bio001' }
    ];
    await Course.insertMany(courses);

    // 3. Seed Students (40 CS Students: 20 Male, 20 Female)
    console.log('Seeding 40 students with gender fields...');
    const students = [];
    const maleNames = [
      'Aarav Sharma', 'Vikram Singh', 'Rohan Gupta', 'Amit Shah', 'Rahul Verma',
      'Aditya Sen', 'Arjun Kapoor', 'Kabir Mehta', 'Dev Patel', 'Neil Roy',
      'Yash Wardhan', 'Harish Kumar', 'Sai Teja', 'Parth Joshi', 'Vihaan Reddy',
      'Vivaan Joshi', 'Reyansh Goel', 'Shivam Pandey', 'Aryan Mishra', 'Gaurav Das'
    ];
    const femaleNames = [
      'Priya Patel', 'Ananya Reddy', 'Sneha Iyer', 'Kavitha Nair', 'Divya Choudhary',
      'Diya Bose', 'Riya Sen', 'Neha Gupta', 'Tanya Sharma', 'Ishita Roy',
      'Pooja Patil', 'Shreya Ghoshal', 'Kriti Sanon', 'Kiara Advani', 'Alia Bhatt',
      'Deepika Padukone', 'Priyanka Chopra', 'Katrina Kaif', 'Shraddha Kapoor', 'Janhvi Kapoor'
    ];

    for (let i = 1; i <= 20; i++) {
      students.push({
        student_id: `stu${String(i).padStart(3, '0')}`,
        name: maleNames[i - 1],
        program_id: 'cs001',
        batch: '2024',
        gender: 'Male'
      });
      students.push({
        student_id: `stu${String(i + 20).padStart(3, '0')}`,
        name: femaleNames[i - 1],
        program_id: 'cs001',
        batch: '2024',
        gender: 'Female'
      });
    }

    // Add a few extra program students for testing
    students.push(
      { student_id: 'stu041', name: 'Amit Shah Alt', program_id: 'ca001', batch: '2024', gender: 'Male' },
      { student_id: 'stu042', name: 'Sneha Iyer Alt', program_id: 'ca001', batch: '2024', gender: 'Female' },
      { student_id: 'stu043', name: 'Kavitha Krishnan Alt', program_id: 'bio001', batch: '2024', gender: 'Female' }
    );

    await Student.insertMany(students);

    // 4. Seed Course Outcomes (CO1 to CO5 for all 5 CSE courses)
    console.log('Seeding Course Outcomes (CO1-CO5)...');
    const cseCourseIds = ['cs_math', 'cs_python', 'cs_dbms', 'cs_java', 'cs_os'];
    const outcomes = [];
    cseCourseIds.forEach(courseId => {
      for (let coNum = 1; coNum <= 5; coNum++) {
        outcomes.push({
          outcome_id: `out_${courseId.split('_')[1]}_${coNum}`,
          course_id: courseId,
          outcome_name: `CO${coNum}`
        });
      }
    });
    await Outcome.insertMany(outcomes);

    // 5. Seed Topics
    console.log('Seeding topics...');
    const topics = [
      { topic_id: 'top_math_1', course_id: 'cs_math', topic_name: 'Matrices' },
      { topic_id: 'top_math_2', course_id: 'cs_math', topic_name: 'Calculus' },
      { topic_id: 'top_math_3', course_id: 'cs_math', topic_name: 'Differential Equations' },
      { topic_id: 'top_math_4', course_id: 'cs_math', topic_name: 'Probability' },

      { topic_id: 'top_dbms_1', course_id: 'cs_dbms', topic_name: 'Normalization' },
      { topic_id: 'top_dbms_2', course_id: 'cs_dbms', topic_name: 'SQL Joins' },
      { topic_id: 'top_dbms_3', course_id: 'cs_dbms', topic_name: 'Transactions' },
      { topic_id: 'top_dbms_4', course_id: 'cs_dbms', topic_name: 'Indexing' },

      { topic_id: 'top_py_1', course_id: 'cs_python', topic_name: 'Functions' },
      { topic_id: 'top_py_2', course_id: 'cs_python', topic_name: 'OOP' },
      { topic_id: 'top_py_3', course_id: 'cs_python', topic_name: 'File Handling' },
      { topic_id: 'top_py_4', course_id: 'cs_python', topic_name: 'Exception Handling' },

      { topic_id: 'top_java_1', course_id: 'cs_java', topic_name: 'Multithreading' },
      { topic_id: 'top_java_2', course_id: 'cs_java', topic_name: 'Generics' },
      { topic_id: 'top_os_1', course_id: 'cs_os', topic_name: 'Process Scheduling' },
      { topic_id: 'top_os_2', course_id: 'cs_os', topic_name: 'Virtual Memory' }
    ];
    await Topic.insertMany(topics);

    // 6. Seed Exam Schedule (current courses)
    console.log('Seeding exam schedule...');
    const examSchedule = cseCourseIds.map((cId, idx) => ({
      course_id: cId,
      exam_name: 'Final Term',
      exam_date: `2026-07-0${idx + 1}`,
      start_time: '09:30',
      end_time: '12:30',
      room: `Room 10${idx + 1}`
    }));
    await ExamSchedule.insertMany(examSchedule);

    // 7. Seed Results (detailed internal + end semester exams)
    console.log('Seeding comprehensive result documents...');
    const results = [];
    const csStudents = students.filter(s => s.program_id === 'cs001');

    csStudents.forEach((student, idx) => {
      // Establish student capability class (high, average, weak)
      // Index 0-9: high performers (base average 86-94)
      // Index 10-29: average performers (base average 68-78)
      // Index 30-39: weak/failing performers (base average 42-56)
      const isHigh = idx < 10;
      const isWeak = idx >= 30;
      const baseAverage = isHigh ? 88 : (isWeak ? 48 : 72);

      cseCourseIds.forEach(courseId => {
        // Course specific offset (adds variety per subject)
        const courseCharCodeSum = courseId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const courseOffset = (courseCharCodeSum % 11) - 5; // range: -5 to +5

        // Exam offsets
        const i1Offset = (idx % 7) - 3;
        const i2Offset = (idx % 5) - 2;
        const i3Offset = (idx % 3) - 1;
        const esOffset = (idx % 9) - 4;

        const i1Mark = Math.min(100, Math.max(25, Math.round(baseAverage + courseOffset + i1Offset)));
        const i2Mark = Math.min(100, Math.max(25, Math.round(baseAverage + courseOffset + i2Offset + 2))); // slightly improving
        const i3Mark = Math.min(100, Math.max(25, Math.round(baseAverage + courseOffset + i3Offset + 4))); // further improving

        results.push(
          { student_id: student.student_id, course_id: courseId, exam_name: 'Internal 1', marks: i1Mark, total_marks: 100 },
          { student_id: student.student_id, course_id: courseId, exam_name: 'Internal 2', marks: i2Mark, total_marks: 100 },
          { student_id: student.student_id, course_id: courseId, exam_name: 'Internal 3', marks: i3Mark, total_marks: 100 }
        );

        // End Semester Exam:
        // Absent logic: Make stu009 (Male) and stu029 (Female) absent in cs_dbms and other courses
        const isAbsent = (student.student_id === 'stu009' || student.student_id === 'stu029');

        if (!isAbsent) {
          const esMark = Math.min(100, Math.max(20, Math.round(baseAverage + courseOffset + esOffset)));
          results.push({
            student_id: student.student_id,
            course_id: courseId,
            exam_name: 'End Semester',
            marks: esMark,
            total_marks: 100
          });
        }
      });

      // Historical semester averages (Semester 1 to Semester 3) for trend lines
      // We write results for virtual courses representing semesters
      const sem1Mark = Math.min(100, Math.max(40, Math.round(baseAverage - 4 + (idx % 5))));
      const sem2Mark = Math.min(100, Math.max(40, Math.round(baseAverage - 2 + (idx % 3))));
      const sem3Mark = Math.min(100, Math.max(40, Math.round(baseAverage + (idx % 4))));

      results.push(
        { student_id: student.student_id, course_id: 'cs_sem1_history', exam_name: 'End Semester', marks: sem1Mark, total_marks: 100 },
        { student_id: student.student_id, course_id: 'cs_sem2_history', exam_name: 'End Semester', marks: sem2Mark, total_marks: 100 },
        { student_id: student.student_id, course_id: 'cs_sem3_history', exam_name: 'End Semester', marks: sem3Mark, total_marks: 100 }
      );
    });

    await Result.insertMany(results);

    // 8. Seed Attendance Logs
    console.log('Seeding attendance logs (15 sessions per student per course)...');
    const attendanceRecords = [];
    const today = new Date();

    csStudents.forEach((student, idx) => {
      // Determine student presence rate
      // aarav (stu001) is 100% present, but a few students (like indices 8, 18, 38) will be low attendance (<75%)
      const isLowAttendance = (student.student_id === 'stu008' || student.student_id === 'stu018' || student.student_id === 'stu038');
      const presentProbability = isLowAttendance ? 0.60 : 0.88; // 60% vs 88% chance of presence

      cseCourseIds.forEach(courseId => {
        for (let lectureNum = 1; lectureNum <= 15; lectureNum++) {
          const date = new Date(today);
          date.setDate(today.getDate() - (15 - lectureNum));
          
          // Deterministic pseudo-randomness based on idx and lectureNum
          const seedValue = (idx * 17 + lectureNum * 31) % 100;
          const status = (seedValue / 100) < presentProbability ? 'Present' : 'Absent';

          attendanceRecords.push({
            student_id: student.student_id,
            course_id: courseId,
            date,
            status,
            lecture_number: lectureNum
          });
        }
      });
    });

    await Attendance.insertMany(attendanceRecords);

    // 9. Seed Assignments
    console.log('Seeding assignments...');
    const assignments = [
      {
        title: 'DBMS Normalization Homework',
        description: 'Design 3NF relational schemas for a library system.',
        course_id: 'cs_dbms',
        teacher_id: 'tch001',
        due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5),
        max_marks: 50
      },
      {
        title: 'Linear Algebra Matrix Calculation',
        description: 'Complete questions 1 to 10 on eigenvectors and eigenvalues.',
        course_id: 'cs_math',
        teacher_id: 'tch001',
        due_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
        max_marks: 50
      }
    ];
    const seededAssignments = await Assignment.insertMany(assignments);

    // Seed submissions
    console.log('Seeding assignment submissions...');
    const submissions = csStudents.slice(0, 25).map(student => ({
      assignment_id: seededAssignments[0]._id,
      student_id: student.student_id,
      submitted_at: new Date(),
      file_url: 'http://localhost:5000/uploads/assignment_submit.pdf',
      marks_obtained: (student.student_id === 'stu001') ? 48 : (Math.random() > 0.5 ? Math.round(35 + Math.random() * 15) : null),
      feedback: (student.student_id === 'stu001') ? 'Excellent query decomposition!' : ''
    }));
    await AssignmentSubmission.insertMany(submissions);

    // 10. Seed Announcements
    console.log('Seeding announcements...');
    const announcements = [
      {
        title: 'Eid Holiday',
        content: 'The campus will remain closed on 2nd July for Eid ul-Adha.',
        category: 'Holiday',
        target_type: 'all',
        created_by: 'admin'
      },
      {
        title: 'Internal Exams Rescheduled',
        content: 'Internal 2 assessments have been rescheduled. Refer to the exam planner tab for updated venues.',
        category: 'Exam',
        target_type: 'course',
        target_id: 'cs_dbms',
        created_by: 'tch001'
      },
      {
        title: 'Google Workshop Registrations',
        content: 'Register for the Google Cloud workshop happening this Saturday in Seminar Hall A.',
        category: 'Workshop',
        target_type: 'program',
        target_id: 'cs001',
        created_by: 'admin'
      }
    ];
    await Announcement.insertMany(announcements);

    // 11. Seed User Accounts
    console.log('Seeding user accounts...');
    const bcrypt = require('bcryptjs');
    const hashedPwd = await bcrypt.hash('EduAgent@123', 12);
    const teacherPwd = await bcrypt.hash('Teacher@123', 12);
    const studentPwd = await bcrypt.hash('Student@123', 12);
    const adminPwd = await bcrypt.hash('Admin@123', 12);

    const userAccounts = [];

    // Seed student logins
    csStudents.forEach((student) => {
      userAccounts.push({
        userId: `usr_${student.student_id}`,
        name: student.name,
        email: `${student.student_id}@eduagent.com`,
        password: studentPwd,
        role: 'student',
        student_id: student.student_id,
        teacher_id: null,
        admin_id: null,
        program_id: 'cs001'
      });
    });

    // Backwards compatibility logins from original seed.js
    userAccounts.push(
      {
        userId: 'usr_student_001',
        name: 'Aarav Sharma',
        email: 'student@eduagent.com',
        password: studentPwd,
        role: 'student',
        student_id: 'stu001',
        teacher_id: null,
        admin_id: null,
        program_id: 'cs001'
      },
      {
        userId: 'usr_student_002',
        name: 'Priya Patel',
        email: 'student2@eduagent.com',
        password: studentPwd,
        role: 'student',
        student_id: 'stu002',
        teacher_id: null,
        admin_id: null,
        program_id: 'cs001'
      },
      {
        userId: 'usr_teacher_001',
        name: 'Dr. Meera Nair',
        email: 'teacher@eduagent.com',
        password: teacherPwd,
        role: 'teacher',
        student_id: null,
        teacher_id: 'tch001',
        admin_id: null,
        program_id: 'cs001'
      },
      {
        userId: 'usr_admin_001',
        name: 'Admin EduAgent',
        email: 'admin@eduagent.com',
        password: adminPwd,
        role: 'admin',
        student_id: null,
        teacher_id: null,
        admin_id: 'adm001',
        program_id: null
      }
    );

    await User.insertMany(userAccounts);

    console.log('Database successfully seeded with CSE class data!');
    return true;

  } catch (error) {
    console.error('Error seeding database:', error.message);
    throw error;
  }
};

if (require.main === module) {
  seedData()
    .then(() => {
      console.log('✅ Done!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Failed:', err);
      process.exit(1);
    });
}

module.exports = seedData;
