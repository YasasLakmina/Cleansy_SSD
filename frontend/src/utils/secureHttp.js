/**
 * Secure HTTP Client
 * Provides secure API communication with proper error handling
 */

import { API_CONFIG, SECURITY_HEADERS, SAFE_URL_PATTERNS } from './securityConfig.js';
import { handleSecureError, secureLog } from './errorHandler.js';

/**
 * Validates if a URL is safe to make requests to
 * @param {string} url - URL to validate
 * @returns {boolean} True if URL is safe
 */
const isUrlSafe = (url) => {
  try {
    const urlObj = new URL(url, window.location.origin);
    return SAFE_URL_PATTERNS.some(pattern => pattern.test(urlObj.href));
  } catch {
    return false;
  }
};

/**
 * Secure fetch wrapper with built-in security features
 * @param {string} url - API endpoint
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Response object with success/error handling
 */
export const secureApiCall = async (url, options = {}) => {
  try {
    // Validate URL
    const fullUrl = url.startsWith('http') ? url : `${API_CONFIG.baseURL}${url}`;
    
    if (!isUrlSafe(fullUrl)) {
      throw new Error('URL not allowed by security policy');
    }

    // Prepare secure headers
    const headers = {
      ...SECURITY_HEADERS,
      ...options.headers,
    };

    // Add authorization header if available
    const token = localStorage.getItem('token');
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // Setup fetch options with security defaults
    const fetchOptions = {
      credentials: 'include', // Include cookies for CORS
      mode: 'cors',
      cache: 'no-cache',
      ...options,
      headers,
    };

    secureLog('info', `Making API call to: ${url}`);

    const response = await fetch(fullUrl, fetchOptions);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    secureLog('info', `API call successful: ${url}`);
    return { success: true, data };

  } catch (error) {
    const errorMessage = handleSecureError(error, `API call to ${url}`);
    secureLog('error', `API call failed: ${url}`, error);
    return { success: false, error: errorMessage };
  }
};

/**
 * GET request
 */
export const apiGet = (url, options = {}) => {
  return secureApiCall(url, { ...options, method: 'GET' });
};

/**
 * POST request
 */
export const apiPost = (url, data, options = {}) => {
  return secureApiCall(url, {
    ...options,
    method: 'POST',
    body: JSON.stringify(data),
  });
};

/**
 * PUT request
 */
export const apiPut = (url, data, options = {}) => {
  return secureApiCall(url, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

/**
 * DELETE request
 */
export const apiDelete = (url, options = {}) => {
  return secureApiCall(url, { ...options, method: 'DELETE' });
};

/**
 * File upload with security validation
 */
export const apiUpload = async (url, file, options = {}) => {
  try {
    // Validate file type and size (implement based on your requirements)
    if (!file) {
      throw new Error('No file provided');
    }

    const formData = new FormData();
    formData.append('file', file);

    return secureApiCall(url, {
      ...options,
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type for FormData, let browser set it
        ...options.headers,
      },
    });
  } catch (error) {
    const errorMessage = handleSecureError(error, 'File upload');
    return { success: false, error: errorMessage };
  }
};

export default {
  secureApiCall,
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  apiUpload,
};