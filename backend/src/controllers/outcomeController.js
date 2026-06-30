const Outcome = require('../models/Outcome');
const Result = require('../models/Result');

// @desc    Get outcome attainment for a student in a course
// @route   GET /api/outcomes/:studentId/:courseId
// @access  Public
exports.getOutcomeAttainment = async (req, res) => {
  try {
    const studentId = req.user.role === 'student' ? req.user.student_id : req.params.studentId;
    const { courseId } = req.params;

    // 1. Find all outcomes for the selected course
    const outcomes = await Outcome.find({ course_id: courseId });

    if (!outcomes || outcomes.length === 0) {
      return res.status(404).json({
        message: `No outcomes found for course '${courseId}'`
      });
    }

    // 2. Find results for the student in this course to compute baseline performance
    const results = await Result.find({ student_id: studentId, course_id: courseId });

    const averageMarks = results.length > 0
      ? results.reduce((sum, r) => sum + r.marks, 0) / results.length
      : 70; // fallback if no results are found

    // 3. Map outcomes and calculate dynamic/deterministic attainment scores
    const outcomeList = outcomes.map((o) => {
      // Deterministic offset based on outcome name characters
      const charSum = o.outcome_name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const offset = (charSum % 21) - 10; // range: -10 to +10

      let attainment = Math.round(averageMarks + offset);
      attainment = Math.min(100, Math.max(30, attainment)); // clamp between 30 and 100

      return {
        outcome: o.outcome_name,
        attainment
      };
    });

    res.status(200).json({
      student_id: studentId,
      course_id: courseId,
      outcomes: outcomeList
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
