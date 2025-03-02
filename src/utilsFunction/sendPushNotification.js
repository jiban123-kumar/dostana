// utils/notification.js
const User = require("../model/userModel");
const webpush = require("./webpush"); // Import the configured webpush

const sendPushNotification = async ({ userId, title, body, url }) => {
  try {
    // Check if the user has push enabled
    const user = await User.findById(userId).select("pushEnabled pushSubscription");
    if (!user || !user.pushEnabled || !user.pushSubscription) {
      console.log("User does not have push notifications enabled or no subscription found.");
      return;
    }
    // Send the push notification
    const payload = JSON.stringify({ title, body, url });
    await webpush.sendNotification(user.pushSubscription, payload);
    console.log("Push notification sent successfully");
  } catch (error) {
    console.error("Error sending push notification:", error.message);
    throw error; // Re-throw the error for handling in the calling function
  }
};

module.exports = { sendPushNotification };
