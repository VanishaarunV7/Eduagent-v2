const mongoose = require('mongoose');

const PreviousYearAnalysisSchema = new mongoose.Schema(
  {
    courseId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    queryTerm: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    analysisData: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    sources: [
      {
        title: String,
        url: String
      }
    ],
    analyzedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    collection: 'previous_year_analysis',
    timestamps: true
  }
);

PreviousYearAnalysisSchema.index({ courseId: 1, queryTerm: 1 });

module.exports = mongoose.model('PreviousYearAnalysis', PreviousYearAnalysisSchema);
