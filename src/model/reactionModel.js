const mongoose = require("mongoose");

const reactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // References the User model
      required: true,
    },
    content: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Content", // References the Content model
      required: true,
    },
    type: {
      type: String,
      enum: ["like", "heart", "care", "angry", "laugh"], // Allowed reaction types
      required: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt timestamps
  }
);

// Ensure a user can only react once per content with the same reaction type
reactionSchema.index({ user: 1, content: 1, type: 1 }, { unique: true });

const Reaction = mongoose.model("Reaction", reactionSchema);

module.exports = Reaction;
