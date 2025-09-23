import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root directory
dotenv.config({ path: path.join(__dirname, "../.env") });

// Configure Facebook OAuth strategy after environment variables are loaded
import { configureFacebookStrategy } from "./utils/passport.js";
configureFacebookStrategy();

import dbConnection from "./dbConfig/dbConnection.js";
import userRoutes from "./routes/user.route.js";
import authRoutes from "./routes/auth.route.js";
import apartmentListingRoutes from "./routes/IT22577160_Routes/apartmentListing.route_02.js";
import PaymentProfileCreationRoutes from "./routes/IT22602978_Routes/PaymentProfileCreation.route_03.js";
import TaskAssignRoute from "./routes/IT22607232_Routes/s1_TaskAssignRoute.js";
import RequestLeaveRoutes from "./routes/IT22603418_Routes/RequestLeave.route_04.js";
import visitorListingRoutes from "./routes/IT22561466_Routes/visitorListing.route.js";
import cookieParser from "cookie-parser";
import serviceListingRoutes from "./routes/IT22350114_Routes/serviceListingRoute.js";
import amenitiesListingRoutes from "./routes/IT22003546_Routes/amenitiesListing.route.js";
import sharedResourcesListingRoutes from "./routes/IT22577160_Routes/sharedResourcesListing.route_02.js";
import commentRoutes from "./routes/IT22577160_Routes/comment.route_02.js";
import checkoutRoutes from "./routes/IT22577160_Routes/checkout.route_02.js";
import RateTasksRoutes from "./routes/IT22607232_Routes/RateTasksRoute_01.js";
import amenitiesBookingRoutes from "./routes/IT22003546_Routes/amenitiesBooking.route_05.js";
import TaskAnalysisRoute from "./routes/IT22607232_Routes/TaskAnalysisRoute_01.js";
import taskcategoriesRoutes from "./routes/IT22607232_Routes/taskcategoriesRoute_01.js";
import tasklabelsRoutes from "./routes/IT22607232_Routes/taskLabels_01.js";
import AdminPaymentHandlingRoutes from "./routes/IT22602978_Routes/AdminPaymentHandling.route_03.js";
import serviceBookingRoutes from "./routes/IT22350114_Routes/serviceBookingRoutes.js";
import StaffAdminRoutes from "./routes/IT22603418_Routes/StaffAdmin.route_04.js";
import StaffAttendanceRoutes from "./routes/IT22603418_Routes/StaffAttendance.route_04.js";
import conversationRoutes from "./routes/IT22577160_Routes/conversation.route_02.js";
import messageRoutes from "./routes/IT22577160_Routes/messages.route_02.js";
import AnnouncementsRoutes from "./routes/IT22196460_Routes/AnnouncementsRoutes.js";
import cors from "cors";
import EstimationRoutes_01 from "./routes/IT22607232_Routes/EstimationRoutes_01.js";
import carparkListingRoutes from "./routes/IT22561466_Routes/carparkListing.route.js";
// Security middleware import
import helmet from "helmet";
import {
  cspConfig,
  cspNonceMiddleware,
  hiddenFileProtection,
  additionalSecurityHeaders,
  corsConfig,
  corsErrorHandler,
} from "./utils/security.js";
import { logSecurityConfig } from "./utils/securityConfig.js";

import StaffRegisterRoutes from "./routes/IT22603418_Routes/StaffRegister.route_04.js";

const app = express();

// ============ SECURITY MIDDLEWARE ============
// 1. CSP Nonce Generation (must be before helmet)
// Generates unique nonce for each request to allow inline scripts/styles securely
app.use(cspNonceMiddleware);

// 2. SECURITY FIX: Content Security Policy with No Fallback Issues Resolved
// Addresses ZAP finding by explicitly defining all required directives
// - Defines base-uri, form-action, frame-ancestors (no fallback directives)
// - Ensures script-src exists when using script-src-elem/attr
// - Ensures style-src exists when using style-src-elem/attr
app.use(helmet(cspConfig));

// 3. SECURITY FIX: Hidden File Disclosure Prevention
// Blocks access to .DS_Store, .git, .env, backup files, etc.
app.use(hiddenFileProtection);

