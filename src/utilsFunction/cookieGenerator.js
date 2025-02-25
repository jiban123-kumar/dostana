const cookieGenerator = (res, token) => {
  res.cookie("token", token, {
    sameSite: process.env.PRODUCTION === "true" ? "None" : "strict",
    maxAge: parseInt(process.env.COOKIE_EXPIRATION_DAYS) * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
};

module.exports = cookieGenerator;
