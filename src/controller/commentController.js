// commentController.js
const Comment = require("../model/commentModel");
const Content = require("../model/contentModel");
const catchAsync = require("../utilsFunction/catchAsync");
const CustomError = require("../utilsFunction/customError");

// Create a comment
const createComment = catchAsync(async (req, res, next) => {
  const { comment, contentId } = req.body;
  // Ensure the content exists
  const content = await Content.findById(contentId);
  if (!content) {
    return next(new CustomError("content not found", 404));
  }

  const newComment = await Comment.create({
    comment,
    content: contentId,
    user: req.user?.id,
  });
  await newComment.populate("user", "profileImage firstName lastName");

  res.status(201).json({
    message: "Comment created successfully",
    comment: newComment,
  });
});

// Delete a comment
const deleteComment = catchAsync(async (req, res, next) => {
  const { commentId } = req.params;
  // Find the comment
  const comment = await Comment.findById(commentId);

  if (!comment) {
    return next(new CustomError("Comment not found", 404));
  }

  const content = await Content.findById(comment.content);
  if (!content) {
    return next(new CustomError("Associated content not found", 404));
  }

  // Allow deletion if the user is the comment creator or the content owner
  if (comment.user.toString() !== req.user?.id && content.user.toString() !== req.user?.id) {
    return next(new CustomError("You do not have permission to delete this comment", 403));
  }

  const deletedComment = await Comment.findOneAndDelete({ _id: commentId });

  res.status(200).json({
    message: "Comment deleted successfully",
    comment: deletedComment,
  });
});

// Get comments by content ID with pagination (for infinite query)
const getCommentsForContent = catchAsync(async (req, res, next) => {
  const { contentId } = req.params;
  // Parse query parameters
  let { page, limit } = req.query;
  page = parseInt(page) || 1;
  limit = parseInt(limit) || 10;

  // Ensure the content exists
  const content = await Content.findById(contentId);
  if (!content) {
    return next(new CustomError("content not found", 404));
  }

  const totalComments = await Comment.countDocuments({ content: contentId });
  const totalPages = Math.ceil(totalComments / limit);

  const comments = await Comment.find({ content: contentId })
    .populate("user", "profileImage firstName lastName")
    .sort({ createdAt: -1 }) // latest first
    .skip((page - 1) * limit)
    .limit(limit);

  const nextPage = page < totalPages ? page + 1 : null;

  res.status(200).json({
    message: "Comments retrieved successfully",
    comments,
    page,
    nextPage,
    totalPages,
    totalComments,
  });
});

module.exports = {
  createComment,
  deleteComment,
  getCommentsForContent,
};
