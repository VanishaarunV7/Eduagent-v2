const Student = require('../models/Student');

// @desc    Get all students
// @route   GET /api/students
// @access  Public
exports.getStudents = async (req, res) => {
  try {
    if (req.user && req.user.role === 'student') {
      return res.status(403).json({ message: "Access denied. Student cannot view other students." });
    }
    const students = await Student.find({}, { _id: 0, __v: 0 });
    res.status(200).json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single student by studentId
// @route   GET /api/students/:studentId
// @access  Public
// Enforce JWT student_id matching for student role
exports.getStudentById = async (req, res) => {
  try {
    const studentId = req.user.role === 'student' ? req.user.student_id : req.params.studentId;
    const student = await Student.findOne({ student_id: studentId }, { _id: 0, __v: 0 });
    if (!student) {
      return res.status(404).json({ message: `Student with ID '${studentId}' not found` });
    }
    res.status(200).json(student);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const AssignmentSubmission = require('../models/AssignmentSubmission');

exports.submitAssignment = async (req, res) => {
  try {
    const studentId = req.user.role === 'student' ? req.user.student_id : req.params.studentId;
    const { assignment_id, file_url } = req.body;
    if (!assignment_id) {
      return res.status(400).json({ message: 'Missing assignment_id' });
    }

    const submission = await AssignmentSubmission.findOneAndUpdate(
      { assignment_id, student_id: studentId },
      {
        submitted_at: new Date(),
        file_url: file_url || 'http://localhost:5000/uploads/assignment_submit.pdf',
        marks_obtained: null,
        feedback: ''
      },
      { upsert: true, new: true }
    );

    res.status(200).json({ message: 'Assignment submitted successfully', submission });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
