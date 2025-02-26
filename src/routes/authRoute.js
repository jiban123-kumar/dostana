const express = require("express");
const passport = require("passport");
const { generateJwtToken } = require("../utilsFunction/jwtUtil");
const { loginUser, registerUser, verifyOtp, resetPassword, deleteAccount, deleteAllAccounts, changePassword, logoutUser, requestOtp } = require("../controller/authController");
const validationResultResponse = require("../validators/expressValidatorsResult");
const { validateOtpValidator, sendOtpValidator } = require("../validators/otpValidator");
const resetPasswordValidator = require("../validators/resetPasswordValidator");
const { protect } = require("../middlewares/protect");
const { checkUserExist, checkUserNotExist } = require("../middlewares/checkUser");
const cookieGenerator = require("../utilsFunction/cookieGenerator");

const router = express.Router();

// Validators
// These are validation middleware that will run before controllers

// Routes
router.post("/login", loginUser);

router.post("/signup", registerUser);

router.post("/signup/get-otp", sendOtpValidator, validationResultResponse, checkUserNotExist, requestOtp);

router.post("/forget-password/get-otp", sendOtpValidator, validationResultResponse, checkUserExist, requestOtp);

router.post("/verify-otp", validateOtpValidator, validationResultResponse, verifyOtp);

router.post("/password/reset", resetPasswordValidator, validationResultResponse, resetPassword);

router.post("/password/change", protect, changePassword);

router.delete("/account", protect, deleteAccount);

router.delete("/accounts", deleteAllAccounts);

router.post("/logout", logoutUser);

// Google OAuth routes
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get("/google/callback", passport.authenticate("google", { failureRedirect: `https://${process.env.CLIENT_URL}/home` }), (req, res) => {
  const user = req.user; // This will be populated by Passport
  // Generate JWT token after successful Google login
  // const token = generateJwtToken({ id: user.id, isGoogleAccount: user.isGoogleAccount });

  // Send the token as a secure HTTP-only cookie
  // cookieGenerator(res, token);

  // Redirect to a protected route after login
  res.redirect(`https://${process.env.CLIENT_URL}/home`);
});

module.exports = router;
