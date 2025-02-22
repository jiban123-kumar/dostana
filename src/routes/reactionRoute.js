const express = require("express");
const { toggleReaction, getReactionsForContent } = require("../controller/reactionController");
const { protect } = require("../middlewares/protect");

const router = express.Router();

// Toggle reaction on content
router.patch("/:contentId/reaction", protect, toggleReaction);

// Get reactions for content (short or long)
router.get("/:contentId/reactions", protect, getReactionsForContent);

module.exports = router;
