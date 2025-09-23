import mongoose from "mongoose";
import AmenitiesBooking from "../../models/IT22003546_Models/amenitiesBooking.model_05.js";
import amenitiesBookingEmailTemplate from "../../utils/email_templates/amenityBookingEmailTemplate.js";
import sendEmail from "../../utils/sendEmail_Tommy.js";

// --- Security helpers: basic sanitization, validation, and field allowlists ---
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/; // HH:MM 24h
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeString(s) {
  if (typeof s !== "string") return s;
  // strip HTML tags and common XSS vectors
  return s.replace(/</g, "").replace(/>/g, "").replace(/javascript:/gi, "");
}

function isValidTime(t) {
  return typeof t === "string" && TIME_RE.test(t);
}

function isValidEmail(e) {
  return typeof e === "string" && EMAIL_RE.test(e);
}

function toISODate(d) {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  // normalize to start of day (no timezone surprises for comparisons)
  date.setHours(0, 0, 0, 0);
  return date;
}

function combineDateAndTime(baseDate, hhmm) {
  if (!(baseDate instanceof Date)) return null;
  if (typeof hhmm !== "string" || !TIME_RE.test(hhmm)) return null;
  const [hh, mm] = hhmm.split(":").map((n) => parseInt(n, 10));
  const d = new Date(baseDate);
  d.setHours(hh, mm, 0, 0);
  return d;
}

// Only allow the fields we expect from clients (prevents mass-assignment)
const CREATE_FIELDS = [
  // identity / amenity
  "residentUsername",
  "residentName",
  "residentEmail",
  "residentContact",
  "amenityId",
  "amenityTitle",
  // booking core
  "bookingID",
  "bookingDate",
  "startTime",
  "endTime",
  "bookingTime",
  "duration",
  // pricing & media
  "pricePerHour",
  "bookingPrice",
  "imageUrls",
  // misc
  "specialRequests",
  "userRef",
];

const UPDATE_FIELDS = [
  // allow safe updates (do not accept arbitrary fields)
  "bookingStatus",
  "startTime",
  "endTime",
  "bookingTime",
  "residentEmail",
  "residentName"
];

function pick(obj, allowed) {
  const out = {};
  for (const k of allowed) if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  return out;
}

function sanitizePayload(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") out[k] = sanitizeString(v);
    else if (Array.isArray(v)) out[k] = v.map(sanitizeString);
    else out[k] = v;
  }
  return out;
}
// --- End helpers ---

