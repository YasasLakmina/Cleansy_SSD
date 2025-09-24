import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import { errorHandler } from "../utils/error.js";
import passport from "../utils/passport.js";

// sign up API
export const signup = async (req, res, next) => {
  const { username, email, password } = req.body;

  if (
    !username ||
    !email ||
    !password ||
    username === "" ||
    email === "" ||
    password === ""
  ) {
    next(errorHandler(400, "All fields are required"));
  }

  const hashedPassword = bcryptjs.hashSync(password, 10);

  const newUser = new User({
    username,
    email,
    password: hashedPassword,
  });

  try {
    await newUser.save();
    res.json("User Signup successfully");
  } catch (error) {
    next(error);
  }
};

// sign in API
export const signIn = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password || email === "" || password === "") {
    next(errorHandler(400, "All fields are required"));
  }

  try {
    const validUser = await User.findOne({ email });
    if (!validUser) {
      return next(errorHandler(400, "User not found"));
    }

    const validPassword = bcryptjs.compareSync(password, validUser.password);
    if (!validPassword) {
      return next(errorHandler(400, "Invalid password"));
    }

    const token = jwt.sign(
      {
        id: validUser._id,
        Username: validUser.username,
        isAdmin: validUser.isAdmin,
        isUserAdmin: validUser.isUserAdmin,
        isPropertyAdmin: validUser.isPropertyAdmin,
        isVisitorAdmin: validUser.isVisitorAdmin,
        isAnnouncementAdmin: validUser.isAnnouncementAdmin,
        isBookingAdmin: validUser.isBookingAdmin,
        isStaffAdmin: validUser.isStaffAdmin,
        isBillingAdmin: validUser.isBillingAdmin,
        isFacilityAdmin: validUser.isFacilityAdmin,
        isFacilityServiceAdmin: validUser.isFacilityServiceAdmin,
        isStaff: validUser.isStaff,
      },
      process.env.JWT_SECRET
    );

    const { password: pass, ...rest } = validUser._doc;
    res
      .status(200)
      .cookie("access_token", token, {
        httpOnly: true,
      })
      .json(rest);
  } catch (error) {
    next(error);
  }
};



export const signInQR = async (req, res, next) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });

    const token = jwt.sign(
      {
        id: user._id,
        Username: user.username,
        isAdmin: user.isAdmin,
        isUserAdmin: user.isUserAdmin,
        isPropertyAdmin: user.isPropertyAdmin,
        isVisitorAdmin: user.isVisitorAdmin,
        isAnnouncementAdmin: user.isAnnouncementAdmin,
        isBookingAdmin: user.isBookingAdmin,
        isStaffAdmin: user.isStaffAdmin,
        isBillingAdmin: user.isBillingAdmin,
        isFacilityAdmin: user.isFacilityAdmin,
        isFacilityServiceAdmin: user.isFacilityServiceAdmin,
      },
      process.env.JWT_SECRET
    );
    const { password, ...rest } = user._doc;
    res
      .status(200)
      .cookie("access_token", token, {
        httpOnly: true,
      })
      .json(rest);
  } catch (error) {
    next(error);
  }
};

// Facebook Authentication

/**
 * Generate JWT token with user information
 * @param {Object} user - User object from database
 * @returns {string} JWT token
 */
const generateJWTToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      Username: user.username,
      isAdmin: user.isAdmin,
      isUserAdmin: user.isUserAdmin,
      isPropertyAdmin: user.isPropertyAdmin,
      isVisitorAdmin: user.isVisitorAdmin,
      isAnnouncementAdmin: user.isAnnouncementAdmin,
      isBookingAdmin: user.isBookingAdmin,
      isStaffAdmin: user.isStaffAdmin,
      isBillingAdmin: user.isBillingAdmin,
      isFacilityAdmin: user.isFacilityAdmin,
      isFacilityServiceAdmin: user.isFacilityServiceAdmin,
      isStaff: user.isStaff,
    },
    process.env.JWT_SECRET
  );
};

/**
 * Initiate Facebook authentication
 * Redirects user to Facebook login page
 */
export const facebookAuth = passport.authenticate("facebook", {
  scope: ["email"],
});

/**
 * Handle Facebook authentication callback
 * Process the response from Facebook and issue JWT token
 */
export const facebookCallback = (req, res, next) => {
  passport.authenticate(
    "facebook",
    { session: false },
    async (err, user, info) => {
      try {
        if (err) {
          return res.status(500).json({
            success: false,
            message: "Facebook authentication failed",
            error: err.message,
          });
        }

        if (!user) {
          return res.status(401).json({
            success: false,
            message: "Facebook authentication failed",
          });
        }

        // Generate JWT token
        const token = generateJWTToken(user);

        // Remove password from response
        const { password, ...userWithoutPassword } = user._doc;

        // Set httpOnly cookie with JWT token
        res.cookie("access_token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
        });

        // Redirect to frontend success page
        return res.redirect(
          `${process.env.CLIENT_URL || "http://localhost:5173"}/auth/success`
        );
      } catch (error) {
        next(error);
      }
    }
  )(req, res, next);
};
