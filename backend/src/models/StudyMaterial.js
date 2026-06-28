const mongoose = require('mongoose');

const StudyMaterialSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
      trim: true
    },
    filePath: {
      type: String,
      required: true,
      trim: true
    },
    courseId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    studentId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    subject: {
      type: String,
      trim: true
    },
    fileType: {
      type: String,
      required: true,
      enum: ['pdf', 'docx', 'pptx', 'image'],
      trim: true
    },
    uploadDate: {
      type: Date,
      default: Date.now
    },
    pages: {
      type: Number,
      default: 1
    },
    chunksCount: {
      type: Number,
      default: 0
    }
  },
  {
    collection: 'study_materials',
    timestamps: true
  }
);

StudyMaterialSchema.index({ studentId: 1, courseId: 1 });

module.exports = mongoose.model('StudyMaterial', StudyMaterialSchema);
