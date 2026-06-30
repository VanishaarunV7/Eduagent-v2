const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema(
  {
    student_id: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    program_id: {
      type: String,
      required: true,
      trim: true
    },
    batch: {
      type: String,
      required: true,
      trim: true
    },
    gender: {
      type: String,
      enum: ['Male', 'Female'],
      required: true,
      default: 'Male'
    }
  },
  {
    collection: 'students',
    timestamps: true
  }
);

module.exports = mongoose.model('Student', StudentSchema);
