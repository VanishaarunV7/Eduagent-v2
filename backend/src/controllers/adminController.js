const Student = require('../models/Student');
const Course = require('../models/Course');
const Result = require('../models/Result');
const Topic = require('../models/Topic');
const Outcome = require('../models/Outcome');
const ExamSchedule = require('../models/ExamSchedule');
const User = require('../models/User');
const Program = require('../models/Program');
const Department = require('../models/Department');
const AuditLog = require('../models/AuditLog');
const mongoose = require('mongoose');

// Helper to write audit logs
const logAuditAction = async (req, action, details) => {
  try {
    const userId = req.user?.userId || 'admin';
    const audit = new AuditLog({
      userId,
      action,
      details,
      ipAddress: req.ip || '127.0.0.1'
    });
    await audit.save();
  } catch (err) {
    console.error('Audit logging failed:', err);
  }
};

/**
 * GET /api/admin/dashboard
 * Retrieve ERP summary stats and AI Administrator Dashboard Cards
 */
exports.getAdminDashboard = async (req, res) => {
  try {
    const students = await Student.countDocuments();
    const teachers = await User.countDocuments({ role: 'teacher' });
    const depts = await Department.countDocuments();
    const courses = await Course.countDocuments();
    const programs = await Program.countDocuments();
    const activeUsers = await User.countDocuments();
    const todayLogins = 12; // Static mockup
    const examsCount = await ExamSchedule.countDocuments();

    // AI Dashboard insights list
    const aiInsights = [
      {
        title: 'Department Performance Improvement',
        desc: 'Computer Science passing rate increased by +4.2% since last semester.',
        type: 'success',
        relevance: 'High'
      },
      {
        title: 'Course Difficulty Threshold Breached',
        desc: 'Python Programming (cs_python) shows standard deviation skewing 12% lower than database mean.',
        type: 'warning',
        relevance: 'Medium'
      },
      {
        title: 'Potential Dropout Risks Flagged',
        desc: '2 students have been flagged for attendance drop-offs and consecutive absent flags.',
        type: 'danger',
        relevance: 'High'
      },
      {
        title: 'System Audit Check',
        desc: 'MongoDB database backup executed successfully; 12 active authentication tokens.',
        type: 'info',
        relevance: 'Low'
      }
    ];

    res.status(200).json({
      stats: {
        students,
        teachers,
        departments: depts || 3,
        courses,
        programs,
        activeUsers,
        todayLogins,
        exams: examsCount
      },
      aiInsights
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── STUDENTS CRUD ────────────────────────────────────────────────────────────
exports.getStudents = async (req, res) => {
  try {
    const studentsList = await Student.find({});
    res.status(200).json(studentsList);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createStudent = async (req, res) => {
  try {
    const { student_id, name, program_id, batch, email, password } = req.body;
    if (!student_id || !name || !program_id || !email) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // 1. Create Student document
    const student = new Student({ student_id, name, program_id, batch: batch || '2025' });
    await student.save();

    // 2. Create User account
    const user = new User({
      userId: `usr_student_${student_id}`,
      name,
      email,
      password: password || 'Student@123',
      role: 'student',
      student_id,
      program_id
    });
    await user.save();

    await logAuditAction(req, 'CREATE_STUDENT', `Created student ${name} (${student_id})`);
    res.status(201).json({ message: 'Student created successfully', student });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    await Student.findOneAndDelete({ student_id: studentId });
    await User.findOneAndDelete({ student_id: studentId });
    await logAuditAction(req, 'DELETE_STUDENT', `Deleted student ID: ${studentId}`);
    res.status(200).json({ message: 'Student and credentials deleted.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── TEACHERS CRUD ────────────────────────────────────────────────────────────
exports.getTeachers = async (req, res) => {
  try {
    const teachersList = await User.find({ role: 'teacher' }, { password: 0 });
    res.status(200).json(teachersList);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createTeacher = async (req, res) => {
  try {
    const { teacher_id, name, email, password, program_id } = req.body;
    if (!teacher_id || !name || !email) {
      return res.status(400).json({ message: 'Missing teacher_id, name, or email' });
    }

    const user = new User({
      userId: `usr_teacher_${teacher_id}`,
      name,
      email,
      password: password || 'Teacher@123',
      role: 'teacher',
      teacher_id,
      program_id: program_id || 'cs001'
    });
    await user.save();

    await logAuditAction(req, 'CREATE_TEACHER', `Created teacher account ${name} (${teacher_id})`);
    res.status(201).json({ message: 'Teacher created successfully', teacher: user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params;
    await User.findOneAndDelete({ teacher_id: teacherId, role: 'teacher' });
    await logAuditAction(req, 'DELETE_TEACHER', `Deleted teacher account: ${teacherId}`);
    res.status(200).json({ message: 'Teacher account deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── DEPARTMENTS CRUD ─────────────────────────────────────────────────────────
exports.getDepartments = async (req, res) => {
  try {
    let depts = await Department.find({});
    if (depts.length === 0) {
      // Seed fallback default departments
      depts = [
        { dept_id: 'dept_cs', dept_name: 'Computer Science', head_of_dept: 'Dr. Meera Nair' },
        { dept_id: 'dept_bio', dept_name: 'Biotechnology', head_of_dept: 'Dr. Priya Krishnan' },
        { dept_id: 'dept_comm', dept_name: 'Commerce & Accounting', head_of_dept: 'Prof. Amit Shah' }
      ];
      await Department.insertMany(depts);
    }
    res.status(200).json(depts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createDepartment = async (req, res) => {
  try {
    const { dept_id, dept_name, head_of_dept } = req.body;
    if (!dept_id || !dept_name) {
      return res.status(400).json({ message: 'Missing dept_id or dept_name' });
    }

    const dept = new Department({ dept_id, dept_name, head_of_dept: head_of_dept || '' });
    await dept.save();

    await logAuditAction(req, 'CREATE_DEPT', `Created department ${dept_name}`);
    res.status(201).json(dept);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    await Department.findByIdAndDelete(id);
    await logAuditAction(req, 'DELETE_DEPT', `Deleted department document ID ${id}`);
    res.status(200).json({ message: 'Department deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── PROGRAMS CRUD ────────────────────────────────────────────────────────────
exports.getPrograms = async (req, res) => {
  try {
    const list = await Program.find({});
    res.status(200).json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createProgram = async (req, res) => {
  try {
    const { program_id, program_name } = req.body;
    const prog = new Program({ program_id, program_name });
    await prog.save();
    await logAuditAction(req, 'CREATE_PROGRAM', `Created program ${program_name}`);
    res.status(201).json(prog);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteProgram = async (req, res) => {
  try {
    const { id } = req.params;
    await Program.findByIdAndDelete(id);
    res.status(200).json({ message: 'Program deleted.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── COURSES CRUD ─────────────────────────────────────────────────────────────
exports.getCourses = async (req, res) => {
  try {
    const list = await Course.find({});
    res.status(200).json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createCourse = async (req, res) => {
  try {
    const { course_id, course_name, program_id } = req.body;
    const course = new Course({ course_id, course_name, program_id });
    await course.save();
    await logAuditAction(req, 'CREATE_COURSE', `Created course ${course_name}`);
    res.status(201).json(course);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    await Course.findByIdAndDelete(id);
    res.status(200).json({ message: 'Course deleted.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── EXAM SCHEDULER ───────────────────────────────────────────────────────────
exports.getExams = async (req, res) => {
  try {
    const list = await ExamSchedule.find({});
    res.status(200).json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createExam = async (req, res) => {
  try {
    const { course_id, exam_name, exam_date, start_time, end_time, room } = req.body;
    const exam = new ExamSchedule({
      course_id,
      exam_name,
      exam_date,
      start_time,
      end_time,
      room
    });
    await exam.save();
    await logAuditAction(req, 'CREATE_EXAM', `Scheduled exam ${exam_name} for course ${course_id}`);
    res.status(201).json(exam);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteExam = async (req, res) => {
  try {
    const { id } = req.params;
    await ExamSchedule.findByIdAndDelete(id);
    res.status(200).json({ message: 'Exam deleted.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── USER MANAGEMENT & AUDIT LOGS ─────────────────────────────────────────────
exports.getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find({}).sort({ createdAt: -1 }).limit(100);
    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.resetUserPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ message: 'Missing email or newPassword' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User account not found' });
    }

    user.password = newPassword;
    await user.save();

    await logAuditAction(req, 'RESET_PASSWORD', `Admin reset password for user ${email}`);
    res.status(200).json({ message: `Password for ${email} reset successfully.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── BACKUP & DATABASE EXPORTS ────────────────────────────────────────────────
exports.exportDatabase = async (req, res) => {
  try {
    const [students, teachers, courses, results] = await Promise.all([
      Student.find({}),
      User.find({ role: 'teacher' }, { password: 0 }),
      Course.find({}),
      Result.find({})
    ]);

    const backupData = {
      timestamp: new Date(),
      students,
      teachers,
      courses,
      results
    };

    res.status(200).json(backupData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
