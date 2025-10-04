/**
 * Passport Facebook OAuth Strategy Configuration
 * Handles Facebook authentication for user login and registration
 */

import passport from "passport";
import FacebookStrategy from "passport-facebook";
import User from "../models/user.model.js";
import bcryptjs from "bcryptjs";

/**
 * Configure Facebook Strategy after environment variables are loaded
 */
export function configureFacebookStrategy() {
  if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
    passport.use(
      new FacebookStrategy.Strategy(
        {
          clientID: process.env.FACEBOOK_CLIENT_ID,
          clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
          callbackURL: "http://localhost:3000/api/auth/facebook/callback",
          profileFields: ["id", "emails", "name", "photos"],
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            // Extract user information from Facebook profile
            const facebookId = profile.id;
            const email = profile.emails?.[0]?.value;
            const name =
              profile.displayName ||
              profile.name?.givenName + " " + profile.name?.familyName ||
              "Facebook User";
            const profilePicture = profile.photos?.[0]?.value;

            // Validate required fields
            if (!email) {
              return done(
                new Error("Facebook account must have an email address"),
                null
              );
            }

            if (!name || typeof name !== "string") {
              return done(
                new Error("Facebook account must have a valid display name"),
                null
              );
            }

            // Check if user exists with this Facebook ID
            let user = await User.findOne({ facebookId });

            if (user) {
              // User already exists with this Facebook ID
              return done(null, user);
            }

            // Check if user exists with this email
            user = await User.findOne({ email });

            if (user) {
              // User exists with same email - link Facebook account
              user.facebookId = facebookId;
              if (profilePicture && !user.profilePicture.includes("pixabay")) {
                user.profilePicture = profilePicture;
              }
              await user.save();
              return done(null, user);
            }

            // Create new user
            const generatedPassword =
              Math.random().toString(36).slice(-8) +
              Math.random().toString(36).slice(-8);
            const hashedPassword = bcryptjs.hashSync(generatedPassword, 10);

            // Generate a safe username from the name
            const safeName =
              name
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, "")
                .split(" ")
                .join("") || "facebookuser";

            const username = safeName + Math.random().toString(9).slice(-4);

            const newUser = new User({
              username,
              email,
              password: hashedPassword,
              profilePicture: profilePicture || undefined,
              facebookId,
            });

            await newUser.save();
            return done(null, newUser);
          } catch (error) {
            return done(error, null);
          }
        }
      )
    );

    // Serialize user for session (required by Passport)
    passport.serializeUser((user, done) => {
      done(null, user._id);
    });

    // Deserialize user from session (required by Passport)
    passport.deserializeUser(async (id, done) => {
      try {
        const user = await User.findById(id);
        done(null, user);
      } catch (error) {
        done(error, null);
      }
    });
  }
}

// Default serialize/deserialize functions (required by Passport)
passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
