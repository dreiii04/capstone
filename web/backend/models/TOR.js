const mongoose = require('mongoose');
const { applyStoredPdfProtection } = require('../utils/storedPdf');

const gradeEntrySchema = new mongoose.Schema({
  academicYear: {
    type: String,
    required: true
  },
  semester: {
    type: String,
    required: true
  },
  subjectCode: {
    type: String,
    required: true
  },
  subjectName: {
    type: String,
    required: true
  },
  units: {
    type: Number,
    required: true
  },
  grade: {
    type: Number,
    required: true
  }
}, { _id: false });

const torSchema = new mongoose.Schema({
  torId: {
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
  yearLevel: {
    type: String,
    default: ''
  },
  grades: [gradeEntrySchema],
  gwa: {
    type: Number,
    default: 0
  },
  totalUnits: {
    type: Number,
    default: 0
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

applyStoredPdfProtection(torSchema);

module.exports = mongoose.model('TOR', torSchema);
