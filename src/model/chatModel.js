const mongoose = require("mongoose");
const { Schema } = mongoose;

const messageSchema = new Schema(
  {
    sender: {
      _id: { type: Schema.Types.ObjectId, required: true },
      firstName: String,
      lastName: String,
      profileImage: String,
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
        _id: { type: Schema.Types.ObjectId, required: true },
        firstName: String,
        lastName: String,
        profileImage: String,
      },
    ],
    messages: [messageSchema],
    archived: { type: Boolean, default: false },
    deletedBy: [Schema.Types.ObjectId],
  },
  {
    timestamps: true,
  }
);

const Chat = mongoose.model("Chat", chatSchema);
module.exports = Chat;
