import mongoose from "mongoose";
import visitorListing from "../../models/IT22561466_Models/visitorListing.model.js";
import { errorHandler } from "../../utils/error.js";

// --- Security helpers: sanitize inputs, restrict fields, and validate IDs ---
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
// pick only fields that exist on the schema (prevents mass-assignment)
function pickModelFields(Model, obj) {
  const allowed = Object.keys(Model.schema.paths).filter(
    (p) => !["_id", "__v", "createdAt", "updatedAt"].includes(p) && !p.includes(".")
  );
  const out = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  return out;
}
// Safely escape user-provided search terms for regex usage
function escapeRegex(s) {
  return String(s ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
// NOTE: Ensure route-level auth/role middleware is applied:
// Only the owner or an authorized admin should be able to create/update/delete visitor listings.
// --- End helpers ---

export const createvisitorListing = async (req, res, next) => {
  try {
    const safe = sanitizePayload(pickModelFields(visitorListing, req.body));
    // enforce ownership server-side to avoid spoofing userRef in body
    if (req.user && req.user.id) safe.userRef = req.user.id;
    const newVisitorListing = await visitorListing.create(safe);
    return res.status(201).json({
      success: true,
      message: "Visitor listing created successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getVisitorListings = async (req, res, next) => {
  if (req.user && String(req.user.id) === String(req.params.id)) {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: "Invalid id" });
      }
      const visitorListings = await visitorListing
        .find({ userRef: req.params.id })
        .select("-__v")
        .lean();
      return res.status(200).json(visitorListings);
    } catch (error) {
      return next(error);
    }
  } else {
    return res.status(401).json({ message: "You can only view your own lists!" });
  }
};

export const deletevisitorListing = async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid id" });
  }

  const listing = await visitorListing.findById(req.params.id);

  if (!listing) {
    return next(errorHandler(404, "Guest not found!"));
  }
  if (!req.user || (String(req.user.id) !== String(listing.userRef) && !req.user.isAdmin)) {
    return res.status(401).json({ message: "You can only delete your own listings!" });
  }

  try {
    await visitorListing.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Guest has been deleted!" });
  } catch (error) {
    next(error);
  }
};

export const updatevisitorListing = async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid id" });
  }

  const listing = await visitorListing.findById(req.params.id);

  if (!listing) {
    return next(errorHandler(404, "Guest not found!"));
  }
  if (!req.user || (String(req.user.id) !== String(listing.userRef) && !req.user.isAdmin)) {
    return res.status(401).json({ message: "You can only update your own listings!" });
  }
  try {
    const update = sanitizePayload(pickModelFields(visitorListing, req.body));
    // never allow client to change ownership
    if ("userRef" in update) delete update.userRef;
    const updatedListing = await visitorListing.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    ).lean();
    return res.status(200).json(updatedListing);
  } catch (error) {
    next(error);
  }
};

export const getvisitorListing = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const listing = await visitorListing.findById(req.params.id).lean();
    if (!listing) {
      return next(errorHandler(404, "Guest not found!"));
    }
    res.status(200).json(listing);
  } catch (error) {
    next(error);
  }
};

// Function to get all visitor listings
export const getAllVisitorListings = async (req, res) => {
  try {
    const allVisitorListings = await visitorListing.find().select("-__v").lean();
    return res.status(200).json(allVisitorListings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const getvisitors = async (req, res, next) => {
  try {
    const startIndex = Math.max(0, parseInt(req.query.startIndex, 10) || 0);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20)); // cap to 50
    const searchTerm = escapeRegex(req.query.searchTerm || "");
    const query = searchTerm
      ? { guestName: { $regex: searchTerm, $options: "i" } }
      : {};
    const visitors = await visitorListing
      .find(query)
      .skip(startIndex)
      .limit(limit)
      .select("-__v")
      .lean();
    return res.status(200).json(visitors);
  } catch (error) {
    return next(error);
  }
};
