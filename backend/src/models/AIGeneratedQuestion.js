const mongoose = require('mongoose');

const AIGeneratedQuestionSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    courseId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    type: {
      type: String,
      required: true,
      enum: ['mcq', 'two_mark', 'five_mark', 'ten_mark', 'other'],
      trim: true
    },
    content: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    generatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    collection: 'ai_generated_questions',
    timestamps: true
  }
);

AIGeneratedQuestionSchema.index({ studentId: 1, courseId: 1, type: 1 });

module.exports = mongoose.model('AIGeneratedQuestion', AIGeneratedQuestionSchema);
