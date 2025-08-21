#!/usr/bin/env node

/**
 * ================================================================
 * PRODUCTION-OPTIMIZED API SERVER
 * Advanced backend with 10x scale preparation
 * ================================================================
 */

import express from 'express';
import cors from 'cors';
import { expressMiddleware } from '@apollo/server/express4';

// Import optimized components
import db from './connection-pooling.js';
import {
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
  httpLogger
} from './performance-middleware.js';

import QueryOptimizer from './query-optimizer.js';
import BatchProcessor from './batch-api.js';
import JobQueueManager from './job-queue.js';
import { cursorPagination } from './pagination-utils.js';
import { createGraphQLServer } from './graphql-server.js';

// ================================================================
// SERVER CONFIGURATION
// ================================================================

const app = express();
const PORT = process.env.PORT || 8000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize optimized components
const queryOptimizer = new QueryOptimizer(db.pool);
const batchProcessor = new BatchProcessor(app, db);
const jobQueue = new JobQueueManager(db, queryOptimizer);

// ================================================================
// MIDDLEWARE STACK (Order matters for performance)
// ================================================================

// 1. Security headers (first for all requests)
app.use(securityMiddleware);

// 2. Compression (early for all responses)
app.use(compressionMiddleware);

// 3. HTTP logging (structured logging)
app.use(httpLogger);

// 4. Performance monitoring (request tracking)
app.use(performanceMonitoring);

// 5. Rate limiting (protect against abuse)
app.use(globalRateLimit);
app.use('/api', apiRateLimit);
app.use('/api/companies', expensiveOperationsLimit);
app.use('/api/performance', expensiveOperationsLimit);

// 6. Slow down middleware (progressive delays)
app.use(slowDownMiddleware);

// 7. CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}));

// 8. Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ================================================================
// ENHANCED API ENDPOINTS
// ================================================================

