const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema(
  {
    course_id: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    course_name: {
      type: String,
      required: true,
      trim: true
    },
    program_id: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    collection: 'courses',
    timestamps: true
  }
);

module.exports = mongoose.model('Course', CourseSchema);
