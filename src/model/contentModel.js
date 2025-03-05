const mongoose = require("mongoose");

const contentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["thought", "post"], // Distinguishes between tweet and post
      required: true,
    },
    caption: {
      type: String, // For tweets or post descriptions
      trim: true,
    },
    mediaUrl: {
      type: [String], // Array of strings for media URLs
    },
    mediaType: {
      type: String,
      enum: ["image", "video"],
      default: "image",
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    savedBy: {
      type: [mongoose.Schema.Types.ObjectId], // Array of user references who saved the content
      ref: "User",
      default: [], // Default to an empty array
    },
    sharedWith: {
      type: [mongoose.Schema.Types.ObjectId], // Array of user references to whom the content is shared
      ref: "User",
    },
    sharedBy: {
      type: mongoose.Schema.Types.ObjectId, // User who shared the content
      ref: "User",
    },
  },
  { timestamps: true }
);

const Content = mongoose.model("Content", contentSchema);

module.exports = Content;
