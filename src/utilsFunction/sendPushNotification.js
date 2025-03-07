const admin = require("firebase-admin");
const serviceAccount = require("./serviceKey.json"); // Path to your Firebase service account JSON
const User = require("../model/userModel");

// Initialize the Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const sendPushNotification = async ({ userId, title, body, path = "/" }) => {
  const baseUrl = `https://${process.env.CLIENT_URL}`;

  const url = `${baseUrl}${path}`;

  try {
    // Retrieve the user and their FCM token from the database.
    const user = await User.findById(userId).select("fcmToken");
    if (!user || !user.fcmToken) {
      console.log("User does not have an FCM token.");
      return;
    }
    const fcmToken = user.fcmToken;
    console.log(fcmToken);

    const message = {
      token: fcmToken,
      notification: {
        title,
        body,
      },
      // Pass additional data (like the URL) in the data payload.
      data: {
        url, // This will be available in your service worker.
      },
      // Optionally, set webpush options for compatibility.
      webpush: {
        headers: {
          Urgency: "high",
        },
        fcmOptions: {
          link: url, // Some clients might use this for click actions.
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log("Successfully sent FCM message:", response);
    return response;
  } catch (error) {
    console.error("Error sending FCM message:", error);
  }
};

module.exports = { sendPushNotification };
