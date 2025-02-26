require("dotenv").config();
const jwt = require("jsonwebtoken");
const CustomError = require("../utilsFunction/customError");

exports.protect = async (req, res, next) => {
  try {
    const { token } = req.cookies;

    // If a JWT is present, verify it
    if (token) {
      const decodedInfo = jwt.verify(token, process.env.JWT_SECRET_KEY);
      req.user = decodedInfo;
      return next();
    }

    // Otherwise, if Passport has set req.user via session, allow access
    if (req.isAuthenticated && req.isAuthenticated()) {
      // req.user is already set by Passport (for Google OAuth)
      return next();
    }

    // If neither token nor session-based auth is found, deny access
    return next(new CustomError("Authentication required", 401));
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new CustomError("Token expired, please login again", 401));
    } else if (error instanceof jwt.JsonWebTokenError) {
      return next(new CustomError("Invalid Token, please login again", 401));
    } else {
      return next(new CustomError("Internal Server Error", 500));
    }
  }
};
