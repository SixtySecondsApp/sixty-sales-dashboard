/**
 * ================================================================
 * PRODUCTION-SCALE PERFORMANCE MIDDLEWARE
 * Advanced optimization layer for 10x scale preparation
 * ================================================================
 */

import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import pino from 'pino';
import pinoHttp from 'pino-http';
import Redis from 'ioredis';
import FastJsonStringify from 'fast-json-stringify';

// ================================================================
// STRUCTURED LOGGING CONFIGURATION
// ================================================================

/**
 * Production-grade structured logging with APM integration
 */
const logger = pino({
  name: 'sixty-sales-api',
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  formatters: {
    level: (label) => ({ level: label.toUpperCase() }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
      version: process.env.npm_package_version || '1.0.0'
    })
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: {
        'user-agent': req.headers['user-agent'],
        'accept': req.headers.accept,
        'content-type': req.headers['content-type']
      },
      remoteAddress: req.remoteAddress,
      remotePort: req.remotePort
    }),
    res: (res) => ({
      statusCode: res.statusCode,
      headers: res.getHeaders()
    }),
    err: pino.stdSerializers.err
  },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie'],
    censor: '[REDACTED]'
  }
});

// ================================================================
// REDIS CACHE CONFIGURATION
// ================================================================

/**
 * Production Redis configuration with clustering support
 */
let redis = null;
let redisAvailable = false;

try {
  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || null,
    db: process.env.REDIS_DB || 0,
    
    // Connection pool settings
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    enableOfflineQueue: false,
    
    // Performance settings
    lazyConnect: true,
    keepAlive: 30000,
    connectTimeout: 10000,
    commandTimeout: 5000,
    
    // Memory optimization
    maxMemoryPolicy: 'allkeys-lru'
  });

  redis.on('connect', () => {
    redisAvailable = true;
    logger.info('✅ Redis connected successfully');
  });

  redis.on('error', (err) => {
    redisAvailable = false;
    logger.warn('⚠️ Redis connection failed, falling back to in-memory cache', { error: err.message });
  });

  redis.on('close', () => {
    redisAvailable = false;
    logger.warn('🔌 Redis connection closed');
  });

} catch (error) {
  logger.warn('⚠️ Redis initialization failed, using memory cache only', { error: error.message });
}

// ================================================================
// JSON SERIALIZATION OPTIMIZATION
// ================================================================

/**
 * Pre-compiled JSON serializers for common response formats
 */
const jsonSerializers = {
  // Standard API response format
  apiResponse: FastJsonStringify({
    type: 'object',
    properties: {
      data: { type: ['object', 'array', 'null'] },
      error: { type: ['string', 'null'] },
      count: { type: 'integer' },
      pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          hasMore: { type: 'boolean' }
        }
      },
      meta: {
        type: 'object',
        properties: {
          timestamp: { type: 'string' },
          version: { type: 'string' },
          requestId: { type: 'string' }
        }
      }
    }
  }),

  // Performance stats response
  performanceStats: FastJsonStringify({
    type: 'object',
    properties: {
      queries: { type: 'integer' },
      cacheHits: { type: 'integer' },
      cacheMisses: { type: 'integer' },
      cacheHitRatio: { type: 'string' },
      errors: { type: 'integer' },
      pool: {
        type: 'object',
        properties: {
          total: { type: 'integer' },
          idle: { type: 'integer' },
          waiting: { type: 'integer' }
        }
      }
    }
  }),

  // Health check response
  healthCheck: FastJsonStringify({
    type: 'object',
    properties: {
      status: { type: 'string' },
      database: { type: 'string' },
      redis: { type: 'string' },
      timestamp: { type: 'string' },
      uptime: { type: 'number' },
      memory: {
        type: 'object',
        properties: {
          used: { type: 'number' },
          total: { type: 'number' },
          percentage: { type: 'number' }
        }
      }
    }
  })
};

// ================================================================
// COMPRESSION MIDDLEWARE
// ================================================================

/**
 * Intelligent compression with Brotli support
 */
const compressionMiddleware = compression({
  // Use Brotli if supported, fallback to gzip
  level: 6, // Balanced compression vs CPU
  threshold: 1024, // Only compress responses > 1KB
  
  // Custom filter for what to compress
  filter: (req, res) => {
    // Don't compress if explicitly disabled
    if (req.headers['x-no-compression']) {
      return false;
    }
    
    // Don't compress already compressed content
    if (res.getHeader('content-encoding')) {
      return false;
    }
    
    // Don't compress small images or videos
    const contentType = res.getHeader('content-type') || '';
    if (contentType.startsWith('image/') || contentType.startsWith('video/')) {
      return false;
    }
    
    // Compress text, JSON, HTML, CSS, JavaScript
    return compression.filter(req, res);
  }
});

