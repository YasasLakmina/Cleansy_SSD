/**
 * Frontend Security Configuration
 * Centralizes security settings and constants
 */

// Environment detection
export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;

// API Configuration
export const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  timeout: 30000, // 30 seconds
  retries: 3,
};

// Security Headers
export const SECURITY_HEADERS = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
  // Don't include sensitive tokens here, add them per request
};

// Allowed file types for uploads
export const ALLOWED_FILE_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  documents: ['application/pdf', 'text/plain'],
  // Add more as needed
};

// Maximum file sizes (in bytes)
export const MAX_FILE_SIZES = {
  image: 5 * 1024 * 1024, // 5MB
  document: 10 * 1024 * 1024, // 10MB
};

// URL patterns that should be validated
export const SAFE_URL_PATTERNS = [
  /^https?:\/\/localhost:\d+/,
  /^https?:\/\/127\.0\.0\.1:\d+/,
  /^https:\/\/api\.stripe\.com/,
  /^https:\/\/.*\.googleapis\.com/,
  // Add your production domains here
];

// Content Security Policy settings
export const CSP_CONFIG = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://js.stripe.com", "https://apis.google.com"],
  'style-src': ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  'font-src': ["'self'", "https://fonts.gstatic.com"],
  'img-src': ["'self'", "data:", "https:", "blob:"],
  'connect-src': ["'self'", API_CONFIG.baseURL, "https://api.stripe.com", "https://*.googleapis.com", "ws://localhost:*"],
  'frame-src': ["'none'"],
  'object-src': ["'none'"],
};

// Validation patterns
export const VALIDATION_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+?[\d\s\-\(\)]+$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  noSpecialChars: /^[a-zA-Z0-9\s\-_]+$/,
};

// Sanitization rules
export const SANITIZE_RULES = {
  // Remove potentially dangerous characters
  stripHtml: /<[^>]*>/g,
  stripScript: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  stripOnEvents: /on\w+="[^"]*"/gi,
};

export default {
  isDevelopment,
  isProduction,
  API_CONFIG,
  SECURITY_HEADERS,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZES,
  SAFE_URL_PATTERNS,
  CSP_CONFIG,
  VALIDATION_PATTERNS,
  SANITIZE_RULES,
};