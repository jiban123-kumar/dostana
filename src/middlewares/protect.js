require("dotenv").config();
const jwt = require("jsonwebtoken");
const CustomError = require("../utilsFunction/customError");
const User = require("../model/userModel");

exports.protect = async (req, res, next) => {
  try {
    let token = req.cookies?.token;
    // If no token is found and user is not authenticated, return 401
    if (!token) {
      return next(new CustomError("Token not found", 401));
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
