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

// google sign in API
export const google = async (req, res, next) => {
  const { email, name, googlePhotoURL } = req.body;
  try {
    const user = await User.findOne({ email });
    if (user) {
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
    } else {
      const generatedPassword =
        Math.random().toString(36).slice(-8) +
        Math.random().toString(36).slice(-8);
      const hashedPassword = bcryptjs.hashSync(generatedPassword, 10);
      const newUser = new User({
        username:
          name.toLowerCase().split(" ").join("") +
          Math.random().toString(9).slice(-4),
        email,
        password: hashedPassword,
        profilePicture: googlePhotoURL,
      });
      await newUser.save();
      const token = jwt.sign(
        {
          id: newUser._id,
          Username: newUser.username,
          isAdmin: newUser.isAdmin,
          isUserAdmin: newUser.isUserAdmin,
          isPropertyAdmin: newUser.isPropertyAdmin,
          isVisitorAdmin: newUser.isVisitorAdmin,
          isAnnouncementAdmin: newUser.isAnnouncementAdmin,
          isBookingAdmin: newUser.isBookingAdmin,
          isStaffAdmin: newUser.isStaffAdmin,
          isBillingAdmin: newUser.isBillingAdmin,
          isFacilityAdmin: newUser.isFacilityAdmin,
          isFacilityServiceAdmin: newUser.isFacilityServiceAdmin,
        },
        process.env.JWT_SECRET
      );
      const { password, ...rest } = newUser._doc;
      res
        .status(200)
        .cookie("access_token", token, {
          httpOnly: true,
        })
        .json(rest);
    }
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

// GitHub OAuth Authentication
export const github = async (req, res, next) => {
  const { email, name, githubPhotoURL, githubId } = req.body;
  try {
    const user = await User.findOne({ email });
    if (user) {
      // User exists, sign them in
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
    } else {
      // Create new user
      const generatedPassword =
        Math.random().toString(36).slice(-8) +
        Math.random().toString(36).slice(-8);
      const hashedPassword = bcryptjs.hashSync(generatedPassword, 10);
      const newUser = new User({
        username:
          name.toLowerCase().split(" ").join("") +
          Math.random().toString(9).slice(-4),
        email,
        password: hashedPassword,
        profilePicture: githubPhotoURL,
        githubId,
      });
      await newUser.save();
      const token = jwt.sign(
        {
          id: newUser._id,
          Username: newUser.username,
          isAdmin: newUser.isAdmin,
          isUserAdmin: newUser.isUserAdmin,
          isPropertyAdmin: newUser.isPropertyAdmin,
          isVisitorAdmin: newUser.isVisitorAdmin,
          isAnnouncementAdmin: newUser.isAnnouncementAdmin,
          isBookingAdmin: newUser.isBookingAdmin,
          isStaffAdmin: newUser.isStaffAdmin,
          isBillingAdmin: newUser.isBillingAdmin,
          isFacilityAdmin: newUser.isFacilityAdmin,
          isFacilityServiceAdmin: newUser.isFacilityServiceAdmin,
        },
        process.env.JWT_SECRET
      );
      const { password, ...rest } = newUser._doc;
      res
        .status(200)
        .cookie("access_token", token, {
          httpOnly: true,
        })
        .json(rest);
    }
  } catch (error) {
    next(error);
  }
};

// GitHub OAuth Callback Handler
export const githubCallback = async (req, res, next) => {
  const { code, state } = req.query; // Changed from req.body to req.query for GET request

  try {
    // Exchange code for access token
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code: code,
          state: state,
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return res.status(400).json({
        success: false,
        message: tokenData.error_description || "GitHub OAuth failed",
      });
    }

    const accessToken = tokenData.access_token;

    // Get user data from GitHub
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    const githubUser = await userResponse.json();

    // Get user emails from GitHub
    const emailResponse = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    const emails = await emailResponse.json();
    const primaryEmail =
      emails.find((email) => email.primary && email.verified)?.email ||
      githubUser.email;

    if (!primaryEmail) {
      return res.status(400).json({
        success: false,
        message: "No verified email found in GitHub account",
      });
    }

    // Check if user exists
    let user = await User.findOne({
      $or: [{ email: primaryEmail }, { githubId: githubUser.id.toString() }],
    });

    if (user) {
      // Update GitHub ID if not set
      if (!user.githubId) {
        user.githubId = githubUser.id.toString();
        await user.save();
      }
    } else {
      // Create new user
      const generatedPassword =
        Math.random().toString(36).slice(-8) +
        Math.random().toString(36).slice(-8);
      const hashedPassword = bcryptjs.hashSync(generatedPassword, 10);

      user = new User({
        username:
          (githubUser.login ||
            githubUser.name?.toLowerCase().replace(/\s+/g, "") ||
            "githubuser") + Math.random().toString(9).slice(-4),
        email: primaryEmail,
        password: hashedPassword,
        profilePicture: githubUser.avatar_url,
        githubId: githubUser.id.toString(),
      });

      await user.save();
    }

    // Generate JWT token

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

    // Set cookie and redirect to frontend
    const { password, ...userWithoutPassword } = user._doc;

    res.cookie("access_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    // Redirect to frontend with success
    res.redirect(`http://localhost:5173/auth/github/callback?success=true`);
  } catch (error) {
    // Redirect to frontend with error
    res.redirect(
      `http://localhost:5173/auth/github/callback?error=${encodeURIComponent(
        error.message || "GitHub authentication failed"
      )}`
    );
  }
};

// Get current user API
export const me = async (req, res, next) => {
  try {
    const token = req.cookies.access_token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No authentication token found",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
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
