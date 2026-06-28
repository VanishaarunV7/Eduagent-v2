const mongoose = require('mongoose');

const ResultSchema = new mongoose.Schema(
  {
    student_id: {
      type: String,
      required: true,
      trim: true
    },
    course_id: {
      type: String,
      required: true,
      trim: true
    },
    exam_name: {
      type: String,
      required: true,
      trim: true
    },
    marks: {
      type: Number,
      required: true
    },
    total_marks: {
      type: Number,
      required: true
    }
  },
  {
    collection: 'results',
    timestamps: true
  }
);

// Compound index to guarantee uniqueness for a student's result per exam per course
ResultSchema.index({ student_id: 1, course_id: 1, exam_name: 1 }, { unique: true });

module.exports = mongoose.model('Result', ResultSchema);
