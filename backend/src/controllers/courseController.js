const Student = require('../models/Student');
const Course = require('../models/Course');

// @desc    Get courses associated with student's program
// @route   GET /api/students/:studentId/courses
// @access  Public
exports.getCoursesByStudentId = async (req, res) => {
  try {
    const studentId = req.user.role === 'student' ? req.user.student_id : req.params.studentId;

    // 1. Find student by student_id
    const student = await Student.findOne({ student_id: studentId });
    if (!student) {
      return res.status(404).json({ message: `Student with ID '${studentId}' not found` });
    }

    // 2. Find all courses matching that program_id
    const courses = await Course.find({ program_id: student.program_id }, { _id: 0, __v: 0 });

    // 3. Return structured response
    res.status(200).json({
      student_id: student.student_id,
      student_name: student.name,
      program_id: student.program_id,
      courses
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
