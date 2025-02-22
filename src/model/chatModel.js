const mongoose = require("mongoose");
const { Schema } = mongoose;

// Define the Message subdocument schema
const messageSchema = new Schema(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
    },
    // Refactored media field as an array of subdocuments
    media: {
      type: [
        {
          url: { type: String, required: true },
          type: { type: String, required: true }, // e.g., "image", "video"
        },
      ],
      default: [],
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
    // Track which users have deleted this message (soft-delete)
    deletedFor: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    // New isRead field to track if the message has been read.
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
    _id: true, // Mongoose will automatically generate an _id for each subdocument
  }
);

// Define the Chat schema
const chatSchema = new Schema(
  {
    // Participants in the chat (could be two or more users)
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    // Array of embedded messages
    messages: [messageSchema],
    // Field to archive the entire conversation
    archived: {
      type: Boolean,
      default: false,
    },
    deletedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt for the chat
  }
);

// Create the Chat model
const Chat = mongoose.model("Chat", chatSchema);

module.exports = Chat;
