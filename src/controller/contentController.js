// controllers/contentController.js
const Content = require("../model/contentModel");
const Reaction = require("../model/reactionModel");
const User = require("../model/userModel");
const catchAsync = require("../utilsFunction/catchAsync");
const CustomError = require("../utilsFunction/customError");
const { removeFileFromSupabase } = require("../utilsFunction/fileRemover");
const { uploadFileToSupabase } = require("../utilsFunction/fileUploader");

/**
 * Add reaction details to each content in the provided array.
 */
const addReactionDetails = async (contents, loggedUserId) => {
  if (!contents || contents.length === 0) return contents;

  // Gather all content IDs.
  const contentIds = contents.map((c) => c._id);
  // Fetch reactions for these IDs.
  const reactions = await Reaction.find({ content: { $in: contentIds } })
    .populate("user", "profileImage firstName lastName")
    .sort({ createdAt: -1 });

  // Group reactions by content ID.
  const reactionsByContent = {};
  reactions.forEach((r) => {
    const id = r.content.toString();
    if (!reactionsByContent[id]) reactionsByContent[id] = [];
    reactionsByContent[id].push(r);
  });

  // Attach reaction details (total count and limited reactions) to each content.
  contents.forEach((content) => {
    const allReactions = reactionsByContent[content._id.toString()] || [];
    const totalReactions = allReactions.length;
    let finalReactions = [];

    if (loggedUserId) {
      // Include the user’s reaction (if any) plus up to two others.
      const userReaction = allReactions.find((r) => r.user && r.user._id.toString() === loggedUserId);
      const otherReactions = allReactions.filter((r) => !userReaction || r._id.toString() !== userReaction._id.toString());
      const latestOtherReactions = otherReactions.slice(0, 2);
      if (userReaction) finalReactions.push(userReaction);
      finalReactions = finalReactions.concat(latestOtherReactions);
    } else {
      // If not logged in, include the three most recent reactions.
      finalReactions = allReactions.slice(0, 3);
    }

    content.reactionDetails = {
      totalReactions,
      reactions: finalReactions,
    };
  });

  return contents;
};

/**
 * Create new content.
 * Returns the newly created content as a single object under "content".
 */
const createContent = catchAsync(async (req, res, next) => {
  const { type, caption } = req.body;
  const user = await User.findById(req.user?.id);
  if (!user) return next(new CustomError("User not found", 404));

  // Validate content type
  if (!["thought", "post"].includes(type)) return next(new CustomError("Invalid content type", 400));

  // Handle media uploads
  const media = [];
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const { buffer, originalname, mimetype } = file;
      const result = await uploadFileToSupabase({ buffer, originalname, mimetype });

      if (result.isError) {
        return next(new CustomError(`Failed to upload file: ${result.message}`, 500));
      }

      // Push media object like { url, type }
      media.push({
        url: result.fileUrl,
        type: mimetype.startsWith("image/") ? "image" : "video",
      });
    }
  }

  // Create new content
  const newContent = await Content.create({
    type,
    caption,
    media, // Using new consistent media structure
    user: user._id,
  });

  // Populate user details
  await newContent.populate("user", "profileImage firstName lastName");

  // Convert to plain object and exclude unwanted fields
  let contentObj = newContent.toObject();
  delete contentObj.savedBy;
  delete contentObj.sharedBy;
  delete contentObj.sharedWith;

  // Add reaction details (if you have any reaction logic)
  await addReactionDetails([contentObj], req.user.id);

  // Send response
  res.status(200).json({
    message: `${type.charAt(0).toUpperCase() + type.slice(1)} created successfully`,
    content: contentObj,
  });
});

/**
 * Delete content and its associated files from Supabase if applicable.
 */
