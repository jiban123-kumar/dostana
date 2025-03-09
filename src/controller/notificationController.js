const Notification = require("../model/notificationModel");
const User = require("../model/userModel");
const catchAsync = require("../utilsFunction/catchAsync");
const CustomError = require("../utilsFunction/customError");
const { sendPushNotification } = require("../utilsFunction/sendPushNotification");

/**
 * Create a notification.
 */
const createNotification = catchAsync(async (req, res, next) => {
  const { type, action, userId, referenceId } = req.body;
  const senderId = req.user?.id;
  const sender = await User.findById(senderId);
  if (!sender) {
    return next(new CustomError("User not found", 404));
  }

  // Avoid self-notifications for specific types
  if ((type === "content-comment" || type === "content-reaction") && userId === senderId) {
    return res.status(200).json({});
  }

  // Add a new notification detail to the user's notifications document
  const notification = await Notification.findOneAndUpdate(
    { user: userId },
    {
      $push: { details: { sender: senderId, type, action, referenceId } },
    },
    { upsert: true, new: true }
  );

  // Populate sender details (e.g., firstName, lastName, profileImage)
  await notification.populate("details.sender", "firstName lastName profileImage");

  // Convert to plain object and sort the details by createdAt descending
  const notificationObj = notification.toObject();
  const sortedDetails = notificationObj.details.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const newNotificationDetail = sortedDetails[0];

  // Define push notification content and dynamic path based on notification type
  let title = "Notification";
  let body = "You have a new notification.";
  let path = "/"; // default path
  switch (type) {
    case "friend_request_sent":
      title = "Friend Request";
      body = `${sender.firstName} sent you a friend request.`;
      path = "/friend-requests";
      break;
    case "friend_request_accepted":
      title = "Friend Request Accepted";
      body = `${sender.firstName} accepted your friend request.`;
      path = "/friends";
      break;
    case "content-reaction":
      title = "New Reaction";
      body = `${sender.firstName} reacted to your content.`;
      // Direct user to view the content where the reaction was made
      path = `/home/content/${referenceId}`;
      break;
    case "content-share":
      title = "Content Shared";
      body = `${sender.firstName} shared your content.`;
      path = "/shared-feed";
      break;
    case "content-comment":
      title = "New Comment";
      body = `${sender.firstName} commented on your content.`;
      path = `/home/content/${referenceId}`;
      break;
    default:
      break;
  }

  // Send the push notification with the dynamic path
  await sendPushNotification({ userId, title, body, path });

  res.status(201).json({
    message: "Notification created successfully",
    notification: newNotificationDetail,
    userId,
  });
});

/**
 * Delete a specific notification detail.
 */
const deleteNotification = catchAsync(async (req, res, next) => {
  const { notificationId } = req.params;

  // Find the Notification document that contains the detail with the given ID.
  const notification = await Notification.findOne({ "details._id": notificationId });

  if (!notification) {
    return next(new CustomError("Notification not found", 404));
  }

  // Ensure that only the recipient can delete their notification detail.
  if (notification.user.toString() !== req.user?.id) {
    return next(new CustomError("You do not have permission to delete this notification", 403));
  }

  // Remove the specific notification detail.
  notification.details.pull(notificationId);

  // Optionally delete the entire document if no details remain.
  if (notification.details.length === 0) {
    await notification.deleteOne();
  } else {
    await notification.save();
  }

  res.status(200).json({
    message: "Notification deleted successfully",
  });
});

/**
 * Get all notifications for the logged-in user.
 * If the query parameter countOnly is "true", only the count is returned.
 */
const getNotifications = catchAsync(async (req, res, next) => {
  // Retrieve pagination parameters; defaults: page 1 and limit 10 notifications per page.
  const { countOnly, page = 1, limit = 10 } = req.query;

  // Find the Notification document for the logged-in user
  const notificationDoc = await Notification.findOne({ user: req.user?.id }).populate("details.sender", "firstName lastName profileImage");

  // The notifications are stored as subdocuments in the details array.
  const details = notificationDoc ? notificationDoc.details : [];
  const totalNotifications = details.length;

  // If only count is requested, return it.
  if (countOnly === "true") {
    return res.status(200).json({
      message: "Notification count retrieved successfully",
      totalNotifications,
    });
  }

  // Sort notifications by createdAt in descending order (most recent first)
  const sortedNotifications = details.sort((a, b) => b.createdAt - a.createdAt);

  // Paginate notifications
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const startIndex = (pageNum - 1) * limitNum;
  const endIndex = startIndex + limitNum;
  const paginatedNotifications = sortedNotifications.slice(startIndex, endIndex);
  const nextPage = endIndex < totalNotifications ? pageNum + 1 : null;

  res.status(200).json({
    message: "Notifications retrieved successfully",
    totalNotifications,
    notifications: paginatedNotifications,
    currentPage: pageNum,
    totalPages: Math.ceil(totalNotifications / limitNum),
    nextPage,
  });
});

