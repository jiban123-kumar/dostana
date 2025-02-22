const { validationResult } = require("express-validator");

const validationResultResponse = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array(), message: `${errors.array()[0].msg}` });
  }
  next();
};

module.exports = validationResultResponse;
