const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { protectPrivateUserFields } = require('../../utils/privateUserFields');

const adminSchema = new mongoose.Schema({
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
    default: 'admin'
  },
  name: {
    type: String,
    default: 'Admin'
  },
  profilePic: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
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
adminSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Method to compare password
adminSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

protectPrivateUserFields(adminSchema);

module.exports = mongoose.model('Admin', adminSchema);
