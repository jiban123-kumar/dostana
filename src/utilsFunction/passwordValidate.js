const bcrypt = require("bcrypt");
const passwordValidate = async (password, dbPassword) => {
  return await bcrypt.compare(password, dbPassword);
};
const hashPassword = async (password) => {
  return await bcrypt.hash(password, 10);
};

module.exports = { passwordValidate, hashPassword };
