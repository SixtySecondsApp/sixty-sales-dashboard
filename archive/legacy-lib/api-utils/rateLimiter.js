// Rate limiting utility for API endpoints
const rateLimitStore = new Map();
const ipRequestCounts = new Map();

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  windowMs: 60000, // 1 minute window
  maxRequests: 100, // Max requests per window per IP
  skipSuccessfulGET: true, // Don't count successful GET requests towards limit
  skipOPTIONS: true, // Don't count CORS preflight requests
  
  // Different limits for different endpoints
  endpoints: {
    '/api/dashboard': { maxRequests: 20, windowMs: 60000 },
    '/api/deals': { maxRequests: 50, windowMs: 60000 },
    '/api/health': { maxRequests: 200, windowMs: 60000 },
    '/api/deals/bulk': { maxRequests: 5, windowMs: 60000 }
  }
};

// Get client IP address from request
function getClientIP(request) {
  return request.headers['x-forwarded-for'] || 
         request.headers['x-real-ip'] || 
         request.connection?.remoteAddress || 
         request.socket?.remoteAddress ||
         '127.0.0.1';
}

// Create rate limit key
function createRateLimitKey(ip, endpoint) {
  return `${ip}:${endpoint}`;
}

// Check if request should be rate limited
export function checkRateLimit(request) {
  const ip = getClientIP(request);
  const method = request.method;
  const url = request.url.split('?')[0]; // Remove query params
  
  // Skip rate limiting for OPTIONS requests
  if (RATE_LIMIT_CONFIG.skipOPTIONS && method === 'OPTIONS') {
    return { allowed: true };
  }
  
  // Get rate limit config for this endpoint
  const endpointConfig = RATE_LIMIT_CONFIG.endpoints[url] || RATE_LIMIT_CONFIG;
  const key = createRateLimitKey(ip, url);
  const now = Date.now();
  const windowStart = now - endpointConfig.windowMs;
  
  // Get or create request history for this key
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, []);
  }
  
  const requests = rateLimitStore.get(key);
  
  // Remove old requests outside the window
  const validRequests = requests.filter(timestamp => timestamp > windowStart);
  rateLimitStore.set(key, validRequests);
  
  // Check if we're over the limit
  if (validRequests.length >= endpointConfig.maxRequests) {
    const resetTime = Math.ceil((validRequests[0] + endpointConfig.windowMs) / 1000);
    
    return {
      allowed: false,
      limit: endpointConfig.maxRequests,
      remaining: 0,
      resetTime,
      retryAfter: resetTime - Math.floor(now / 1000)
    };
  }
  
  // Add current request
  validRequests.push(now);
  rateLimitStore.set(key, validRequests);
  
  return {
    allowed: true,
    limit: endpointConfig.maxRequests,
    remaining: endpointConfig.maxRequests - validRequests.length,
    resetTime: Math.ceil((now + endpointConfig.windowMs) / 1000)
  };
}

// Add rate limit headers to response
export function addRateLimitHeaders(response, rateLimitResult) {
  if (rateLimitResult.limit) {
    response.setHeader('X-RateLimit-Limit', rateLimitResult.limit);
  }
  if (rateLimitResult.remaining !== undefined) {
    response.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining);
  }
  if (rateLimitResult.resetTime) {
    response.setHeader('X-RateLimit-Reset', rateLimitResult.resetTime);
  }
  if (rateLimitResult.retryAfter) {
    response.setHeader('Retry-After', rateLimitResult.retryAfter);
  }
}

// Rate limiting middleware
export function rateLimitMiddleware(request, response, next) {
  const rateLimitResult = checkRateLimit(request);
  
  addRateLimitHeaders(response, rateLimitResult);
  
  if (!rateLimitResult.allowed) {
    response.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: rateLimitResult.retryAfter,
      limit: rateLimitResult.limit
    });
    return false;
  }
  
  return true;
}

// Cleanup old entries periodically
function cleanupRateLimitStore() {
  const now = Date.now();
  const maxWindowMs = Math.max(...Object.values(RATE_LIMIT_CONFIG.endpoints).map(config => config.windowMs));
  const cutoff = now - maxWindowMs * 2; // Keep extra buffer
  
  let cleanedCount = 0;
  
  for (const [key, requests] of rateLimitStore.entries()) {
    const validRequests = requests.filter(timestamp => timestamp > cutoff);
    
    if (validRequests.length === 0) {
      rateLimitStore.delete(key);
      cleanedCount++;
    } else if (validRequests.length < requests.length) {
      rateLimitStore.set(key, validRequests);
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`Rate limiter cleanup: removed ${cleanedCount} expired entries`);
  }
}

// Whitelist for trusted IPs (for development)
const ipWhitelist = new Set([
  '127.0.0.1',
  '::1',
  'localhost'
]);

// Check if IP is whitelisted
export function isWhitelistedIP(ip) {
  return ipWhitelist.has(ip);
}

// Get rate limit statistics
export function getRateLimitStats() {
  const now = Date.now();
  const stats = {
    totalEntries: rateLimitStore.size,
    entriesByEndpoint: {},
    topIPs: {},
    windowSizes: RATE_LIMIT_CONFIG.endpoints
  };
  
  // Analyze entries by endpoint and IP
  for (const [key, requests] of rateLimitStore.entries()) {
    const [ip, endpoint] = key.split(':');
    
    // Count by endpoint
    if (!stats.entriesByEndpoint[endpoint]) {
      stats.entriesByEndpoint[endpoint] = 0;
    }
    stats.entriesByEndpoint[endpoint]++;
    
    // Count by IP (top 10)
    if (!stats.topIPs[ip]) {
      stats.topIPs[ip] = 0;
    }
    stats.topIPs[ip] += requests.length;
  }
  
  // Convert topIPs to sorted array
  stats.topIPs = Object.entries(stats.topIPs)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .reduce((obj, [ip, count]) => {
      obj[ip] = count;
      return obj;
    }, {});
  
  return stats;
}

// Initialize cleanup interval
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimitStore, 300000); // Clean every 5 minutes
}

export default {
  checkRateLimit,
  addRateLimitHeaders,
  rateLimitMiddleware,
  isWhitelistedIP,
  getRateLimitStats
};