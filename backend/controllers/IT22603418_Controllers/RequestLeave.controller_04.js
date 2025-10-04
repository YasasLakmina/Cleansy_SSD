import RequestLeave from "../../models/IT22603418_Models/RequestLeave.model_04.js";
import { errorHandler } from "../../utils/error.js";
import mongoose from "mongoose";

// --- Security helpers: sanitize inputs, allowlist fields, validate basics ---
function sanitizeString(s) {
  if (typeof s !== "string") return s;
  // strip HTML brackets and obvious JS schemes
  return s.replace(/</g, "").replace(/>/g, "").replace(/javascript:/gi, "");
}
function sanitizePayload(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") out[k] = sanitizeString(v);
    else if (Array.isArray(v)) out[k] = v.map(sanitizeString);
    else if (v && typeof v === "object") out[k] = sanitizePayload(v);
    else out[k] = v;
  }
  return out;
}
// Allowlists: adjust to your model schema if needed
const CREATE_FIELDS = [
  "leaveType",
  "startDate",
  "endDate",
  "reason"
];
const UPDATE_FIELDS = [
  "leaveType",
  "startDate",
  "endDate",
  "reason",
  "status"
];
function pick(obj, allowed) {
  const out = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  return out;
}
function toISODate(d) {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}
// --- End helpers ---

export const createRequestLeave = async (req, res, next) => {
  try {
    // Whitelist & sanitize input; set ownership server-side
    const raw = pick(req.body, CREATE_FIELDS);
    const data = sanitizePayload(raw);

    // basic validations
    if (!req.user || !req.user.staffID) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!data.leaveType || !data.startDate || !data.endDate || !data.reason) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const start = toISODate(data.startDate);
    const end = toISODate(data.endDate);
    if (!start || !end || end < start) {
      return res.status(400).json({ message: "Invalid date range" });
    }

    // Create a new RequestLeave instance using sanitized data
    const newRequestLeave = await RequestLeave.create({
      staffID: req.user.staffID, // enforce ownership
      leaveType: data.leaveType,
      startDate: start,
      endDate: end,
      reason: data.reason,
      status: "Pending"
    });

    // Send a successful response with the newly created request leave entry
    return res.status(201).json(newRequestLeave);
  } catch (error) {
    // If an error occurs during the process, pass it to the error handling middleware
    next(error);
  }
};

export const getRequestLeave = async (req, res, next) => {
  try {
    // Enforce that users can only view their own requests
    if (!req.user || String(req.user.staffID) !== String(req.params.staffID)) {
      return res.status(401).json({ message: "You can only view your own requests!" });
    }

    const requestLeave = await RequestLeave.find({
      staffID: req.params.staffID,
    })
      .select("-__v")
      .lean();

    if (!requestLeave || requestLeave.length === 0) {
      return res.status(404).json({ message: "No request leave entries found for this staffID" });
    }

    return res.status(200).json(requestLeave);
  } catch (error) {
    next(error);
  }
};

//Update Leave Request
export const updateRequestLeave = async (req, res) => {
  const requestId = req.body._id;
  const requestData = sanitizePayload(pick(req.body, UPDATE_FIELDS)); // sanitized, allowlisted

  try {
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ success: false, message: "Invalid request id" });
    }

    // Ensure the requester owns the document (or is admin)
    const existing = await RequestLeave.findById(requestId).lean();
    if (!existing) {
      return res.status(404).json({ success: false, message: "Leave request not found" });
    }
    if (!req.user || (String(req.user.staffID) !== String(existing.staffID) && !req.user.isAdmin)) {
      return res.status(401).json({ success: false, message: "You can only update your own requests!" });
    }

    // Prevent changing ownership
    if ("staffID" in requestData) delete requestData.staffID;

    // Normalize dates if present
    if (requestData.startDate) {
      const start = toISODate(requestData.startDate);
      if (!start) return res.status(400).json({ success: false, message: "Invalid startDate" });
      requestData.startDate = start;
    }
    if (requestData.endDate) {
      const end = toISODate(requestData.endDate);
      if (!end) return res.status(400).json({ success: false, message: "Invalid endDate" });
      requestData.endDate = end;
    }

    const updatedRequest = await RequestLeave.findByIdAndUpdate(
      requestId,
      requestData,
      { new: true, runValidators: true }
    ).lean();

    return res.status(200).json({
      success: true,
      message: "Leave request updated successfully",
      data: updatedRequest,
    });
  } catch (error) {
    console.error("Error updating leave request:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while updating leave request",
    });
  }
};

//Delete Leave Request
export const deleteRequestLeave = async (req, res, next) => {
  try {
    const { _id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const existing = await RequestLeave.findById(_id);
    if (!existing) {
      return res.status(404).json({ message: "Leave request not found" });
    }
    if (!req.user || (String(req.user.staffID) !== String(existing.staffID) && !req.user.isAdmin)) {
      return res.status(401).json({ message: "You can only delete your own requests!" });
    }

    await RequestLeave.findByIdAndDelete(_id);
    return res.status(200).json({
      success: true,
      message: "Leave Request deleted",
    });
  } catch (error) {
    next(error);
  }
};

// Controller function to get the count of requests for a specific user
export const getRequestCount = async (req, res) => {
  try {
    if (!req.user || String(req.user.staffID) !== String(req.params.staffID)) {
      return res.status(401).json({ message: "You can only view your own counts!" });
    }
    const requestCount = await RequestLeave.countDocuments({
      staffID: req.params.staffID,
    });
    return res.json({ count: requestCount });
  } catch (error) {
    console.error("Error fetching request count:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
