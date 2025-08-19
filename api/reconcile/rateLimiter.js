// Rate Limiting Middleware for Reconciliation API Endpoints
// Prevents API abuse and protects against DoS attacks

import { supabase } from '../lib/supabase.js';

// In-memory rate limiting store (for simple implementation)
// In production, use Redis or database-backed rate limiting
const rateLimitStore = new Map();

// Rate limiting configuration
const RATE_LIMITS = {
  // Standard operations (per minute per user)
  standard: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    message: 'Too many reconciliation requests. Please try again in a minute.'
  },
  // Bulk operations (per hour per user)
  bulk: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    message: 'Too many bulk operations. Please try again in an hour.'
  },
  // Heavy operations like merge (per hour per user)
  heavy: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
    message: 'Too many merge operations. Please try again in an hour.'
  }
};

/**
 * Rate limiting middleware
 * @param {string} limitType - Type of limit: 'standard', 'bulk', 'heavy'
 * @returns {Function} Express middleware function
 */
export function createRateLimit(limitType = 'standard') {
  return async (req, res, next) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ 
          error: 'User ID is required for rate limiting' 
        });
      }

      const config = RATE_LIMITS[limitType];
      if (!config) {
        console.warn(`Unknown rate limit type: ${limitType}, using standard`);
        config = RATE_LIMITS.standard;
      }

      const key = `${userId}_${limitType}`;
      const now = Date.now();
      const windowStart = now - config.windowMs;

      // Get or create user's request history
      let userRequests = rateLimitStore.get(key) || [];
      
      // Remove requests outside the current window
      userRequests = userRequests.filter(timestamp => timestamp > windowStart);

      // Check if user has exceeded the limit
      if (userRequests.length >= config.maxRequests) {
        // Log rate limit violation for security monitoring
        await logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          userId,
          limitType,
          requestCount: userRequests.length,
          maxRequests: config.maxRequests,
          windowMs: config.windowMs,
          userAgent: req.headers['user-agent'],
          ip: req.ip || req.connection.remoteAddress,
          endpoint: req.path,
          method: req.method
        });

        return res.status(429).json({
          error: config.message,
          retryAfter: Math.ceil(config.windowMs / 1000),
          currentRequests: userRequests.length,
          maxRequests: config.maxRequests,
          windowMs: config.windowMs
        });
      }

      // Add current request to history
      userRequests.push(now);
      rateLimitStore.set(key, userRequests);

      // Clean up old entries periodically (prevent memory leaks)
      if (Math.random() < 0.01) { // 1% chance
        cleanupRateLimitStore();
      }

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', config.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - userRequests.length));
      res.setHeader('X-RateLimit-Reset', Math.ceil((windowStart + config.windowMs) / 1000));

      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Don't block requests on rate limiter errors
      next();
    }
  };
}

/**
 * Enhanced rate limiting for specific actions
 */
export const actionRateLimits = {
  // Manual linking operations
  link_manual: createRateLimit('standard'),
  
  // Create operations (more resource intensive)
  create_deal_from_activity: createRateLimit('bulk'),
  create_activity_from_deal: createRateLimit('bulk'),
  
  // Heavy operations
  merge_records: createRateLimit('heavy'),
  split_record: createRateLimit('heavy'),
  
  // Standard operations
  mark_duplicate: createRateLimit('standard'),
  undo_action: createRateLimit('standard')
};

/**
 * Database-backed rate limiting for enterprise use
 * @param {string} userId 
 * @param {string} limitType 
 * @param {string} action 
 * @returns {Promise<boolean>} true if request should be allowed
 */
export async function checkDatabaseRateLimit(userId, limitType, action) {
  try {
    const config = RATE_LIMITS[limitType];
    const windowStart = new Date(Date.now() - config.windowMs);

    // Get request count from database
    const { data, error } = await supabase
      .from('reconciliation_audit_log')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('action_type', action)
      .gte('executed_at', windowStart.toISOString());

    if (error) {
      console.error('Database rate limit check error:', error);
      return true; // Allow request on error
    }

    const requestCount = data?.length || 0;
    return requestCount < config.maxRequests;

  } catch (error) {
    console.error('Database rate limit error:', error);
    return true; // Allow request on error
  }
}

