import pkg from 'pg';

const { Client, Pool } = pkg;

// Database connection string - throw error if env var not set for security
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required but not set. Please configure your database connection.');
}

// Connection pool for better performance
let pool = null;

// Initialize connection pool
function initializePool() {
  if (!pool) {
    console.log('🔄 Initializing database connection pool...');
    
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      },
      // Pool configuration for optimal performance
      max: 15, // Reduced maximum number of clients in the pool for better resource management
      min: 3, // Increased minimum to ensure availability
      idleTimeoutMillis: 20000, // Reduced idle timeout for faster cleanup
      connectionTimeoutMillis: 8000, // Reduced connection timeout for faster failures
      query_timeout: 12000, // Reduced query timeout for better performance
      statement_timeout: 12000, // Reduced statement timeout
      idle_in_transaction_session_timeout: 10000, // Reduced idle transaction timeout
      
      // Pool-specific settings
      allowExitOnIdle: true, // Allow pool to close when all clients are idle
      maxUses: 5000, // Reduced max uses to cycle connections more frequently
      
      // Additional optimizations
      keepAlive: true, // Keep TCP connections alive
      keepAliveInitialDelayMillis: 10000, // Initial delay before keepalive
      
      // Advanced pool settings
      acquireTimeoutMillis: 8000, // Time to wait for connection acquisition
      createTimeoutMillis: 8000, // Time to wait for connection creation
      destroyTimeoutMillis: 5000, // Time to wait for connection destruction
      reapIntervalMillis: 1000, // How often to check for idle connections
      createRetryIntervalMillis: 200, // Retry interval for failed connections
    });

    // Pool event handlers for monitoring
    pool.on('connect', (client) => {
      console.log('🔗 New database client connected to pool');
    });

    pool.on('error', (err, client) => {
      console.error('❌ Unexpected error on idle database client:', err);
    });

    pool.on('remove', (client) => {
      console.log('🔄 Database client removed from pool');
    });

    console.log('✅ Database connection pool initialized');
  }
  return pool;
}

// Get a client from the pool (preferred method)
export async function getDbClient() {
  try {
    const dbPool = initializePool();
    const client = await dbPool.connect();
    console.log('🔗 Connected to database via pool');
    return client;
  } catch (error) {
    console.error('❌ Pool connection failed, falling back to direct connection');
    
    // Fallback to direct connection
    const client = new Client({
      connectionString: DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      },
      connectionTimeoutMillis: 10000,
      query_timeout: 15000,
      statement_timeout: 15000,
      idle_in_transaction_session_timeout: 15000
    });
    
    await client.connect();
    console.log('🔗 Connected to database directly');
    return client;
  }
}

// Get pool statistics with enhanced monitoring
export function getPoolStats() {
  if (!pool) return null;
  
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    maxPoolSize: pool.options.max,
    minPoolSize: pool.options.min,
    utilizationRate: ((pool.totalCount - pool.idleCount) / pool.options.max * 100).toFixed(2) + '%',
    healthStatus: pool.waitingCount > 5 ? 'overloaded' : pool.idleCount < 2 ? 'busy' : 'healthy'
  };
}

// Query optimization cache for frequently used queries
const queryCache = new Map();
const QUERY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100;

// Add query to cache
function cacheQuery(queryKey, result) {
  // Implement LRU eviction if cache is full
  if (queryCache.size >= MAX_CACHE_SIZE) {
    const firstKey = queryCache.keys().next().value;
    queryCache.delete(firstKey);
  }
  
  queryCache.set(queryKey, {
    result,
    timestamp: Date.now(),
    hitCount: 0
  });
}

// Get query from cache
function getCachedQuery(queryKey) {
  const cached = queryCache.get(queryKey);
  if (!cached) return null;
  
  // Check if expired
  if (Date.now() - cached.timestamp > QUERY_CACHE_TTL) {
    queryCache.delete(queryKey);
    return null;
  }
  
  cached.hitCount++;
  return cached.result;
}

// Generate cache key for query
function generateQueryKey(query, params) {
  const paramStr = params ? JSON.stringify(params) : '';
  return `${query.trim().substring(0, 100)}_${paramStr}`.replace(/\s+/g, ' ');
}