const deleteContent = catchAsync(async (req, res, next) => {
  const { contentId } = req.params;
  const content = await Content.findById(contentId);
  if (!content) return next(new CustomError("Content not found", 404));

  if (content.user.toString() !== req.user?.id) return next(new CustomError("You do not have permission to delete this content", 403));

  const fileDeleteResults = [];
  if (content.mediaUrl && content.mediaUrl.length > 0) {
    for (const filePath of content.mediaUrl) {
      const { isError } = await removeFileFromSupabase(filePath);
      fileDeleteResults.push(isError ? { filePath, error: true, message: `Failed to delete file: ${filePath}` } : { filePath, error: false });
    }
  }
  const failedDeletions = fileDeleteResults.filter((result) => result.error);
  if (failedDeletions.length > 0) {
    return res.status(500).json({
      message: "Some files could not be deleted from Supabase.",
      errors: failedDeletions,
    });
  }

  await content.deleteOne();
  res.status(200).json({
    message: `${content.type.charAt(0).toUpperCase() + content.type.slice(1)} and associated files deleted successfully`,
    content,
  });
});

/**
 * Get contents based on query filters.
 * Returns an array of content objects under "contents".
 */
const getContents = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10, filterType, userId } = req.query;
  const parsedPage = parseInt(page, 10) || 1;
  const parsedLimit = parseInt(limit, 10) || 10;
  const skip = (parsedPage - 1) * parsedLimit;
  const loggedUserId = req.user ? req.user.id : null;

  let totalDocuments = 0;
  let contents = [];

  if (filterType === "saved") {
    // Retrieve saved content.
    const filter = { savedBy: { $in: [loggedUserId] } };
    totalDocuments = await Content.countDocuments(filter);
    contents = await Content.find(filter).populate("user", "profileImage firstName lastName").sort({ createdAt: -1 }).skip(skip).limit(parsedLimit);
    contents = contents.map((doc) => {
      const docObj = doc.toObject();
      docObj.isSavedByUser = true;
      delete docObj.savedBy;
      delete docObj.sharedBy;
      delete docObj.sharedWith;
      return docObj;
    });
  } else if (filterType === "shared") {
    // Retrieve shared content from the Share model.
    const filter = { $or: [{ sharedWith: loggedUserId }, { sharedBy: loggedUserId }] };
    totalDocuments = await Content.countDocuments(filter);
    contents = await Content.find(filter)
      .populate("user", "profileImage firstName lastName")
      .populate("sharedBy", "firstName lastName profileImage")
      .populate("sharedWith", "firstName lastName profileImage")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    // Attach a "shareType" field and include isSavedByUser
    contents = contents.map((item) => {
      const isSharedByMe = item.sharedBy && item.sharedBy._id.toString() === loggedUserId;
      const shareType = isSharedByMe ? "sharedByMe" : "sharedWithMe";
      if (!isSharedByMe) {
        item.sharedWith = item.sharedWith.filter((user) => user._id.toString() === loggedUserId);
      }

      // Add isSavedByUser
      item.isSavedByUser = item.savedBy ? item.savedBy.some((id) => id.toString() === loggedUserId) : false;
      item.shareType = shareType;

      // Remove unwanted fields

      return { ...item };
    });
  } else {
    // Default: return all content (or filter by userId if provided).
    const filter = userId ? { user: userId } : {};
    totalDocuments = await Content.countDocuments(filter);
    contents = await Content.find(filter).populate("user", "profileImage firstName lastName").sort({ createdAt: -1 }).skip(skip).limit(parsedLimit);
    contents = contents.map((doc) => {
      const docObj = doc.toObject();
      if (loggedUserId) {
        const isSaved = docObj.savedBy ? docObj.savedBy.some((id) => id.toString() === loggedUserId) : false;
        docObj.isSavedByUser = isSaved;
      } else {
        docObj.isSavedByUser = false;
      }
      delete docObj.savedBy;
      delete docObj.sharedBy;
      delete docObj.sharedWith;
      return docObj;
    });
  }

  await addReactionDetails(contents, loggedUserId);

  const nextPage = skip + contents.length < totalDocuments ? parsedPage + 1 : null;

  res.status(200).json({
    message: "Content retrieved successfully",
    contents,
    nextPage,
    totalDocuments,
  });
});

