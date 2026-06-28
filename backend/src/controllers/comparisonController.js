const Result = require('../models/Result');

// @desc    Get comparison data for a student in a course
// @route   GET /api/comparison/:studentId/:courseId
// @access  Public
exports.getComparisonData = async (req, res) => {
  try {
    const { studentId, courseId } = req.params;

    // Find all results matching the student and course
    const results = await Result.find({ student_id: studentId, course_id: courseId });

    if (!results || results.length === 0) {
      return res.status(404).json({
        message: `No results found for student '${studentId}' in course '${courseId}'`
      });
    }

    // Initialize marks variables
    let internal1 = null;
    let internal2 = null;
    let internal3 = null;

    results.forEach((r) => {
      const examName = r.exam_name.toLowerCase();
      if (examName.includes('internal 1')) {
        internal1 = r.marks;
      } else if (examName.includes('internal 2')) {
        internal2 = r.marks;
      } else if (examName.includes('internal 3')) {
        internal3 = r.marks;
      }
    });

    // Create an array of non-null marks to compute stats
    const marksArray = [internal1, internal2, internal3].filter((m) => m !== null);

    if (marksArray.length === 0) {
      return res.status(400).json({
        message: `No internal marks recorded for student '${studentId}' in course '${courseId}'`
      });
    }

    // Calculate metrics
    const totalSum = marksArray.reduce((acc, curr) => acc + curr, 0);
    const average = parseFloat((totalSum / marksArray.length).toFixed(2));
    const highest = Math.max(...marksArray);
    const lowest = Math.min(...marksArray);

    // Calculate improvement percentage: ((Internal3 - Internal1) / Internal1) * 100
    let improvement = 0;
    if (internal1 !== null && internal3 !== null && internal1 !== 0) {
      improvement = parseFloat((((internal3 - internal1) / internal1) * 100).toFixed(2));
    }

    // Return the response object with requested fields only
    res.status(200).json({
      student_id: studentId,
      course_id: courseId,
      internal1,
      internal2,
      internal3,
      average,
      highest,
      lowest,
      improvement
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