// Optimized query execution for SELECT operations
export async function executeOptimizedQuery(query, params = [], options = {}) {
  const { enableCache = false, cacheTTL = QUERY_CACHE_TTL } = options;
  
  // Only cache SELECT queries
  const isSelectQuery = query.trim().toUpperCase().startsWith('SELECT');
  
  if (enableCache && isSelectQuery) {
    const queryKey = generateQueryKey(query, params);
    const cached = getCachedQuery(queryKey);
    
    if (cached) {
      console.log(`🚀 Query cache HIT for: ${queryKey.substring(0, 50)}...`);
      return cached;
    }
  }
  
  // Execute query normally
  const result = await executeQuery(query, params, options);
  
  // Cache result if it's a SELECT query and caching is enabled
  if (enableCache && isSelectQuery && result) {
    const queryKey = generateQueryKey(query, params);
    cacheQuery(queryKey, result);
    console.log(`💾 Cached query result for: ${queryKey.substring(0, 50)}...`);
  }
  
  return result;
}

// Get cache statistics
export function getQueryCacheStats() {
  const entries = Array.from(queryCache.entries());
  const totalHits = entries.reduce((sum, [_, value]) => sum + value.hitCount, 0);
  
  return {
    size: queryCache.size,
    maxSize: MAX_CACHE_SIZE,
    totalHits,
    hitRate: entries.length > 0 ? (totalHits / entries.length).toFixed(2) : '0.00',
    oldestEntry: entries.length > 0 ? Math.min(...entries.map(([_, value]) => value.timestamp)) : null,
    utilizationRate: ((queryCache.size / MAX_CACHE_SIZE) * 100).toFixed(2) + '%'
  };
}

// Clear query cache
export function clearQueryCache() {
  const size = queryCache.size;
  queryCache.clear();
  console.log(`🗑️ Cleared query cache: ${size} entries removed`);
  return size;
}

// Enhanced query execution with performance monitoring and connection pooling
export async function executeQuery(query, params = [], options = {}) {
  const startTime = Date.now();
  const queryPreview = query.substring(0, 100).replace(/\s+/g, ' ').trim() + '...';
  console.log('🔄 Executing query:', queryPreview);
  
  let client;
  let isPooledConnection = false;
  
  try {
    client = await getDbClient();
    
    // Check if this is a pooled connection
    isPooledConnection = client.release !== undefined;
    
    // Set query timeout if specified
    if (options.timeout) {
      await client.query('SET statement_timeout = $1', [options.timeout]);
    }
    
    const result = await client.query(query, params);
    const duration = Date.now() - startTime;
    
    console.log(`✅ Query executed successfully: ${result.rows.length} rows, ${duration}ms`);
    
    // Log slow queries for optimization
    if (duration > 1000) {
      console.warn(`🐌 Slow query detected (${duration}ms):`, queryPreview);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Database query error (${duration}ms):`, {
      query: queryPreview,
      params: params?.length || 0,
      error: error.message
    });
    
    // Enhance error with context
    error.queryPreview = queryPreview;
    error.duration = duration;
    error.paramsCount = params?.length || 0;
    
    throw error;
  } finally {
    // Handle connection cleanup based on type
    if (client) {
      try {
        if (isPooledConnection) {
          // Release back to pool
          client.release();
          console.log('🔄 Connection released back to pool');
        } else {
          // Close direct connection
          await client.end();
          console.log('🔄 Direct connection closed');
        }
      } catch (closeError) {
        console.error('❌ Error releasing/closing connection:', closeError);
      }
    }
  }
}

// Batch query execution for better performance
export async function executeBatchQueries(queries, options = {}) {
  const startTime = Date.now();
  console.log(`🔄 Executing batch of ${queries.length} queries`);
  
  let client;
  let isPooledConnection = false;
  
  try {
    client = await getDbClient();
    isPooledConnection = client.release !== undefined;
    
    // Start transaction for batch operations
    await client.query('BEGIN');
    
    const results = [];
    for (const { query, params = [] } of queries) {
      const result = await client.query(query, params);
      results.push(result);
    }
    
    await client.query('COMMIT');
    
    const duration = Date.now() - startTime;
    console.log(`✅ Batch executed successfully: ${queries.length} queries, ${duration}ms`);
    
    return results;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Batch query error (${duration}ms):`, error.message);
    
    // Rollback on error
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('❌ Error rolling back transaction:', rollbackError);
      }
    }
    
    throw error;
  } finally {
    if (client) {
      try {
        if (isPooledConnection) {
          client.release();
          console.log('🔄 Batch connection released back to pool');
        } else {
          await client.end();
          console.log('🔄 Batch direct connection closed');
        }
      } catch (closeError) {
        console.error('❌ Error releasing/closing batch connection:', closeError);
      }
    }
  }
}

