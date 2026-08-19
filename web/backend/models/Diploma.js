const mongoose = require('mongoose');

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
  generatedBy: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('Diploma', diplomaSchema);
