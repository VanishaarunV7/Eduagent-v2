require('dotenv').config();
const mongoose = require('mongoose');

// Import Models
const Program = require('./src/models/Program');
const Course = require('./src/models/Course');
const Student = require('./src/models/Student');
const Result = require('./src/models/Result');
const Topic = require('./src/models/Topic');
const Outcome = require('./src/models/Outcome');
const ExamSchedule = require('./src/models/ExamSchedule');

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI is not defined in the environment variables.');
    }

    if (mongoose.connection.readyState !== 1) {
      console.log('Connecting to MongoDB...');
      await mongoose.connect(mongoUri);
      console.log('Connected to MongoDB.');
    } else {
      console.log('Using existing MongoDB connection for seeding.');
    }

    // Clear old seeded data for all collections
    console.log('Clearing old collections...');
    await Program.deleteMany({});
    await Course.deleteMany({});
    await Student.deleteMany({});
    await Result.deleteMany({});
    await Topic.deleteMany({});
    await Outcome.deleteMany({});
    await ExamSchedule.deleteMany({});

    // 1. Seeding programs
    console.log('Seeding programs...');
    const programs = [
      { program_id: 'cs001', program_name: 'Computer Science' },
      { program_id: 'ca001', program_name: 'Chartered Accounts' },
      { program_id: 'bio001', program_name: 'Biotechnology' }
    ];
    await Program.insertMany(programs);

    // 2. Seeding courses
    console.log('Seeding courses...');
    const courses = [
      { course_id: 'cs_math', course_name: 'Mathematics', program_id: 'cs001' },
      { course_id: 'cs_dbms', course_name: 'DBMS', program_id: 'cs001' },
      { course_id: 'cs_python', course_name: 'Python Programming', program_id: 'cs001' },
      { course_id: 'ca_fin_acc', course_name: 'Financial Accounting', program_id: 'ca001' },
      { course_id: 'ca_tax', course_name: 'Taxation', program_id: 'ca001' },
      { course_id: 'ca_audit', course_name: 'Auditing', program_id: 'ca001' },
      { course_id: 'bio_genetics', course_name: 'Genetics', program_id: 'bio001' },
      { course_id: 'bio_micro', course_name: 'Microbiology', program_id: 'bio001' },
      { course_id: 'bio_biochem', course_name: 'Biochemistry', program_id: 'bio001' }
    ];
    await Course.insertMany(courses);

    // 3. Seeding students (using consistent 'stu' prefixes)
    console.log('Seeding students...');
    const students = [
      { student_id: 'stu001', name: 'Aarav Sharma', program_id: 'cs001', batch: '2024' },
      { student_id: 'stu002', name: 'Priya Patel', program_id: 'cs001', batch: '2024' },
      { student_id: 'stu003', name: 'Vikram Singh', program_id: 'cs001', batch: '2024' },
      { student_id: 'stu004', name: 'Ananya Reddy', program_id: 'cs001', batch: '2024' },
      { student_id: 'stu005', name: 'Amit Shah', program_id: 'ca001', batch: '2024' },
      { student_id: 'stu006', name: 'Sneha Iyer', program_id: 'ca001', batch: '2024' },
      { student_id: 'stu007', name: 'Rohan Gupta', program_id: 'ca001', batch: '2024' },
      { student_id: 'stu008', name: 'Kavitha Krishnan', program_id: 'bio001', batch: '2024' },
      { student_id: 'stu009', name: 'Rahul Verma', program_id: 'bio001', batch: '2024' },
      { student_id: 'stu010', name: 'Divya Choudhary', program_id: 'bio001', batch: '2024' }
    ];
    await Student.insertMany(students);

    // Course IDs for program cs001
    const csCourses = ['cs_math', 'cs_dbms', 'cs_python'];

    // 4. Seeding results for student 'stu001'
    console.log('Seeding results for stu001...');
    const results = [];
    csCourses.forEach(courseId => {
      // Add Internal 1, 2, and 3 marks (realistic values between 60 and 100)
      results.push(
        { student_id: 'stu001', course_id: courseId, exam_name: 'Internal 1', marks: 80, total_marks: 100 },
        { student_id: 'stu001', course_id: courseId, exam_name: 'Internal 2', marks: 85, total_marks: 100 },
        { student_id: 'stu001', course_id: courseId, exam_name: 'Internal 3', marks: 90, total_marks: 100 }
      );
    });
    await Result.insertMany(results);

    // 5. Seeding topics for courses
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
      { topic_id: 'top_py_4', course_id: 'cs_python', topic_name: 'Exception Handling' }
    ];
    await Topic.insertMany(topics);

    // 6. Seeding outcomes for courses
    console.log('Seeding course outcomes...');
    const outcomes = [
      { outcome_id: 'out_math_1', course_id: 'cs_math', outcome_name: 'CO1' },
      { outcome_id: 'out_math_2', course_id: 'cs_math', outcome_name: 'CO2' },
      { outcome_id: 'out_math_3', course_id: 'cs_math', outcome_name: 'CO3' },
      { outcome_id: 'out_math_4', course_id: 'cs_math', outcome_name: 'CO4' },

      { outcome_id: 'out_dbms_1', course_id: 'cs_dbms', outcome_name: 'CO1' },
      { outcome_id: 'out_dbms_2', course_id: 'cs_dbms', outcome_name: 'CO2' },
      { outcome_id: 'out_dbms_3', course_id: 'cs_dbms', outcome_name: 'CO3' },
      { outcome_id: 'out_dbms_4', course_id: 'cs_dbms', outcome_name: 'CO4' },

      { outcome_id: 'out_py_1', course_id: 'cs_python', outcome_name: 'CO1' },
      { outcome_id: 'out_py_2', course_id: 'cs_python', outcome_name: 'CO2' },
      { outcome_id: 'out_py_3', course_id: 'cs_python', outcome_name: 'CO3' },
      { outcome_id: 'out_py_4', course_id: 'cs_python', outcome_name: 'CO4' }
    ];
    await Outcome.insertMany(outcomes);

    // 7. Seeding exam schedule (future dates)
    console.log('Seeding exam schedule...');
    const examSchedule = [
      { course_id: 'cs_math', exam_name: 'Final Term', exam_date: '2026-07-01', start_time: '09:30', end_time: '12:30', room: 'Room 101' },
      { course_id: 'cs_dbms', exam_name: 'Final Term', exam_date: '2026-07-02', start_time: '09:30', end_time: '12:30', room: 'Room 101' },
      { course_id: 'cs_python', exam_name: 'Final Term', exam_date: '2026-07-03', start_time: '09:30', end_time: '12:30', room: 'Room 101' }
    ];
    await ExamSchedule.insertMany(examSchedule);

    console.log('Database successfully seeded!');
    if (require.main === module) {
      process.exit(0);
    }
  } catch (error) {
    console.error('Error seeding database:', error.message);
    if (require.main === module) {
      process.exit(1);
    }
    throw error;
  }
};

if (require.main === module) {
  seedData();
}

module.exports = seedData;

