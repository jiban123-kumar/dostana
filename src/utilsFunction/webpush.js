// utils/webpush.js
const webpush = require("web-push");

// Generate VAPID keys using: webpush.generateVAPIDKeys()
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
};

// Set VAPID details
webpush.setVapidDetails(
  "mailto:your-email@example.com", // Replace with your email
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

module.exports = webpush;
