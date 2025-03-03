require("dotenv").config();
const jwt = require("jsonwebtoken");
const CustomError = require("../utilsFunction/customError");

exports.protect = async (req, res, next) => {
  try {
    let token = req.cookies?.token;
    console.log(req.headers.authorization);

    // Extract token from Authorization header if not in cookies
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    // If no token is found and user is not authenticated, return 401
    if (!token && !req.isAuthenticated()) {
      return next(new CustomError("Token not found", 401));
    }

    // If authenticated via Passport (e.g., Google OAuth), set user and proceed
    if (req.isAuthenticated() && req.user) {
      req.user = {
        id: req.user._id,
        isGoogleAccount: req.user.isGoogleAccount,
      };
      return next();
    }

    // Verify JWT token
    if (token) {
      try {
        req.user = jwt.verify(token, process.env.JWT_SECRET_KEY);
        return next();
      } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
          return next(new CustomError("Token expired, please login again", 401));
        } else if (error instanceof jwt.JsonWebTokenError) {
          return next(new CustomError("Invalid Token, please login again", 401));
        }
      }
    }

    // Default fallback (should not reach here)
    return next(new CustomError("Unauthorized access", 401));
  } catch (error) {
    return next(new CustomError("Internal Server Error", 500));
  }
};