/**
 * Advanced rate limiting with user tier support
 */
export function createTieredRateLimit(action) {
  return async (req, res, next) => {
    try {
      const { userId } = req.body;
      
      // Get user tier from database
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('tier, rate_limit_multiplier')
        .eq('user_id', userId)
        .single();

      const baseLimitType = getBaseLimitType(action);
      const baseConfig = RATE_LIMITS[baseLimitType];
      
      // Adjust limits based on user tier
      const multiplier = userProfile?.rate_limit_multiplier || 1;
      const adjustedConfig = {
        ...baseConfig,
        maxRequests: Math.floor(baseConfig.maxRequests * multiplier)
      };

      // Apply adjusted rate limit
      const key = `${userId}_${action}_tiered`;
      const now = Date.now();
      const windowStart = now - adjustedConfig.windowMs;

      let userRequests = rateLimitStore.get(key) || [];
      userRequests = userRequests.filter(timestamp => timestamp > windowStart);

      if (userRequests.length >= adjustedConfig.maxRequests) {
        await logSecurityEvent('TIERED_RATE_LIMIT_EXCEEDED', {
          userId,
          action,
          tier: userProfile?.tier || 'standard',
          multiplier,
          requestCount: userRequests.length,
          maxRequests: adjustedConfig.maxRequests
        });

        return res.status(429).json({
          error: `Rate limit exceeded for ${action}. Upgrade your tier for higher limits.`,
          retryAfter: Math.ceil(adjustedConfig.windowMs / 1000),
          currentTier: userProfile?.tier || 'standard',
          currentRequests: userRequests.length,
          maxRequests: adjustedConfig.maxRequests
        });
      }

      userRequests.push(now);
      rateLimitStore.set(key, userRequests);

      res.setHeader('X-RateLimit-Tier', userProfile?.tier || 'standard');
      res.setHeader('X-RateLimit-Limit', adjustedConfig.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, adjustedConfig.maxRequests - userRequests.length));

      next();
    } catch (error) {
      console.error('Tiered rate limiting error:', error);
      next();
    }
  };
}

/**
 * IP-based rate limiting for additional security
 */
export function createIPRateLimit() {
  return async (req, res, next) => {
    try {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const key = `ip_${ip}`;
      const now = Date.now();
      const windowMs = 60 * 1000; // 1 minute
      const maxRequests = 100; // per IP per minute
      const windowStart = now - windowMs;

      let ipRequests = rateLimitStore.get(key) || [];
      ipRequests = ipRequests.filter(timestamp => timestamp > windowStart);

      if (ipRequests.length >= maxRequests) {
        await logSecurityEvent('IP_RATE_LIMIT_EXCEEDED', {
          ip,
          requestCount: ipRequests.length,
          maxRequests,
          userAgent: req.headers['user-agent'],
          endpoint: req.path
        });

        return res.status(429).json({
          error: 'Too many requests from this IP address. Please try again later.',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      ipRequests.push(now);
      rateLimitStore.set(key, ipRequests);

      next();
    } catch (error) {
      console.error('IP rate limiting error:', error);
      next();
    }
  };
}

/**
 * Helper functions
 */
function getBaseLimitType(action) {
  if (['create_deal_from_activity', 'create_activity_from_deal'].includes(action)) {
    return 'bulk';
  }
  if (['merge_records', 'split_record'].includes(action)) {
    return 'heavy';
  }
  return 'standard';
}

function cleanupRateLimitStore() {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  for (const [key, requests] of rateLimitStore.entries()) {
    if (Array.isArray(requests)) {
      const recentRequests = requests.filter(timestamp => now - timestamp < maxAge);
      if (recentRequests.length === 0) {
        rateLimitStore.delete(key);
      } else {
        rateLimitStore.set(key, recentRequests);
      }
    }
  }
}

async function logSecurityEvent(eventType, metadata) {
  try {
    await supabase
      .from('security_events')
      .insert({
        event_type: eventType,
        metadata,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

// Export rate limiting configurations for use in other modules
export { RATE_LIMITS };