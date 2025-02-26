const User = require("../model/userModel");
const catchAsync = require("../utilsFunction/catchAsync");
const CustomError = require("../utilsFunction/customError");
const { passwordValidate, hashPassword } = require("../utilsFunction/passwordValidate");
const { generateJwtToken } = require("../utilsFunction/jwtUtil");
const EmailVerification = require("../model/emailVerificationModel");
const mongoose = require("mongoose");
const { sendOtp, validateOtp } = require("../utilsFunction/nodemailer");
const cookieGenerator = require("../utilsFunction/cookieGenerator");

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
  const token = generateJwtToken({ id: user._id, email });
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

const deleteAccount = catchAsync(async (req, res, next) => {
  const { password, isAccountDelete } = req.body;
  const user = await User.findById(req.user?.id);

  if (!user) {
    return next(new CustomError("User not found", 404));
  }
  if (req.user?.isGoogleAccount) {
    await User.findByIdAndDelete(req.user?.id);
    req.logout((err) => {
      if (err) return next(err);
      // Optionally destroy the session completely
      req.session.destroy(() => {
        res.redirect(`https://${process.env.CLIENT_URL}/login`);
      });
    });

    return res.status(204).json({ message: "Account deleted successfully" });
  }
  const isValidPassword = await passwordValidate(password || "", user.password);
  if (!isValidPassword) {
    return next(new CustomError("Invalid password", 401));
  }
  if (isAccountDelete) {
    await User.findByIdAndDelete(req.user?.id);
    res.clearCookie("token");

    return res.status(204).json({ message: "Account deleted successfully" });
  }

  res.status(204).json({ message: "Account deleted successfully" });
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
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });
  if (req.user?.isGoogleAccount) {
    req.logout((err) => {
      if (err) return next(err);
      res.clearCookie("connect.sid");
      req.session.destroy();
    });
  }
  res.status(200).json({ message: "Logout successful" });
});
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
