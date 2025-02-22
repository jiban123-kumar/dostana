// friendRoutes.js
const express = require("express");
const {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  removeFriend,
  getFriends,
  getFriendRequests,
  getSuggestedUsers,
  checkRelationship,
  getUserStatus,
  manageFriendRequests,
  searchConnections, // import the new controller
} = require("../controller/friendController");
const { protect } = require("../middlewares/protect");

const router = express.Router();

router.post("/send-request", protect, sendFriendRequest);
router.post("/accept-request/:requesterId", protect, acceptFriendRequest);
router.post("/decline-request/:requesterId", protect, declineFriendRequest);
router.delete("/cancel-request/:recipientId", protect, cancelFriendRequest);
router.delete("/remove-friend/:friendId", protect, removeFriend);
router.get("/friends", protect, getFriends);
router.get("/friend-requests", protect, getFriendRequests);
router.get("/suggested-users", protect, getSuggestedUsers);
router.get("/relationship/:userId", protect, checkRelationship);
router.get("/user-status/:userId", protect, getUserStatus);
router.post("/manage-requests", protect, manageFriendRequests);

// New route for searching friend relationships

module.exports = router;
