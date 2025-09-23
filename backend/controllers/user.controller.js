import bcryptjs from "bcryptjs";
import mongoose from "mongoose";
import User from "../models/user.model.js";
import { errorHandler } from "../utils/error.js";

// --- Security helpers: sanitize inputs, allowlist fields, basic validators ---
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isEmail(x) { return typeof x === "string" && EMAIL_RE.test(x); }
function isNonEmptyString(x) { return typeof x === "string" && x.trim().length > 0; }
function sanitizeString(s) {
  if (typeof s !== "string") return s;
  // strip HTML angle brackets and obvious javascript: URLs
  return s.replace(/</g, "").replace(/>/g, "").replace(/javascript:/gi, "");
}
function sanitizePayload(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") out[k] = sanitizeString(v);
    else if (Array.isArray(v)) out[k] = v.map(sanitizeString);
    else if (v && typeof v === "object") out[k] = sanitizePayload(v);
    else out[k] = v;
  }
  return out;
}
const UPDATE_FIELDS = ["username", "email", "profilePicture", "password"];
function pick(obj, allowed) {
  const out = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  return out;
}
// --- End helpers ---

export const test = (req, res) => {
  res.send("Test API");
};

// update user API
export const updateUser = async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
    return next(errorHandler(400, "Invalid user id"));
  }
  if (String(req.user.id) !== String(req.params.userId) && !req.user.isAdmin) {
    return next(errorHandler(403, "You are not allowed to update this user"));
  }

  // Sanitize and allowlist incoming fields
  const raw = pick(req.body, UPDATE_FIELDS);
  const data = sanitizePayload(raw);

  if (data.password) {
    if (data.password.length < 6) {
      return next(errorHandler(400, "Password must be at least 6 characters"));
    }
    data.password = await bcryptjs.hash(data.password, 12);
  }

  if (data.username) {
    if (data.username.length < 7 || data.username.length > 20) {
      return next(
        errorHandler(400, "Username must be between 7 to 20 characters")
      );
    }
    if (data.username.includes(" ")) {
      return next(errorHandler(400, "Username cannot contain any spaces"));
    }
    if (data.username !== data.username.toLowerCase()) {
      return next(errorHandler(400, "Username must be in lowercase"));
    }
    if (!data.username.match(/^[a-zA-Z0-9]+$/)) {
      return next(
        errorHandler(400, "Username must contain only letters and numbers")
      );
    }
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.userId,
      { $set: {
          username: data.username,
          email: data.email,
          profilePicture: data.profilePicture,
          password: data.password,
        } },
      { new: true, runValidators: true, projection: { password: 0, __v: 0 } }
    ).lean();
    if (!updatedUser) {
      return next(errorHandler(404, "User not found"));
    }
    return res.status(200).json(updatedUser);
  } catch (error) {
    next(error);
  }
};

// delete user API
export const deleteUser = async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
    return next(errorHandler(400, "Invalid user id"));
  }
  if (!req.user.isAdmin && req.user.id !== req.params.userId) {
    return next(errorHandler(403, "You are not allowed to delete this user"));
  }

  try {
    await User.findByIdAndDelete(req.params.userId);
    return res.status(200).json({ success: true, message: "User has been deleted" });
  } catch (error) {
    next(error);
  }
};

// signout user API
export const signout = (req, res, next) => {
  try {
    res.clearCookie("access_token", {
      httpOnly: true,
      sameSite: "Lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return res.status(200).json({ success: true, message: "User has been signed out" });
  } catch (error) {
    next(error);
  }
};

// admin getUsers API
export const getUsers = async (req, res, next) => {
  if (!req.user.isAdmin) {
    return next(errorHandler(403, "You are not allowed to get all users"));
  }

  try {
    const startIndex = Math.max(0, parseInt(req.query.startIndex, 10) || 0);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 9));
    const sortDirection = (req.query.sort === "desc") ? -1 : 1;

    const users = await User.find()
      .sort({ createdAt: sortDirection })
      .skip(startIndex)
      .limit(limit)
      .select("-password -__v")
      .lean();

    const totalUsers = await User.countDocuments();
    const now = new Date();
    const oneMonthAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      now.getDate()
    );
    const lastMonthUsers = await User.countDocuments({
      createdAt: { $gte: oneMonthAgo },
    });
    return res.status(200).json({ users, totalUsers, lastMonthUsers });
  } catch (error) {
    next(error);
  }
};

// get user details
export const getUserDetails = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return next(errorHandler(400, "Invalid user id"));
    }
    const user = await User.findById(req.params.id).select("-password -__v").lean();
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }
    return res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

// Accept Staff
export const approveAsStaff = async (req, res) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(401).json({ success: false, message: "Admin privileges required" });
  }
  if (!mongoose.Types.ObjectId.isValid(req.params.staffID)) {
    return res.status(400).json({ success: false, message: "Invalid staff id" });
  }
  const _id = req.params.staffID;

  try {
    // Find the Staff Register request by ID and update its status to "accepted" in the database
    const updatedUser = await User.findByIdAndUpdate(
      _id,
      { isStaff: true },
      { new: true, runValidators: true, projection: { password: 0, __v: 0 } }
    ).lean();

    if (!updatedUser) {
      return res
        .status(404)
        .json({ success: false, message: "Staff not found" });
    }

    // If the request was successfully updated, send a success response
    return res.status(200).json({
      success: true,
      message: "Staff added successfully",
      data: updatedUser,
    });
  } catch (error) {
    // If an error occurs during the update process, send an error response
    return res.status(500).json({
      success: false,
      message: "An error occurred while accepting Staff",
    });
  }
};

// Deny Staff
export const rejectAsStaff = async (req, res) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(401).json({ success: false, message: "Admin privileges required" });
  }
  if (!mongoose.Types.ObjectId.isValid(req.params.staffID)) {
    return res.status(400).json({ success: false, message: "Invalid staff id" });
  }
  const _id = req.params.staffID;

  try {
    // Find the Staff Register request by ID and update its status to "denied" in the database
    const updatedUser = await User.findByIdAndUpdate(
      _id,
      { isStaff: false },
      { new: true, runValidators: true, projection: { password: 0, __v: 0 } }
    ).lean();

    if (!updatedUser) {
      return res
        .status(404)
        .json({ success: false, message: "Staff not found" });
    }

    // If the request was successfully updated, send a success response
    return res.status(200).json({
      success: true,
      message: "Staff rejected",
      data: updatedUser,
    });
  } catch (error) {
    // If an error occurs during the update process, send an error response
    return res.status(500).json({
      success: false,
      message: "An error occurred while denying Staff",
    });
  }
};
