const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema(
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
    date: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['Present', 'Absent'],
      required: true,
      default: 'Present'
    },
    lecture_number: {
      type: Number,
      required: false
    }
  },
  {
    collection: 'attendance',
    timestamps: true
  }
);

module.exports = mongoose.model('Attendance', AttendanceSchema);
