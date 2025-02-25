const cookieGenerator = (res, token) => {
  if (!token) {
    throw new Error("Token is required to set the cookie.");
  }

  const isProduction = process.env.NODE_ENV === "production";
  const maxAge = parseInt(process.env.COOKIE_EXPIRATION_DAYS, 10) * 24 * 60 * 60 * 1000 || 7 * 24 * 60 * 60 * 1000; // Default to 7 days

  res.cookie("token", token, {
    sameSite: isProduction ? "None" : "Strict",
    maxAge,
    httpOnly: true,
    secure: isProduction,
    path: "/",
    domain: `https://${process.env.CLIENT_URL}`,
  });
};

module.exports = cookieGenerator;
