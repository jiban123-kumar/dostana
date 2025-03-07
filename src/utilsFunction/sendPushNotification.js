const admin = require("firebase-admin");

// Parse the Firebase service key from the environment variable
const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_KEY || "{}");

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const User = require("../model/userModel");

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
      notification: { title, body },
      data: { url }, // Additional payload for service worker
      webpush: {
        headers: { Urgency: "high" },
        fcmOptions: { link: url },
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
