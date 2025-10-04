// ============ SECURITY UTILITIES ============
// This file contains security-related configurations and middleware

import { getAllowedOrigins } from "./securityConfig.js";
import crypto from "crypto";

/**
 * WHY ZAP RAISES "Failure to Define Directive with No Fallback":
 *
 * ZAP flags this error when:
 * 1. Using script-src-elem or script-src-attr WITHOUT defining script-src (no fallback)
 * 2. Using style-src-elem or style-src-attr WITHOUT defining style-src (no fallback)
 * 3. Missing directives that have NO fallback: base-uri, form-action, frame-ancestors
 * 4. Relying on default-src for directives that don't inherit from it
 *
 * This configuration resolves these issues by:
 * - Always defining script-src when using script-src-elem/attr
 * - Always defining style-src when using style-src-elem/attr
 * - Explicitly defining base-uri, form-action, frame-ancestors
 * - Not relying on default-src for critical security directives
 */

/**
 * Generate a cryptographically secure nonce for CSP
 * @returns {string} Base64 encoded nonce
 */
export const generateNonce = () => {
  return crypto.randomBytes(16).toString("base64");
};

/**
 * Build CSP directives based on environment
 * @param {boolean} isProd - Whether in production mode
 * @param {string} nonce - Optional nonce for inline scripts/styles
 * @returns {Object} CSP directives object
 */
export const buildCspDirectives = (isProd = false, nonce = null) => {
  // Base directives that are always present
  const baseDirectives = {
    // CRITICAL: These directives have NO fallback - must be explicitly defined
    "default-src": ["'self'"],
    "base-uri": ["'self'"], // NO fallback - prevents <base> tag injection
    "form-action": ["'self'"], // NO fallback - restricts form submissions
    "frame-ancestors": ["'none'"], // NO fallback - prevents clickjacking
    "object-src": ["'none'"], // Prevent plugins/objects

    // Image sources
    "img-src": [
      "'self'",
      "data:", // Base64 images
      "https:", // Allow HTTPS images
      "blob:", // Dynamic/canvas images
    ],

    // Font sources
    "font-src": [
      "'self'",
      "data:", // Base64 fonts
      "https://fonts.gstatic.com", // Google Fonts
    ],

    // Media sources
    "media-src": ["'self'"],

    // Worker sources (for service workers, web workers)
    "worker-src": [
      "'self'",
      "blob:", // For HMR and dynamic workers
    ],

    // Manifest sources (for PWA manifests)
    "manifest-src": ["'self'"],

    // Network connections
    "connect-src": [
      "'self'",
      "https://api.stripe.com", // Payment processing
      "https://*.googleapis.com", // Google APIs
      ...(isProd
        ? []
        : [
            "ws://localhost:*", // Dev WebSocket
            "wss://localhost:*", // Dev secure WebSocket
            "http://localhost:*", // Dev server connections
          ]),
    ],
  };

  // Production-specific directives (strict security)
  if (isProd) {
    return {
      ...baseDirectives,

      // PRODUCTION: Strict script policy
      "script-src": [
        "'self'",
        ...(nonce ? [`'nonce-${nonce}'`] : []), // Nonce for inline scripts
        "https://js.stripe.com", // Stripe SDK
        "https://apis.google.com", // Google APIs
      ],

      // PRODUCTION: Strict style policy
      "style-src": [
        "'self'",
        ...(nonce ? [`'nonce-${nonce}'`] : []), // Nonce for inline styles
        "https://fonts.googleapis.com", // Google Fonts CSS
      ],

      // Production: No inline styles/scripts without nonce
      // These are defined to ensure fallback coverage
      "script-src-elem": [
        "'self'",
        ...(nonce ? [`'nonce-${nonce}'`] : []),
        "https://js.stripe.com",
      ],
      "script-src-attr": ["'none'"], // No inline event handlers
      "style-src-elem": [
        "'self'",
        ...(nonce ? [`'nonce-${nonce}'`] : []),
        "https://fonts.googleapis.com",
      ],
      "style-src-attr": ["'none'"], // No inline style attributes

      // Additional directives for complete ZAP compliance
      "child-src": ["'self'"],
      "frame-src": ["'none'"],

      // Navigation directive (if supported)
      "navigate-to": ["'self'", "https:"],

      // Production: Force HTTPS
      "upgrade-insecure-requests": [],
    };
  }

  // Development-specific directives (relaxed for HMR/debugging)
  else {
    return {
      ...baseDirectives,

      // DEVELOPMENT: Relaxed script policy for HMR
      "script-src": [
        "'self'",
        "'unsafe-inline'", // Allow inline scripts in dev
        "'unsafe-eval'", // Allow eval for HMR/dev tools
        "https://js.stripe.com",
        "https://apis.google.com",
        "http://localhost:*", // Dev servers
      ],

      // DEVELOPMENT: Relaxed style policy for HMR
      "style-src": [
        "'self'",
        "'unsafe-inline'", // Allow inline styles in dev
        "https://fonts.googleapis.com",
        "http://localhost:*", // Dev servers
      ],

      // Development: Define element-specific directives for fallback coverage
      "script-src-elem": [
        "'self'",
        "'unsafe-inline'",
        "http://localhost:*",
        "https://js.stripe.com",
      ],
      "script-src-attr": ["'self'", "'unsafe-inline'", "http://localhost:*"],
      "style-src-elem": [
        "'self'",
        "'unsafe-inline'",
        "http://localhost:*",
        "https://fonts.googleapis.com",
      ],
      "style-src-attr": ["'self'", "'unsafe-inline'", "http://localhost:*"],
      // Additional directives that ZAP expects for complete coverage
      "child-src": ["'self'", "blob:"],
      "frame-src": ["'none'"],

      // Navigation directives
      "navigate-to": ["'self'", "http://localhost:*", "https:"],
    };
  }
};

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
 * Middleware to generate and attach CSP nonce to each request
 * This nonce can be used in inline scripts and styles for production security
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const cspNonceMiddleware = (req, res, next) => {
  // Generate a unique nonce for this request
  const nonce = generateNonce();

  // Attach nonce to response locals for template access
  res.locals.nonce = nonce;
  res.locals.cspNonce = nonce; // Alternative property name

  // Store nonce for CSP header generation
  req.cspNonce = nonce;

  next();
};

