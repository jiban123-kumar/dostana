const mongoose = require("mongoose");

const emailVerificationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  otp: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  isAccountVerified: {
    type: Boolean,
    default: false,
  },

  lastOtpRequestedAt: {
    type: Date,
    default: null,
  },
});

emailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 10 * 60 });

const EmailVerification = mongoose.model("EmailVerification", emailVerificationSchema);

module.exports = EmailVerification;
