const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: String,
    default: '',
    index: true
  },
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  requestId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  documentType: {
    type: String,
    required: true
  },
  paymentMode: {
    type: String,
    enum: ['GCash', 'Maya', 'GoThyme', 'Other Online Payment'],
    default: 'GCash'
  },
  amount: {
    type: String,
    default: '0.00'
  },
  receiptImage: {
    type: String,
    default: ''
  },
  payerName: {
    type: String,
    default: ''
  },
  payerEmail: {
    type: String,
    default: '',
    index: true,
    lowercase: true,
    trim: true
  },
  payerType: {
    type: String,
    enum: ['Student', 'Alumni'],
    default: 'Student'
  },
  adminRemarks: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Pending Verification', 'Completed', 'Needs Update', 'Rejected', 'Refunded'],
    default: 'Pending Verification'
  },
  verifiedBy: {
    type: String,
    default: ''
  },
  verifiedAt: {
    type: Date
  },
  date: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
