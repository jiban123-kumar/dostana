const { body } = require("express-validator");

const resetPasswordValidator = [
  body("email").isEmail().withMessage("Enter a valid email"),
  body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters long").isAlphanumeric().withMessage("Password must contain letters and numbers"),
];
module.exports = resetPasswordValidator;
