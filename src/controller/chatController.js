const catchAsync = require("../utilsFunction/catchAsync");
const CustomError = require("../utilsFunction/customError");
const User = require("../model/userModel");
const Chat = require("../model/chatModel");
const { uploadFileToSupabase } = require("../utilsFunction/fileUploader");
const { removeFileFromSupabase } = require("../utilsFunction/fileRemover");
const { sendPushNotification } = require("../utilsFunction/sendPushNotification");

const sendMessage = catchAsync(async (req, res, next) => {
  const { recipientId, text, clientId } = req.body;
  const senderId = req.user?.id;

  if (!text.trim() && (!req.files || req.files.length === 0)) {
    return next(new CustomError("Please provide text or media", 400));
  }

  if (!senderId) {
    throw new CustomError("Unauthorized", 401);
  }

  const recipient = await User.findById(recipientId);
  if (!recipient) {
    throw new CustomError("Recipient not found", 404);
  }

  let chat = await Chat.findOne({
    participants: { $all: [senderId, recipientId] },
  });

  if (!chat) {
    chat = await Chat.create({
      participants: [senderId, recipientId],
      messages: [],
    });
  } else {
    // Remove recipientId from deletedFor if it exists
    if (chat.deletedFor.includes(recipientId)) {
      chat.deletedFor = chat.deletedFor.filter((id) => id.toString() !== recipientId);
    }
  }

  let mediaUrls = [];
  try {
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const { buffer, originalname, mimetype } = file;
        const result = await uploadFileToSupabase({ buffer, originalname, mimetype });

        if (result.isError) {
          throw new CustomError(`Failed to upload file: ${result.message}`, 500);
        }

        mediaUrls.push({
          url: result.fileUrl,
          type: mimetype.split("/")[0],
        });
      }
    }

    const newMessage = {
      sender: senderId, // Reference to User model
      text,
      media: mediaUrls,
      deletedFor: [],
    };

    chat.messages.push(newMessage);
    await chat.save();
    const userName = await User.findById(senderId).select("firstName");

    sendPushNotification({
      userId: recipientId,
      title: "Dostana",
      body: `You have a new message from ${userName.firstName + " " + userName.lastName}`,
      path: `/chats`,
    });

    const createdMessage = chat.messages[chat.messages.length - 1];

    res.status(200).json({
      message: "Message sent successfully",
      newMessage: createdMessage,
      recipientId,
      chatId: chat._id,
      clientId,
    });
  } catch (err) {
    if (mediaUrls.length > 0) {
      await Promise.all(mediaUrls.map((media) => removeFileFromSupabase(media.url)));
    }
    throw err;
  }
});

const deleteMessage = catchAsync(async (req, res, next) => {
  const { deleteFor, chatId, messageId, recipientId } = req.body;
  const userId = req.user.id;

  const chat = await Chat.findById(chatId);
  if (!chat) {
    return next(new CustomError("Chat not found", 404));
  }

  const messageIndex = chat.messages.findIndex((msg) => msg._id.toString() === messageId);
  if (messageIndex === -1) {
    return next(new CustomError("Message not found", 404));
  }

  const message = chat.messages[messageIndex];

  if (deleteFor === "Everyone") {
    if (message.sender._id.toString() !== userId) {
      return next(new CustomError("You can only delete your own messages for everyone", 403));
    }

    if (message.media && message.media.length > 0) {
      await Promise.all(message.media.map((file) => removeFileFromSupabase(file.url)));
    }
    chat.messages.splice(messageIndex, 1);
  } else {
    if (!message.deletedFor.includes(userId)) {
      message.deletedFor.push(userId);
    }

    const allDeleted = chat.participants.every((participant) => message.deletedFor.includes(participant._id.toString()));

    if (allDeleted) {
      if (message.media && message.media.length > 0) {
        await Promise.all(message.media.map((file) => removeFileFromSupabase(file.url)));
      }
      chat.messages.splice(messageIndex, 1);
    }
  }

  await chat.save();
  res.status(200).json({
    message: "Message deletion processed successfully",
    deletedMessageId: messageId,
    recipientId,
    deleteForEveryone: deleteFor === "Everyone",
  });
});

