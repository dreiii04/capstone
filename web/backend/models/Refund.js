const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema({
  userId: {
    type: String,
    default: '',
    index: true
  },
  refundId: {
    type: String,
    required: true,
    unique: true
  },
  transactionId: {
    type: String,
    required: true
  },
  requestId: {
    type: String,
    default: ''
  },
  studentName: {
    type: String,
    required: true
  },
  studentEmail: {
    type: String,
    default: '',
    index: true,
    lowercase: true,
    trim: true
  },
  amount: {
    type: String,
    default: '0.00'
  },
  reason: {
    type: String,
    enum: ['Duplicate Payment', 'Wrong Amount', 'Service Not Rendered', 'Other'],
    required: true
  },
  otherReason: {
    type: String,
    default: ''
  },
  userReason: { type: String, default: '' },
  refundMethod: { type: String, default: '' },
  accountName: { type: String, default: '' },
  accountNumber: { type: String, default: '' },
  bankName: { type: String, default: '' },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  processedBy: {
    type: String,
    default: ''
  },
  processedAt: {
    type: Date
  },
  adminRemarks: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('Refund', refundSchema);
