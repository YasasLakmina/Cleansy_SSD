import ServiceListing from "../../models/IT22350114_Models/serviceListingModel.js";
import mongoose from "mongoose";

// --- Security helpers: sanitize inputs and restrict fields to the model schema ---
function sanitizeString(s) {
  if (typeof s !== "string") return s;
  // remove HTML brackets and obvious JS schemes
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
// NOTE: Ensure route-level auth/role middleware is applied:
// Only authorized staff/admins should be able to create/update/delete service listings.
// --- End helpers ---

export const createServiceListing = async (req, res, next) => {
  try {
    // Sanitize and restrict input to schema fields
    const safe = sanitizePayload(pickModelFields(ServiceListing, req.body));
    const newServiceListing = await ServiceListing.create(safe);
    // Send a success response with the newly created service listing
    return res.status(201).json({
      success: true,
      message: "Service listing created successfully",
      serviceListing: newServiceListing,
    });
  } catch (error) {
    // Pass any errors to the error handling middleware
    next(error);
  }
};

//Read for all service listings
export const getAllServiceListings = async (req, res, next) => {
  try {
    const allServiceListings = await ServiceListing.find()
      .select("-__v")
      .lean();
    return res.status(200).json(allServiceListings);
  } catch (error) {
    next(error);
  }
};

//Fetch a specific service listing
export const getServiceListing = async (req, res, next) => {
  try {
    const { Serviceid } = req.params;
    if (!mongoose.Types.ObjectId.isValid(Serviceid)) {
      return res.status(400).json({ message: "Invalid Serviceid" });
    }
    const serviceListing = await ServiceListing.findById(Serviceid).lean();
    if (!serviceListing) {
      return res.status(404).json({ message: "Service listing not found" });
    }
    return res.status(200).json(serviceListing);
  }
  catch (error) {
    next(error);
  }
};

//Update a service listing
export const updateServiceListing = async (req, res, next) => {
  try {
    const { Serviceid } = req.params;
    if (!mongoose.Types.ObjectId.isValid(Serviceid)) {
      return res.status(400).json({ message: "Invalid Serviceid" });
    }
    const update = sanitizePayload(pickModelFields(ServiceListing, req.body));
    const updateServiceListing = await ServiceListing.findByIdAndUpdate(
      Serviceid,
      update,
      { new: true, runValidators: true }
    ).lean();
    return res.status(200).json(updateServiceListing);
  } catch (error) {
    next(error);
  }
};

//Delete a service listing
export const deleteServiceListing = async (req, res, next) => {
  try {
    const { Serviceid } = req.params;
    if (!mongoose.Types.ObjectId.isValid(Serviceid)) {
      return res.status(400).json({ message: "Invalid Serviceid" });
    }
    const deleted = await ServiceListing.findByIdAndDelete(Serviceid).lean();
    if (!deleted) {
      return res.status(404).json({ message: "Service listing not found" });
    }
    return res.status(200).json({
      success: true,
      message: "Service listing deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
