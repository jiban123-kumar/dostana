const { body } = require("express-validator");

const changePasswordValidator = [
  body("newPassword").isLength({ min: 8 }).withMessage("Password must be at least 8 characters long").isAlphanumeric().withMessage("Password must contain letters and numbers"),
];
module.exports = changePasswordValidator;