// NOTE: Ensure an auth middleware validates the caller's identity and role.
// Only the owner or an admin should be allowed to create/update/delete relevant bookings.
export const bookAmenity = async (req, res, next) => {
    try {
        // Whitelist & sanitize input to prevent stored XSS / mass assignment
        const raw = pick(req.body, CREATE_FIELDS);
        const data = sanitizePayload(raw);

        // Coerce expected types
        if (data.duration !== undefined) data.duration = Number(data.duration);
        if (data.pricePerHour !== undefined) data.pricePerHour = Number(data.pricePerHour);
        if (data.bookingPrice !== undefined) data.bookingPrice = Number(data.bookingPrice);
        if (data.imageUrls && Array.isArray(data.imageUrls)) {
          data.imageUrls = data.imageUrls.filter((u) => typeof u === "string" && /^https:\/\//.test(u));
        }
        if (data.specialRequests && typeof data.specialRequests === "string") {
          data.specialRequests = sanitizeString(data.specialRequests).slice(0, 1000);
        }

        // Validate required fields (before Mongoose errors)
        const missing = [];
        if (!data.residentUsername) missing.push("residentUsername");
        if (!data.residentName) missing.push("residentName");
        if (!data.residentEmail) missing.push("residentEmail");
        if (!data.residentContact) missing.push("residentContact");
        if (!data.amenityId) missing.push("amenityId");
        if (!data.amenityTitle) missing.push("amenityTitle");
        if (!data.bookingID) missing.push("bookingID");
        if (!data.bookingDate) missing.push("bookingDate");
        if (data.duration === undefined || isNaN(data.duration)) missing.push("duration");
        if (data.bookingPrice === undefined || isNaN(data.bookingPrice)) missing.push("bookingPrice");
        if (missing.length) {
          return res.status(400).json({ success: false, message: `Missing/invalid required fields: ${missing.join(", ")}` });
        }

        if (!isValidEmail(data.residentEmail)) {
          return res.status(400).json({ success: false, message: "Invalid email." });
        }

        // Validate and normalize date/time
        const bookingDateISO = toISODate(data.bookingDate);
        if (!bookingDateISO) {
          return res.status(400).json({ success: false, message: "Invalid bookingDate." });
        }

        // Normalize start/end from either explicit fields or legacy bookingTime ("HH:MM-HH:MM" or "HH:MM to HH:MM")
        let start = typeof data.startTime === "string" ? data.startTime.trim() : "";
        let end   = typeof data.endTime === "string"   ? data.endTime.trim()   : "";
        let bookingTime = typeof data.bookingTime === "string" ? data.bookingTime.trim() : "";

        if ((!start || !end) && bookingTime) {
          // accept both "to" and "-" separators
          const normalized = bookingTime.replace(/\s+to\s+/i, "-");
          const parts = normalized.split("-");
          if (parts.length === 2) {
            start = parts[0].trim();
            end   = parts[1].trim();
          }
        }

        // Re-validate after normalization
        if (!isValidTime(start) || !isValidTime(end)) {
          return res.status(400).json({ success: false, message: "Invalid startTime or endTime (HH:MM expected)." });
        }

        // Canonicalize bookingTime to dash format
        bookingTime = `${start}-${end}`;

        // Build Date objects for start/end based on the bookingDate (schema expects Date)
        const startDT = combineDateAndTime(bookingDateISO, start);
        const endDT = combineDateAndTime(bookingDateISO, end);
        if (!startDT || !endDT) {
          return res.status(400).json({ success: false, message: "Invalid start/end time." });
        }
        if (endDT <= startDT) {
          return res.status(400).json({ success: false, message: "End time must be after start time." });
        }

        // Generate an array of hour ticks between start and end (for logging / checks)
        const bookingHours = [];
        const tmp = new Date(startDT);
        while (tmp < endDT) {
          const hh = String(tmp.getHours()).padStart(2, "0");
          bookingHours.push(`${hh}:00`);
          tmp.setHours(tmp.getHours() + 1);
        }
        console.log("Booking Hours:", bookingHours); // Log generated hours

        // Check fair allocation rules here

        const pastBookings = await AmenitiesBooking.find({
            residentUsername: data.residentUsername,
            amenityTitle: data.amenityTitle,
            bookingStatus: { $in: ['Confirmed', 'Pending'] },
            bookingDate: { $lt: bookingDateISO },
        }).sort({ bookingDate: -1 }).limit(2);
        
        if (pastBookings.length === 2) {
            const lastBookingDate = new Date(pastBookings[0].bookingDate);
            const secondLastBookingDate = new Date(pastBookings[1].bookingDate);
            const newBookingDate = bookingDateISO;
        
            // Calculate the difference in days between the last two bookings
            const dayDifference = Math.abs((lastBookingDate - secondLastBookingDate) / (1000 * 60 * 60 * 24));
        
            // Check if the new booking date is consecutive with the last two bookings
            if (dayDifference !== 1 || (newBookingDate - lastBookingDate) / (1000 * 60 * 60 * 24) !== 1) {
                // Allow the user to book if the new booking date is not consecutive with the last two bookings
                // Proceed with the booking process
            } else {
                // Deny the booking since the new booking date is consecutive with the last two bookings
                return res.status(409).json({
                    success: false,
                    message: "You cannot book the same amenity for more than 2 consecutive days.",
                });
            }
        }

        const isBookingExist = await AmenitiesBooking.findOne({
          amenityTitle: data.amenityTitle,
          bookingDate: bookingDateISO,
          bookingStatus: { $in: ['Confirmed', 'Pending'] },
          // simple overlap check on start/end times as Date objects
          $or: [
            { $and: [ { startTime: { $lt: endDT } }, { endTime: { $gt: startDT } } ] }
          ]
        }).lean();

        console.log("Existing Booking:", isBookingExist);  // Log found booking
        console.log("Booking Time:", bookingTime);  // Log formatted booking time

        if (isBookingExist) {
            // If booking already exists and is confirmed, reject new booking
            return res.status(409).json({
                success: false,
                message: "A booking for this time slot is already confirmed and cannot be double-booked.",
            });
        } else {
            // If no confirmed booking exists, create a new confirmed booking
            const newAmenitiesBooking = await AmenitiesBooking.create({
              // identity / amenity
              residentUsername: data.residentUsername,
              residentName: data.residentName,
              residentEmail: data.residentEmail,
              residentContact: data.residentContact,
              amenityId: data.amenityId,
              amenityTitle: data.amenityTitle,
              userRef: data.userRef,
              // booking core
              bookingID: data.bookingID,
              bookingDate: bookingDateISO,
              startTime: startDT,
              endTime: endDT,
              bookingTime,
              duration: data.duration,
              // pricing & media
              pricePerHour: data.pricePerHour,
              bookingPrice: data.bookingPrice,
              imageUrls: data.imageUrls || [],
              // misc
              specialRequests: data.specialRequests || "",
              bookingStatus: "Pending",
            });

            const emailTemplate = amenitiesBookingEmailTemplate(data.residentName, {
              residentUsername: data.residentUsername,
              amenityTitle: data.amenityTitle,
              bookingDate: bookingDateISO,
              startTime: start,
              endTime: end,
              bookingTime,
              bookingStatus: "Pending",
            });
            sendEmail(
              data.residentEmail,
              "Amenity Booking Confirmation",
              emailTemplate
            );


            // Send a success response with the newly created booking
            return res.status(201).json({
                success: true,
                message: "Amenity booking created successfully",
                amenityBooking: newAmenitiesBooking,
            });
        }
    } catch (error) {
        console.error("Error in booking amenity:", error);  // Log any errors
        next(error);
    }
};

// NOTE: Ensure an auth middleware validates the caller's identity and role.
// Only the owner or an admin should be allowed to create/update/delete relevant bookings.
export const getAmenityBookingById = async (req, res, next) => {
    try {
        const { bookingId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
          return res.status(400).json({ message: "Invalid bookingId" });
        }
        const amenityBooking = await AmenitiesBooking.findById(bookingId).lean();
        if (!amenityBooking) {
            return res.status(404).json({ message: "Amenity Booking not found" });
        }
        return res.status(200).json(amenityBooking);
    } catch (error) {
        next(error);
    }
}

// NOTE: Ensure an auth middleware validates the caller's identity and role.
// Only the owner or an admin should be allowed to create/update/delete relevant bookings.
export const updateAmenityBooking = async (req, res, next) => {
    try {
        const { bookingId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
          return res.status(400).json({ message: "Invalid bookingId" });
        }
        const rawUpdate = pick(req.body, UPDATE_FIELDS);
        const update = sanitizePayload(rawUpdate);

        // Optional: constrain status to an allowlist
        if (update.bookingStatus && !["Pending", "Confirmed", "Cancelled"].includes(update.bookingStatus)) {
          return res.status(400).json({ message: "Invalid bookingStatus" });
        }

        // Validate updated times if present
        if (update.startTime && !isValidTime(update.startTime)) {
          return res.status(400).json({ message: "Invalid startTime" });
        }
        if (update.endTime && !isValidTime(update.endTime)) {
          return res.status(400).json({ message: "Invalid endTime" });
        }
        if (update.residentEmail && !isValidEmail(update.residentEmail)) {
          return res.status(400).json({ message: "Invalid residentEmail" });
        }

        const updateAmenityBooking = await AmenitiesBooking.findByIdAndUpdate(
          bookingId,
          update,
          { new: true, runValidators: true }
        ).lean();

        if (
            update.bookingStatus === "Confirmed"
        ) {
            // Send an email notification to the resident
            const payload = {
              residentName: updateAmenityBooking.residentName,
              residentEmail: updateAmenityBooking.residentEmail,
              amenityTitle: updateAmenityBooking.amenityTitle,
              bookingDate: updateAmenityBooking.bookingDate,
              startTime: updateAmenityBooking.startTime,
              endTime: updateAmenityBooking.endTime,
              bookingTime: updateAmenityBooking.bookingTime,
              bookingStatus: "Confirmed",
            };
            const emailTemplate = amenitiesBookingEmailTemplate(payload.residentName, payload);
            sendEmail(
                payload.residentEmail,
                "Amenity Booking Confirmation",
                emailTemplate
            );
        }
        
        return res.status(200).json(updateAmenityBooking);
    }
    catch (error) {
        next(error);
    }
}

// NOTE: Ensure an auth middleware validates the caller's identity and role.
// Only the owner or an admin should be allowed to create/update/delete relevant bookings.
export const deleteAmenityBooking = async (req, res, next) => {
    try {
        const { bookingId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
          return res.status(400).json({ message: "Invalid bookingId" });
        }
        const deleteAmenityBooking = await AmenitiesBooking.findByIdAndDelete(bookingId);
        return res.status(200).json(deleteAmenityBooking);
    }
    catch (error) {
        next(error);
    }
}

// NOTE: Ensure an auth middleware validates the caller's identity and role.
// Only the owner or an admin should be allowed to create/update/delete relevant bookings.
export const getAllBookings = async (req, res, next) => {
    try {
        const allBookings = await AmenitiesBooking.find()
          .select("-__v")
          .lean();
        return res.status(200).json(allBookings);
    }
    catch (error) {
        next(error);
    }
}