const deletechat = catchAsync(async (req, res, next) => {
  const { chatId } = req.params;
  const userId = req.user.id;

  const chat = await Chat.findById(chatId);
  if (!chat) {
    return next(new CustomError("Chat not found", 404));
  }
  console.log(chat);

  chat.messages.forEach((message) => {
    if (!message.deletedFor.includes(userId)) {
      message.deletedFor.push(userId);
    }
  });

  if (!chat.deletedFor.includes(userId)) {
    chat.deletedFor.push(userId);
  }

  if (chat.deletedFor.length === chat.participants.length) {
    if (chat.messages.length > 0) {
      await Promise.all(chat.messages.flatMap((msg) => msg.media.map((file) => removeFileFromSupabase(file.url))));
    }
    await Chat.findByIdAndDelete(chatId);
    return res.status(200).json({ message: "Chat and associated media deleted permanently" });
  }

  await chat.save();
  res.status(200).json({ message: "Chat deleted for you", chatId });
});
const getAllChats = catchAsync(async (req, res, next) => {
  const loggedInUserId = req.user.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const archiveFilter = req.query.archive === "true";

  // Filter chats where the logged-in user is a participant,
  // the chat is not deleted for that user,
  // has exactly 2 participants, and archived status based on the user.
  const filter = {
    participants: loggedInUserId,
    deletedFor: { $nin: [loggedInUserId] },
    $expr: { $eq: [{ $size: "$participants" }, 2] },
    archivedBy: archiveFilter ? { $in: [loggedInUserId] } : { $nin: [loggedInUserId] },
  };

  const total = await Chat.countDocuments(filter);

  // Populate participants with selected fields.
  const chats = await Chat.find(filter)
    .populate("participants", "firstName lastName profileImage")
    .sort({ updatedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const filteredChats = chats.map((chat) => {
    // Filter out messages that are deleted for the logged-in user.
    const visibleMessages = chat.messages.filter((msg) => !msg.deletedFor.map(String).includes(loggedInUserId));
    const lastMessage = visibleMessages[visibleMessages.length - 1] || null;
    // Get the other participant(s) by filtering out the logged-in user.
    const participants = chat.participants.filter((user) => user._id.toString() !== loggedInUserId);

    return {
      _id: chat._id,
      participants,
      lastMessage,
      updatedAt: chat.updatedAt,
      // Archived status per user.
      archived: chat.archivedBy.includes(loggedInUserId),
    };
  });

  res.status(200).json({
    chats: filteredChats,
    page,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
  });
});

const toggleArchiveChat = catchAsync(async (req, res, next) => {
  const loggedInUserId = req.user.id;
  const { recipientId, chatId } = req.body;

  // Find chat where the logged-in user is one of the participants.
  const chat = await Chat.findOne({
    _id: chatId,
    participants: loggedInUserId,
  });
  console.log(chat);

  if (!chat) {
    return res.status(404).json({ message: "Chat not found or you are not a participant" });
  }

  // Toggle archive for the current user only
  if (chat.archivedBy.includes(loggedInUserId)) {
    // Unarchive: remove the user from archivedBy
    chat.archivedBy = chat.archivedBy.filter((id) => id.toString() !== loggedInUserId);
  } else {
    // Archive: add the user to archivedBy
    chat.archivedBy.push(loggedInUserId);
  }

  await chat.save();

  // Return a boolean indicating whether the chat is now archived for this user
  const isArchived = chat.archivedBy.includes(loggedInUserId);
  res.status(200).json({
    message: `Chat ${isArchived ? "archived" : "unarchived"} successfully`,
    chatId: chat._id,
    archived: isArchived,
    recipientId,
  });
});

const getChatByUserId = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const loggedInUserId = req.user.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  // Find chat between the two users. Since participants are ObjectIds, we use $all.
  let chat = await Chat.findOne({
    participants: { $all: [loggedInUserId, userId] },
  }).populate("participants", "firstName lastName profileImage");

  // If chat exists and the logged-in user was marked as having deleted it, remove them from deletedFor.
  if (chat && chat.deletedFor.includes(loggedInUserId)) {
    chat.deletedFor = chat.deletedFor.filter((id) => id.toString() !== loggedInUserId);
    await chat.save();
  }

  // If no chat exists, create one with the two user references.
  if (!chat) {
    // No need to embed the user details since participants reference the User model.
    chat = await Chat.create({
      participants: [loggedInUserId, userId],
      messages: [],
      deletedFor: [],
      archivedBy: [],
    });
    // Populate participants to include user info.
    chat = await chat.populate("participants", "firstName lastName profileImage").execPopulate();
  }

  // Filter out messages that were deleted for the logged-in user.
  const visibleMessages = chat.messages.filter((msg) => !msg.deletedFor.map(String).includes(loggedInUserId));

  const totalMessages = visibleMessages.length;
  const startIndex = Math.max(0, totalMessages - page * limit);
  const endIndex = totalMessages - (page - 1) * limit;
  const messagesChunk = startIndex < 0 ? [] : visibleMessages.slice(startIndex, endIndex);
  const hasMore = startIndex > 0;

  res.status(200).json({
    chatId: chat._id,
    archived: chat.archivedBy.includes(loggedInUserId),
    // Return the other participant's details
    participants: chat.participants.filter((u) => u._id.toString() !== loggedInUserId),
    messages: messagesChunk,
    hasMore,
  });
});