// 4. Additional security headers (enhanced clickjacking protection)
app.use(additionalSecurityHeaders);

// ============ END SECURITY MIDDLEWARE ============

app.use(express.json());
app.use(cookieParser());

// SECURITY FIX: CORS Configuration with Origin Whitelist
// Only allows requests from trusted origins, blocks all others
app.use(cors(corsConfig));

// CORS Error Handler
app.use(corsErrorHandler);

dbConnection();

// Log security configuration
logSecurityConfig();

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});

app.get("/", (req, res) => {
  res.status(200).json({ status: "OK", service: "Cleansy API" });
});

app.use("/api/user", userRoutes);
app.use("/api/auth", authRoutes);

// ============ CSP TESTING ENDPOINT ============
// Test endpoint to demonstrate nonce usage and CSP headers
app.get("/api/csp-test", (req, res) => {
  const nonce = res.locals.nonce;

  res.json({
    message: "CSP Test Endpoint",
    nonce: nonce,
    environment: process.env.NODE_ENV || "development",
    cspExample: {
      inlineScript: `<script nonce="${nonce}">console.log('This inline script will be allowed');</script>`,
      inlineStyle: `<style nonce="${nonce}">body { background: #f0f0f0; }</style>`,
      note: "Use the nonce attribute on inline scripts/styles in production",
    },
    headers: {
      csp: res.getHeaders()["content-security-policy"] || "Not set",
    },
  });
});
// ============ END CSP TESTING ============

// IT22602978 Routes
app.use("/api/PaymentProfileCreation", PaymentProfileCreationRoutes);
app.use("/api/AdminPaymentHandling", AdminPaymentHandlingRoutes);
// IT22603418 Routes
app.use("/api/RequestLeave", RequestLeaveRoutes);
app.use("/api/StaffAdmin", StaffAdminRoutes);
app.use("/api/StaffAttendance", StaffAttendanceRoutes);
app.use("/api/StaffRegister", StaffRegisterRoutes);

// IT22350114 Routes
app.use("/api/serviceListing", serviceListingRoutes);
app.use("/api/serviceBooking", serviceBookingRoutes);

//IT22607232 Routes
app.use("/api/taskAssign", TaskAssignRoute);
app.use("/api/taskRating", RateTasksRoutes);
app.use("/api/taskAnalysis", TaskAnalysisRoute);
app.use("/api/categeories", taskcategoriesRoutes);
app.use("/api/labels", tasklabelsRoutes);
app.use("/api/workEstimation", EstimationRoutes_01);

// IT22577160 Routes
app.use("/api/apartmentListing", apartmentListingRoutes);
app.use("/api/sharedResourcesListing", sharedResourcesListingRoutes);
app.use("/api/comment", commentRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/conversation", conversationRoutes);
app.use("/api/messages", messageRoutes);

// IT22003546 Routes
app.use("/api/amenitiesListing", amenitiesListingRoutes);
app.use("/api/amenitiesBooking", amenitiesBookingRoutes);

//IT22561466 Routes
app.use("/api/visitorListing", visitorListingRoutes);
app.use("/api/carparkListing", carparkListingRoutes);

// IT22196460 Routes
app.use("/api/announcements", AnnouncementsRoutes);

// ============ SECURITY: 404 Handler with CSP Headers ============
// Ensure 404 responses also include security headers
app.use((req, res, next) => {
  // For API routes, return JSON 404
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      success: false,
      statusCode: 404,
      message: "API endpoint not found",
      path: req.path,
    });
  }

  // For non-API routes, return generic 404
  res.status(404).json({
    success: false,
    statusCode: 404,
    message: "Resource not found",
  });
});

// ============ SECURITY: Error Handler with CSP Headers ============
// Global error handler - security headers are already applied by helmet middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  // Log error for debugging (don't expose sensitive info to client)
  console.error("Server Error:", {
    statusCode,
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  res.status(statusCode).json({
    success: false,
    statusCode,
    message:
      process.env.NODE_ENV === "development"
        ? message
        : "Internal Server Error",
  });
});
