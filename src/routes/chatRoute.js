const express = require("express");
const {
  sendMessage,
  deleteMessage,
  deletechat,
  getTotalUnreadMessages,
  getUnreadCountForChat,
  getLastMessageByChatId,
  getChatByUserId,
  getAllChats,
  toggleArchiveChat,
  markMessagesAsReadByChatId,
} = require("../controller/chatController");

const { protect } = require("../middlewares/protect"); // Authentication middleware
const { messageUpload } = require("../multer/multer");

const router = express.Router();

router.patch("/archive/:chatId", protect, toggleArchiveChat);
// Send a message (text, photo, or video)

router.post("/send", messageUpload, protect, sendMessage);

// Get a chat with a specific user
router.get("/:userId", protect, getChatByUserId);

// Get all chats of the logged-in user
router.get("/", protect, getAllChats);

// Delete a specific message
router.post("/message", protect, deleteMessage);

// Delete a chat (only for the logged-in user)
router.delete("/:chatId", protect, deletechat);

// Archive or unarchive a chat
// Mark all messages in a chat as read

// Get the total unread message count for the logged-in user
router.get("/unread/total", protect, getTotalUnreadMessages);

// Get the unread message count for a specific chat
router.get("/unread/:chatId", protect, getUnreadCountForChat);

router.get("/lastMessage/:chatId", protect, getLastMessageByChatId);

router.post("/message/read", protect, markMessagesAsReadByChatId);

module.exports = router;
