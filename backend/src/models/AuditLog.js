const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true
    },
    action: {
      type: String,
      required: true,
      trim: true
    },
    details: {
      type: String,
      trim: true
    },
    ipAddress: {
      type: String,
      default: '127.0.0.1'
    }
  },
  {
    collection: 'audit_logs',
    timestamps: true
  }
);

module.exports = mongoose.model('AuditLog', AuditLogSchema);
