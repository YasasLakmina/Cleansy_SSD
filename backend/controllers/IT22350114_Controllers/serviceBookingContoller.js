import ServiceBooking from "../../models/IT22350114_Models/serviceBookingModel.js";
import sendEmail from "../../utils/sendEmail.js";
import serviceBookingEmailTemplate from "../../utils/email_templates/serviceBookingEmailTemplate.js";
import mongoose from "mongoose";

// --- Security helpers: allowlist fields, sanitize strings, and validate basics ---
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/; // HH:MM 24h
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeString(s) {
  if (typeof s !== "string") return s;
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

function isValidTime(t) {
  return typeof t === "string" && TIME_RE.test(t);
}

function isValidEmail(e) {
  return typeof e === "string" && EMAIL_RE.test(e);
}

const CREATE_FIELDS = [
  "serviceID",
  "bookingDate",
  "bookingTime",
  "residentName",
  "residentEmail",
  "notes"
];

const UPDATE_FIELDS = [
  "bookingStatus",
  "bookingDate",
  "bookingTime",
  "residentName",
  "residentEmail",
  "notes"
];
// --- End helpers ---

export const createServiceBooking = async (req, res, next) => {
  try {
    // Whitelist & sanitize user input
    const raw = pick(req.body, CREATE_FIELDS);
    const data = sanitizePayload(raw);

    // Validate required fields
    if (!data.serviceID || !data.bookingDate || !data.bookingTime || !data.residentName || !data.residentEmail) {
      return res.status(400).json({ success: false, message: "Missing required fields." });
    }
    if (!isValidEmail(data.residentEmail)) {
      return res.status(400).json({ success: false, message: "Invalid email." });
    }
    const bookingDateISO = toISODate(data.bookingDate);
    if (!bookingDateISO) {
      return res.status(400).json({ success: false, message: "Invalid bookingDate." });
    }
    if (!isValidTime(data.bookingTime)) {
      return res.status(400).json({ success: false, message: "Invalid bookingTime (HH:MM expected)." });
    }

    const isBookingExist = await ServiceBooking.findOne({
      serviceID: data.serviceID,
      bookingDate: bookingDateISO,
      bookingTime: data.bookingTime,
      bookingStatus: { $in: ["Confirmed", "Pending"] },
    }).lean();

    let newServiceBooking = null;
    if (isBookingExist) {
      newServiceBooking = await ServiceBooking.create({
        serviceID: data.serviceID,
        bookingDate: bookingDateISO,
        bookingTime: data.bookingTime,
        residentName: data.residentName,
        residentEmail: data.residentEmail,
        notes: data.notes,
        bookingStatus: "Pending",
      });
      const emailTemplate = serviceBookingEmailTemplate(data.residentName, {
        serviceID: data.serviceID,
        bookingDate: bookingDateISO,
        bookingTime: data.bookingTime,
        residentName: data.residentName,
        residentEmail: data.residentEmail,
        notes: data.notes,
        bookingStatus: "Pending",
        bookingID: newServiceBooking._id,
      });
     
      sendEmail(
        data.residentEmail,
        "Service Booking Confirmation",
        emailTemplate
      );
    } else {
      // Create a new service bookings using the data from the request body
      newServiceBooking = await ServiceBooking.create({
        serviceID: data.serviceID,
        bookingDate: bookingDateISO,
        bookingTime: data.bookingTime,
        residentName: data.residentName,
        residentEmail: data.residentEmail,
        notes: data.notes,
        bookingStatus: "Confirmed",
      });
      const emailTemplate = serviceBookingEmailTemplate(data.residentName, {
        serviceID: data.serviceID,
        bookingDate: bookingDateISO,
        bookingTime: data.bookingTime,
        residentName: data.residentName,
        residentEmail: data.residentEmail,
        notes: data.notes,
        bookingStatus: "Confirmed",
        bookingID: newServiceBooking._id,
      });
     
      sendEmail(
        data.residentEmail,
        "Service Booking Confirmation",
        emailTemplate
      );
    }

    // Send a success response with the newly created service booking
    return res.status(201).json({
      success: true,
      message: "Service booking created successfully",
      serviceBooking: newServiceBooking,
    });
  } catch (error) {
    // Pass any errors to the error handling middleware
    next(error);
  }
};

//Read for all service Bookings
export const getAllServiceBookings = async (req, res, next) => {
  try {
    const allServiceBookings = await ServiceBooking.find()
      .select("-__v")
      .lean();
    return res.status(200).json(allServiceBookings);
  } catch (error) {
    next(error);
  }
};

//Fetch a specific service bookings
export const getServiceBookingById = async (req, res, next) => {
  try {
    const { BookingId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(BookingId)) {
      return res.status(400).json({ message: "Invalid BookingId" });
    }
    const serviceBooking = await ServiceBooking.findById(BookingId).lean();
    if (!serviceBooking) {
      return res.status(404).json({ message: "Service booking not found" });
    }
    return res.status(200).json(serviceBooking);
  } catch (error) {
    next(error);
  }
};

//Update a service bookings
export const updateServiceBooking = async (req, res, next) => {
  try {
    const { BookingId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(BookingId)) {
      return res.status(400).json({ message: "Invalid BookingId" });
    }
    const update = sanitizePayload(pick(req.body, UPDATE_FIELDS));

    // Optional validations for updates
    if (update.bookingDate) {
      const iso = toISODate(update.bookingDate);
      if (!iso) return res.status(400).json({ message: "Invalid bookingDate" });
      update.bookingDate = iso;
    }
    if (update.bookingTime && !isValidTime(update.bookingTime)) {
      return res.status(400).json({ message: "Invalid bookingTime (HH:MM expected)" });
    }
    if (update.residentEmail && !isValidEmail(update.residentEmail)) {
      return res.status(400).json({ message: "Invalid residentEmail" });
    }

    const updateServiceBooking = await ServiceBooking.findByIdAndUpdate(
      BookingId,
      update,
      { new: true, runValidators: true }
    ).lean();
    return res.status(200).json(updateServiceBooking);
  } catch (error) {
    next(error);
  }
};

//Delete a service listing
export const deleteServiceBooking = async (req, res, next) => {
  try {
    const { BookingId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(BookingId)) {
      return res.status(400).json({ message: "Invalid BookingId" });
    }
    const deleteServiceBooking = await ServiceBooking.findByIdAndDelete(
      BookingId
    );
    return res.status(200).json(deleteServiceBooking);
  } catch (error) {
    next(error);
  }
};
