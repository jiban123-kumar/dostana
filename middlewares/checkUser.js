const User = require("../model/userModel");
const catchAsync = require("../utilsFunction/catchAsync");
const CustomError = require("../utilsFunction/customError");

/**
 * Middleware to check if a user exists in the database.
 * Throws an error if the user does not exist.
 */
exports.checkUserExist = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new CustomError("Email is required", 400));
  }

  const user = await User.findOne({ email });

  if (!user) {
    return next(new CustomError("Account has not been registered", 404));
  }

  next();
});

/**
 * Middleware to ensure that a user does not exist in the database.
 * Throws an error if the user already exists.
 */
exports.checkUserNotExist = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new CustomError("Email is required", 400));
  }

  const user = await User.findOne({ email });

  if (user) {
    return next(new CustomError("User already exists", 400));
  }

  next();
});
