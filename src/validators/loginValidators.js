const { body } = require("express-validator");

const loginvalidators = [body("emailOrUsername").notEmpty().withMessage("Email or username is required"), body("password").notEmpty().withMessage("Password is required")];
module.exports = loginvalidators;
