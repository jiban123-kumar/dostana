const User = require("../model/userModel");
const catchAsync = require("../utilsFunction/catchAsync");
const CustomError = require("../utilsFunction/customError");
const { passwordValidate, hashPassword } = require("../utilsFunction/passwordValidate");
const { generateJwtToken } = require("../utilsFunction/jwtUtil");
const EmailVerification = require("../model/emailVerificationModel");
const mongoose = require("mongoose");
const { sendOtp, validateOtp } = require("../utilsFunction/nodemailer");
const cookieGenerator = require("../utilsFunction/cookieGenerator");
const { removeFileFromSupabase } = require("../utilsFunction/fileRemover");

const Reaction = require("../model/reactionModel");
const Content = require("../model/contentModel");
const Notification = require("../model/notificationModel");
const Comment = require("../model/commentModel");
const Friend = require("../model/friendModel");
const { default: axios } = require("axios");

// Helper function to handle OTP validation

// Controllers

const requestOtp = catchAsync(async (req, res, next) => {
  const { email } = req.body;
  const response = await sendOtp(email, next);
  if (response?.isError) {
    return next(new CustomError("Failed to send OTP", 400));
  }
  res.status(200).json({ message: "OTP sent successfully", email });
});

const verifyOtp = catchAsync(async (req, res, next) => {
  const { email, otp } = req.body;
  const verificationDetails = await EmailVerification.findOne({ email });

  const response = await validateOtp(email, otp, verificationDetails);
  if (response?.isError) {
    return next(new CustomError(response.errMsg, 400));
  }
  verificationDetails.isAccountVerified = true;
  await verificationDetails.save();
  res.status(200).json({ message: "OTP verified successfully", email });
});

const registerUser = catchAsync(async (req, res, next) => {
  const { email, password, username } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findOne({ email }).session(session);
    if (user) {
      await session.abortTransaction();
      session.endSession();
      return next(new CustomError("User already exists", 400));
    }

    const emailAccount = await EmailVerification.findOne({ email }).session(session);
    if (!emailAccount?.isAccountVerified) {
      await session.abortTransaction();
      session.endSession();
      return next(new CustomError("Account not verified", 400));
    }

    const hashedPassword = await hashPassword(password);
    const newUser = await User.create([{ email, password: hashedPassword, username, isEmailVerified: true }], { session });

    await EmailVerification.findOneAndDelete({ email }).session(session);

    await session.commitTransaction();
    session.endSession();

    const token = generateJwtToken({ id: newUser[0]._id });
    cookieGenerator(res, token);

    res.status(201).json({ status: "success", data: { user: newUser[0] } });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
});

const loginUser = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return next(new CustomError("User not found", 404));
  }
  if (!user.password) {
    return next(new CustomError("Password not found", 401));
  }
  const isValidPassword = await passwordValidate(password, user.password);
  if (!isValidPassword) {
    return next(new CustomError("Invalid password", 401));
  }
  const token = generateJwtToken({ id: user._id });
  cookieGenerator(res, token);
  const isProfileCompleted = user.isProfileCompleted;
  res.status(200).json({ status: "success", message: "Login successful", isProfileCompleted });
});

const changePassword = catchAsync(async (req, res, next) => {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.user?.id);
  if (!user) {
    return next(new CustomError("User not found", 404));
  }
  if (user.isGoogleAccount) {
    return next(new CustomError("Google account cannot change password", 400));
  }
  const isAuthenticated = await passwordValidate(oldPassword || "", user.password);
  if (!isAuthenticated) {
    return next(new CustomError("Invalid password", 401));
  }
  const hashedPassword = await hashPassword(newPassword);
  user.password = hashedPassword;
  await user.save();
  res.status(200).json({ message: "Password changed successfully" });
});

const resetPassword = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const verificationDetails = await EmailVerification.findOne({ email }).session(session);

    if (!verificationDetails || !verificationDetails.isAccountVerified) {
      await session.abortTransaction();
      session.endSession();
      return next(new CustomError("Account has not been verified", 401));
    }

    const user = await User.findOne({ email }).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return next(new CustomError("User not found", 404));
    }

    const hashedPassword = await hashPassword(password);
    user.password = hashedPassword;
    await user.save({ session });

    await EmailVerification.findOneAndDelete({ email }).session(session);

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
});
const logoutUser = catchAsync(async (req, res, next) => {
  // Clear authentication token cookie
  await User.findByIdAndUpdate(req.user?.id, { subscription: null });
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });

  res.status(200).json({ message: "Logout successful" });
});

// Helper function to delete all data related to a user
const deleteUserData = async (userId) => {
  // Delete all comments made by the user
  await Comment.deleteMany({ user: userId });

  // Delete all reactions made by the user
  await Reaction.deleteMany({ user: userId });

  // Find all content (posts/tweets) created by the user
  const userContents = await Content.find({ user: userId });
  // Collect IDs of the user's content for further deletion of reactions
  const userContentIds = userContents.map((content) => content._id);

  // Remove any reactions on the user's content
  await Reaction.deleteMany({ content: { $in: userContentIds } });

  // For each content, remove associated media files from Supabase
  for (const content of userContents) {
    if (content.mediaUrl && content.mediaUrl.length > 0) {
      for (const filePath of content.mediaUrl) {
        await removeFileFromSupabase(filePath);
      }
    }
  }
  // Delete all content documents for the user
  await Content.deleteMany({ user: userId });

  // Delete notifications belonging to the user
  await Notification.deleteMany({ user: userId });

  // Delete friend relationships where the user is involved (either as requester or recipient)
  await Friend.deleteMany({ $or: [{ requester: userId }, { recipient: userId }] });

  // Add any other related data deletion here as needed
};

// Refactored deleteAccount controller
const deleteAccount = catchAsync(async (req, res, next) => {
  const { password, isAccountDelete, recaptchaToken } = req.body;
  const user = await User.findById(req.user?.id);

  if (!user) return next(new CustomError("User not found", 404));

  // Validate password for non-Google accounts
  if (!req.user?.isGoogleAccount && !(await passwordValidate(password || "", user.password))) {
    return next(new CustomError("Invalid password", 401));
  }

  // Handle reCAPTCHA validation if account deletion is requested
  if (isAccountDelete) {
    const recaptchaValid = await verifyRecaptcha(recaptchaToken);
    if (!recaptchaValid) return res.status(400).json({ valid: false, error: "reCAPTCHA verification failed" });
  }

  // Proceed with account deletion
  await handleAccountDeletion(user);

  // Clear session cookies and respond
  clearUserCookies(res);
  res.status(200).json({ message: "Account deleted successfully" });
});

// Function to verify reCAPTCHA
const verifyRecaptcha = async (token) => {
  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    const { data } = await axios.post(`https://www.google.com/recaptcha/api/siteverify`, null, {
      params: { secret: secretKey, response: token },
    });
    return data.success;
  } catch (error) {
    return false;
  }
};

// Function to handle account deletion
const handleAccountDeletion = async (user) => {
  await deleteUserData(user._id);
  if (user.profileImage) await removeFileFromSupabase(user.profileImage);
  if (user.coverImage) await removeFileFromSupabase(user.coverImage);
  await User.findByIdAndDelete(user._id);
};

// Function to clear cookies after account deletion
const clearUserCookies = (res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });
  res.clearCookie("connect.sid");
};

module.exports = {
  loginUser,
  registerUser,
  verifyOtp,
  deleteAccount,
  resetPassword,
  changePassword,
  logoutUser,
  requestOtp,
};