/**
 * Toggle save/unsave for a content document.
 * Returns the updated content as a single object under "content".
 */
const toggleSaveContent = catchAsync(async (req, res, next) => {
  const { contentId } = req.params;
  const userId = req.user?.id;

  const content = await Content.findById(contentId);
  if (!content) return next(new CustomError("Content not found", 404));

  let message = "";
  if (content.savedBy.includes(userId)) {
    await Content.findByIdAndUpdate(contentId, { $pull: { savedBy: userId } });
    message = "Content unsaved successfully";
  } else {
    await Content.findByIdAndUpdate(contentId, { $addToSet: { savedBy: userId } });
    message = "Content saved successfully";
  }

  const updatedContent = await Content.findById(contentId).populate("user", "profileImage firstName lastName");
  let updatedContentObj = updatedContent.toObject();
  updatedContentObj.isSavedByUser = updatedContent.savedBy.includes(userId);
  // Remove unwanted fields.
  delete updatedContentObj.savedBy;
  delete updatedContentObj.sharedBy;
  delete updatedContentObj.sharedWith;

  // Add reaction details.
  await addReactionDetails([updatedContentObj], userId);

  res.status(200).json({
    message,
    content: updatedContentObj,
  });
});

/**
 * Share content with multiple users.
 * Returns the updated share document as a single object under "content".
 * The nested content is formatted with reaction details.
 */
const shareContent = catchAsync(async (req, res, next) => {
  const { contentId, userIds } = req.body; // Array of user IDs

  // Ensure the content exists
  const content = await Content.findById(contentId);
  if (!content) {
    return next(new CustomError("Content not found", 404));
  }

  // Update the content document: add users to the sharedWith array
  const updatedContent = await Content.findByIdAndUpdate(
    contentId,
    {
      $addToSet: { sharedWith: { $each: userIds } },
      sharedBy: req.user.id,
    },
    { new: true }
  )
    .populate("user", "profileImage firstName lastName")
    .populate("sharedBy", "firstName lastName profileImage")
    .populate("sharedWith", "firstName lastName profileImage");

  // Convert to plain object and remove unwanted fields
  let contentObj = updatedContent.toObject();
  contentObj.isSavedByUser = updatedContent.savedBy.includes(req.user.id); // Add isSavedByUser
  delete contentObj.savedBy;
  delete contentObj.sharedBy;
  delete contentObj.sharedWith;

  // Add reaction details
  await addReactionDetails([contentObj], req.user.id);

  res.status(200).json({
    message: "Content shared successfully",
    content: contentObj,
  });
});

const getContentById = catchAsync(async (req, res, next) => {
  const { contentId } = req.params;
  const loggedUserId = req.user ? req.user.id : null;

  // Find the content by its ID and populate the user details.
  const content = await Content.findById(contentId).populate("user", "profileImage firstName lastName");
  if (!content) return next(new CustomError("Content not found", 404));

  // Convert to plain object
  let contentObj = content.toObject();

  // Add isSavedByUser flag (if logged in) using the savedBy field.
  if (loggedUserId) {
    const isSaved = contentObj.savedBy ? contentObj.savedBy.some((id) => id.toString() === loggedUserId) : false;
    contentObj.isSavedByUser = isSaved;
  } else {
    contentObj.isSavedByUser = false;
  }

  // Remove unwanted fields to match the list response.
  delete contentObj.savedBy;
  delete contentObj.sharedBy;
  delete contentObj.sharedWith;

  // Optionally, attach reaction details.
  await addReactionDetails([contentObj], loggedUserId);

  res.status(200).json({
    message: "Content retrieved successfully",
    content: contentObj,
  });
});

module.exports = {
  createContent,
  deleteContent,
  getContents, // List endpoint (returns an array of contents)
  toggleSaveContent,
  shareContent,
  getContentById,
};
