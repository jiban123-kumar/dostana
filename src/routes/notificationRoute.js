const express = require("express");
const {
  createNotification,
  deleteNotification,
  getNotifications,
  deleteAllNotifications,
  markNotificationsAsReadByIds, // New: Mark selected notifications as read by IDs
  getUnreadNotificationCount,
  getUnreadNotifications,
  toggleNotificationSetting,
  getNotificationSetting,
} = require("../controller/notificationController");
const { protect } = require("../middlewares/protect");
const User = require("../model/userModel");

const router = express.Router();

// Create a notification
router.post("/", protect, createNotification);

// Delete a single notification by its ID
router.delete("/delete/:notificationId", protect, deleteNotification);

// Retrieve all notifications for the logged-in user
router.get("/", protect, getNotifications);

// Delete all notifications for the logged-in user
router.delete("/delete-all", protect, deleteAllNotifications);

// Mark all notifications as read (existing endpoint)

// Mark selected notifications as read (expects { notificationIds: [...] } in body)
router.patch("/read", protect, markNotificationsAsReadByIds);

// Get unread notifications count
router.get("/unread/count", protect, getUnreadNotificationCount);

// Get unread notifications list
router.get("/unread", protect, getUnreadNotifications);

// Toggle the notifications setting (expects { enabled: boolean } in body)
router.patch("/setting", protect, toggleNotificationSetting);

// Get the current notifications setting (on/off)
router.get("/setting", protect, getNotificationSetting);

router.post("/push-subscribe", async (req, res) => {
  try {
    const { subscription } = req.body;
    await User.findByIdAndUpdate(req.user.id, {
      pushSubscription: subscription,
    });
    res.status(200).json({ message: "Push subscription saved" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post("/push-unsubscribe", async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      pushSubscription: null,
    });
    res.status(200).json({ message: "Push subscription removed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