/**
 * Production-ready Content Security Policy Configuration
 * Addresses ZAP finding "Failure to Define Directive with No Fallback"
 */
export const createCspConfig = (
  isProd = process.env.NODE_ENV === "production"
) => {
  return {
    contentSecurityPolicy: {
      useDefaults: false, // Don't use helmet defaults, use our explicit config
      directives: (req, res) => {
        // Get nonce from request if available
        const nonce = req?.cspNonce || null;

        // Build environment-appropriate directives
        const directives = buildCspDirectives(isProd, nonce);

        return directives;
      },
      reportOnly: false, // Set to true for testing, false for enforcement
    },

    // Additional security headers
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },

    // Remove X-Powered-By header
    hidePoweredBy: true,
  };
};

// Legacy export for backward compatibility
// Use static directives for simpler implementation
export const cspConfig = {
  contentSecurityPolicy: {
    useDefaults: false,
    directives: buildCspDirectives(process.env.NODE_ENV === "production"),
    reportOnly: false,
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hidePoweredBy: true,
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
  const path = req.path.toLowerCase();

  // Allow API routes (they should not be blocked)
  if (path.startsWith("/api/")) {
    return next();
  }

  // Block access to hidden files (files starting with dot after a slash)
  if (path.includes("/.")) {
    return res.status(403).json({
      error: "Access denied",
      message: "Access to hidden files is not allowed",
    });
  }

  // Check against blocked paths
  const isBlocked = blockedPaths.some((blockedPath) => {
    const pathLower = blockedPath.toLowerCase();

    // Handle wildcard patterns
    if (pathLower.includes("*")) {
      const pattern = pathLower.replace(/\*/g, ".*");
      const regex = new RegExp(pattern);
      return regex.test(path);
    }

    // Direct path matching
    return path.includes(pathLower);
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
