const catchAsync = require("../utilsFunction/catchAsync");
const CustomError = require("../utilsFunction/customError");
const User = require("../model/userModel");
const Chat = require("../model/chatModel");
const { uploadFileToSupabase } = require("../utilsFunction/fileUploader");
const { removeFileFromSupabase } = require("../utilsFunction/fileRemover");

const sendMessage = catchAsync(async (req, res, next) => {
  const { recipientId, text } = req.body;
  const senderId = req.user?.id;

  if (!senderId) {
    throw new CustomError("Unauthorized", 401);
  }

  const recipient = await User.findById(recipientId);
  if (!recipient) {
    throw new CustomError("Recipient not found", 404);
  }

  // Find an existing chat between the sender and the recipient, or create one.
  let chat = await Chat.findOne({
    participants: { $all: [senderId, recipientId] },
  });

  if (!chat) {
    chat = await Chat.create({
      participants: [senderId, recipientId],
      messages: [],
    });
  }

  // This array will store info on files successfully uploaded to Supabase.
  let mediaUrls = [];

  try {
    // Process uploaded files if any.
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const { buffer, originalname, mimetype } = file;
        const result = await uploadFileToSupabase({ buffer, originalname, mimetype });

        if (result.isError) {
          // If a file upload fails, throw an error to trigger the catch block.
          throw new CustomError(`Failed to upload file: ${result.message}`, 500);
        }

        // Determine the file type from the MIME type (e.g., "image" for "image/jpeg").
        const fileType = mimetype.split("/")[0];

        // Save the file URL and type.
        mediaUrls.push({
          url: result.fileUrl,
          type: fileType,
        });
      }
    }

    // Create the new message object.
    const newMessage = {
      sender: senderId, // Only the sender ID is stored here.
      text,
      media: mediaUrls, // either an array of file objects or an empty array
      deletedFor: [], // initially, no one has deleted the message
    };

    // Append the new message to the chat.
    chat.messages.push(newMessage);

    // Save the updated chat document.
    await chat.save();

    // Fetch sender's profile separately.
    const senderProfile = await User.findById(senderId).select("firstName lastName profileImage");

    // Retrieve the newly created message.
    const createdMessage = chat.messages[chat.messages.length - 1].toObject();

    // Attach the sender's profile as a separate field.
    createdMessage.senderProfile = senderProfile;

    // Return the new message with the sender ID and senderProfile.
    res.status(200).json({
      message: "Message sent successfully",
      newMessage: createdMessage,
      recipientId,
      chatId: chat._id,
    });
  } catch (err) {
    // Cleanup: If an error occurs, remove any uploaded files from Supabase.
    if (mediaUrls.length > 0) {
      for (const media of mediaUrls) {
        try {
          await removeFileFromSupabase(media.url);
        } catch (cleanupError) {
          console.error(`Failed to cleanup file ${media.url}:`, cleanupError);
        }
      }
    }
    // Forward the error to the error handler.
    throw err;
  }
});

const deleteMessage = catchAsync(async (req, res, next) => {
  // Expecting a field "deleteFor" in the body with value "me" or "everyone"
  const { deleteFor, chatId, messageId, recipientId } = req.body;
  const userId = req.user.id;

  const chat = await Chat.findById(chatId);
  if (!chat) {
    return next(new CustomError("Chat not found", 404));
  }

  // Find the message by its ID
  const messageIndex = chat.messages.findIndex((msg) => msg._id.toString() === messageId);
  if (messageIndex === -1) {
    return next(new CustomError("Message not found", 404));
  }

  const message = chat.messages[messageIndex];

  // Delete for Everyone (hard delete) - only allowed for sender.
  if (deleteFor === "Everyone") {
    if (message.sender.toString() !== userId) {
      return next(new CustomError("You can only delete your own messages for everyone", 403));
    }

    // Remove associated media files from Supabase if any.
    if (message.media && message.media.length > 0) {
      for (const filePath of message.media) {
        const { isError } = await removeFileFromSupabase(filePath.url);
        if (isError) {
          console.error(`Failed to delete file from Supabase: ${filePath}`);
        }
      }
    }

    // Remove the message from the chat entirely.
    chat.messages.splice(messageIndex, 1);
  } else {
    // Default: delete for "me"
    // Add the current user's ID to the message's deletedFor array if not already present.
    if (!message.deletedFor.includes(userId)) {
      message.deletedFor.push(userId);
    }

    // If every participant in the chat has deleted the message, remove it completely.
    const allDeleted = chat.participants.every((participant) => message.deletedFor.includes(participant.toString()));

    if (allDeleted) {
      if (message.media && message.media.length > 0) {
        for (const filePath of message.media) {
          const { isError } = await removeFileFromSupabase(filePath.url);
          if (isError) {
            console.error(`Failed to delete file from Supabase: ${filePath}`);
          }
        }
      }
      chat.messages.splice(messageIndex, 1);
    }
  }

  await chat.save();
  const deletedMessageId = messageId;

  res.status(200).json({ message: "Message deletion processed successfully", deletedMessageId, recipientId, deleteForEveryone: deleteFor === "Everyone" });
});