const getTotalUnreadMessages = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const chats = await Chat.find({ participants: { $in: [userId] } });
  let totalUnread = 0;

  chats.forEach((chat) => {
    chat.messages.forEach((message) => {
      if (message.sender._id.toString() !== userId && !message.isRead) {
        totalUnread++;
      }
    });
  });

  res.status(200).json({
    message: "Total unread messages count retrieved successfully",
    totalUnreadMessages: totalUnread,
  });
});

const markMessagesAsRead = catchAsync(async (req, res, next) => {
  const { chatId } = req.body;
  const userId = req.user.id;

  const chat = await Chat.findById(chatId);
  if (!chat) {
    return next(new CustomError("Chat not found", 404));
  }

  let isUpdated = false;
  chat.messages.forEach((message) => {
    if (message.sender._id.toString() !== userId && !message.isRead) {
      message.isRead = true;
      isUpdated = true;
    }
  });

  if (isUpdated) {
    await chat.save();
  }

  res.status(200).json({
    message: "All messages marked as read successfully",
    chatId,
  });
});

const getUnreadCountForChat = catchAsync(async (req, res, next) => {
  const { chatId } = req.params;
  const userId = req.user.id;

  const chat = await Chat.findById(chatId);
  if (!chat) {
    return next(new CustomError("Chat not found", 404));
  }

  let unreadCount = 0;
  chat.messages.forEach((message) => {
    if (message.sender._id.toString() !== userId && !message.isRead) {
      unreadCount++;
    }
  });

  res.status(200).json({
    message: "Unread messages count for chat retrieved successfully",
    unreadCount,
  });
});

const getLastMessageByChatId = catchAsync(async (req, res, next) => {
  const loggedInUserId = req.user.id;
  const { chatId } = req.params;

  const chat = await Chat.findById(chatId);
  const visibleMessages = chat.messages.filter((msg) => !msg.deletedFor.map(String).includes(loggedInUserId));
  const lastMessage = visibleMessages.length > 0 ? visibleMessages[visibleMessages.length - 1] : null;

  res.status(200).json({ lastMessage });
});

const markMessagesAsReadByChatId = catchAsync(async (req, res, next) => {
  const { chatId, messageIds } = req.body;
  const userId = req.user.id;

  if (!chatId) {
    return next(new CustomError("Please provide a chat ID", 400));
  }

  if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
    return next(new CustomError("Please provide an array of message IDs", 400));
  }

  const chat = await Chat.findById(chatId);
  if (!chat) {
    return next(new CustomError("Chat not found", 404));
  }

  let totalUpdatedCount = 0;
  chat.messages.forEach((message) => {
    if (
      messageIds.includes(message._id.toString()) &&
      message.sender.toString() !== userId && // changed here to use sender directly
      message.isRead === false
    ) {
      totalUpdatedCount++;
    }
  });

  await Chat.updateOne(
    { _id: chatId },
    { $set: { "messages.$[elem].isRead": true } },
    {
      arrayFilters: [
        {
          "elem._id": { $in: messageIds },
          "elem.sender": { $ne: userId }, // use elem.sender directly
          "elem.isRead": false,
        },
      ],
    }
  );

  res.status(200).json({
    message: "Messages marked as read successfully",
    count: totalUpdatedCount,
  });
});

module.exports = {
  getChatByUserId,
  getAllChats,
  sendMessage,
  deleteMessage,
  deletechat,
  toggleArchiveChat,
  getTotalUnreadMessages,
  getUnreadCountForChat,
  markMessagesAsRead,
  getLastMessageByChatId,
  markMessagesAsReadByChatId,
};
