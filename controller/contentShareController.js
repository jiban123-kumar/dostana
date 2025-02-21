// controllers/shareController.js
const Content = require("../model/contentModel");
const Share = require("../model/shareModel");
const CustomError = require("../utilsFunction/customError");
const catchAsync = require("../utilsFunction/catchAsync");

const getSharedContent = catchAsync(async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) {
    return next(new CustomError("User not authenticated", 401));
  }

  // Read pagination parameters
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  // Find shares where the logged‑in user is either the sharer or a recipient.
  const filter = { $or: [{ sharedWith: userId }, { sharedBy: userId }] };

  // Count total matching documents
  const totalDocuments = await Share.countDocuments(filter);

  // Find and paginate
  let shares = await Share.find(filter)
    .populate({
      path: "content",
      populate: { path: "user", select: "firstName lastName profileImage" },
    })
    .populate("sharedBy", "firstName lastName profileImage")
    .populate("sharedWith", "firstName lastName profileImage")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  // Add a `type` field: if the logged‑in user is the one who shared, mark as "sharedByMe",
  // otherwise "sharedWithMe". (Also, for sharedWithMe, you might choose to filter the sharedWith array.)
  shares = shares.map((item) => {
    const isSharedByMe = item.sharedBy && item.sharedBy._id.toString() === userId;
    const type = isSharedByMe ? "sharedByMe" : "sharedWithMe";
    if (!isSharedByMe) {
      // Optionally, for "sharedWithMe" only include the current user’s info.
      item.sharedWith = item.sharedWith.filter((user) => user._id.toString() === userId);
    }
    return { ...item, type };
  });

  const nextPage = skip + shares.length < totalDocuments ? page + 1 : null;

  res.status(200).json({
    message: "Shared content retrieved successfully.",
    sharedContent: shares,
    nextPage,
    totalDocuments,
  });
});

// (Your shareContent controller remains similar)
const shareContent = catchAsync(async (req, res, next) => {
  const { contentId, userIds } = req.body; // Array of user IDs to share with

  // Ensure the content exists
  const content = await Content.findById(contentId);
  if (!content) {
    return next(new CustomError("Content not found", 404));
  }

  // Update (or create) a share document: add users to the sharedWith array
  const updatedContent = await Share.findOneAndUpdate(
    { content: contentId },
    {
      $addToSet: { sharedWith: { $each: userIds } },
      sharedBy: req.user.id,
    },
    { new: true, upsert: true }
  );

  res.status(200).json({
    message: "Content shared successfully",
    content: updatedContent,
  });
});

module.exports = { shareContent, getSharedContent };
