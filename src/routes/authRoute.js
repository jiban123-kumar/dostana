const express = require("express");
const passport = require("passport");
const { generateJwtToken } = require("../utilsFunction/jwtUtil");
const { loginUser, registerUser, verifyOtp, resetPassword, deleteAccount, changePassword, logoutUser, requestOtp } = require("../controller/authController");
const validationResultResponse = require("../validators/expressValidatorsResult");
const { validateOtpValidator, sendOtpValidator } = require("../validators/otpValidator");
const resetPasswordValidator = require("../validators/resetPasswordValidator");
const { protect } = require("../middlewares/protect");
const { checkUserExist, checkUserNotExist } = require("../middlewares/checkUser");
const cookieGenerator = require("../utilsFunction/cookieGenerator");
const { OAuth2Client } = require("google-auth-library");
const User = require("../model/userModel");

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

router.post("/logout", logoutUser);

// Google OAuth routes
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get("/google/callback", passport.authenticate("google", { failureRedirect: `https://${process.env.CLIENT_URL}/login` }), (req, res) => {
  const payLoad = {
    id: req.user._id,
    isGoogleAccount: true,
  };
  const token = generateJwtToken(payLoad);
  cookieGenerator(res, token);
  // res.redirect(`https://${process.env.CLIENT_URL}/home?token=${token}`);
  res.redirect(`http://localhost:5173/home`);
});

module.exports = router;
