const mongoose = require('mongoose');

const PDFDocumentSchema = new mongoose.Schema(
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
    course: {
      type: String,
      required: true,
      trim: true
    },
    studentId: {
      type: String,
      required: true,
      trim: true
    },
    uploadDate: {
      type: Date,
      default: Date.now
    },
    pages: {
      type: Number,
      default: 0
    },
    chunksCount: {
      type: Number,
      default: 0
    }
  },
  {
    collection: 'pdf_documents',
    timestamps: true
  }
);

module.exports = mongoose.model('PDFDocument', PDFDocumentSchema);
