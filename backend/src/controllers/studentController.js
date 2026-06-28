const Student = require('../models/Student');

// @desc    Get all students
// @route   GET /api/students
// @access  Public
exports.getStudents = async (req, res) => {
  try {
    const students = await Student.find({}, { _id: 0, __v: 0 });
    res.status(200).json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single student by studentId
// @route   GET /api/students/:studentId
// @access  Public
exports.getStudentById = async (req, res) => {
  try {
    const { studentId } = req.params;
    const student = await Student.findOne({ student_id: studentId }, { _id: 0, __v: 0 });
    if (!student) {
      return res.status(404).json({ message: `Student with ID '${studentId}' not found` });
    }
    res.status(200).json(student);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
