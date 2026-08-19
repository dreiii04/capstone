const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  documentId: {
    type: String,
    required: true,
    unique: true
  },
  category: {
    type: String,
    enum: ['Certification', 'Certified True Copy', 'Transcript of Records'],
    required: true
  },
  documentType: {
    type: String,
    required: true
    // e.g. 'Certificate of Enrollment', 'CTC of Diploma', 'Transcript of Records'
  },
  studentName: {
    type: String,
    required: true
  },
  studentId: {
    type: String,
    required: true
  },
  course: {
    type: String,
    default: ''
  },
  yearLevel: {
    type: String,
    default: ''
  },
  purpose: {
    type: String,
    default: ''
  },
  // Link to a student request (optional)
  linkedRequestId: {
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
  documentHash: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  generatedBy: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('Document', documentSchema);
