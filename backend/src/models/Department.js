const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema(
  {
    dept_id: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    dept_name: {
      type: String,
      required: true,
      trim: true
    },
    head_of_dept: {
      type: String,
      default: ''
    }
  },
  {
    collection: 'departments',
    timestamps: true
  }
);

module.exports = mongoose.model('Department', DepartmentSchema);
