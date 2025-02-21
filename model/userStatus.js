const mongoose = require("mongoose");

const userStatusSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  isOnline: {
    type: Boolean,
    default: false,
  },
  lastSeen: {
    type: Date,
    default: null,
  },
});

module.exports = mongoose.model("UserStatus", userStatusSchema);
