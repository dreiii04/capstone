const mongoose = require('mongoose');

const loginLockoutSchema = new mongoose.Schema({
  ip: {
    type: String,
    required: true,
    unique: true
  },
  failures: {
    type: Number,
    required: true,
    default: 0
  },
  lockedUntil: {
    type: Date,
    default: null
  },
  lastAttempt: {
    type: Date,
    default: Date.now,
    expires: 24 * 60 * 60 // 24 hours TTL, document auto-deletes if no activity
  }
});

module.exports = mongoose.model('LoginLockout', loginLockoutSchema);
