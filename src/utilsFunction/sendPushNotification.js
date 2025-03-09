// notificationController.js
const webpush = require("web-push");
const User = require("../model/userModel");

// Configure web-push with your VAPID details from environment variables
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
};

webpush.setVapidDetails(`mailto:${process.env.VAPID_EMAIL}`, vapidKeys.publicKey, vapidKeys.privateKey);

const sendPushNotification = async ({ userId, title, body, path = "/" }) => {
  const baseUrl = `https://${process.env.CLIENT_URL}`;
  const url = `${baseUrl}${path}`;

  try {
    const user = await User.findById(userId).select("subscription");
    console.log(user);
    if (!user || !user.subscription) {
      console.log("User does not have an FCM token.");
      return;
    }

    const fcmToken = user.subscription;
    console.log(fcmToken);

    // Create the payload as a JSON string
    const payload = JSON.stringify({
      title,
      body,
      data: { url },
    });

    // Send the notification using web-push
    const response = await webpush.sendNotification(fcmToken, payload);
    console.log("Successfully sent web push notification:", response);
    return response;
  } catch (error) {
    console.error("Error sending web push notification:", error);
  }
};

module.exports = { sendPushNotification };
