const cookieGenerator = (res, token) => {
  if (!token) {
    throw new Error("Token is required to set the cookie.");
  }

  const isProduction = process.env.NODE_ENV === "production";
  const days = parseInt(process.env.COOKIE_EXPIRATION_DAYS, 10) || 7;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000); // Set expiration date

  res.cookie("token", token, {
    sameSite: isProduction ? "None" : "Strict",
    expires, // Use explicit expiration date
    httpOnly: true,
    secure: isProduction,
  });
};

module.exports = cookieGenerator;
