const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  userEmail: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true
  },
  type: {
    type: String,
    default: '------'
  },
  status: {
    type: String,
    enum: ['Successful', 'Process', 'Failed', 'Canceled'],
    default: 'Successful'
  },
  details: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