// ================================================================
// SECURITY MIDDLEWARE
// ================================================================

/**
 * Production security headers with CSP
 */
const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.sixty-sales.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false, // Disable for API
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// ================================================================
// RATE LIMITING CONFIGURATION
// ================================================================

/**
 * Multi-tier rate limiting strategy
 */

// Store for rate limiting (Redis if available, memory otherwise)
const rateLimitStore = redisAvailable ? {
  // Redis store implementation
  async get(key) {
    try {
      const result = await redis.get(`ratelimit:${key}`);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      logger.warn('Rate limit Redis get error', { key, error: error.message });
      return null;
    }
  },
  
  async set(key, value, ttl) {
    try {
      await redis.setex(`ratelimit:${key}`, ttl, JSON.stringify(value));
    } catch (error) {
      logger.warn('Rate limit Redis set error', { key, error: error.message });
    }
  },
  
  async increment(key, ttl) {
    try {
      const result = await redis.multi()
        .incr(`ratelimit:${key}`)
        .expire(`ratelimit:${key}`, ttl)
        .exec();
      return parseInt(result[0][1]);
    } catch (error) {
      logger.warn('Rate limit Redis increment error', { key, error: error.message });
      return 1;
    }
  }
} : undefined;

// Global rate limiting
const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window per IP
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: rateLimitStore,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health';
  }
});

// API-specific rate limiting (more restrictive)
const apiRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 API calls per minute per IP
  message: {
    error: 'API rate limit exceeded, please slow down.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: rateLimitStore
});

// Expensive operations rate limiting
const expensiveOperationsLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 expensive operations per 5 minutes
  message: {
    error: 'Too many expensive operations, please wait before retrying.',
    retryAfter: '5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: rateLimitStore,
  skip: (req) => {
    // Apply only to stats and complex queries
    const expensivePaths = ['/api/companies?includeStats=true', '/api/performance/'];
    return !expensivePaths.some(path => req.path.includes(path));
  }
});

// Slow down middleware (progressive delay)
const slowDownMiddleware = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 100, // Allow 100 requests per window without delay
  delayMs: (used, req) => {
    const delayMs = (used - 100) * 100; // Increase delay by 100ms for each request over the limit
    return Math.min(delayMs, 3000); // Cap at 3 seconds
  },
  maxDelayMs: 3000,
  skipFailedRequests: true,
  skipSuccessfulRequests: false
});

// ================================================================
// PERFORMANCE MONITORING MIDDLEWARE
// ================================================================

/**
 * Request performance monitoring with metrics collection
 */
