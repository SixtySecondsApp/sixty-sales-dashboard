/**
 * API Error Sanitization Utilities
 * 
 * Centralized error handling for API endpoints to prevent sensitive
 * information leakage and provide consistent error responses.
 */

/**
 * Sanitizes error messages to prevent sensitive data exposure
 * @param {Error} error - The original error object
 * @param {string} operation - The operation that failed (for context)
 * @returns {string} Sanitized error message safe for client consumption
 */
export function sanitizeErrorMessage(error, operation = 'operation') {
  const message = error?.message || 'Unknown error';
  
  // Log full error server-side but return sanitized message to client
  console.error(`API error during ${operation} (sanitized for client):`, {
    message,
    code: error?.code,
    timestamp: new Date().toISOString(),
    stack: error?.stack?.substring(0, 200), // Limited stack trace for debugging
    // Don't log full error object to prevent sensitive data exposure
  });
  
  // Return generic error messages for common database errors
  if (message.includes('duplicate key')) {
    return 'A record with this information already exists';
  }
  if (message.includes('foreign key')) {
    return 'Referenced record not found';
  }
  if (message.includes('PGRST')) {
    return 'Database service temporarily unavailable';
  }
  if (message.includes('JWT') || message.includes('authentication')) {
    return 'Authentication required';
  }
  if (message.includes('permission') || message.includes('unauthorized')) {
    return 'Permission denied';
  }
  if (message.includes('timeout')) {
    return 'Request timeout - please try again';
  }
  if (message.includes('connection')) {
    return 'Service temporarily unavailable';
  }
  if (message.includes('syntax error')) {
    return 'Invalid request format';
  }
  if (message.includes('invalid input')) {
    return 'Invalid input data';
  }
  
  // For unrecognized errors, return generic message
  return `${operation.charAt(0).toUpperCase() + operation.slice(1)} failed. Please try again.`;
}

/**
 * Sanitizes API responses with consistent error handling
 * @param {Object} response - Express response object
 * @param {*} data - Response data (null if error)
 * @param {Error|string} error - Error object or message
 * @param {number} status - HTTP status code
 * @param {Object} options - Additional options
 * @returns {Object} Express response
 */
export function sanitizedApiResponse(response, data = null, error = null, status = 200, options = {}) {
  const {
    requestStartTime = Date.now(),
    operation = 'operation',
    ...otherOptions
  } = options;
  
  // Calculate response time
  const responseTime = Date.now() - requestStartTime;
  
  // Set security headers
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Standard CORS headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Performance headers
  response.setHeader('X-Response-Time', `${responseTime}ms`);
  response.setHeader('X-Timestamp', new Date().toISOString());
  
  // Handle error cases
  let sanitizedError = null;
  let errorStatus = status;
  
  if (error) {
    if (typeof error === 'string') {
      sanitizedError = error;
    } else if (error instanceof Error) {
      sanitizedError = sanitizeErrorMessage(error, operation);
      // Set appropriate status code based on error type
      if (error.code === '23505') errorStatus = 409; // Conflict
      else if (error.code === '23503') errorStatus = 400; // Bad Request
      else if (error.message?.includes('authentication')) errorStatus = 401;
      else if (error.message?.includes('permission')) errorStatus = 403;
      else if (error.message?.includes('not found')) errorStatus = 404;
      else if (error.message?.includes('timeout')) errorStatus = 408;
      else errorStatus = 500; // Internal Server Error
    } else {
      sanitizedError = `${operation.charAt(0).toUpperCase() + operation.slice(1)} failed. Please try again.`;
      errorStatus = 500;
    }
  }
  
  // Build response body
  const responseBody = {
    data,
    error: sanitizedError,
    metadata: {
      count: Array.isArray(data) ? data.length : (data ? 1 : 0),
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
      success: !sanitizedError
    }
  };
  
  // Log slow responses for monitoring
  if (responseTime > 1000) {
    console.warn(`🐌 Slow API response: ${operation} took ${responseTime}ms`);
  }
  
  return response.status(sanitizedError ? errorStatus : status).json(responseBody);
}

/**
 * Express middleware for centralized error handling
 * @param {Error} error - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export function errorHandlerMiddleware(error, req, res, next) {
  const operation = req.path?.replace('/api/', '') || 'request';
  const requestStartTime = req.startTime || Date.now();
  
  return sanitizedApiResponse(res, null, error, 500, {
    requestStartTime,
    operation
  });
}

/**
 * Rate limiting error response
 * @param {Object} response - Express response object
 * @param {Object} options - Rate limit options
 */
export function rateLimitErrorResponse(response, options = {}) {
  const { retryAfter = 60, operation = 'request' } = options;
  
  response.setHeader('Retry-After', retryAfter);
  response.setHeader('X-RateLimit-Limit', '100');
  response.setHeader('X-RateLimit-Remaining', '0');
  response.setHeader('X-RateLimit-Reset', new Date(Date.now() + retryAfter * 1000).toISOString());
  
  return sanitizedApiResponse(response, null, 'Too many requests. Please try again later.', 429, {
    operation
  });
}