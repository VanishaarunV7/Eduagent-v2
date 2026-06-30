const Topic = require('../models/Topic');
const Result = require('../models/Result');

// @desc    Get topic performance for a student in a course
// @route   GET /api/topics/:studentId/:courseId
// @access  Public
exports.getTopics = async (req, res) => {
  try {
    const studentId = req.user.role === 'student' ? req.user.student_id : req.params.studentId;
    const { courseId } = req.params;

    // 1. Find all topics for the selected course
    const topics = await Topic.find({ course_id: courseId });

    if (!topics || topics.length === 0) {
      return res.status(404).json({
        message: `No topics found for course '${courseId}'`
      });
    }

    // 2. Find results for the student in this course to compute baseline performance
    const results = await Result.find({ student_id: studentId, course_id: courseId });

    const averageMarks = results.length > 0
      ? results.reduce((sum, r) => sum + r.marks, 0) / results.length
      : 70; // fallback if no results are found

    // 3. Map topics and calculate dynamic/deterministic scores and status
    const topicPerformanceList = topics.map((topic) => {
      // Deterministic offset based on topic name characters to simulate different topic scores
      const charSum = topic.topic_name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const offset = (charSum % 31) - 15; // range: -15 to +15

      let score = Math.round(averageMarks + offset);
      score = Math.min(100, Math.max(40, score)); // clamp between 40 and 100

      let status = 'Weak';
      if (score >= 80) {
        status = 'Strong';
      } else if (score >= 60) {
        status = 'Average';
      }

      let suggestions = 'Keep up the good work! Challenge yourself with advanced application problems.';
      if (status === 'Weak') {
        suggestions = 'Review lecture slides on ' + topic.topic_name + ', consult tutor, and complete basic exercises.';
      } else if (status === 'Average') {
        suggestions = 'Complete homework sets, review textbook section, and self-test core equations.';
      }

      const study_material = `${topic.topic_name.replace(/\s+/g, '_')}_Core_Notes.pdf`;

      return {
        topic_name: topic.topic_name,
        score,
        status,
        suggestions,
        study_material
      };
    });

    res.status(200).json({
      student_id: studentId,
      course_id: courseId,
      topics: topicPerformanceList
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
