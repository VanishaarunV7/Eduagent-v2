const mongoose = require('mongoose');

const AssignmentSubmissionSchema = new mongoose.Schema(
  {
    assignment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: true
    },
    student_id: {
      type: String,
      required: true,
      trim: true
    },
    submitted_at: {
      type: Date,
      default: Date.now
    },
    file_url: {
      type: String,
      trim: true
    },
    marks_obtained: {
      type: Number,
      default: null
    },
    feedback: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    collection: 'assignment_submissions',
    timestamps: true
  }
);

module.exports = mongoose.model('AssignmentSubmission', AssignmentSubmissionSchema);