/**
 * Delete an entire chat.
 * (This controller remains largely the same as before.)
 */
/**
 * Delete an entire chat.
 * This controller now also marks all messages as deleted for the logged-in user.
 */
const deletechat = catchAsync(async (req, res, next) => {
  const { chatId } = req.params;
  const userId = req.user.id;
  console.log(chatId, userId);

  const chat = await Chat.findById(chatId);
  if (!chat) {
    return next(new CustomError("Chat not found", 404));
  }

  // Mark all messages as deleted for the current user.
  chat.messages.forEach((message) => {
    if (!message.deletedFor.includes(userId)) {
      message.deletedFor.push(userId);
    }
  });

  // Add user ID to deletedBy array if not already present.
  if (!chat.deletedBy.includes(userId)) {
    chat.deletedBy.push(userId);
  }

  // If both users have deleted, remove chat and associated media.
  if (chat.deletedBy.length === chat.participants.length) {
    if (chat.messages.length > 0) {
      for (const message of chat.messages) {
        if (message.media && message.media.length > 0) {
          for (const filePath of message.media) {
            const { isError } = await removeFileFromSupabase(filePath.url);
            if (isError) {
              console.error(`Failed to delete file from Supabase: ${filePath}`);
            }
          }
        }
      }
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

  // Count total matching chats
  const total = await Chat.countDocuments({
    participants: loggedInUserId,
    deletedBy: { $nin: [loggedInUserId] },
    $expr: { $eq: [{ $size: "$participants" }, 2] },
  });

  // Get paginated chats without populating messages.sender
  const chats = await Chat.find({
    participants: loggedInUserId,
    deletedBy: { $nin: [loggedInUserId] },
    $expr: { $eq: [{ $size: "$participants" }, 2] },
  })
    .sort({ updatedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate({
      path: "participants",
      select: "firstName lastName profileImage",
    });

  // Process and format the chats
  const filteredChats = chats.map((chat) => {
    // Only include messages that haven't been deleted for the logged-in user.
    const visibleMessages = chat.messages.filter((msg) => !msg.deletedFor.map(String).includes(loggedInUserId));
    const lastMessage = visibleMessages[visibleMessages.length - 1] || null;
    const participants = chat.participants.filter((user) => user._id.toString() !== loggedInUserId);

    return {
      _id: chat._id,
      participants,
      lastMessage,
      updatedAt: chat.updatedAt,
      archived: chat.archived, // Added archived field
    };
  });

  res.status(200).json({
    chats: filteredChats,
    page,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
  });
});

/**
 * Toggle archive status of a chat.
 */
const toggleArchiveChat = catchAsync(async (req, res, next) => {
  const { chatId } = req.params;
  const loggedInUserId = req.user.id;
  const { recipientId } = req.body;

  // Find the chat and ensure the logged-in user is a participant
  const chat = await Chat.findOne({ _id: chatId, participants: { $in: [loggedInUserId] } });

  if (!chat) {
    return res.status(404).json({ message: "Chat not found or you are not a participant" });
  }

  // Toggle the archived status
  chat.archived = !chat.archived;
  await chat.save();

  res.status(200).json({
    message: `chat ${chat.archived ? "archived" : "unarchived"} successfully`,
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

  // Find the chat and populate participants only (do not populate messages.sender)
  let chat = await Chat.findOne({
    participants: { $all: [loggedInUserId, userId] },
  }).populate({
    path: "participants",
    select: "firstName lastName profileImage",
  });

  // If the chat exists and was previously deleted for the logged-in user, restore it.
  if (chat && chat.deletedBy.includes(loggedInUserId)) {
    chat.deletedBy = chat.deletedBy.filter((id) => id.toString() !== loggedInUserId);
    await chat.save();
  }

  // If no chat exists, create a new one and populate participants only.
  if (!chat) {
    chat = await Chat.create({
      participants: [loggedInUserId, userId],
      messages: [],
      deletedBy: [],
    });
    chat = await Chat.findById(chat._id).populate({
      path: "participants",
      select: "firstName lastName profileImage",
    });
  }

  // Filter visible messages for the logged-in user.
  const visibleMessages = chat.messages.filter((msg) => !msg.deletedFor.map(String).includes(loggedInUserId));

  // Calculate pagination for messages.
  const totalMessages = visibleMessages.length;
  const startIndex = Math.max(0, totalMessages - page * limit);
  const endIndex = totalMessages - (page - 1) * limit;
  const messagesChunk = startIndex < 0 ? [] : visibleMessages.slice(startIndex, endIndex);
  const hasMore = startIndex > 0;

  res.status(200).json({
    chatId: chat._id,
    archived: chat.archived, // Added archived field
    // Return only the other participant's info.
    participants: chat.participants.filter((u) => u._id.toString() !== loggedInUserId),
    messages: messagesChunk, // messages.sender remains as the sender ID only.
    hasMore,
  });
});

// ========================================================================
// 1. Controller to get the total unread messages count for the logged-in user.
//    Only messages not sent by the user and not yet read are counted.
// ========================================================================
const getTotalUnreadMessages = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  // Find all chats where the logged-in user is a participant.
  const chats = await Chat.find({ participants: userId });
  let totalUnread = 0;

  chats.forEach((chat) => {
    chat.messages.forEach((message) => {
      // Count the message if:
      // - It was not sent by the logged-in user.
      // - It is not marked as read.
      if (message.sender.toString() !== userId && !message.isRead) {
        totalUnread++;
      }
    });
  });

  res.status(200).json({
    message: "Total unread messages count retrieved successfully",
    totalUnreadMessages: totalUnread || 0,
  });
});

/**
 * Controller to mark all messages in a specific chat as read.
 * This is intended to be called when the chat modal is mounted.
 */
const markMessagesAsRead = catchAsync(async (req, res, next) => {
  // You can either pass the chatId in req.body or req.params.
  const { chatId } = req.body; // or use req.params.chatId if preferred.
  const userId = req.user.id;

  const chat = await Chat.findById(chatId);
  if (!chat) {
    return next(new CustomError("Chat not found", 404));
  }

  // Flag to check if at least one message is updated.
  let isUpdated = false;

  // Mark as read all messages not sent by the logged-in user.
  chat.messages.forEach((message) => {
    if (message.sender.toString() !== userId && !message.isRead) {
      message.isRead = true;
      isUpdated = true;
    }
  });

  // Save the chat only if there were updates.
  if (isUpdated) {
    await chat.save();
  }
  console.log(chat);

  res.status(200).json({
    message: "All messages marked as read successfully",
    chatId,
  });
});

// ========================================================================
// 3. Controller to get the unread messages count for a specific chat.
//    Only messages not sent by the user and not yet read are counted.
// ========================================================================
const getUnreadCountForChat = catchAsync(async (req, res, next) => {
  const { chatId } = req.params;
  const userId = req.user.id;

  const chat = await Chat.findById(chatId);
  if (!chat) {
    return next(new CustomError("Chat not found", 404));
  }

  let unreadCount = 0;
  chat.messages.forEach((message) => {
    if (message.sender.toString() !== userId && !message.isRead) {
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

  // Find the chat by ID and ensure the logged-in user is a participant
  const chat = await Chat.findOne({ _id: chatId });

  // Filter out messages deleted for the logged-in user
  const visibleMessages = chat.messages.filter((msg) => !msg.deletedFor.map(String).includes(loggedInUserId));

  // Get the last visible message (if any)
  const lastMessage = visibleMessages.length > 0 ? visibleMessages[visibleMessages.length - 1] : null;

  res.status(200).json({ lastMessage });
});
const markMessagesAsReadByIds = catchAsync(async (req, res, next) => {
  const { messageIds } = req.body;
  const userId = req.user.id;

  if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
    return next(new CustomError("Please provide an array of message IDs", 400));
  }

  // First, find all chats containing any of the provided message IDs.
  const chats = await Chat.find({ "messages._id": { $in: messageIds } });

  // Count the total number of unread messages (isRead === false) not sent by the user.
  let totalUpdatedCount = 0;
  chats.forEach((chat) => {
    chat.messages.forEach((message) => {
      if (messageIds.includes(message._id.toString()) && message.sender.toString() !== userId && message.isRead === false) {
        totalUpdatedCount++;
      }
    });
  });

  // Update the matching messages in all chats
  await Chat.updateMany(
    { "messages._id": { $in: messageIds } },
    { $set: { "messages.$[elem].isRead": true } },
    {
      arrayFilters: [
        {
          "elem._id": { $in: messageIds },
          "elem.sender": { $ne: userId },
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
  markMessagesAsReadByIds,
};
