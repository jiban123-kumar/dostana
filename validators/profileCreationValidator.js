const { body } = require("express-validator");

const profileCreationValidator = [
  body("firstName")
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ min: 3 })
    .withMessage("First name must be at least 3 characters long")
    .isLength({ max: 20 })
    .withMessage("First name must be at most 20 characters long"),
  body("lastName")
    .notEmpty()
    .withMessage("Last name is required")
    .isLength({ min: 3 })
    .withMessage("Last name must be at least 3 characters long")
    .isLength({ max: 20 })
    .withMessage("Last name must be at most 20 characters long"),
  body("aboutMe").optional().isLength({ max: 100 }).withMessage("About me must be at most 100 characters long"),
  body("gender").isIn(["male", "female", "other"]).withMessage("Gender must be male, female or other"),
  body("dob")
    .isDate()
    .withMessage("Date of birth must be a valid date")
    .custom((value, { req }) => {
      const today = new Date();
      const birthDate = new Date(value);
      if (birthDate > today) {
        throw new Error("Date of birth cannot be in the future");
      }
      if (birthDate.getFullYear() > today.getFullYear() - 16) {
        throw new Error("You must be at least 16 years old to create a profile");
      }
      return true;
    }),
];

module.exports = profileCreationValidator;
