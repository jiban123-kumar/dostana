const jwt = require("jsonwebtoken");
const generateJwtToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET_KEY, {
    expiresIn: "30d",
  });
};
const authenticateJWT = (req, res, next) => {
  const token = req.session.jwtToken; // Retrieve JWT from cookie-session
  if (!token) {
    return res.status(403).send("Access denied");
  }

  // Verify the JWT
  jwt.verify(token, process.env.JWT_SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).send("Invalid token");
    }

    req.user = user; // Attach user info to the request
    next(); // Continue to the next middleware or route
  });
};
module.exports = { generateJwtToken, authenticateJWT };
