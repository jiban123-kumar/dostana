const express = require("express");
const { protect } = require("../middlewares/protect");
const {
  createContent,
  deleteContent,
  getContents,
  toggleSaveContent,
  shareContent,
  getContentById, // Import the new controller
} = require("../controller/contentController");
const { contentUpload } = require("../multer/multer");

const router = express.Router();

// Create new content
router.post("/create-content", contentUpload, protect, createContent);

// Get (list) contents with optional filters (saved, shared, etc.)
router.get("/", protect, getContents);

// Get a single content by its ID
router.get("/:contentId", protect, getContentById);

// Delete a content item by its ID
router.delete("/:contentId", protect, deleteContent);

// Toggle save/unsave a content item
router.patch("/toggle-save/:contentId", protect, toggleSaveContent);

// Share content with other users
router.post("/share", protect, shareContent);

module.exports = router;