// Query with retry logic for transient failures
export async function executeQueryWithRetry(query, params = [], maxRetries = 3, retryDelay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await executeQuery(query, params);
    } catch (error) {
      lastError = error;
      
      // Don't retry on permanent errors
      if (error.code === '23505' || // unique violation
          error.code === '23503' || // foreign key violation
          error.code === '42P01' || // undefined table
          error.code === '42703') { // undefined column
        throw error;
      }
      
      if (attempt < maxRetries) {
        console.warn(`⚠️ Query attempt ${attempt} failed, retrying in ${retryDelay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay *= 2; // Exponential backoff
      }
    }
  }
  
  console.error(`❌ Query failed after ${maxRetries} attempts`);
  throw lastError;
}

// Enhanced API response handler with performance metrics and caching headers
export function apiResponse(response, data, error = null, status = 200, options = {}) {
  const {
    requestStartTime = Date.now(),
    cacheHit = false,
    cacheKey = null,
    enableCaching = false,
    cacheTTL = 300,
    operation = 'operation'
  } = options;
  
  // Calculate response time
  const responseTime = Date.now() - requestStartTime;
  
  // Set security headers
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('X-XSS-Protection', '1; mode=block');
  
  // CORS headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Performance headers
  response.setHeader('X-Response-Time', `${responseTime}ms`);
  response.setHeader('X-Timestamp', new Date().toISOString());
  
  // Cache headers
  if (cacheHit) {
    response.setHeader('X-Cache', 'HIT');
    if (cacheKey) response.setHeader('X-Cache-Key', cacheKey);
  } else if (enableCaching && status === 200 && !error) {
    response.setHeader('X-Cache', 'MISS');
    response.setHeader('Cache-Control', `public, max-age=${cacheTTL}`);
    if (cacheKey) response.setHeader('X-Cache-Key', cacheKey);
  }
  
  // Rate limiting headers (placeholder for future implementation)
  response.setHeader('X-RateLimit-Limit', '1000');
  response.setHeader('X-RateLimit-Remaining', '999');
  
  // SECURITY: Sanitize error messages to prevent data leakage
  let sanitizedError = null;
  let errorStatus = status;
  
  if (error) {
    if (typeof error === 'string') {
      sanitizedError = error;
    } else if (error instanceof Error) {
      // Log full error server-side but return sanitized message to client
      console.error(`API error during ${operation} (sanitized for client):`, {
        message: error.message,
        code: error.code,
        timestamp: new Date().toISOString(),
        // Don't log full error object to prevent sensitive data exposure
      });
      
      // Return generic error messages for common database errors
      const message = error.message || 'Unknown error';
      if (message.includes('duplicate key')) {
        sanitizedError = 'A record with this information already exists';
        errorStatus = 409;
      } else if (message.includes('foreign key')) {
        sanitizedError = 'Referenced record not found';
        errorStatus = 400;
      } else if (message.includes('PGRST')) {
        sanitizedError = 'Database service temporarily unavailable';
        errorStatus = 503;
      } else if (message.includes('JWT') || message.includes('authentication')) {
        sanitizedError = 'Authentication required';
        errorStatus = 401;
      } else if (message.includes('permission') || message.includes('unauthorized')) {
        sanitizedError = 'Permission denied';
        errorStatus = 403;
      } else if (message.includes('timeout')) {
        sanitizedError = 'Request timeout - please try again';
        errorStatus = 408;
      } else if (message.includes('connection')) {
        sanitizedError = 'Service temporarily unavailable';
        errorStatus = 503;
      } else if (message.includes('syntax error')) {
        sanitizedError = 'Invalid request format';
        errorStatus = 400;
      } else if (message.includes('invalid input')) {
        sanitizedError = 'Invalid input data';
        errorStatus = 400;
      } else {
        sanitizedError = `${operation.charAt(0).toUpperCase() + operation.slice(1)} failed. Please try again.`;
        errorStatus = 500;
      }
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
      cached: cacheHit,
      success: !sanitizedError
    }
  };
  
  // Log performance metrics
  if (responseTime > 1000) {
    console.warn(`🐌 Slow response: ${operation} took ${responseTime}ms`);
  }
  
  return response.status(sanitizedError ? errorStatus : status).json(responseBody);
}

// Specialized response for paginated data
export function paginatedResponse(response, data, pagination, options = {}) {
  const {
    page = 1,
    limit = 50,
    total = data?.length || 0,
    hasNext = false,
    hasPrev = false
  } = pagination;
  
  const enhancedOptions = {
    ...options,
    pagination: {
      page,
      limit,
      total,
      hasNext,
      hasPrev,
      totalPages: Math.ceil(total / limit)
    }
  };
  
  return apiResponse(response, data, null, 200, enhancedOptions);
}

// Handle CORS preflight requests for Vercel
export function handleCORS(request, response) {
  if (request.method === 'OPTIONS') {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return response.status(200).end();
  }
  return null;
} 