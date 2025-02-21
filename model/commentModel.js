const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: [500, "Comment should be a maximum of 500 characters"],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Content", // Assuming comments are for posts/tweets in the Content model
      required: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
  }
);

const Comment = mongoose.model("Comment", commentSchema);

module.exports = Comment;
