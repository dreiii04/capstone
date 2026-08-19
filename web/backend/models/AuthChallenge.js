const mongoose = require('mongoose');

const authChallengeSchema = new mongoose.Schema({
  purpose: { type: String, required: true },
  email: { type: String, required: true },
  challengeTokenHash: { type: String, required: true },
  otpHash: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

authChallengeSchema.index({ purpose: 1, email: 1 }, { unique: true });

module.exports = mongoose.models.AuthChallenge ||
  mongoose.model('AuthChallenge', authChallengeSchema);
