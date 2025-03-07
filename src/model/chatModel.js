const mongoose = require("mongoose");
const { Schema } = mongoose;

const messageSchema = new Schema(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: String,
    media: [
      {
        url: { type: String, required: true },
        type: { type: String, required: true },
      },
    ],
    deletedFor: [Schema.Types.ObjectId],
    isRead: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
    _id: true,
  }
);

const chatSchema = new Schema(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    messages: [messageSchema],
    archivedBy: { type: [Schema.Types.ObjectId], default: [] },
    deletedFor: [Schema.Types.ObjectId],
  },
  {
    timestamps: true,
  }
);

const Chat = mongoose.model("Chat", chatSchema);
module.exports = Chat;
