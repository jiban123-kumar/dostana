// friendController.js
const Friend = require("../model/friendModel");
const User = require("../model/userModel");
const UserStatus = require("../model/userStatus");
const catchAsync = require("../utilsFunction/catchAsync");
const CustomError = require("../utilsFunction/customError");
const { sendPushNotification } = require("../utilsFunction/sendPushNotification");

// Send a Friend Request
const sendFriendRequest = catchAsync(async (req, res, next) => {
  const { recipientId } = req.body; // ID of the user receiving the friend request
  const requesterId = req.user?.id;

  if (requesterId === recipientId) {
    return next(new CustomError("You cannot send a friend request to yourself", 400));
  }

  const recipient = await User.findById(recipientId);
  if (!recipient) {
    return next(new CustomError("Recipient not found", 404));
  }

  // Create (or update) a friend request
  const friendRequest = await Friend.findOneAndUpdate({ requester: requesterId, recipient: recipientId }, { status: "pending" }, { new: true, upsert: true });

  res.status(200).json({
    message: "Friend request sent successfully",
    friendRequest,
  });
});

// Accept a Friend Request
const acceptFriendRequest = catchAsync(async (req, res, next) => {
  const { requesterId } = req.params;

  const friendRequest = await Friend.findOne({
    requester: requesterId,
    recipient: req.user?.id,
  });
  if (!friendRequest || friendRequest.status !== "pending") {
    return next(new CustomError("Invalid or non-pending friend request", 400));
  }

  friendRequest.status = "accepted";
  await friendRequest.save();
  const recipient = friendRequest.recipient;

  res.status(200).json({
    message: "Friend request accepted successfully",
    friendRequest,
  });
});

// Decline a Friend Request (by recipient)
const declineFriendRequest = catchAsync(async (req, res, next) => {
  const { requesterId } = req.params;
  const recipientId = req.user?.id;

  const friendRequest = await Friend.findOne({
    requester: requesterId,
    recipient: recipientId,
  });
  if (!friendRequest || friendRequest.status !== "pending") {
    return next(new CustomError("Invalid or non-pending friend request", 400));
  }

  await friendRequest.deleteOne();

  res.status(200).json({
    message: "Friend request declined successfully",
    friendRequest,
  });
});

// Cancel a Friend Request (by requester)
const cancelFriendRequest = catchAsync(async (req, res, next) => {
  const { recipientId } = req.params;
  const requesterId = req.user?.id;

  const friendRequest = await Friend.findOne({
    requester: requesterId,
    recipient: recipientId,
  });
  if (!friendRequest || friendRequest.status !== "pending") {
    return next(new CustomError("Invalid or non-pending friend request", 400));
  }

  await friendRequest.deleteOne();

  res.status(200).json({
    message: "Friend request canceled successfully",
    friendRequest,
  });
});

// Remove a Friend (unfriend)
const removeFriend = catchAsync(async (req, res, next) => {
  const { friendId } = req.params;
  const userId = req.user?.id;

  const friendship = await Friend.findOne({
    $or: [
      { requester: userId, recipient: friendId, status: "accepted" },
      { requester: friendId, recipient: userId, status: "accepted" },
    ],
  });
  if (!friendship) {
    return next(new CustomError("Friendship not found", 404));
  }

  await friendship.deleteOne();

  res.status(200).json({
    message: "Friend removed successfully",
    friendship,
  });
});

// Get All Friends
const getFriends = catchAsync(async (req, res, next) => {
  const userId = req.user?.id;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const [friends, total] = await Promise.all([
    Friend.find({
      $or: [
        { requester: userId, status: "accepted" },
        { recipient: userId, status: "accepted" },
      ],
    })
      .populate("requester recipient", "firstName lastName profileImage")
      .select("requester recipient")
      .skip(skip)
      .limit(limit),
    Friend.countDocuments({
      $or: [
        { requester: userId, status: "accepted" },
        { recipient: userId, status: "accepted" },
      ],
    }),
  ]);

  const friendList = friends.map((friend) => {
    const friendData = friend.requester._id.toString() === userId ? friend.recipient : friend.requester;
    return {
      _id: friendData._id,
      firstName: friendData.firstName,
      lastName: friendData.lastName,
      profileImage: friendData.profileImage,
    };
  });

  const hasNextPage = page * limit < total;

  res.status(200).json({
    friends: friendList || [],
    hasNextPage,
  });
});

