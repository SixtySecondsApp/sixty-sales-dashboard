import { executeQuery, handleCORS, apiResponse, getPoolStats } from './_db.js';
import { getCacheStats } from './utils/cache.js';

export default async function handler(request, response) {
  const requestStartTime = Date.now();
  
  // Handle CORS preflight
  const corsResponse = handleCORS(request, response);
  if (corsResponse) return corsResponse;

  try {
    if (request.method === 'GET') {
      // Parse query parameters
      const urlParts = request.url.split('?');
      const queryString = urlParts[1] || '';
      const searchParams = new URLSearchParams(queryString);
      const { detailed = 'false' } = Object.fromEntries(searchParams);
      
      // Basic health check
      const dbStartTime = Date.now();
      const result = await executeQuery('SELECT NOW() as current_time, version() as db_version');
      const dbResponseTime = Date.now() - dbStartTime;
      
      const baseHealthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: {
          connected: true,
          version: result.rows[0]?.db_version?.split(' ')[0] || 'unknown',
          response_time: `${dbResponseTime}ms`,
          server_time: result.rows[0]?.current_time
        },
        api: {
          version: '2.0.0',
          environment: process.env.NODE_ENV || 'development',
          region: process.env.VERCEL_REGION || 'local',
          deployment: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 'local'
        }
      };

      // Add detailed metrics if requested
      if (detailed === 'true') {
        // Database pool statistics
        const poolStats = getPoolStats();
        if (poolStats) {
          baseHealthData.database.pool = {
            total_connections: poolStats.totalCount,
            idle_connections: poolStats.idleCount,
            waiting_requests: poolStats.waitingCount,
            max_pool_size: poolStats.maxPoolSize,
            min_pool_size: poolStats.minPoolSize,
            utilization: `${Math.round((poolStats.totalCount / poolStats.maxPoolSize) * 100)}%`
          };
        }

        // Cache statistics
        try {
          const cacheStats = getCacheStats();
          baseHealthData.cache = {
            hit_rate: cacheStats.hitRate,
            total_hits: cacheStats.hits,
            total_misses: cacheStats.misses,
            entries: cacheStats.size,
            max_entries: cacheStats.maxSize,
            memory_usage: `${Math.round(cacheStats.memoryUsage)}%`,
            evictions: cacheStats.evictions
          };
        } catch (cacheError) {
          baseHealthData.cache = { error: 'Cache stats unavailable' };
        }

        // System resource metrics (basic)
        baseHealthData.system = {
          memory: {
            used: process.memoryUsage().heapUsed,
            total: process.memoryUsage().heapTotal,
            external: process.memoryUsage().external,
            usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
          },
          uptime: `${Math.round(process.uptime())}s`,
          node_version: process.version
        };

        // Test additional database operations
        try {
          const [dealsCount, companiesCount, activitiesCount] = await Promise.all([
            executeQuery('SELECT COUNT(*) as count FROM deals'),
            executeQuery('SELECT COUNT(*) as count FROM companies'),  
            executeQuery('SELECT COUNT(*) as count FROM activities')
          ]);

          baseHealthData.database.tables = {
            deals: parseInt(dealsCount.rows[0].count),
            companies: parseInt(companiesCount.rows[0].count),
            activities: parseInt(activitiesCount.rows[0].count)
          };
        } catch (tableError) {
          baseHealthData.database.tables = { error: tableError.message };
        }
      }

      return apiResponse(response, baseHealthData, null, 200, {
        requestStartTime,
        enableCaching: false
      });
    }
    
    return apiResponse(response, null, 'Method not allowed', 405);
  } catch (error) {
    console.error('Health check failed:', error);
    
    const healthData = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        error: error.message,
        response_time: 'timeout'
      },
      api: {
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'development',
        region: process.env.VERCEL_REGION || 'local'
      },
      error_details: {
        type: error.constructor.name,
        code: error.code || 'UNKNOWN',
        query_preview: error.queryPreview || 'N/A'
      }
    };
    
    return apiResponse(response, healthData, null, 503, {
      requestStartTime
    });
  }
} 