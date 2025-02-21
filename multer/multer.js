const multer = require("multer");

// Configure Multer storage
const storage = multer.memoryStorage(); // Store files in memory for further processing (e.g., to upload to Supabase)
const upload = multer({ storage });

// Apply Multer to specific fields
const profileUpload = upload.fields([
  { name: "profileImage", maxCount: 1 },
  { name: "coverImage", maxCount: 1 },
]);

const contentUpload = upload.any("media");
const messageUpload = upload.any("media");

module.exports = { profileUpload, contentUpload, messageUpload };
