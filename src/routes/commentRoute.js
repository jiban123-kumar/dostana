const express = require("express");
const { createComment, deleteComment, getCommentsForContent } = require("../controller/commentController");
const { protect } = require("../middlewares/protect");

const router = express.Router();

// Create a comment
router.delete("/delete/:commentId", protect, deleteComment);

router.post("/", protect, createComment);

router.get("/:contentId", protect, getCommentsForContent);
// Delete a comment

// Get comments by post ID

module.exports = router;