const performanceMonitoring = (req, res, next) => {
  const start = process.hrtime.bigint();
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  
  // Attach request ID
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  // Track memory usage
  const initialMemory = process.memoryUsage();
  
  // Override res.json to measure response size and use optimized serialization
  const originalJson = res.json;
  res.json = function(data) {
    const responseSize = Buffer.byteLength(JSON.stringify(data), 'utf8');
    
    // Use optimized serializer if available
    let serializedData;
    if (data && typeof data === 'object') {
      if (data.hasOwnProperty('queries') && data.hasOwnProperty('cacheHits')) {
        // Performance stats response
        serializedData = jsonSerializers.performanceStats(data);
      } else if (data.hasOwnProperty('status') && data.hasOwnProperty('database')) {
        // Health check response
        serializedData = jsonSerializers.healthCheck(data);
      } else {
        // Standard API response
        serializedData = jsonSerializers.apiResponse(data);
      }
    }
    
    if (serializedData) {
      res.setHeader('Content-Type', 'application/json');
      res.send(serializedData);
    } else {
      originalJson.call(this, data);
    }
    
    // Log performance metrics
    const duration = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
    const finalMemory = process.memoryUsage();
    const memoryDelta = finalMemory.heapUsed - initialMemory.heapUsed;
    
    // Log performance data
    logger.info('Request completed', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration.toFixed(2)}ms`,
      responseSize: `${(responseSize / 1024).toFixed(2)}KB`,
      memoryDelta: `${(memoryDelta / 1024 / 1024).toFixed(2)}MB`
    });
    
    // Store metrics in Redis if available (for dashboard)
    if (redisAvailable && redis) {
      const metrics = {
        timestamp: Date.now(),
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        responseSize,
        memoryDelta
      };
      
      redis.lpush('performance:metrics', JSON.stringify(metrics))
        .then(() => redis.ltrim('performance:metrics', 0, 999)) // Keep last 1000 metrics
        .catch(err => logger.warn('Failed to store performance metrics', { error: err.message }));
    }
  };
  
  next();
};

// ================================================================
// CACHING MIDDLEWARE
// ================================================================

/**
 * Smart caching middleware with Redis backing
 */
const cacheMiddleware = (options = {}) => {
  const {
    ttl = 300, // 5 minutes default
    keyGenerator = (req) => `cache:${req.method}:${req.originalUrl}`,
    condition = () => true
  } = options;
  
  return async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET' || !condition(req)) {
      return next();
    }
    
    const cacheKey = keyGenerator(req);
    
    try {
      // Try to get from Redis first
      if (redisAvailable && redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const data = JSON.parse(cached);
          res.setHeader('X-Cache', 'HIT');
          res.setHeader('X-Cache-TTL', await redis.ttl(cacheKey));
          return res.json(data);
        }
      }
      
      // Cache miss - intercept response
      const originalJson = res.json;
      res.json = function(data) {
        // Store in Redis if available
        if (redisAvailable && redis && res.statusCode === 200) {
          redis.setex(cacheKey, ttl, JSON.stringify(data))
            .catch(err => logger.warn('Cache set failed', { cacheKey, error: err.message }));
        }
        
        res.setHeader('X-Cache', 'MISS');
        originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      logger.warn('Cache middleware error', { cacheKey, error: error.message });
      next();
    }
  };
};

// ================================================================
// REQUEST BATCHING UTILITIES
// ================================================================

/**
 * Utilities for batch request processing
 */
const batchUtils = {
  /**
   * Validate batch request structure
   */
  validateBatchRequest(body) {
    if (!Array.isArray(body) || body.length === 0) {
      throw new Error('Batch request must be a non-empty array');
    }
    
    if (body.length > 50) {
      throw new Error('Batch size cannot exceed 50 requests');
    }
    
    for (const [index, request] of body.entries()) {
      if (!request.method || !request.path) {
        throw new Error(`Invalid request at index ${index}: method and path are required`);
      }
      
      if (!['GET', 'POST', 'PUT', 'DELETE'].includes(request.method)) {
        throw new Error(`Invalid method at index ${index}: ${request.method}`);
      }
    }
    
    return true;
  },
  
  /**
   * Process batch requests in parallel with concurrency control
   */
  async processBatch(requests, app, maxConcurrency = 10) {
    const results = [];
    const chunks = [];
    
    // Split into chunks for concurrency control
    for (let i = 0; i < requests.length; i += maxConcurrency) {
      chunks.push(requests.slice(i, i + maxConcurrency));
    }
    
    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(
        chunk.map(async (request, index) => {
          try {
            // Simulate Express request/response
            const mockReq = {
              method: request.method,
              path: request.path,
              query: request.query || {},
              body: request.body || {},
              headers: request.headers || {}
            };
            
            const mockRes = {
              statusCode: 200,
              headers: {},
              data: null,
              json(data) {
                this.data = data;
              },
              status(code) {
                this.statusCode = code;
                return this;
              },
              setHeader(name, value) {
                this.headers[name] = value;
              }
            };
            
            // This would need to be implemented based on your routing logic
            // For now, return a placeholder
            return {
              id: request.id || index,
              status: 200,
              data: { message: 'Batch processing not fully implemented yet' }
            };
            
          } catch (error) {
            return {
              id: request.id || index,
              status: 500,
              error: error.message
            };
          }
        })
      );
      
      results.push(...chunkResults.map(result => result.value || result.reason));
    }
    
    return results;
  }
};

// ================================================================
// EXPORTS
// ================================================================

export {
  logger,
  redis,
  redisAvailable,
  compressionMiddleware,
  securityMiddleware,
  globalRateLimit,
  apiRateLimit,
  expensiveOperationsLimit,
  slowDownMiddleware,
  performanceMonitoring,
  cacheMiddleware,
  jsonSerializers,
  batchUtils,
  
  // HTTP logging middleware
  httpLogger: pinoHttp({ logger })
};