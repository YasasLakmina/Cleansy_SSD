// ============ SECURITY UTILITIES ============
// This file contains security-related configurations and middleware

import { getAllowedOrigins } from "./securityConfig.js";

/**
 * CORS Configuration
 * Defines which origins are allowed to make requests to the API
 */
export const corsConfig = {
  origin: function (origin, callback) {
    // Get allowed origins from environment configuration
    const allowedOrigins = getAllowedOrigins();

    // Allow requests with no origin (mobile apps, curl, Postman, etc.)
    if (!origin) return callback(null, true);

    // Check if the origin is in the allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(
        `🚫 CORS: Blocked request from unauthorized origin: ${origin}`
      );
      console.warn(`   Allowed origins: ${allowedOrigins.join(", ")}`);
      callback(new Error("Not allowed by CORS policy"), false);
    }
  },

  // Allow credentials (cookies, authorization headers)
  credentials: true,

  // Specify allowed methods
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],

  // Specify allowed headers
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],

  // Cache preflight requests for 24 hours
  maxAge: 86400,
};

/**
 * Content Security Policy (CSP) Configuration
 * Defines what resources can be loaded and from where
 * Now includes frame-ancestors for clickjacking protection
 */
export const cspConfig = {
  contentSecurityPolicy: {
    directives: {
      // Only allow resources from same origin by default
      defaultSrc: ["'self'"],

      // Scripts: Allow from self and trusted CDNs
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // Remove this for better security if possible
        "https://cdn.jsdelivr.net",
        "https://unpkg.com",
        "https://js.stripe.com", // Stripe payment integration
        "https://apis.google.com", // Google APIs if needed
      ],

      // Styles: Allow from self and font providers
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Often needed for CSS frameworks
        "https://fonts.googleapis.com",
        "https://cdn.jsdelivr.net",
      ],

      // Images: Allow from self and HTTPS sources
      imgSrc: [
        "'self'",
        "data:", // Base64 images
        "https:", // All HTTPS image sources
        "blob:", // Dynamic images
      ],

      // Fonts: Allow from self and Google Fonts
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "data:", // Base64 fonts
      ],

      // Prevent loading of plugins/objects
      objectSrc: ["'none'"],

      // Media: Allow from self
      mediaSrc: ["'self'"],

      // Network connections: API endpoints and WebSockets
      connectSrc: [
        "'self'",
        "https://api.stripe.com",
        "https://*.googleapis.com",
        "wss://localhost:*",
        "ws://localhost:*",
        "https://localhost:*",
      ],

      // SECURITY FIX: Clickjacking Protection via CSP
      // Prevent the page from being embedded in frames/iframes
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"],

      // Base URI: Prevent injection of base tags
      baseUri: ["'self'"],

      // Form action: Only allow forms to submit to same origin
      formAction: ["'self'"],
    },
  },

  // Additional security headers
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
};

/**
 * List of paths and patterns that should be blocked from public access
 * Prevents information disclosure through hidden files
 */
export const blockedPaths = [
  // Hidden files and directories
  ".DS_Store",
  ".git",
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  ".gitignore",
  ".gitattributes",

  // Node.js specific
  "node_modules",
  "package.json",
  "package-lock.json",
  "yarn.lock",
  ".npmrc",
  ".yarnrc",

  // Log files
  ".log",
  "logs/",
  "*.log",

  // Temporary files
  "tmp/",
  "temp/",
  ".tmp",
  ".temp",

  // Backup files
  "backup",
  ".bak",
  ".backup",
  ".old",
  ".orig",
  ".save",

  // Editor files
  ".swp",
  ".swo",
  ".vim",
  "*~",
  "*.tmp",

  // Configuration files
  "config.js",
  "config.json",
  ".config",

  // Database files
  "*.sqlite",
  "*.db",

  // Archive files that might contain source
  "*.zip",
  "*.tar",
  "*.tar.gz",
  "*.rar",
];

/**
 * Middleware to prevent access to hidden files and sensitive directories
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const hiddenFileProtection = (req, res, next) => {
  const url = req.url.toLowerCase();

  // Block access to any URL containing hidden file patterns
  if (url.includes("/.")) {
    return res.status(403).json({
      error: "Access denied",
      message: "Access to hidden files is not allowed",
    });
  }

  // Check against blocked paths
  const isBlocked = blockedPaths.some((path) => {
    const pathLower = path.toLowerCase();

    // Handle wildcard patterns
    if (pathLower.includes("*")) {
      const pattern = pathLower.replace(/\*/g, ".*");
      const regex = new RegExp(pattern);
      return regex.test(url);
    }

    // Direct path matching
    return url.includes(pathLower);
  });

  if (isBlocked) {
    console.warn(`Blocked access attempt to: ${req.url} from IP: ${req.ip}`);
    return res.status(403).json({
      error: "Access denied",
      message: "Access to this resource is not allowed",
    });
  }

  next();
};

/**
 * Additional security headers middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const additionalSecurityHeaders = (req, res, next) => {
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // SECURITY FIX: Enhanced Clickjacking Protection
  // X-Frame-Options header (legacy support)
  res.setHeader("X-Frame-Options", "DENY");

  // Enable XSS filtering
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Referrer Policy: Control how much referrer information is shared
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions Policy: Control browser features
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
  );

  // Strict Transport Security (use only if serving over HTTPS)
  if (req.secure || req.headers["x-forwarded-proto"] === "https") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  // Prevent information disclosure in error messages
  res.removeHeader("X-Powered-By");

  next();
};

/**
 * CORS Error Handler
 * Custom error handler for CORS-related errors
 */
export const corsErrorHandler = (err, req, res, next) => {
  if (err.message && err.message.includes("CORS")) {
    console.warn(
      `CORS Error: ${err.message} for origin: ${req.headers.origin}`
    );
    return res.status(403).json({
      error: "CORS Policy Violation",
      message: "Origin not allowed by CORS policy",
      origin: req.headers.origin,
    });
  }
  next(err);
};
