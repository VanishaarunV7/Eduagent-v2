const mongoose = require('mongoose');

const AnnouncementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    content: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      enum: ['Holiday', 'Assignment', 'Exam', 'Cancellation', 'Workshop', 'Placement', 'General'],
      default: 'General'
    },
    target_type: {
      type: String,
      enum: ['all', 'program', 'course'],
      default: 'all'
    },
    target_id: {
      type: String,
      default: ''
    },
    created_by: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    collection: 'announcements',
    timestamps: true
  }
);

module.exports = mongoose.model('Announcement', AnnouncementSchema);
