const Student = require('../models/Student');
const Course = require('../models/Course');
const ExamSchedule = require('../models/ExamSchedule');

// @desc    Get exam schedules for all courses in the student's program
// @route   GET /api/exams/:studentId
// @access  Public
exports.getExamsByStudentId = async (req, res) => {
  try {
    const studentId = req.user.role === 'student' ? req.user.student_id : req.params.studentId;

    // Check if student exists
    const student = await Student.findOne({ student_id: studentId });
    if (!student) {
      return res.status(404).json({ message: `Student with ID '${studentId}' not found` });
    }

    // Find all courses associated with the student's program
    const courses = await Course.find({ program_id: student.program_id });
    const courseIds = courses.map(c => c.course_id);

    // Find all exam schedules for these courses
    const schedules = await ExamSchedule.find({ course_id: { $in: courseIds } }, { _id: 0, __v: 0 });

    res.status(200).json(schedules);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