/**
 * Delete all notifications for the logged-in user.
 */
const deleteAllNotifications = catchAsync(async (req, res, next) => {
  await Notification.findOneAndUpdate({ user: req.user?.id }, { details: [] });

  res.status(200).json({
    message: "All notifications deleted successfully",
  });
});

/**
 * Get the count of unread notifications for the logged-in user.
 */
const getUnreadNotificationCount = catchAsync(async (req, res, next) => {
  const notificationDoc = await Notification.findOne({ user: req.user?.id });
  let unreadCount = 0;
  if (notificationDoc && notificationDoc.details) {
    unreadCount = notificationDoc.details.filter((detail) => !detail.isRead).length;
  }
  res.status(200).json({
    message: "Unread notifications count retrieved successfully",
    unreadCount,
  });
});

/**
 * Get the list of unread notifications for the logged-in user.
 */
const getUnreadNotifications = catchAsync(async (req, res, next) => {
  const notificationDoc = await Notification.findOne({ user: req.user?.id }).populate("details.sender", "firstName lastName profileImage");

  const unreadNotifications = notificationDoc ? notificationDoc.details.filter((detail) => !detail.isRead) : [];

  // Optionally sort unread notifications by creation time (most recent first)
  unreadNotifications.sort((a, b) => b.createdAt - a.createdAt);

  res.status(200).json({
    message: "Unread notifications retrieved successfully",
    unreadNotifications,
  });
});

/**
 * Toggle the notifications setting (on/off) for the logged-in user.
 *
 * Expects a boolean value `enabled` in req.body.
 */
const toggleNotificationSetting = catchAsync(async (req, res, next) => {
  let notificationDoc = await Notification.findOne({ user: req.user?.id });
  // Use bulletNotificationEnabled instead of notificationEnabled
  const currentEnabled = notificationDoc ? notificationDoc.bulletNotificationEnabled : true;
  const newEnabled = !currentEnabled;

  notificationDoc = await Notification.findOneAndUpdate({ user: req.user?.id }, { bulletNotificationEnabled: newEnabled }, { new: true, upsert: true });

  res.status(200).json({
    message: "Notification setting toggled successfully",
    bulletNotificationEnabled: notificationDoc.bulletNotificationEnabled,
  });
});

/**
 * Get the current notifications setting (on/off) for the logged-in user.
 */
const getNotificationSetting = catchAsync(async (req, res, next) => {
  const notificationDoc = await Notification.findOne({ user: req.user?.id });
  // Default to true if no document exists
  const bulletNotificationEnabled = notificationDoc ? notificationDoc.bulletNotificationEnabled : true;

  res.status(200).json({
    message: "Notification setting retrieved successfully",
    bulletNotificationEnabled,
  });
});

const markNotificationsAsReadByIds = catchAsync(async (req, res, next) => {
  const { notificationIds } = req.body;

  if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
    return next(new CustomError("Please provide an array of notification IDs", 400));
  }

  // Update the notification document for the logged-in user,
  // setting isRead to true for all details with _id in the provided array.
  await Notification.updateOne({ user: req.user?.id }, { $set: { "details.$[elem].isRead": true } }, { arrayFilters: [{ "elem._id": { $in: notificationIds } }] });

  res.status(200).json({
    message: "Notifications marked as read successfully",
  });
});

module.exports = {
  createNotification,
  deleteNotification,
  getNotifications,
  deleteAllNotifications,
  getUnreadNotificationCount,
  getUnreadNotifications,
  toggleNotificationSetting,
  getNotificationSetting,
  markNotificationsAsReadByIds,
};
