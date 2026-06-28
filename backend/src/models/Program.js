const mongoose = require('mongoose');

const ProgramSchema = new mongoose.Schema(
  {
    program_id: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    program_name: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    collection: 'programs',
    timestamps: true
  }
);

module.exports = mongoose.model('Program', ProgramSchema);
