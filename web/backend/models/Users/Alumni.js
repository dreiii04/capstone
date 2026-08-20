const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { protectPrivateUserFields } = require('../../utils/privateUserFields');

const alumniSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    default: 'alumni',
    enum: ['student', 'alumni']
  },
  studentId: {
    type: String,
    unique: true,
    sparse: true
  },
  course: {
    type: String,
    default: ''
  },
  yearLevel: {
    type: String,
    default: ''
  },
  profilePic: {
    type: String,
    default: ''
  },
  phoneNumber: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Inactive'
  },
  studentStatus: { type: String, default: 'alumni' },
  educationalLevel: { type: String, default: '' },
  yearGraduated: { type: String, default: '' },
  lastYearAttended: { type: String, default: '' },
  lastGradeLevelCompleted: { type: String, default: '' },
  lastYearLevelCompleted: { type: String, default: '' },
  sessionVersion: { type: Number, default: 0 },
  tokensValidAfter: { type: Date },
  refreshTokens: [{
    tokenHash: { type: String, required: true },
    sessionVersion: { type: Number, default: 0 },
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true }
  }]
}, { timestamps: true });

// Hash password before saving
alumniSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Method to compare password
alumniSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

protectPrivateUserFields(alumniSchema);

module.exports = mongoose.model('Alumni', alumniSchema, 'alumni');
