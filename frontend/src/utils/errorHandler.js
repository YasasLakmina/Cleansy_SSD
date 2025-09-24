/**
 * Secure Error Handling Utility
 * Prevents sensitive information disclosure while maintaining functionality
 */

// Check if we're in development mode
const isDevelopment = import.meta.env.DEV;

/**
 * Secure console logging that only works in development
 * @param {string} level - log level (log, warn, error, info)
 * @param {...any} args - arguments to log
 */
export const secureLog = (level = "log", ...args) => {
  if (isDevelopment && console[level]) {
    console[level]("[CLEANSY]", ...args);
  }
};

/**
 * Secure error handler for API responses
 * @param {Error|Response} error - The error object or response
 * @param {string} context - Context where the error occurred
 * @returns {string} User-friendly error message
 */
export const handleSecureError = (error, context = "") => {
  // Log detailed error in development only
  secureLog("error", `Error in ${context}:`, error);

  // Return generic messages for production
  if (!isDevelopment) {
    return "An error occurred. Please try again later.";
  }

  // In development, provide more details
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }

  if (error?.message) {
    return error.message;
  }

  return "An unexpected error occurred.";
};

/**
 * Secure API error handler
 * @param {Response} response - Fetch response object
 * @param {string} context - Context for the API call
 * @returns {Promise<Object>} Processed response or error
 */
export const handleApiResponse = async (response, context = "") => {
  try {
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }

    return { success: true, data };
  } catch (error) {
    const message = handleSecureError(error, context);
    return { success: false, error: message };
  }
};

/**
 * Sanitize sensitive data from objects before logging
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
export const sanitizeForLogging = (obj) => {
  if (!obj || typeof obj !== "object") return obj;

  const sensitive = ["password", "token", "secret", "key", "auth"];
  const sanitized = { ...obj };

  Object.keys(sanitized).forEach((key) => {
    if (sensitive.some((word) => key.toLowerCase().includes(word))) {
      sanitized[key] = "[REDACTED]";
    }
  });

  return sanitized;
};

export default {
  secureLog,
  handleSecureError,
  handleApiResponse,
  sanitizeForLogging,
};
