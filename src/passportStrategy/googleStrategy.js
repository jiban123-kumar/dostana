const passport = require("passport");
const User = require("../model/userModel");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const googleOauthStartegy = () => {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_AUTH_CLIENT_ID,

        clientSecret: process.env.GOOGLE_AUTH_CLIENT_SECRET,

        callbackURL: process.env.GOOGLE_AUTH_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await User.findOne({ googleId: profile.id });
          if (!user) {
            user = await User.create({
              firstName: profile.name.givenName,
              lastName: profile.name.familyName,
              googleId: profile.id,
              isGoogleAccount: true,
              isEmailVerified: true,
              profileImage: profile.photos[0].value,
            });
          }

          return done(null, user);
        } catch (err) {
          done(err, false);
        }
      }
    )
  );
};

module.exports = { googleOauthStartegy };
