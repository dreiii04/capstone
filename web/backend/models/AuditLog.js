const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  method: {
    type: String,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  ip: {
    type: String,
    required: true
  },
  userEmail: {
    type: String,
    default: 'Anonymous'
  },
  statusCode: {
    type: Number,
    required: true
  },
  durationMs: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    expires: 30 * 24 * 60 * 60 // 30 days TTL (based on open question suggestion)
  }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
