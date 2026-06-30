const mongoose = require('mongoose');

const AssignmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    course_id: {
      type: String,
      required: true,
      trim: true
    },
    teacher_id: {
      type: String,
      required: true,
      trim: true
    },
    due_date: {
      type: Date,
      required: true
    },
    max_marks: {
      type: Number,
      default: 100
    }
  },
  {
    collection: 'assignments',
    timestamps: true
  }
);

module.exports = mongoose.model('Assignment', AssignmentSchema);
