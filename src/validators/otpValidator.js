const { body } = require("express-validator");

const sendOtpValidator = [body("email").isEmail().withMessage("Enter a valid email")];
const validateOtpValidator = [body("email").isEmail().withMessage("Enter a valid email"), body("otp").isLength({ min: 6, max: 6 }).withMessage("Enter a valid OTP")];
module.exports = { sendOtpValidator, validateOtpValidator };