// User endpoint (cached for 5 minutes)
app.get('/api/user', cacheMiddleware({ ttl: 300 }), (req, res) => {
  res.json({
    id: 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459',
    email: 'andrew.bryce@sixtyseconds.video',
    first_name: 'Andrew',
    last_name: 'Bryce',
    stage: 'Director',
    is_admin: true,
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
});

// Enhanced companies endpoint with pagination and caching
app.get('/api/companies', async (req, res) => {
  try {
    const { search, includeStats, limit, ownerId, cursor, direction } = req.query;
    
    // Parse pagination parameters
    const pagination = cursorPagination.parsePaginationParams({
      cursor,
      limit: parseInt(limit) || 50,
      direction
    });

    let result;
    if (includeStats === 'true') {
      result = await queryOptimizer.executeOptimized(
        'get_companies_with_stats',
        [ownerId || null, search ? `%${search}%` : null, pagination.limit + 1]
      );
    } else {
      result = await queryOptimizer.executeOptimized(
        'get_companies_simple',
        [ownerId || null, search ? `%${search}%` : null, pagination.limit + 1]
      );
    }

    const response = cursorPagination.createResponse(result.rows, pagination.limit, pagination.direction);
    
    res.json(response);
  } catch (error) {
    logger.error('Companies endpoint error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Enhanced deals endpoint with optimized queries
app.get('/api/deals', async (req, res) => {
  try {
    const { includeRelationships, limit, ownerId, cursor, direction } = req.query;
    
    const pagination = cursorPagination.parsePaginationParams({
      cursor,
      limit: parseInt(limit) || 50,
      direction
    });

    let result;
    if (includeRelationships === 'true') {
      result = await queryOptimizer.executeOptimized(
        'get_deals_with_relationships',
        [ownerId || null, pagination.limit + 1]
      );
    } else {
      result = await queryOptimizer.executeOptimized(
        'get_deals_simple',
        [ownerId || null, pagination.limit + 1]
      );
    }

    const response = cursorPagination.createResponse(result.rows, pagination.limit, pagination.direction);
    
    res.json(response);
  } catch (error) {
    logger.error('Deals endpoint error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Enhanced contacts endpoint with optimized queries
app.get('/api/contacts', async (req, res) => {
  try {
    const { id, search, companyId, includeCompany, limit, ownerId, stats, deals, activities, owner, tasks, cursor, direction } = req.query;
    
    // Handle individual contact requests with sub-resources
    if (id && id.trim() !== '') {
      return handleContactSubResources(req, res, id, queryOptimizer);
    }
    
    const pagination = cursorPagination.parsePaginationParams({
      cursor,
      limit: parseInt(limit) || 50,
      direction
    });

    let result;
    if (includeCompany === 'true') {
      result = await queryOptimizer.executeOptimized(
        'get_contacts_with_company',
        [ownerId || null, search ? `%${search}%` : null, companyId || null, pagination.limit + 1]
      );
    } else {
      result = await queryOptimizer.executeOptimized(
        'get_contacts_simple',
        [ownerId || null, search ? `%${search}%` : null, companyId || null, pagination.limit + 1]
      );
    }

    const response = cursorPagination.createResponse(result.rows, pagination.limit, pagination.direction);
    
    res.json(response);
  } catch (error) {
    logger.error('Contacts endpoint error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Contact sub-resources with optimized queries
async function handleContactSubResources(req, res, contactId, optimizer) {
  const { stats, deals, activities, owner, tasks } = req.query;
  
  try {
    if (stats === 'true') {
      const result = await optimizer.executeOptimized('get_contact_stats', [contactId]);
      return res.json({ data: result.rows[0] || {}, error: null });
    }
    
    if (deals === 'true') {
      const result = await optimizer.executeOptimized('get_contact_deals', [contactId]);
      return res.json({ data: result.rows, error: null, count: result.rows.length });
    }
    
    if (activities === 'true') {
      const limit = parseInt(req.query.limit) || 10;
      const result = await optimizer.executeOptimized('get_contact_activities', [contactId, limit]);
      return res.json({ data: result.rows, error: null, count: result.rows.length });
    }
    
    if (owner === 'true') {
      const result = await db.query(
        'SELECT p.id, p.first_name, p.last_name, p.stage, p.email, p.avatar_url, c.created_at as assigned_date FROM contacts c LEFT JOIN profiles p ON c.owner_id = p.id WHERE c.id = $1',
        [contactId]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Contact or owner not found', data: null });
      }
      
      const row = result.rows[0];
      const ownerData = {
        id: row.id,
        name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
        first_name: row.first_name,
        last_name: row.last_name,
        title: row.stage,
        email: row.email,
        avatar_url: row.avatar_url,
        assigned_date: row.assigned_date
      };
      
      return res.json({ data: ownerData, error: null });
    }
    
    if (tasks === 'true') {
      const tasksQuery = `
        SELECT 'activity' as source, a.id::text as id, a.type || ' follow-up' as title,
               'Follow up on ' || a.type || ' activity' as description, 'medium' as priority,
               a.created_at + INTERVAL '3 days' as due_date, false as completed
        FROM activities a WHERE a.contact_id = $1 AND a.created_at > NOW() - INTERVAL '30 days'
        UNION ALL
        SELECT 'deal' as source, d.id::text as id, 'Follow up on deal' as title,
               'Check progress on deal worth £' || COALESCE(d.value::text, 'unknown') as description,
               CASE WHEN d.value > 10000 THEN 'high' WHEN d.value > 5000 THEN 'medium' ELSE 'low' END as priority,
               d.updated_at + INTERVAL '7 days' as due_date,
               CASE WHEN d.status = 'won' THEN true ELSE false END as completed
        FROM deals d WHERE (d.primary_contact_id = $1 OR d.id IN (SELECT deal_id FROM deal_contacts WHERE contact_id = $1))
        AND d.status != 'lost'
        ORDER BY due_date DESC LIMIT 10
      `;
      
      const result = await db.query(tasksQuery, [contactId]);
      return res.json({ data: result.rows, error: null, count: result.rows.length });
    }
    
    // Single contact fallback
    const contactResult = await db.query(
      'SELECT ct.*, c.id as company_id, c.name as company_name, c.domain as company_domain FROM contacts ct LEFT JOIN companies c ON ct.company_id = c.id WHERE ct.id = $1',
      [contactId]
    );
    
    if (contactResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found', data: null });
    }
    
    const row = contactResult.rows[0];
    const data = {
      ...row,
      companies: row.company_id ? {
        id: row.company_id,
        name: row.company_name,
        domain: row.company_domain
      } : null
    };
    
    res.json({ data, error: null });
  } catch (error) {
    logger.error('Contact sub-resource error', { contactId, error: error.message });
    res.status(500).json({ error: error.message });
  }
}

// Deal operations with optimized database access
app.post('/api/deals', async (req, res) => {
  try {
    const dealData = req.body;
    
    const {
      name,
      company = name,
      value = 0,
      company_id = null,
      primary_contact_id = null,
      stage_id,
      probability = 50,
      expected_close_date = null,
      description = '',
      owner_id = 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459',
      contact_identifier = null,
      contact_identifier_type = 'unknown',
      contact_name = ''
    } = dealData;
    
    if (!name) {
      return res.status(400).json({ error: 'Deal name is required' });
    }
    
    let finalStageId = stage_id;
    if (!finalStageId) {
      const stageResult = await queryOptimizer.executeOptimized('get_deal_stages');
      if (stageResult.rows.length > 0) {
        finalStageId = stageResult.rows[0].id;
      }
    }
    
    const query = `
      INSERT INTO deals (
        name, company, value, company_id, primary_contact_id, stage_id,
        probability, expected_close_date, description, owner_id,
        contact_identifier, contact_identifier_type, contact_name,
        stage_changed_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
      ) RETURNING *
    `;
    
    const params = [
      name, company, value, company_id, primary_contact_id, finalStageId,
      probability, expected_close_date, description, owner_id,
      contact_identifier, contact_identifier_type, contact_name
    ];
    
    const result = await db.query(query, params);
    
    res.status(201).json({
      data: result.rows[0],
      error: null
    });
  } catch (error) {
    logger.error('Create deal error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Batch API endpoint
app.post('/api/batch', async (req, res) => {
  try {
    const requests = req.body;
    
    if (!Array.isArray(requests)) {
      return res.status(400).json({ error: 'Request body must be an array of batch requests' });
    }
    
    const result = await batchProcessor.processBatch(requests);
    res.json(result);
  } catch (error) {
    logger.error('Batch processing error', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

// Enhanced health check
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    
    let redisStatus = 'disconnected';
    if (redisAvailable && redis) {
      try {
        await redis.ping();
        redisStatus = 'connected';
      } catch (error) {
        redisStatus = 'error';
      }
    }
    
    const memoryUsage = process.memoryUsage();
    
    const healthData = {
      status: 'healthy',
      database: 'connected',
      redis: redisStatus,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
      },
      environment: NODE_ENV,
      version: process.env.npm_package_version || '1.0.0'
    };
    
    res.json(healthData);
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(500).json({ 
      status: 'unhealthy', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Performance statistics
app.get('/api/performance/stats', async (req, res) => {
  try {
    const dbStats = db.getStats();
    const queryStats = queryOptimizer.getQueryStats();
    const queueStats = await jobQueue.getQueueStats();
    
    const performanceData = {
      ...dbStats,
      queryOptimization: queryStats,
      jobQueues: queueStats,
      redis: {
        available: redisAvailable,
        connected: redisAvailable && redis ? await redis.ping().then(() => true).catch(() => false) : false
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      }
    };
    
    res.json(performanceData);
  } catch (error) {
    logger.error('Performance stats error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ================================================================
// SERVER INITIALIZATION
// ================================================================

async function initializeServer() {
  try {
    logger.info('🚀 Starting production-optimized server...');
    
    // Initialize query optimizer
    await queryOptimizer.initializePreparedStatements();
    
    // Initialize job queue system
    await jobQueue.initialize();
    
    // Initialize GraphQL server
    const graphqlServer = await createGraphQLServer(db, queryOptimizer, batchProcessor, cursorPagination);
    
    // Mount GraphQL endpoint
    app.use('/graphql', expressMiddleware(graphqlServer, {
      context: async ({ req, res }) => ({
        req,
        res,
        user: null,
        db,
        queryOptimizer,
        logger
      })
    }));
    
    // Start HTTP server
    const server = app.listen(PORT, '127.0.0.1', () => {
      logger.info(`🚀 Production API Server running on http://127.0.0.1:${PORT}`);
      logger.info(`📊 Companies API: http://127.0.0.1:${PORT}/api/companies`);
      logger.info(`👥 Contacts API: http://127.0.0.1:${PORT}/api/contacts`);
      logger.info(`📋 Deals API: http://127.0.0.1:${PORT}/api/deals`);
      logger.info(`🔄 Batch API: http://127.0.0.1:${PORT}/api/batch`);
      logger.info(`🎯 GraphQL API: http://127.0.0.1:${PORT}/graphql`);
      logger.info(`📈 Performance Stats: http://127.0.0.1:${PORT}/api/performance/stats`);
      logger.info(`❤️ Health Check: http://127.0.0.1:${PORT}/api/health`);
      
      if (redisAvailable) {
        logger.info('✅ Redis caching enabled');
      } else {
        logger.warn('⚠️ Redis not available - using memory cache only');
      }
    });
    
    // Graceful shutdown handling
    const gracefulShutdown = async (signal) => {
      logger.info(`📥 Received ${signal}, starting graceful shutdown...`);
      
      server.close(async () => {
        try {
          await Promise.all([
            db.close(),
            jobQueue.shutdown(),
            graphqlServer?.stop()
          ]);
          
          if (redis) {
            await redis.disconnect();
          }
          
          logger.info('✅ Server shutdown complete');
          process.exit(0);
        } catch (error) {
          logger.error('❌ Error during shutdown', { error: error.message });
          process.exit(1);
        }
      });
    };
    
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    logger.error('Server initialization failed', { error: error.message });
    process.exit(1);
  }
}

// Start the server
initializeServer();