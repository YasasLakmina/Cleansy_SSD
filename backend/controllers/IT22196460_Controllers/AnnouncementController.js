import Announcement from "../../models/IT22196460_Models/AnnouncementModel.js";
import nodemailer from 'nodemailer';
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

//Function to send email notification (hardened)
const sendEmailNotification = async (announcement, action = "created") => {
  try {
    // escape function to prevent HTML injection in emails
    const esc = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 465),
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const to = process.env.ANNOUNCEMENT_NOTIFY_TO || "security@example.com";
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;

    const html = `
      <p>A new announcement has been ${esc(action)}:</p>
      <ul>
        <li><b>Announcement ID:</b> ${esc(announcement.Announcement_ID)}</li>
        <li><b>Title:</b> ${esc(announcement.Title)}</li>
        <li><b>Content:</b> ${esc(announcement.Content)}</li>
        <li><b>Created At:</b> ${esc(announcement.Create_At)}</li>
      </ul>
    `;

    await transporter.sendMail({
      from,
      to,
      subject: `Announcement ${esc(action)}`,
      html,
    });
  } catch (err) {
    console.error("Email send error:", err?.message || err);
  }
};

// --- Security helpers: sanitize inputs and restrict fields ---
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
const CREATE_FIELDS = [
  "Announcement_ID",
  "Title",
  "Content",
  "Category_ID",
  "Attachment_URL",
  "Create_At",
];
const UPDATE_FIELDS = [
  "Title",
  "Content",
  "Category_ID",
  "Attachment_URL",
];
function pick(obj, allowed) {
  const out = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  return out;
}
// --- End helpers ---

// create a new announcement 
export const createAnnouncement = async(req, res) => {
    const raw = pick(req.body, CREATE_FIELDS);
    const data = sanitizePayload(raw);
    const newAnnouncement = new Announcement(data);
    try{
        const savedAnnouncement = await newAnnouncement.save();

        await sendEmailNotification(savedAnnouncement, "created");
        res.status(201).json(savedAnnouncement);
    } catch(error){
        console.error("Error creating announcement : ", error.message);
        res.status(500).json({message: "Faild to create announcement"});
    }
};

// Read all announcements
export const getAnnouncements = async(req, res, next) => {
    try{
        const announcement = await Announcement.find().select("-__v").lean();
        res.status(200).json(announcement);
    } catch(error){
        console.error("Error fetching announcements: ",error.message);
        res.status(500).json({message: "Failed to fetch announcements"});
    }
};

// Update announcement
export const updateAnnouncement = async(req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const data = sanitizePayload(pick(req.body, UPDATE_FIELDS));

    try {
        const updatedAnnouncement = await Announcement.findByIdAndUpdate(
            req.params.id,
            data,
            { new: true, runValidators: true }
        ).lean();

        if (!updatedAnnouncement) {
            return res.status(404).json({ message: "Announcement not found" });
        }
        await sendEmailNotification(updatedAnnouncement, "updated");

        res.status(200).json(updatedAnnouncement);
    } catch (error) {
        console.error("Error updating announcement:", error.message);
        res.status(500).json({ message: "Failed to update announcement" });
    }

}; 

//Delete announcement
export const deleteAnnouncement = async(req, res, next) => {

    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
          return res.status(400).json({ message: "Invalid id" });
        }
        const deleteAnnouncement = await Announcement.findByIdAndDelete(req.params.id);

        if(!deleteAnnouncement){
            return res.status(404).json({ message: "Announcement not found"});
        }
        await sendEmailNotification({ Announcement_ID: req.params.id, Title: "", Content: "", Create_At: new Date() }, "deleted");

        res.status(200).json({message: "Announcement deleted successfully"});
    } catch(error){

        console.error("Error deleting announcement:", error.message);
        res.status(500).json({message: "Failed to delete announcement "});
    }
};

//Read announcement
export const getAnnouncement = async(req, res, next) => {

    try{
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
          return res.status(400).json({ message: "Invalid id" });
        }
        const announcement = await Announcement.findById(req.params.id).lean();

        if(!announcement) {
            return res.status(404).json({message: "Announcement not found"});
        }
        res.status(200).json(announcement);
    }catch(error){

        // console.error("Error fetching announcement:", error.message);
        // res.status(500).json({message: "Failed to fetch announcemen"});
        next(error)
    }
};

// Generate report of announcements generated today
export const generateDailyReport = async (req, res) => {
    try {
        // Fetch announcements generated today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const announcements = await Announcement.find({ Create_At: { $gte: today } }).select("-__v").lean();

        // Return the report
        res.status(200).json({
            count: announcements.length,
            announcements: announcements
        });
    } catch (error) {
        console.error("Error generating daily report:", error.message);
        res.status(500).json({ message: "Failed to generate daily report" });
    }
};

// Fetch announcements generated today
export const getAnnouncementsToday = async (req, res) => {
    try {
        // Fetch announcements generated today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const announcements = await Announcement.find({ Create_At: { $gte: today } }).select("-__v").lean();

        // Return the announcements
        res.status(200).json({
            count: announcements.length,
            announcements: announcements
        });
    } catch (error) {
        console.error("Error fetching announcements today:", error.message);
        res.status(500).json({ message: "Failed to fetch announcements today" });
    }
};

// Fetch all announcements
export const getAllAnnouncements = async (req, res) => {
    try {
        const announcements = await Announcement.find();
        res.status(200).json(announcements);
    } catch (error) {
        console.error("Error fetching all announcements:", error.message);
        res.status(500).json({ message: "Failed to fetch announcements" });
    }
};
