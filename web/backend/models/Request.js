const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  requestId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: String,
    default: '',
    index: true
  },
  name: {
    type: String,
    required: true
  },
  studentId: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    default: '',
    index: true,
    lowercase: true,
    trim: true
  },
  course: {
    type: String,
    default: ''
  },
  yearLevel: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: [
      'Pending for Payment',
      'Pending',
      'Needs Update',
      'In Process',
      'Released',
      'Ready to Claim',
      'Claimed',
      'Refund Approved',
      'Refunded',
      'Completed',
      'Rejected',
    ],
    default: 'Pending for Payment'
  },
  refundStatus: {
    type: String,
    default: ''
  },
  claimedAt: {
    type: Date,
    default: null
  },
  processingStartedAt: { type: Date, default: null },
  processingDays: { type: Number, min: 1, default: null },
  estimatedCompletionDate: { type: String, default: '' },
  estimatedProcessingStart: { type: Date, default: null },
  estimatedProcessingEnd: { type: Date, default: null },
  rejectionReason: {
    type: String,
    default: ''
  },
  correctionType: { type: String, default: '' },
  remarks: { type: String, default: '' },
  mobileStatus: { type: String, default: '' },
  statusHistory: { type: [mongoose.Schema.Types.Mixed], default: [] },
  paymentReceiptId: { type: String, default: '' },
  documentType: {
    type: String,
    required: true
  },
  subDocumentType: {
    type: String,
    default: ''
  },
  purpose: {
    type: String,
    default: ''
  },
  otherPurpose: {
    type: String,
    default: ''
  },
  quantity: {
    type: Number,
    default: 1
  },
  documentPrice: {
    type: Number,
    min: 0,
    default: 0
  },
  processingFee: {
    type: Number,
    min: 0,
    default: 0
  },
  totalAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  documentHash: {
    type: String
  },
  verificationCode: {
    type: String,
    select: false,
    index: true,
    sparse: true,
    unique: true
  },
  documentFile: {
    type: String,
    select: false
  },
  hasDocument: {
    type: Boolean,
    default: false
  },
  blockchainStatus: {
    type: String,
    enum: ['', 'Pending', 'Recorded', 'Failed'],
    default: ''
  },
  blockchainTxHash: {
    type: String,
    default: ''
  },
  blockchainBlockNumber: {
    type: Number,
    default: null
  },
  dateRequested: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

delete mongoose.models.Request;
module.exports = mongoose.model('Request', requestSchema);
