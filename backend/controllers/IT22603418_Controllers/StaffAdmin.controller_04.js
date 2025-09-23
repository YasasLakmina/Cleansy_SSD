import RequestLeave from "../../models/IT22603418_Models/RequestLeave.model_04.js";
import { errorHandler } from "../../utils/error.js";
import mongoose from "mongoose";

// NOTE: Admin-only endpoints.
// Ensure an auth middleware populates req.user and enforces roles.
// The handlers below additionally check req.user.isAdmin for defense-in-depth.

export const getAllLeaveRequests = async (req, res, next) => {
  try {
    // Authorization: admin only
    if (!req.user || !req.user.isAdmin) {
      return res.status(401).json({ message: "Admin privileges required" });
    }

    // Pagination with sensible caps to avoid accidental data dumps / DoS
    const startIndex = Math.max(0, parseInt(req.query.startIndex, 10) || 0);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

    // Fetch leave requests with minimal internal fields
    const allLeaveRequests = await RequestLeave.find()
      .skip(startIndex)
      .limit(limit)
      .select("-__v")
      .lean();

    if (!allLeaveRequests || allLeaveRequests.length === 0) {
      return res.status(404).json({ message: "No leave requests found" });
    }

    return res.status(200).json(allLeaveRequests);
  } catch (error) {
    next(error);
  }
};

// Accept Leave Request
export const acceptLeaveRequest = async (req, res) => {
  // Authorization: admin only
  if (!req.user || !req.user.isAdmin) {
    return res.status(401).json({ success: false, message: "Admin privileges required" });
  }
  const requestId = req.params.requestId;
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    return res.status(400).json({ success: false, message: "Invalid requestId" });
  }
  try {
    const updatedRequest = await RequestLeave.findByIdAndUpdate(
      requestId,
      { status: "accepted" },
      { new: true, runValidators: true, projection: { __v: 0 } }
    );

    if (!updatedRequest) {
      return res
        .status(404)
        .json({ success: false, message: "Leave request not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Leave request updated successfully",
      data: updatedRequest,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "An error occurred while accepting leave request",
    });
  }
};

// Deny Leave Request
export const denyLeaveRequest = async (req, res) => {
  // Authorization: admin only
  if (!req.user || !req.user.isAdmin) {
    return res.status(401).json({ success: false, message: "Admin privileges required" });
  }
  const requestId = req.params.requestId;
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    return res.status(400).json({ success: false, message: "Invalid requestId" });
  }
  try {
    const updatedRequest = await RequestLeave.findByIdAndUpdate(
      requestId,
      { status: "denied" },
      { new: true, runValidators: true, projection: { __v: 0 } }
    );

    if (!updatedRequest) {
      return res
        .status(404)
        .json({ success: false, message: "Leave request not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Leave request updated successfully",
      data: updatedRequest,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "An error occurred while denying leave request",
    });
  }
};
