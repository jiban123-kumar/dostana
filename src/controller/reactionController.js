const Reaction = require("../model/reactionModel");
const catchAsync = require("../utilsFunction/catchAsync");
const CustomError = require("../utilsFunction/customError");

/**
 * Toggle a reaction for a given content.
 * - If a reaction exists:
 *    - If no type is provided or the same type is provided, remove the reaction.
 *    - If a different type is provided, update the reaction type.
 * - If no reaction exists and a valid type is provided, create a new reaction.
 */
// reactionController.js
const toggleReaction = catchAsync(async (req, res, next) => {
  const { type } = req.body;
  const { contentId } = req.params;
  const userId = req.user?.id;

  if (type && !["like", "heart", "care", "angry", "laugh"].includes(type)) {
    return next(new CustomError("Invalid reaction type", 400));
  }

  const existingReaction = await Reaction.findOne({
    user: userId,
    content: contentId,
  }).populate("user", "profileImage firstName lastName");

  if (existingReaction) {
    if (!type || existingReaction.type === type) {
      await existingReaction.deleteOne();
      return res.status(200).json({
        message: `Removed reaction: ${existingReaction.type}`,
        reactionDetails: {
          contentId,
          isReacted: false,
          userId: userId, // Include user ID for cache update
        },
      });
    }
    existingReaction.type = type;
    await existingReaction.save();

    return res.status(200).json({
      message: `Updated reaction to ${type}`,
      reactionDetails: {
        contentId,
        isReacted: true,
        reaction: existingReaction,
        userId,
      },
    });
  }

  if (type) {
    const reaction = await Reaction.create({
      user: userId,
      content: contentId,
      type,
    }).then((r) => r.populate("user", "profileImage firstName lastName"));
    return res.status(201).json({
      message: `Reacted with ${type}`,
      reactionDetails: {
        contentId,
        isReacted: true,
        reaction,
        userId,
      },
    });
  }

  return res.status(400).json({
    message: "No reaction type provided",
    contentId,
  });
});

/**
 * Get all reactions for a given content.
 * Supports an optional query parameter 'length' to limit the number of reactions returned.
 */
const getReactionsForContent = catchAsync(async (req, res, next) => {
  const { contentId } = req.params;
  const { length } = req.query;

  if (!contentId) {
    return next(new CustomError("Content ID is required", 400));
  }

  const totalReactions = await Reaction.countDocuments({ content: contentId });
  let reactions;

  if (length) {
    reactions = await Reaction.find({ content: contentId })
      .populate("user", "profileImage firstName lastName")
      .sort({ createdAt: -1 })
      .limit(parseInt(length) || 3)
      .select("-__v");
  } else {
    reactions = await Reaction.find({ content: contentId }).populate("user", "profileImage firstName lastName").sort({ createdAt: -1 }).select("-__v");
  }

  res.status(200).json({
    message: `Reactions for content ${contentId}`,
    reactionDetails: {
      totalReactions,
      reactions,
    },
  });
});

module.exports = { toggleReaction, getReactionsForContent };
