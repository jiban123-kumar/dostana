// routes/googleAuthRoutes.js

const express = require("express");
const router = express.Router();
const { OAuth2Client } = require("google-auth-library");
const User = require("../model/userModel");
const { generateJwtToken } = require("../utilsFunction/jwtUtil");
const cookieGenerator = require("../utilsFunction/cookieGenerator");

// Initialize Google OAuth2 client using your Google Client ID
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// POST /auth/google/token
// This endpoint receives the Google token from your React client,
// verifies it, finds/creates the user, generates a JWT, sets a cookie,
// and responds with the authentication status.
router.post("/google/token", async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ success: false, message: "Token required" });

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    console.log(ticket.getPayload());
    const { sub, email, given_name, family_name, picture } = ticket.getPayload();

    // Find or create user with email
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

    // Generate JWT and set cookie
    const jwtToken = generateJwtToken({ id: user._id, isGoogleAccount: true });
    cookieGenerator(res, jwtToken);

    res.json({ success: true, user });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
