const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: String,
    default: '',
    index: true
  },
  message: {
    type: String,
    required: true
  },
  email: {
    type: String,
    default: '',
    index: true,
    lowercase: true,
    trim: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  date: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

delete mongoose.models.Notification;
module.exports = mongoose.model('Notification', notificationSchema);
