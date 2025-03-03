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
