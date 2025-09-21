// ============ SECURITY CONFIGURATION ============
// Environment-specific security settings

/**
 * Get allowed CORS origins based on environment
 * @returns {Array} Array of allowed origins
 */
export const getAllowedOrigins = () => {
  const isDevelopment = process.env.NODE_ENV === "development";
  const isProduction = process.env.NODE_ENV === "production";

  // Base origins that are always allowed
  const baseOrigins = [];

  // Development origins
  const developmentOrigins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://localhost:8080", // Common Vue.js dev server
    "http://localhost:3001", // Alternative React port
  ];

  // Production origins (replace with your actual domains)
  const productionOrigins = [
    "https://yourdomain.com",
    "https://www.yourdomain.com",
    // Add your actual production domains here:
    // 'https://cleansy.app',
    // 'https://www.cleansy.app',
    // 'https://api.cleansy.app'
  ];

  // Environment-specific origins from environment variables
  const envOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
    : [];

  // Combine origins based on environment
  let allowedOrigins = [...baseOrigins, ...envOrigins];

  if (isDevelopment) {
    allowedOrigins = [...allowedOrigins, ...developmentOrigins];
    console.log("🔧 Development mode: CORS allows local origins");
  }

  if (isProduction) {
    allowedOrigins = [...allowedOrigins, ...productionOrigins];
    console.log("🔒 Production mode: CORS restricted to production origins");
  }

  // If no environment is set, allow both (fallback)
  if (!isDevelopment && !isProduction) {
    allowedOrigins = [
      ...allowedOrigins,
      ...developmentOrigins,
      ...productionOrigins,
    ];
    console.warn("⚠️  NODE_ENV not set: CORS allows all configured origins");
  }

  return allowedOrigins;
};

/**
 * Security configuration based on environment
 */
export const securityConfig = {
  // Rate limiting configuration
  rateLimit: {
    windowMs:
      process.env.NODE_ENV === "production" ? 15 * 60 * 1000 : 60 * 1000, // 15 min in prod, 1 min in dev
    max: process.env.NODE_ENV === "production" ? 100 : 1000, // Stricter in production
  },

  // Session configuration
  session: {
    secure: process.env.NODE_ENV === "production", // Only secure cookies in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },

  // CSP configuration based on environment
  csp: {
    development: {
      // More permissive in development
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
    production: {
      // Strict in production
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
    },
  },
};

/**
 * Log security configuration on startup
 */
export const logSecurityConfig = () => {
  console.log("\n🔐 Security Configuration:");
  console.log(`   Environment: ${process.env.NODE_ENV || "not set"}`);
  console.log(
    `   Allowed CORS Origins: ${getAllowedOrigins().length} configured`
  );
  console.log(
    `   CSP: ${
      process.env.NODE_ENV === "production" ? "Strict" : "Development"
    } mode`
  );
  console.log(
    `   HTTPS Only: ${process.env.NODE_ENV === "production" ? "Yes" : "No"}`
  );
  console.log("   Security Headers: ✅ Enabled");
  console.log("   Hidden File Protection: ✅ Enabled");
  console.log("   Clickjacking Protection: ✅ Enabled\n");
};
