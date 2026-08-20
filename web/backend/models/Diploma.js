const mongoose = require('mongoose');
const { applyStoredPdfProtection } = require('../utils/storedPdf');

const diplomaSchema = new mongoose.Schema({
  diplomaId: {
    type: String,
    required: true,
    unique: true
  },
  studentId: {
    type: String,
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  course: {
    type: String,
    required: true
  },
  honors: {
    type: String,
    default: ''
  },
  dateOfGraduation: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Draft', 'Finalized', 'Released'],
    default: 'Draft'
  },
  pdfPath: {
    type: String,
    default: ''
  },
  pdfData: {
    type: String,
    default: '',
    select: false
  },
  documentHash: {
    type: String,
    default: '',
    index: true
  },
  blockchainStatus: {
    type: String,
    enum: ['', 'Recorded', 'Failed'],
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
  generatedBy: {
    type: String,
    default: ''
  }
}, { timestamps: true });

applyStoredPdfProtection(diplomaSchema);

module.exports = mongoose.model('Diploma', diplomaSchema);
