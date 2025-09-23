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

// Only allow the fields we expect from clients (prevents mass-assignment)
const CREATE_FIELDS = [
  "residentUsername",
  "residentName",
  "residentEmail",
  "amenityTitle",
  "bookingDate",
  "startTime",
  "endTime",
  "bookingTime"
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

        // Validate required fields
        if (!data.residentUsername || !data.residentName || !data.residentEmail || !data.amenityTitle) {
          return res.status(400).json({ success: false, message: "Missing required fields." });
        }
        if (!isValidEmail(data.residentEmail)) {
          return res.status(400).json({ success: false, message: "Invalid email." });
        }

        // Validate and normalize date/time
        const bookingDateISO = toISODate(data.bookingDate);
        if (!bookingDateISO) {
          return res.status(400).json({ success: false, message: "Invalid bookingDate." });
        }

        // Prefer explicit startTime/endTime rather than parsing a free-form range
        if (!isValidTime(data.startTime) || !isValidTime(data.endTime)) {
          return res.status(400).json({ success: false, message: "Invalid startTime or endTime (HH:MM expected)." });
        }

        console.log("Request Body:", data);  // Log request data

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

        let bookingTime = data.bookingTime || `${data.startTime} to ${data.endTime}`;
        // Split the bookingTime string into an array of start and end times
        const [bookingTimeStart, bookingTimeEnd] = bookingTime.split(" to ");

        // Convert start and end times to integers
        const startTimeInt = parseInt(bookingTimeStart.split(":")[0]);
        const endTimeInt = parseInt(bookingTimeEnd.split(":")[0]);

        // Generate an array of time strings between start and end times
        const bookingHours = [];
        for (let i = startTimeInt; i < endTimeInt; i++) {
            // Convert the integer to a time string (e.g., 6 => "6:00")
            const hour = i < 10 ? `0${i}` : `${i}`; // Add leading zero if needed
            const timeString = `${hour}:00`;
            
            // Push the time string to the array
            bookingHours.push(timeString);
        }
        console.log("Booking Hours:", bookingHours); // Log generated hours

        // If fair allocation rules pass, proceed with booking

        const isBookingExist = await AmenitiesBooking.findOne({
          amenityTitle: data.amenityTitle,
          bookingDate: bookingDateISO,
          bookingStatus: { $in: ['Confirmed', 'Pending'] },
          // simple overlap check on start/end times as strings "HH:MM"
          $or: [
            { $and: [ { startTime: { $lt: data.endTime } }, { endTime: { $gt: data.startTime } } ] }
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
              residentUsername: data.residentUsername,
              residentName: data.residentName,
              residentEmail: data.residentEmail,
              amenityTitle: data.amenityTitle,
              bookingDate: bookingDateISO,
              startTime: data.startTime,
              endTime: data.endTime,
              bookingTime,
              bookingStatus: "Pending",
            });

            const emailTemplate = amenitiesBookingEmailTemplate(data.residentName, {
              residentUsername: data.residentUsername,
              amenityTitle: data.amenityTitle,
              bookingDate: bookingDateISO,
              startTime: data.startTime,
              endTime: data.endTime,
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
