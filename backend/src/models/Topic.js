const mongoose = require('mongoose');

const TopicSchema = new mongoose.Schema(
  {
    topic_id: {
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
    topic_name: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    collection: 'topics',
    timestamps: true
  }
);

module.exports = mongoose.model('Topic', TopicSchema);
