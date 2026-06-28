const mongoose = require('mongoose');

const ChatHistorySchema = new mongoose.Schema(
  {
    student_id: {
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
    collection: 'chat_history',
    timestamps: true
  }
);

// Compound index to speed up retrieval of session history
ChatHistorySchema.index({ student_id: 1, course_id: 1, session_id: 1, timestamp: 1 });

module.exports = mongoose.model('ChatHistory', ChatHistorySchema);
