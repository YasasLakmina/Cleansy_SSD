import Attendance from "../../models/IT22603418_Models/StaffAttendance.model_04.js";
import mongoose from "mongoose";

// --- Security helpers: sanitize inputs, allowlist fields, and safe date handling ---
function sanitizeString(s) {
  if (typeof s !== "string") return s;
  // strip HTML brackets and obvious JS schemes
  return s.replace(/</g, "").replace(/>/g, "").replace(/javascript:/gi, "");
}
function toDateTime(input) {
  // Try to parse various forms; return Date or null
  if (!input) return null;
  const d = new Date(input);
  if (!Number.isNaN(d.getTime())) return d;
  return null;
}
function combineDateTime(dateStr, timeStr) {
  // Combine "YYYY-MM-DD" and "HH:MM[:SS]" safely
  if (!dateStr || !timeStr) return null;
  const iso = `${dateStr}T${timeStr.length === 5 ? timeStr + ":00" : timeStr}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}
// --- End helpers ---

// Controller to create a new attendance record
export const createAttendance = async (req, res) => {
  try {
    // Enforce identity from authenticated user context; do not trust body
    if (!req.user || !req.user.staffID) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const staffID = String(req.user.staffID);
    const staffName = sanitizeString(req.body?.staffName);
    // Prefer server time if loginTime not provided or invalid
    const provided = toDateTime(req.body?.loginTime);
    const loginTime = provided || new Date();

    const attendance = new Attendance({
      staffID,
      staffName,
      loginTime,
    });
    await attendance.save();
    return res.status(201).json(attendance);
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Controller to update attendance record with logout time
export const updateAttendance = async (req, res) => {
  try {
    if (!req.user || !req.user.staffID) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const staffID = String(req.user.staffID);

    const attendance = await Attendance.findOneAndUpdate(
      { staffID, logoutTime: null },
      { $set: { logoutTime: new Date() } },
      { sort: { loginTime: -1 }, new: true, projection: { __v: 0 } }
    );

    if (!attendance) {
      return res.status(404).json({ error: "No active attendance record found" });
    }
    return res.status(200).json(attendance);
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Controller to get attendance records for the logged-in user
export const getAllAttendance = async (req, res) => {
  try {
    if (!req.user || String(req.user.staffID) !== String(req.params.staffID)) {
      return res.status(401).json({ error: "You can only view your own attendance records" });
    }
    const attendance = await Attendance.find({ staffID: req.params.staffID })
      .select("-__v")
      .lean();

    if (!attendance || attendance.length === 0) {
      return res.status(404).json({ error: "No attendance records found for the current user" });
    }
    return res.status(200).json(attendance);
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

//Face recognition attendance mark
export const recognizeFace = async (req, res) => {
  try {
    // Do not log request bodies (may include PII)
    const { rollno, name, time, date, time_type } = req.body || {};

    const staffID = String(rollno || "");
    const staffName = sanitizeString(name);
    const action = String(time_type || "").toLowerCase();

    if (!staffID || (action !== "login" && action !== "logout")) {
      return res.status(400).json({ error: "Invalid face recognition payload" });
    }

    if (action === "login") {
      const loginTime = combineDateTime(date, time) || new Date();
      const attendance = new Attendance({
        staffID,
        staffName,
        loginTime,
        logoutTime: null,
      });
      await attendance.save();
      return res.status(200).json(attendance);
    } else {
      // logout
      const latestAttendance = await Attendance.findOne(
        { staffID, logoutTime: null },
        {},
        { sort: { loginTime: -1 } }
      );

      if (!latestAttendance) {
        return res.status(404).json({ error: "No active attendance record found" });
      }

      latestAttendance.logoutTime = combineDateTime(date, time) || new Date();
      await latestAttendance.save();
      return res.status(200).json(latestAttendance);
    }
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Controller to retrieve all attendance records
export const getAllStaffAttendance = async (req, res) => {
  try {
    // Admin-only listing to prevent data leakage
    if (!req.user || !req.user.isAdmin) {
      return res.status(401).json({ error: "Admin privileges required" });
    }

    const startIndex = Math.max(0, parseInt(req.query.startIndex, 10) || 0);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));

    const allAttendance = await Attendance.find()
      .skip(startIndex)
      .limit(limit)
      .select("-__v")
      .lean();

    if (!allAttendance || allAttendance.length === 0) {
      return res.status(404).json({ error: "No attendance records found" });
    }

    return res.status(200).json(allAttendance);
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
