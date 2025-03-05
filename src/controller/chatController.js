const catchAsync = require("../utilsFunction/catchAsync");
const CustomError = require("../utilsFunction/customError");
const User = require("../model/userModel");
const Chat = require("../model/chatModel");
const { uploadFileToSupabase } = require("../utilsFunction/fileUploader");
const { removeFileFromSupabase } = require("../utilsFunction/fileRemover");

const sendMessage = catchAsync(async (req, res, next) => {
  const { recipientId, text } = req.body;
  const senderId = req.user?.id;
  if (!text.trim() && req.files?.length === 0) {
    return next(new CustomError("Please provide text or media", 400));
  }

  if (!senderId) {
    throw new CustomError("Unauthorized", 401);
  }

  const [sender, recipient] = await Promise.all([User.findById(senderId).select("firstName lastName profileImage"), User.findById(recipientId).select("firstName lastName profileImage")]);

  if (!recipient) {
    throw new CustomError("Recipient not found", 404);
  }

  let chat = await Chat.findOne({
    "participants._id": { $all: [senderId, recipientId] },
  });

  if (!chat) {
    chat = await Chat.create({
      participants: [
        { _id: sender._id, ...sender.toObject() },
        { _id: recipient._id, ...recipient.toObject() },
      ],
      messages: [],
    });
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
      sender: {
        _id: sender._id,
        firstName: sender.firstName,
        lastName: sender.lastName,
        profileImage: sender.profileImage,
      },
      text,
      media: mediaUrls,
      deletedFor: [],
    };

    chat.messages.push(newMessage);
    await chat.save();

    const createdMessage = chat.messages[chat.messages.length - 1].toObject();
    res.status(200).json({
      message: "Message sent successfully",
      newMessage: createdMessage,
      recipientId,
      chatId: chat._id,
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

  chat.messages.forEach((message) => {
    if (!message.deletedFor.includes(userId)) {
      message.deletedFor.push(userId);
    }
  });

  if (!chat.deletedBy.includes(userId)) {
    chat.deletedBy.push(userId);
  }

  if (chat.deletedBy.length === chat.participants.length) {
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

  // Determine the archive filter based on the query parameter.
  // If req.query.archive === "true", then archiveFilter will be true;
  // otherwise (if "false" or not provided), it will be false.
  const archiveFilter = req.query.archive === "true";
  console.log(archiveFilter);

  // Build the filter object to only return chats for the logged in user
  // that have exactly 2 participants, that haven't been deleted by the user,
  // and match the archived state.
  const filter = {
    "participants._id": loggedInUserId,
    deletedBy: { $nin: [loggedInUserId] },
    $expr: { $eq: [{ $size: "$participants" }, 2] },
    archived: archiveFilter,
  };

  const total = await Chat.countDocuments(filter);

  const chats = await Chat.find(filter)
    .sort({ updatedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const filteredChats = chats.map((chat) => {
    const visibleMessages = chat.messages.filter((msg) => !msg.deletedFor.map(String).includes(loggedInUserId));
    const lastMessage = visibleMessages[visibleMessages.length - 1] || null;
    const participants = chat.participants.filter((user) => user._id.toString() !== loggedInUserId);

    return {
      _id: chat._id,
      participants,
      lastMessage,
      updatedAt: chat.updatedAt,
      archived: chat.archived,
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

  const chat = await Chat.findOne({
    _id: chatId,
    "participants._id": loggedInUserId,
  });

  if (!chat) {
    return res.status(404).json({ message: "Chat not found or you are not a participant" });
  }

  chat.archived = !chat.archived;
  await chat.save();

  res.status(200).json({
    message: `Chat ${chat.archived ? "archived" : "unarchived"} successfully`,
    chatId: chat._id,
    archived: chat.archived,
    recipientId,
  });
});

const getChatByUserId = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const loggedInUserId = req.user.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  let chat = await Chat.findOne({
    "participants._id": { $all: [loggedInUserId, userId] },
  });

  if (chat && chat.deletedBy.includes(loggedInUserId)) {
    chat.deletedBy = chat.deletedBy.filter((id) => id.toString() !== loggedInUserId);
    await chat.save();
  }

  if (!chat) {
    const [loggedInUser, otherUser] = await Promise.all([User.findById(loggedInUserId).select("firstName lastName profileImage"), User.findById(userId).select("firstName lastName profileImage")]);

    chat = await Chat.create({
      participants: [
        { _id: loggedInUser._id, ...loggedInUser.toObject() },
        { _id: otherUser._id, ...otherUser.toObject() },
      ],
      messages: [],
      deletedBy: [],
    });
  }

  const visibleMessages = chat.messages.filter((msg) => !msg.deletedFor.map(String).includes(loggedInUserId));

  const totalMessages = visibleMessages.length;
  const startIndex = Math.max(0, totalMessages - page * limit);
  const endIndex = totalMessages - (page - 1) * limit;
  const messagesChunk = startIndex < 0 ? [] : visibleMessages.slice(startIndex, endIndex);
  const hasMore = startIndex > 0;

  res.status(200).json({
    chatId: chat._id,
    archived: chat.archived,
    participants: chat.participants.filter((u) => u._id.toString() !== loggedInUserId),
    messages: messagesChunk,
    hasMore,
  });
});

const getTotalUnreadMessages = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const chats = await Chat.find({ "participants._id": userId });
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
    totalUnreadMessages: totalUnread || 0,
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
    if (messageIds.includes(message._id.toString()) && message.sender._id.toString() !== userId && message.isRead === false) {
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
          "elem.sender._id": { $ne: userId },
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
