import StaffRegister from "../../models/IT22603418_Models/StaffRegister.model_04.js";
import User from "../../models/user.model.js";
import mongoose from "mongoose";

// --- Security helpers: sanitize inputs, allowlist fields, and basic validators ---
function sanitizeString(s) {
  if (typeof s !== "string") return s;
  // strip HTML brackets and obvious JS schemes
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
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-\s]{7,20}$/; // simple allowlist; adjust as needed
const NIC_RE = /^[A-Za-z0-9\-]{5,30}$/; // adjust to your NIC format
const CREATE_FIELDS = ["staffID", "staffName", "email", "phoneNo", "nic", "imageURL"];
function pick(obj, allowed) {
  const out = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  return out;
}
// --- End helpers ---

// Controller to handle staff registration
export const registerStaff = async (req, res, next) => {
  try {
    // Allowlist & sanitize request body
    const raw = pick(req.body, CREATE_FIELDS);
    const data = sanitizePayload(raw);

    const { staffID, staffName, email, phoneNo, nic, imageURL } = data;

    // Validate required fields
    if (!staffID || !staffName || !email || !phoneNo || !nic || !imageURL) {
      return res.status(400).json({ error: "Please provide all required fields" });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }
    if (!PHONE_RE.test(phoneNo)) {
      return res.status(400).json({ error: "Invalid phone number" });
    }
    if (!NIC_RE.test(nic)) {
      return res.status(400).json({ error: "Invalid NIC format" });
    }

    // Uniqueness checks (staffID or NIC already exists)
    const existingStaff = await StaffRegister.findOne({
      $or: [{ staffID: staffID }, { nic: nic }],
    }).lean();

    if (existingStaff) {
      return res.status(400).json({ error: "Staff with the same staffID or NIC already exists" });
    }

    // Create with safe defaults; do not trust client 'status'
    const newStaff = await StaffRegister.create({
      staffID,
      staffName,
      email,
      phoneNo,
      nic,
      imageURL,
      status: "pending review",
    });

    // Do NOT escalate privileges based on client-provided status.
    // Role changes happen only via admin endpoints below.

    return res.status(201).json(newStaff);
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Controller function to get all Staff Register requests
export const getAllStaffRegisterRequests = async (req, res, next) => {
  try {
    // Admin only
    if (!req.user || !req.user.isAdmin) {
      return res.status(401).json({ message: "Admin privileges required" });
    }

    // Pagination with caps
    const startIndex = Math.max(0, parseInt(req.query.startIndex, 10) || 0);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));

    const AllStaffRegisterRequests = await StaffRegister.find()
      .skip(startIndex)
      .limit(limit)
      .select("-__v")
      .lean();

    if (!AllStaffRegisterRequests || AllStaffRegisterRequests.length === 0) {
      return res.status(404).json({ message: "No Staff Register requests found" });
    }

    return res.status(200).json(AllStaffRegisterRequests);
  } catch (error) {
    return next(error);
  }
};

// Accept Staff Register Request
export const acceptStaffRegisterRequest = async (req, res) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(401).json({ success: false, message: "Admin privileges required" });
  }

  const requestId = req.params.requestId;
  const safeRequestId = sanitizeString(requestId);
  if (!safeRequestId) {
    return res.status(400).json({ success: false, message: "Invalid requestId" });
  }

  try {
    const updatedStaffRegisterRequest = await StaffRegister.findOneAndUpdate(
      { staffID: safeRequestId },
      { status: "approved" },
      { new: true }
    ).lean();

    if (!updatedStaffRegisterRequest) {
      return res.status(404).json({ success: false, message: "Staff Register request not found" });
    }

    // Elevate user role only after approval
    await User.findOneAndUpdate(
      { username: safeRequestId },
      { isStaff: true },
      { upsert: false }
    );

    return res.status(200).json({
      success: true,
      message: "Staff registered successfully",
      data: updatedStaffRegisterRequest,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "An error occurred while accepting Staff Register request",
    });
  }
};

// Deny Staff Register Request
export const denyStaffRegisterRequest = async (req, res) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(401).json({ success: false, message: "Admin privileges required" });
  }

  const requestId = req.params.requestId;
  const safeRequestId = sanitizeString(requestId);
  if (!safeRequestId) {
    return res.status(400).json({ success: false, message: "Invalid requestId" });
  }

  try {
    const updatedStaffRegisterRequest = await StaffRegister.findOneAndUpdate(
      { staffID: safeRequestId },
      { status: "rejected" },
      { new: true }
    ).lean();

    if (!updatedStaffRegisterRequest) {
      return res.status(404).json({ success: false, message: "Staff Register request not found" });
    }

    // Ensure the platform role is not elevated on rejection
    await User.findOneAndUpdate(
      { username: safeRequestId },
      { isStaff: false },
      { upsert: false }
    );

    return res.status(200).json({
      success: true,
      message: "Staff Register denied",
      data: updatedStaffRegisterRequest,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "An error occurred while denying Staff Register request",
    });
  }
};
