const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

// Import models
const Program = require('../src/models/Program');
const Course = require('../src/models/Course');
const Student = require('../src/models/Student');
const Result = require('../src/models/Result');
const Topic = require('../src/models/Topic');
const Outcome = require('../src/models/Outcome');
const ExamSchedule = require('../src/models/ExamSchedule');

const seedDatabase = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI is not defined in the environment variables.');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('Successfully connected to MongoDB.');

    // 9. Remove existing data before inserting new data.
    console.log('Clearing existing data from all collections...');
    await Promise.all([
      Program.deleteMany({}),
      Course.deleteMany({}),
      Student.deleteMany({}),
      Result.deleteMany({}),
      Topic.deleteMany({}),
      Outcome.deleteMany({}),
      ExamSchedule.deleteMany({}),
    ]);
    console.log('Existing data cleared.');

    // 1. Populate Programs collection
    console.log('Seeding Programs...');
    const programs = [
      { program_id: 'cs001', program_name: 'Computer Science' },
      { program_id: 'ca001', program_name: 'Chartered Accountancy' },
      { program_id: 'bio001', program_name: 'Biotechnology' }
    ];
    await Program.insertMany(programs);
    console.log(`Inserted ${programs.length} programs.`);

    // 2. Populate Courses collection
    console.log('Seeding Courses...');
    const courses = [
      // Computer Science (cs001)
      { course_id: 'cs_math', course_name: 'Engineering Mathematics', program_id: 'cs001' },
      { course_id: 'cs_dbms', course_name: 'Database Management Systems', program_id: 'cs001' },
      { course_id: 'cs_python', course_name: 'Python Programming', program_id: 'cs001' },
      
      // Chartered Accountancy (ca001)
      { course_id: 'ca_fin_acc', course_name: 'Financial Accounting', program_id: 'ca001' },
      { course_id: 'ca_tax', course_name: 'Taxation', program_id: 'ca001' },
      { course_id: 'ca_audit', course_name: 'Auditing', program_id: 'ca001' },
      
      // Biotechnology (bio001)
      { course_id: 'bio_genetics', course_name: 'Genetics', program_id: 'bio001' },
      { course_id: 'bio_micro', course_name: 'Microbiology', program_id: 'bio001' },
      { course_id: 'bio_biochem', course_name: 'Biochemistry', program_id: 'bio001' }
    ];
    await Course.insertMany(courses);
    console.log(`Inserted ${courses.length} courses.`);

    // 3. Populate Students collection with 10 students
    console.log('Seeding Students...');
    const students = [
      // Computer Science
      { student_id: 'stu001', name: 'Arun Kumar', program_id: 'cs001', batch: '2024' },
      { student_id: 'stu002', name: 'Priya Sharma', program_id: 'cs001', batch: '2024' },
      { student_id: 'stu003', name: 'Rahul Verma', program_id: 'cs001', batch: '2024' },
      { student_id: 'stu004', name: 'Kavya Nair', program_id: 'cs001', batch: '2024' },
      
      // Chartered Accountancy
      { student_id: 'stu005', name: 'Sneha Iyer', program_id: 'ca001', batch: '2024' },
      { student_id: 'stu006', name: 'Rohan Mehta', program_id: 'ca001', batch: '2024' },
      { student_id: 'stu007', name: 'Ananya Gupta', program_id: 'ca001', batch: '2024' },
      
      // Biotechnology
      { student_id: 'stu008', name: 'Divya Chowdhary', program_id: 'bio001', batch: '2024' },
      { student_id: 'stu009', name: 'Harish Kumar', program_id: 'bio001', batch: '2024' },
      { student_id: 'stu010', name: 'Nisha Patel', program_id: 'bio001', batch: '2024' }
    ];
    await Student.insertMany(students);
    console.log(`Inserted ${students.length} students.`);

    // 5. Generate Topics (Each course should contain four topics)
    console.log('Seeding Topics...');
    const topics = [
      // CS Math
      { topic_id: 'top_math_1', course_id: 'cs_math', topic_name: 'Matrices' },
      { topic_id: 'top_math_2', course_id: 'cs_math', topic_name: 'Calculus' },
      { topic_id: 'top_math_3', course_id: 'cs_math', topic_name: 'Differential Equations' },
      { topic_id: 'top_math_4', course_id: 'cs_math', topic_name: 'Probability' },

      // CS DBMS
      { topic_id: 'top_dbms_1', course_id: 'cs_dbms', topic_name: 'Normalization' },
      { topic_id: 'top_dbms_2', course_id: 'cs_dbms', topic_name: 'SQL Joins' },
      { topic_id: 'top_dbms_3', course_id: 'cs_dbms', topic_name: 'Transactions' },
      { topic_id: 'top_dbms_4', course_id: 'cs_dbms', topic_name: 'Indexing' },

      // CS Python
      { topic_id: 'top_py_1', course_id: 'cs_python', topic_name: 'Functions' },
      { topic_id: 'top_py_2', course_id: 'cs_python', topic_name: 'OOP' },
      { topic_id: 'top_py_3', course_id: 'cs_python', topic_name: 'File Handling' },
      { topic_id: 'top_py_4', course_id: 'cs_python', topic_name: 'Exception Handling' },

      // CA Fin Acc
      { topic_id: 'top_fin_1', course_id: 'ca_fin_acc', topic_name: 'Balance Sheet' },
      { topic_id: 'top_fin_2', course_id: 'ca_fin_acc', topic_name: 'Ledger Posting' },
      { topic_id: 'top_fin_3', course_id: 'ca_fin_acc', topic_name: 'Depreciation' },
      { topic_id: 'top_fin_4', course_id: 'ca_fin_acc', topic_name: 'Cash Flow Statement' },

      // CA Tax
      { topic_id: 'top_tax_1', course_id: 'ca_tax', topic_name: 'Income Tax Basics' },
      { topic_id: 'top_tax_2', course_id: 'ca_tax', topic_name: 'GST Regulations' },
      { topic_id: 'top_tax_3', course_id: 'ca_tax', topic_name: 'Corporate Tax' },
      { topic_id: 'top_tax_4', course_id: 'ca_tax', topic_name: 'Tax Deductions' },

      // CA Audit
      { topic_id: 'top_aud_1', course_id: 'ca_audit', topic_name: 'Audit Planning' },
      { topic_id: 'top_aud_2', course_id: 'ca_audit', topic_name: 'Internal Control' },
      { topic_id: 'top_aud_3', course_id: 'ca_audit', topic_name: 'Vouching' },
      { topic_id: 'top_aud_4', course_id: 'ca_audit', topic_name: 'Audit Report' },

      // Bio Genetics
      { topic_id: 'top_gen_1', course_id: 'bio_genetics', topic_name: 'Mendelian Inheritance' },
      { topic_id: 'top_gen_2', course_id: 'bio_genetics', topic_name: 'DNA Replication' },
      { topic_id: 'top_gen_3', course_id: 'bio_genetics', topic_name: 'Gene Mutation' },
      { topic_id: 'top_gen_4', course_id: 'bio_genetics', topic_name: 'Genetic Mapping' },

      // Bio Micro
      { topic_id: 'top_mic_1', course_id: 'bio_micro', topic_name: 'Bacterial Growth' },
      { topic_id: 'top_mic_2', course_id: 'bio_micro', topic_name: 'Virology' },
      { topic_id: 'top_mic_3', course_id: 'bio_micro', topic_name: 'Staining Techniques' },
      { topic_id: 'top_mic_4', course_id: 'bio_micro', topic_name: 'Sterilization Methods' },

      // Bio Biochem
      { topic_id: 'top_bio_1', course_id: 'bio_biochem', topic_name: 'Protein Structure' },
      { topic_id: 'top_bio_2', course_id: 'bio_biochem', topic_name: 'Enzyme Kinetics' },
      { topic_id: 'top_bio_3', course_id: 'bio_biochem', topic_name: 'Carbohydrate Metabolism' },
      { topic_id: 'top_bio_4', course_id: 'bio_biochem', topic_name: 'Lipid Biosynthesis' }
    ];
    await Topic.insertMany(topics);
    console.log(`Inserted ${topics.length} topics.`);

    // 6. Generate Course Outcomes (Each course should contain four COs)
    console.log('Seeding Course Outcomes...');
    const outcomes = [];
    courses.forEach(course => {
      for (let i = 1; i <= 4; i++) {
        outcomes.push({
          outcome_id: `out_${course.course_id}_${i}`,
          course_id: course.course_id,
          outcome_name: `CO${i}`
        });
      }
    });
    await Outcome.insertMany(outcomes);
    console.log(`Inserted ${outcomes.length} outcomes.`);

    // 7. Generate Exam Schedule (One final exam for every course)
    console.log('Seeding Exam Schedule...');
    const examSchedule = [
      { course_id: 'cs_math', exam_name: 'Final Term', exam_date: '2026-07-01', start_time: '09:30', end_time: '12:30', room: 'Room 101' },
      { course_id: 'cs_dbms', exam_name: 'Final Term', exam_date: '2026-07-02', start_time: '09:30', end_time: '12:30', room: 'Room 101' },
      { course_id: 'cs_python', exam_name: 'Final Term', exam_date: '2026-07-03', start_time: '09:30', end_time: '12:30', room: 'Room 101' },
      
      { course_id: 'ca_fin_acc', exam_name: 'Final Term', exam_date: '2026-07-01', start_time: '14:00', end_time: '17:00', room: 'Room 102' },
      { course_id: 'ca_tax', exam_name: 'Final Term', exam_date: '2026-07-02', start_time: '14:00', end_time: '17:00', room: 'Room 102' },
      { course_id: 'ca_audit', exam_name: 'Final Term', exam_date: '2026-07-03', start_time: '14:00', end_time: '17:00', room: 'Room 102' },
      
      { course_id: 'bio_genetics', exam_name: 'Final Term', exam_date: '2026-07-01', start_time: '09:30', end_time: '12:30', room: 'Lab A' },
      { course_id: 'bio_micro', exam_name: 'Final Term', exam_date: '2026-07-02', start_time: '09:30', end_time: '12:30', room: 'Lab B' },
      { course_id: 'bio_biochem', exam_name: 'Final Term', exam_date: '2026-07-03', start_time: '09:30', end_time: '12:30', room: 'Lab A' }
    ];
    await ExamSchedule.insertMany(examSchedule);
    console.log(`Inserted ${examSchedule.length} exam schedules.`);

    // 4. Generate Results
    console.log('Generating results & computing stats...');
    const results = [];
    const analyticsSummary = [];

    // Helper to generate marks between 55 and 100
    const getRandomMark = () => Math.floor(Math.random() * (100 - 55 + 1)) + 55;

    for (const student of students) {
      // Find courses for this student's program
      const studentCourses = courses.filter(c => c.program_id === student.program_id);

      for (const course of studentCourses) {
        const marks1 = getRandomMark();
        const marks2 = getRandomMark();
        const marks3 = getRandomMark();

        // Push results for the 3 internals
        results.push(
          { student_id: student.student_id, course_id: course.course_id, exam_name: 'Internal 1', marks: marks1, total_marks: 100 },
          { student_id: student.student_id, course_id: course.course_id, exam_name: 'Internal 2', marks: marks2, total_marks: 100 },
          { student_id: student.student_id, course_id: course.course_id, exam_name: 'Internal 3', marks: marks3, total_marks: 100 }
        );

        // 8. Automatically calculate stats
        const marksArray = [marks1, marks2, marks3];
        const average = parseFloat((marksArray.reduce((s, m) => s + m, 0) / 3).toFixed(2));
        const highest = Math.max(...marksArray);
        const lowest = Math.min(...marksArray);
        
        let improvement = 0;
        if (marks1 !== 0) {
          improvement = parseFloat((((marks3 - marks1) / marks1) * 100).toFixed(2));
        }

        analyticsSummary.push({
          Student: student.name,
          StudentID: student.student_id,
          Course: course.course_name,
          CourseID: course.course_id,
          Internal1: marks1,
          Internal2: marks2,
          Internal3: marks3,
          Average: average,
          Highest: highest,
          Lowest: lowest,
          Improvement: `${improvement >= 0 ? '+' : ''}${improvement}%`
        });
      }
    }

    await Result.insertMany(results);
    console.log(`Inserted ${results.length} results.`);

    console.log('\n--- Computed Academic Analytics Summary ---');
    console.table(analyticsSummary);
    console.log('--------------------------------------------\n');

    console.log('Database seeding process completed successfully!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error during database seeding:', error);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
};

seedDatabase();
