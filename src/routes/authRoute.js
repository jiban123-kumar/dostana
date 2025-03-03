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

// // Google OAuth routes
// router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// router.get("/google/callback", passport.authenticate("google", { failureRedirect: `https://${process.env.CLIENT_URL}/login` }), (req, res) => {
//   const payLoad = {
//     id: req.user._id,
//     isGoogleAccount: true,
//   };
//   const token = generateJwtToken(payLoad);
//   cookieGenerator(res, token);
//   res.redirect(`https://${process.env.CLIENT_URL}/home?token=${token}`);
// });

// Initialize Google OAuth2 client using your Google Client ID
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// POST /auth/google/token
// This endpoint receives the Google token from your React client,
// verifies it, finds/creates the user, generates a JWT, sets a cookie,
// and responds with the authentication status.
router.post("/google/token", async (req, res) => {
  const { token } = req.body;

  // Ensure a token is provided
  if (!token) {
    return res.status(400).json({ success: false, message: "Google token is required" });
  }

  try {
    // Verify the token using google-auth-library
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub, email, given_name, family_name, picture } = payload;

    // Find an existing user by their Google ID or create a new one
    let user = await User.findOne({ googleId: sub });
    if (!user) {
      user = await User.create({
        firstName: given_name,
        lastName: family_name,
        googleId: sub,
        isGoogleAccount: true,
        isEmailVerified: true,
        profileImage: picture,
      });
    }

    // Generate a JWT token with the user payload
    const jwtPayload = { id: user._id, isGoogleAccount: true };
    const jwtToken = generateJwtToken(jwtPayload);

    // Use your helper to set the JWT token as an HTTP‑only cookie
    cookieGenerator(res, jwtToken);

    // Return a success response with the token (optional)
    res.json({ success: true, token: jwtToken });
  } catch (error) {
    console.error("Error verifying Google token:", error);
    res.status(401).json({ success: false, message: "Authentication failed" });
  }
});

module.exports = router;
