const mongoose = require("mongoose");

const shareSchema = new mongoose.Schema(
  {
    content: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Content",
      required: true, // Each share must be associated with a content
    },
    sharedWith: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // Reference to the User model
      },
    ],
    sharedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // User who shared the content
    },
  },
  { timestamps: true }
);

const Share = mongoose.model("Share", shareSchema);

module.exports = Share;
