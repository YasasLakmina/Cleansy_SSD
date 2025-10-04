import carparkListing from "../../models/IT22561466_Models/carparkListing.model.js";
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
// Only the owner or an authorized admin should be able to create/update/delete carpark listings.
// --- End helpers ---

export const createcarparkListing = async (req, res, next) => {
    
    try {
        const safe = sanitizePayload(pickModelFields(carparkListing, req.body));
        const newCarparkListing = await carparkListing.create(safe);

        const savedCarparkListingId = newCarparkListing._id;

        return res.status(201).json({
            success: true,
            message: "Carpark listing created successfully",
            carparkListingId: savedCarparkListingId 
        });
        
    } catch (error) {
        next(error);
    }
};



export const updatecarparkListing = async (req, res, next) => {
    try {
        // Validate and sanitize input
        const { carparkListingId, slotId } = req.body;
        if (!carparkListingId) {
            return res.status(400).json({
                success: false,
                message: "Carpark Listing ID is required for updating.",
            });
        }
        if (!mongoose.Types.ObjectId.isValid(carparkListingId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid Carpark Listing ID.",
            });
        }

        const existingCarparkListing = await carparkListing.findById(carparkListingId);

        if (!existingCarparkListing) {
            return res.status(404).json({
                success: false,
                message: "Carpark Listing not found.",
            });
        }

        // Authorization: only owner or admin may update
        if (req.user && existingCarparkListing.userRef && String(req.user.id) !== String(existingCarparkListing.userRef) && !req.user.isAdmin) {
            return res.status(401).json({ success: false, message: "You can only update your own listings!" });
        }

        existingCarparkListing.slotId = sanitizeString(slotId);

        await existingCarparkListing.save({ validateModifiedOnly: true });

        return res.status(200).json({
            success: true,
            message: "Carpark listing updated successfully",
            updatedCarparkListing: existingCarparkListing,
        });
    } catch (error) {
        next(error);
    }
};

export const getCarparkListings = async(req, res, next) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid id" });
        }
        const listing = await carparkListing.findById(id).lean(); 
        if (!listing) {
            return res.status(404).json({ message: 'Details not found!' });
        }
        res.status(200).json(listing);
    } catch (error) {
        next(error);
    }
};

export const getAllBooked = async (req, res, next) => {
    try {
        const allCarparkListings = await carparkListing.find().select("slotId -_id").lean();
        const bookedSlots = allCarparkListings.map(listing => listing.slotId);

        return res.status(200).json({
            success: true,
            bookedSlots: bookedSlots
        });
    } catch (error) {
        next(error);
    }
};

export const getAllCarparkListings = async (req, res) => {
    try {
        const allCarparkListings = await carparkListing.find().select("-__v").lean();
        res.status(200).json(allCarparkListings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const deletecarparkListing = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid id" });
        }
        const listing = await carparkListing.findById(id);
        if(!listing) {
            return res.status(404).json({ message: 'Carpark details not found!' });
        }
        // Authorization: only owner or admin may delete
        if (req.user && listing.userRef && String(req.user.id) !== String(listing.userRef) && !req.user.isAdmin) {
            return res.status(401).json({ message: 'You can only delete your own listings!' });
        }
        await carparkListing.findByIdAndDelete(id);
        return res.status(200).json({ success: true, message: 'Car park details has been deleted!' });
    } catch (error) {
        next(error);
    }
};