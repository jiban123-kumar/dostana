require("dotenv").config();
const jwt = require("jsonwebtoken");
const CustomError = require("../utilsFunction/customError");

exports.protect = async (req, res, next) => {
  try {
    // extract the token from request cookies
    const { token } = req.cookies;

    // if token is not there, return 401 response
    if (!token && !req.user) {
      return next(new CustomError("Token not found", 401));
    }
    if (req.isAuthenticated() && req.user) {
      req.user = {
        id: req.user?._id,
        isGoogleAccount: req.user?.isGoogleAccount,
      };
      return next();
    }

    // verifies the token
    if (token) {
      const decodedInfo = jwt.verify(token, process.env.JWT_SECRET_KEY);

      // checks if decoded info contains legit details, then set that info in req.user and calls next
      req.user = decodedInfo;
      return next();
    }

    // if token is invalid then sends the response accordingly
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
