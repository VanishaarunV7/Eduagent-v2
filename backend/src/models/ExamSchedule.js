const mongoose = require('mongoose');

const ExamScheduleSchema = new mongoose.Schema(
  {
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
    exam_date: {
      type: String,
      required: true,
      trim: true
    },
    start_time: {
      type: String,
      required: true,
      trim: true
    },
    end_time: {
      type: String,
      required: true,
      trim: true
    },
    room: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    collection: 'exam_schedule',
    timestamps: true
  }
);

module.exports = mongoose.model('ExamSchedule', ExamScheduleSchema);
