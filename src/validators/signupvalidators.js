const { body } = require("express-validator");

const signupValidator = [
  body("email").isEmail().withMessage("Enter a valid email"),
  body("username")
    .isLength({ min: 6 })
    .withMessage("Username must be at least 6 characters long")
    .isLength({ max: 20 })
    .withMessage("Username must be at most 20 characters long")
    .isAlphanumeric()
    .custom((value, { req }) => {
      if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) {
        return "Username must contain both letters and numbers";
      }
      return true;
    })
    .withMessage("Username must contain letters and numbers"),
  body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters long").isAlphanumeric().withMessage("Password must contain letters and numbers"),
];
module.exports = signupValidator;