// Get Incoming Friend Requests
const getFriendRequests = catchAsync(async (req, res, next) => {
  const userId = req.user?.id;
  const countOnly = req.query.countOnly === "true";

  if (countOnly) {
    const total = await Friend.countDocuments({ recipient: userId, status: "pending" });
    return res.status(200).json({ total });
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const [friendRequests, total] = await Promise.all([
    Friend.find({ recipient: userId, status: "pending" }).populate("requester", "firstName lastName profileImage").select("requester status").skip(skip).limit(limit),
    Friend.countDocuments({ recipient: userId, status: "pending" }),
  ]);

  const friendRequestsTransformed = friendRequests.map((request) => ({
    _id: request.requester._id,
    firstName: request.requester.firstName,
    lastName: request.requester.lastName,
    profileImage: request.requester.profileImage,
    status: request.status,
  }));

  const hasNextPage = page * limit < total;

  res.status(200).json({
    friendRequests: friendRequestsTransformed,
    hasNextPage,
  });
});

// Get Suggested Users (excluding current friends and incoming requests)
// friendController.js
const getSuggestedUsers = catchAsync(async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) return next(new CustomError("User not authenticated", 401));

  // First, determine current friendships and pending requests
  const friendships = await Friend.find({
    $or: [{ requester: userId }, { recipient: userId }],
  });

  const friendIds = new Set();
  const sentRequests = new Set();
  const receivedRequests = new Set();

  friendships.forEach((friend) => {
    if (friend.status === "accepted") {
      friendIds.add(friend.requester._id.toString());
      friendIds.add(friend.recipient._id.toString());
    } else if (friend.requester._id.toString() === userId && friend.status === "pending") {
      sentRequests.add(friend.recipient._id.toString());
    } else if (friend.recipient._id.toString() === userId && friend.status === "pending") {
      receivedRequests.add(friend.requester._id.toString());
    }
  });

  // Pagination: default page=1 and limit=10 (or use query parameters)
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  // Query for users not already friends, not in pending received requests,
  // and whose profile is complete
  const suggestedUsersQuery = User.find({
    _id: { $nin: [...friendIds, ...receivedRequests, userId] },
    isProfileComplete: true,
  })
    .select("firstName lastName profileImage isProfileComplete")
    .skip(skip)
    .limit(limit);

  const suggestedUsers = await suggestedUsersQuery;

  // Add relationship status: "pending" if a friend request has been sent by the user, otherwise "none"
  const suggestedUsersWithStatus = suggestedUsers.map((user) => ({
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImage: user.profileImage,
    isProfileComplete: user.isProfileComplete,
    status: sentRequests.has(user._id.toString()) ? "pending" : "none",
  }));

  // Optionally, count the total to determine if more pages exist:
  const total = await User.countDocuments({
    _id: { $nin: [...friendIds, ...receivedRequests, userId] },
    isProfileComplete: true,
  });
  const hasNextPage = page * limit < total;

  res.status(200).json({
    suggestedUsers: suggestedUsersWithStatus,
    hasNextPage,
  });
});

// Check Relationship between logged-in user and another user
const checkRelationship = catchAsync(async (req, res, next) => {
  const loggedInUserId = req.user?.id;
  const otherUserId = req.params.userId;

  if (!otherUserId) {
    return next(new CustomError("User ID parameter is required", 400));
  }

  if (loggedInUserId === otherUserId) {
    return res.status(200).json({
      message: "You are checking your own profile.",
      relationship: "self",
    });
  }

  const friendship = await Friend.findOne({
    $or: [
      { requester: loggedInUserId, recipient: otherUserId },
      { requester: otherUserId, recipient: loggedInUserId },
    ],
  });

  if (!friendship) {
    return res.status(200).json({
      message: "No relationship found",
      relationship: "none",
    });
  }

  if (friendship.status === "accepted") {
    return res.status(200).json({
      message: "Users are friends",
      relationship: "friends",
    });
  }

  if (friendship.status === "pending") {
    if (friendship.requester._id.toString() === loggedInUserId) {
      return res.status(200).json({
        message: "Friend request sent by you is pending",
        relationship: "pending_sent",
      });
    } else {
      return res.status(200).json({
        message: "Friend request received by you is pending",
        relationship: "pending_received",
      });
    }
  }

  res.status(200).json({
    message: "Relationship status is unknown",
    relationship: friendship.status,
  });
});

// Get User Status (e.g. online/offline)
const getUserStatus = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const userStatus = await UserStatus.findOne({ user: userId });
  if (!userStatus) return next(new CustomError("User status not found", 404));

  res.status(200).json({
    message: "User status retrieved successfully",
    userStatus,
  });
});

// --- Single Endpoint for Bulk Operations ---
// “action” can be: "accept_all", "cancel_all", or "remove_all"
const manageFriendRequests = catchAsync(async (req, res, next) => {
  const { action } = req.body;
  const userId = req.user?.id;

  if (!["accept_all", "cancel_all", "remove_all"].includes(action)) {
    return next(new CustomError("Invalid action specified", 400));
  }

  let affectedRequests;
  let message = "";

  if (action === "accept_all") {
    affectedRequests = await Friend.find({ recipient: userId, status: "pending" }).populate("requester recipient", "firstName lastName profileImage");
    if (affectedRequests.length === 0) {
      return next(new CustomError("No pending friend requests found", 400));
    }
    await Friend.updateMany({ recipient: userId, status: "pending" }, { $set: { status: "accepted" } });
    // Retrieve the updated documents
    affectedRequests = await Friend.find({
      recipient: userId,
      status: "accepted",
      _id: { $in: affectedRequests.map((r) => r._id) },
    }).populate("requester recipient", "firstName lastName profileImage");

    message = "All friend requests accepted successfully";
  } else if (action === "cancel_all") {
    affectedRequests = await Friend.find({ recipient: userId, status: "pending" }).populate("requester recipient", "firstName lastName profileImage");
    if (affectedRequests.length === 0) {
      return next(new CustomError("No pending friend requests found", 400));
    }
    await Friend.deleteMany({ recipient: userId, status: "pending" });
    message = "All received friend requests canceled successfully";
  } else if (action === "remove_all") {
    affectedRequests = await Friend.find({
      $or: [
        { requester: userId, status: "accepted" },
        { recipient: userId, status: "accepted" },
      ],
    }).populate("requester recipient", "firstName lastName profileImage");
    if (affectedRequests.length === 0) {
      return next(new CustomError("No friends found to remove", 400));
    }
    await Friend.deleteMany({
      $or: [
        { requester: userId, status: "accepted" },
        { recipient: userId, status: "accepted" },
      ],
    });
    message = "All friends removed successfully";
  }

  res.status(200).json({
    message,
    friendRequests: affectedRequests, // returns affected friend documents (with populated user fields)
    action,
  });
});

module.exports = {
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
};
