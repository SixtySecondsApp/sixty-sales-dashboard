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
import { fileURLToPath } from 'url';

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
    // Check database connection
    // TODO: Add actual database connection check

    // Check Redis connection
    // TODO: Add actual Redis connection check

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
// STATIC FILE SERVING (Frontend)
// ============================================================================

const frontendPath = path.join(__dirname, 'frontend/dist');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendPath, 'index.html'));
    } else {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.path
      });
    }
  });
} else {
  console.warn('[WARN] Frontend build not found at:', frontendPath);
}

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
