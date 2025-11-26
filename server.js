#!/usr/bin/env node
/**
 * Express Server for Multi-Tenant SaaS Backend
 *
 * This server handles:
 * - API endpoints for all CRM operations
 * - Authentication and authorization
 * - Database connections (per-customer isolated)
 * - Redis job queue integration
 * - Static file serving (frontend)
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import adminDb from './src/lib/adminDb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Simple logging function (morgan not required)
const simpleLog = (msg) => {
  console.log(`[${new Date().toISOString()}] ${msg}`);
};

// Constants
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CUSTOMER_ID = process.env.CUSTOMER_ID || 'unknown';
const IS_WORKER = process.env.IS_WORKER === 'true';

// ============================================================================
// CREATE EXPRESS APP
// ============================================================================

const app = express();

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Create logs directory if it doesn't exist
if (NODE_ENV === 'production') {
  const logsDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

// Simple HTTP request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    simpleLog(`${req.method} ${req.path} ${status} ${duration}ms`);
  });
  next();
});

// CORS - Allow requests from frontend
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Health check middleware
app.use((req, res, next) => {
  // Add customer context to all requests
  req.customer = {
    id: CUSTOMER_ID,
    name: process.env.CUSTOMER_NAME
  };
  next();
});

// ============================================================================
// HEALTH CHECK ENDPOINT
// ============================================================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    customer: CUSTOMER_ID,
    environment: NODE_ENV,
    uptime: process.uptime()
  });
});

// ============================================================================
// READINESS PROBE
// ============================================================================

let isReady = false;

// Check database and Redis connections on startup
const checkReadiness = async () => {
  try {
    // Initialize Admin DB connection pool
    adminDb.initializeAdminDb();
    const adminDbHealthy = await adminDb.checkAdminDbHealth();

    if (!adminDbHealthy) {
      throw new Error('Admin database health check failed');
    }
    console.log('[READY] Admin database connected');

    isReady = true;
    console.log('[READY] Server is ready to accept requests');
  } catch (error) {
    console.error('[NOTREADY] Server startup check failed:', error.message);
    setTimeout(checkReadiness, 5000); // Retry after 5 seconds
  }
};

app.get('/api/ready', (req, res) => {
  if (isReady) {
    res.json({ ready: true });
  } else {
    res.status(503).json({ ready: false, message: 'Server is still initializing' });
  }
});

// ============================================================================
// PLACEHOLDER API ROUTES (to be implemented)
// ============================================================================

// Deals CRUD
app.get('/api/deals', (req, res) => {
  res.json({
    message: 'GET /api/deals - Retrieve all deals',
    customer: CUSTOMER_ID,
    implemented: false
  });
});

app.post('/api/deals', (req, res) => {
  res.status(201).json({
    message: 'POST /api/deals - Create new deal',
    customer: CUSTOMER_ID,
    implemented: false
  });
});

app.get('/api/deals/:id', (req, res) => {
  res.json({
    message: 'GET /api/deals/:id - Retrieve specific deal',
    dealId: req.params.id,
    customer: CUSTOMER_ID,
    implemented: false
  });
});

app.put('/api/deals/:id', (req, res) => {
  res.json({
    message: 'PUT /api/deals/:id - Update deal',
    dealId: req.params.id,
    customer: CUSTOMER_ID,
    implemented: false
  });
});

app.delete('/api/deals/:id', (req, res) => {
  res.json({
    message: 'DELETE /api/deals/:id - Delete deal',
    dealId: req.params.id,
    customer: CUSTOMER_ID,
    implemented: false
  });
});

// Contacts CRUD
app.get('/api/contacts', (req, res) => {
  res.json({
    message: 'GET /api/contacts - Retrieve all contacts',
    customer: CUSTOMER_ID,
    implemented: false
  });
});

app.post('/api/contacts', (req, res) => {
  res.status(201).json({
    message: 'POST /api/contacts - Create new contact',
    customer: CUSTOMER_ID,
    implemented: false
  });
});

// Activities CRUD
app.get('/api/activities', (req, res) => {
  res.json({
    message: 'GET /api/activities - Retrieve all activities',
    customer: CUSTOMER_ID,
    implemented: false
  });
});

app.post('/api/activities', (req, res) => {
  res.status(201).json({
    message: 'POST /api/activities - Create new activity',
    customer: CUSTOMER_ID,
    implemented: false
  });
});

// Tasks CRUD
app.get('/api/tasks', (req, res) => {
  res.json({
    message: 'GET /api/tasks - Retrieve all tasks',
    customer: CUSTOMER_ID,
    implemented: false
  });
});

app.post('/api/tasks', (req, res) => {
  res.status(201).json({
    message: 'POST /api/tasks - Create new task',
    customer: CUSTOMER_ID,
    implemented: false
  });
});

// ============================================================================
// CUSTOMER PROVISIONING ENDPOINT
// ============================================================================

// Validation middleware for provisioning request
const validateProvisionRequest = (req, res, next) => {
  const { customerId, customerName, customerEmail, plan } = req.body;

  if (!customerId || !/^[a-z0-9_-]+$/.test(customerId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid customer ID. Must contain only lowercase letters, numbers, hyphens, and underscores'
    });
  }

  if (!customerName || customerName.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Customer name is required'
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!customerEmail || !emailRegex.test(customerEmail)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email address'
    });
  }

  if (!['starter', 'pro', 'enterprise'].includes(plan)) {
    return res.status(400).json({
      success: false,
      message: 'Plan must be one of: starter, pro, enterprise'
    });
  }

  next();
};

// Get default modules by plan
const getDefaultModulesByPlan = (plan) => {
  switch (plan) {
    case 'starter':
      return ['crm_core', 'advanced_pipeline'];
    case 'pro':
      return ['crm_core', 'advanced_pipeline', 'calendar_integration', 'workflow_automation'];
    case 'enterprise':
      return ['crm_core', 'advanced_pipeline', 'calendar_integration', 'ai_assistant',
              'workflow_automation', 'analytics_reporting', 'api_access'];
    default:
      return ['crm_core'];
  }
};

// Provision new customer endpoint
app.post('/api/provision', validateProvisionRequest, async (req, res) => {
  const { customerId, customerName, customerEmail, plan, modules, timezone = 'UTC' } = req.body;

  try {
    const pool = adminDb.getAdminPool();

    // Check if customer already exists
    const existingCustomer = await pool.query(
      'SELECT id FROM admin_customers WHERE company_domain = $1 AND deleted_at IS NULL',
      [customerId]
    );

    if (existingCustomer.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Customer with ID '${customerId}' already exists`
      });
    }

    // Determine modules
    const modulesToEnable = modules || getDefaultModulesByPlan(plan);

    // Insert customer into admin database
    const insertCustomerResult = await pool.query(
      `INSERT INTO admin_customers (
        company_name, company_domain, subscription_plan, subscription_status,
        billing_email, database_host, database_port, database_name,
        database_user, database_password_encrypted,
        clerk_org_id, clerk_admin_user_id,
        use_customer_ai_keys, timezone,
        trial_started_at, trial_ends_at, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW()
      ) RETURNING id`,
      [
        customerName,
        customerId,
        plan,
        'trial',
        customerEmail,
        'localhost',
        5432,
        `${customerId}_db`,
        `${customerId}_user`,
        'temp-password',
        `clerk_org_${customerId}`,
        `clerk_user_${customerId}`,
        false,
        timezone,
        new Date(),
        new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      ]
    );

    const customerUuid = insertCustomerResult.rows[0].id;
    console.log(`[PROVISION] Customer created: ${customerId} (${customerUuid})`);

    // Assign feature modules
    const moduleResults = await pool.query(
      'SELECT id, module_key FROM admin_feature_modules WHERE module_key = ANY($1)',
      [modulesToEnable]
    );

    for (const moduleRow of moduleResults.rows) {
      await pool.query(
        'INSERT INTO admin_customer_modules (customer_id, module_id, enabled) VALUES ($1, $2, true)',
        [customerUuid, moduleRow.id]
      );
    }

    console.log(`[PROVISION] Assigned ${moduleResults.rows.length} modules to ${customerId}`);

    // Generate API key
    const key = `sk_${crypto.randomBytes(32).toString('hex')}`;
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    const prefix = key.substring(0, 20);

    const apiKeyResult = await pool.query(
      `INSERT INTO admin_api_keys (
        customer_id, key_hash, key_prefix, name, description,
        permissions, rate_limit_requests, rate_limit_period,
        status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING id`,
      [
        customerUuid,
        hash,
        prefix,
        'default',
        'Default API key generated during provisioning',
        JSON.stringify(['read:*', 'write:*', 'execute:workflows']),
        1000,
        'month',
        'active'
      ]
    );

    const apiKeyId = apiKeyResult.rows[0].id;

    // Log to audit log
    await pool.query(
      `INSERT INTO admin_audit_logs (
        customer_id, action, resource_type, resource_id,
        new_values, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        customerUuid,
        'customer_created',
        'customer',
        customerUuid,
        JSON.stringify({
          name: customerName,
          email: customerEmail,
          plan,
          provisioned_by: 'api_endpoint'
        })
      ]
    );

    return res.status(201).json({
      success: true,
      customerId,
      customerUuid,
      apiKey: {
        key,
        keyId: apiKeyId,
        prefix
      },
      enabledModules: modulesToEnable,
      message: `Customer '${customerName}' provisioned successfully with plan '${plan}'`
    });
  } catch (error) {
    console.error('[PROVISION ERROR]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to provision customer',
      error: error.message
    });
  }
});

// Get provisioning status
app.get('/api/provision/:customerId', async (req, res) => {
  const { customerId } = req.params;

  try {
    const customer = await adminDb.getCustomerByDomain(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: `Customer '${customerId}' not found`
      });
    }

    const modules = await adminDb.getCustomerEnabledModules(customer.id);
    const apiKeys = await adminDb.getCustomerApiKeys(customer.id);

    return res.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.company_name,
        domain: customer.company_domain,
        plan: customer.subscription_plan,
        status: customer.subscription_status,
        createdAt: customer.created_at
      },
      modules: modules.map((m) => ({ name: m.module_name, enabled: m.enabled })),
      apiKeys: apiKeys.map((k) => ({ id: k.id, prefix: k.key_prefix, name: k.name, status: k.status }))
    });
  } catch (error) {
    console.error('[PROVISION GET ERROR]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve provisioning status',
      error: error.message
    });
  }
});

// ============================================================================
// STATIC FILE SERVING (Frontend)
// ============================================================================

// Try both possible paths for frontend build
let frontendPath = path.join(__dirname, 'frontend/dist');
if (!fs.existsSync(frontendPath)) {
  // Fallback to dist in root
  frontendPath = path.join(__dirname, 'dist');
}

if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  console.log('[INFO] Serving frontend from:', frontendPath);
} else {
  console.warn('[WARN] Frontend build not found at:', frontendPath);
}

// ============================================================================
// SPA FALLBACK (Must be after all other routes)
// ============================================================================

// Serve index.html for all non-API routes (SPA mode)
app.use((req, res, next) => {
  // Only for non-API routes
  if (!req.path.startsWith('/api')) {
    const indexPath = path.join(frontendPath || __dirname, 'dist', 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  next();
});

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    method: req.method
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);

  const statusCode = err.status || 500;
  const message = NODE_ENV === 'production' ? 'Internal Server Error' : err.message;

  res.status(statusCode).json({
    error: message,
    statusCode,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

// Check readiness on startup
checkReadiness();

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════╗
║   Multi-Tenant SaaS Backend Server         ║
╠════════════════════════════════════════════╣
║ Environment:  ${NODE_ENV.padEnd(31)} ║
║ Port:         ${PORT.toString().padEnd(31)} ║
║ Customer:     ${CUSTOMER_ID.padEnd(31)} ║
║ Mode:         ${(IS_WORKER ? 'Worker' : 'App').padEnd(31)} ║
║ Started:      ${new Date().toISOString()} ║
╚════════════════════════════════════════════╝
  `);

  if (!IS_WORKER) {
    console.log(`✓ API Server listening on http://0.0.0.0:${PORT}`);
    console.log(`✓ Health check: GET http://localhost:${PORT}/api/health`);
  } else {
    console.log(`✓ Worker process started for customer: ${CUSTOMER_ID}`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SHUTDOWN] SIGTERM received, graceful shutdown...');
  server.close(() => {
    console.log('[SHUTDOWN] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[SHUTDOWN] SIGINT received, graceful shutdown...');
  server.close(() => {
    console.log('[SHUTDOWN] Server closed');
    process.exit(0);
  });
});

// Unhandled promise rejection
process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Unhandled exception
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception:', error);
  process.exit(1);
});

export default app;
