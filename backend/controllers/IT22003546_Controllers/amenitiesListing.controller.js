import mongoose from "mongoose";
import AmenitiesListing from "../../models/IT22003546_Models/amenitiesListing.model.js";

// --- Security helpers: sanitize inputs and restrict fields to model schema ---
function sanitizeString(s) {
  if (typeof s !== "string") return s;
  // remove HTML tags/brackets and obvious JS URLs
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
// --- End helpers ---

// NOTE: Ensure route-level auth/role middleware is applied:
// Only facility admins should be able to create/update/delete amenity listings.

//Create Amenity Listing
export const createAmenityListing = async (req, res, next) => {
    try {
        const safe = sanitizePayload(pickModelFields(AmenitiesListing, req.body));
        const newAmenitiesListing = await AmenitiesListing.create(safe);
        return res.status(201).json({
            success: true,
            message: "Amenity Listing created successfully",
            amenitiesListing: newAmenitiesListing
        });
    } catch (error) {
        next(error);
    }
}

//Get All Amenity Listings
export const getAmenityListings = async (req, res, next) => {
    try {
        const allAmenitiesListings = await AmenitiesListing.find()
          .select("-__v")
          .lean();
        return res.status(200).json(allAmenitiesListings);
    } catch (error) {
        next(error);
    }
}

//Get Amenity Listing by ID
export const getAmenityListingById = async (req, res, next) => {
    try {
        const { Amenityid } = req.params;
        if (!mongoose.Types.ObjectId.isValid(Amenityid)) {
          return res.status(400).json({ message: "Invalid Amenityid" });
        }
        const amenityListing = await AmenitiesListing.findById(Amenityid).lean();
        if (!amenityListing) { 
            return res.status(404).json({ message: "Amenity Listing not found" });
        }
        return res.status(200).json(amenityListing);
    } catch (error) {
        next(error);
    }
}


//update amenity listing - Facility Admin
export const updateAmenityListing = async (req, res, next) => {
    try {
        const { Amenityid } = req.params;
        if (!mongoose.Types.ObjectId.isValid(Amenityid)) {
          return res.status(400).json({ message: "Invalid Amenityid" });
        }
        const update = sanitizePayload(pickModelFields(AmenitiesListing, req.body));
        const updateAmenityListing = await AmenitiesListing.findByIdAndUpdate(
          Amenityid,
          update,
          { new: true, runValidators: true }
        ).lean();
        return res.status(200).json(updateAmenityListing);
    }
    catch (error) {
        next(error);
    }
}

//delete amenity listing - Facility Admin
export const deleteAmenityListing = async (req, res, next) => {
    try {
        const { Amenityid } = req.params;
        if (!mongoose.Types.ObjectId.isValid(Amenityid)) {
          return res.status(400).json({ message: "Invalid Amenityid" });
        }
        await AmenitiesListing.findByIdAndDelete(Amenityid);
        return res.status(200).json({ message: "Amenity Listing deleted successfully" });
    }
    catch (error) {
        next(error);
    }
}
