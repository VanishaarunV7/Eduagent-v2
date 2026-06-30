const mongoose = require('mongoose');

const TeacherChatHistorySchema = new mongoose.Schema(
  {
    teacher_id: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    course_id: {
      type: String,
      trim: true,
      index: true
    },
    session_id: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    role: {
      type: String,
      required: true,
      enum: ['user', 'assistant']
    },
    message: {
      type: String,
      required: true
    },
    agent_used: {
      type: String,
      trim: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  {
    collection: 'teacher_chat_history',
    timestamps: true
  }
);

TeacherChatHistorySchema.index({ teacher_id: 1, course_id: 1, session_id: 1, timestamp: 1 });

module.exports = mongoose.model('TeacherChatHistory', TeacherChatHistorySchema);
