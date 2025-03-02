const mongoose = require("mongoose");

const notificationDetailSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    pushNotification: {
      type: Boolean,
      default: true,
    },
    type: {
      type: String,
      enum: ["friend_request_sent", "friend_request_accepted", "content-reaction", "content-share", "content-comment"],
      required: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    // Indicates if a notification has been read
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true, _id: true }
);

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Renamed field: bulletNotificationEnabled
    bulletNotificationEnabled: {
      type: Boolean,
      default: true,
    },
    details: {
      type: [notificationDetailSchema],
      default: [],
    },
  },
  { timestamps: true }
);

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;
