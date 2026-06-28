const mongoose = require('mongoose');

const OutcomeSchema = new mongoose.Schema(
  {
    outcome_id: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    course_id: {
      type: String,
      required: true,
      trim: true
    },
    outcome_name: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    collection: 'outcomes',
    timestamps: true
  }
);

module.exports = mongoose.model('Outcome', OutcomeSchema);
