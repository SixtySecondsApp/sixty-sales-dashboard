const express = require('express');
const client = require('prom-client');
const Docker = require('dockerode');
const cron = require('node-cron');
const winston = require('winston');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const CONFIG = {
  port: process.env.PORT || 8080,
  checkInterval: process.env.CHECK_INTERVAL || 30, // seconds
  memoryThresholds: {
    warning: parseInt(process.env.MEMORY_THRESHOLD_WARNING) || 80, // percentage
    critical: parseInt(process.env.MEMORY_THRESHOLD_CRITICAL) || 90, // percentage
  },
  containerLimits: {
    'sixty-api-optimized': 384 * 1024 * 1024, // 384MB in bytes
    'sixty-frontend-optimized': 128 * 1024 * 1024, // 128MB in bytes
    'sixty-redis-optimized': 64 * 1024 * 1024, // 64MB in bytes
    'sixty-postgres-optimized': 512 * 1024 * 1024, // 512MB in bytes
  },
  slackWebhook: process.env.SLACK_WEBHOOK_URL,
  alertEmail: process.env.ALERT_EMAIL,
};

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: '/app/logs/memory-monitor.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ],
});

// Docker client
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// Prometheus metrics
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ timeout: 5000 });

// Custom metrics
const containerMemoryUsage = new client.Gauge({
  name: 'container_memory_usage_percentage',
  help: 'Container memory usage as percentage of limit',
  labelNames: ['container_name', 'image']
});

const containerMemoryLimit = new client.Gauge({
  name: 'container_memory_limit_bytes',
  help: 'Container memory limit in bytes',
  labelNames: ['container_name', 'image']
});

const memoryAlerts = new client.Counter({
  name: 'memory_alerts_total',
  help: 'Total number of memory alerts triggered',
  labelNames: ['container_name', 'severity', 'type']
});

const systemMemoryUsage = new client.Gauge({
  name: 'system_memory_usage_percentage',
  help: 'System memory usage percentage'
});

// Express app
const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage()
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(client.register.metrics());
});

// Alert endpoint
app.post('/alert', async (req, res) => {
  try {
    const { container, severity, message } = req.body;
    await sendAlert(container, severity, message);
    res.json({ success: true });
  } catch (error) {
    logger.error('Alert endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Container status endpoint
app.get('/containers', async (req, res) => {
  try {
    const containers = await getContainerStats();
    res.json(containers);
  } catch (error) {
    logger.error('Container status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Memory monitoring functions
async function getSystemMemoryUsage() {
  try {
    const meminfo = await fs.readFile('/proc/meminfo', 'utf8');
    const lines = meminfo.split('\n');
    
    let memTotal = 0;
    let memAvailable = 0;
    
    lines.forEach(line => {
      if (line.startsWith('MemTotal:')) {
        memTotal = parseInt(line.split(/\s+/)[1]) * 1024; // Convert kB to bytes
      } else if (line.startsWith('MemAvailable:')) {
        memAvailable = parseInt(line.split(/\s+/)[1]) * 1024; // Convert kB to bytes
      }
    });
    
    const usedMemory = memTotal - memAvailable;
    const usagePercentage = (usedMemory / memTotal) * 100;
    
    return {
      total: memTotal,
      available: memAvailable,
      used: usedMemory,
      usagePercentage
    };
  } catch (error) {
    logger.error('Failed to get system memory usage:', error);
    return null;
  }
}

async function getContainerStats() {
  try {
    const containers = await docker.listContainers({ all: false });
    const stats = [];
    
    for (const containerInfo of containers) {
      const container = docker.getContainer(containerInfo.Id);
      const containerStats = await container.stats({ stream: false });
      
      const memoryUsage = containerStats.memory_stats.usage || 0;
      const memoryLimit = containerStats.memory_stats.limit || 0;
      const memoryPercentage = memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0;
      
      const containerName = containerInfo.Names[0].substring(1); // Remove leading slash
      const image = containerInfo.Image;
      
      // Update Prometheus metrics
      containerMemoryUsage.set(
        { container_name: containerName, image: image },
        memoryPercentage
      );
      
      containerMemoryLimit.set(
        { container_name: containerName, image: image },
        memoryLimit
      );
      
      stats.push({
        name: containerName,
        image: image,
        memoryUsage: memoryUsage,
        memoryLimit: memoryLimit,
        memoryPercentage: memoryPercentage,
        cpuPercentage: calculateCpuPercentage(containerStats),
        status: containerInfo.State
      });
      
      // Check for memory threshold violations
      await checkMemoryThresholds(containerName, memoryUsage, memoryLimit, memoryPercentage);
    }
    
    return stats;
  } catch (error) {
    logger.error('Failed to get container stats:', error);
    return [];
  }
}

function calculateCpuPercentage(stats) {
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - (stats.precpu_stats.cpu_usage?.total_usage || 0);
  const systemDelta = stats.cpu_stats.system_cpu_usage - (stats.precpu_stats.system_cpu_usage || 0);
  const numberCpus = stats.cpu_stats.online_cpus || 1;
  
  if (systemDelta > 0 && cpuDelta > 0) {
    return (cpuDelta / systemDelta) * numberCpus * 100;
  }
  return 0;
}

async function checkMemoryThresholds(containerName, memoryUsage, memoryLimit, memoryPercentage) {
  const configLimit = CONFIG.containerLimits[containerName];
  
  // Check against configured limits
  if (configLimit && memoryUsage > configLimit) {
    const severity = 'critical';
    const message = `Container ${containerName} exceeded configured memory limit: ${Math.round(memoryUsage / 1024 / 1024)}MB > ${Math.round(configLimit / 1024 / 1024)}MB`;
    
    memoryAlerts.inc({ container_name: containerName, severity, type: 'limit_exceeded' });
    await sendAlert(containerName, severity, message);
    
    logger.warn(message);
  }
  
  // Check percentage thresholds
  if (memoryPercentage > CONFIG.memoryThresholds.critical) {
    const severity = 'critical';
    const message = `Container ${containerName} critical memory usage: ${memoryPercentage.toFixed(2)}%`;
    
    memoryAlerts.inc({ container_name: containerName, severity, type: 'percentage_critical' });
    await sendAlert(containerName, severity, message);
    
    logger.warn(message);
  } else if (memoryPercentage > CONFIG.memoryThresholds.warning) {
    const severity = 'warning';
    const message = `Container ${containerName} high memory usage: ${memoryPercentage.toFixed(2)}%`;
    
    memoryAlerts.inc({ container_name: containerName, severity, type: 'percentage_warning' });
    logger.info(message);
  }
}

async function sendAlert(container, severity, message) {
  const alertData = {
    container,
    severity,
    message,
    timestamp: new Date().toISOString(),
    hostname: process.env.HOSTNAME || 'unknown'
  };
  
  // Send to Slack if configured
  if (CONFIG.slackWebhook) {
    try {
      const slackMessage = {
        text: `🚨 Memory Alert - ${severity.toUpperCase()}`,
        attachments: [{
          color: severity === 'critical' ? 'danger' : 'warning',
          fields: [
            { title: 'Container', value: container, short: true },
            { title: 'Severity', value: severity.toUpperCase(), short: true },
            { title: 'Message', value: message, short: false },
            { title: 'Time', value: alertData.timestamp, short: true }
          ]
        }]
      };
      
      await axios.post(CONFIG.slackWebhook, slackMessage);
      logger.info('Alert sent to Slack');
    } catch (error) {
      logger.error('Failed to send Slack alert:', error);
    }
  }
  
  // Log alert
  logger.warn('Memory alert triggered:', alertData);
}

// Monitoring task
async function performMemoryCheck() {
  try {
    logger.info('Performing memory check...');
    
    // System memory check
    const systemMemory = await getSystemMemoryUsage();
    if (systemMemory) {
      systemMemoryUsage.set(systemMemory.usagePercentage);
      
      if (systemMemory.usagePercentage > CONFIG.memoryThresholds.critical) {
        await sendAlert('system', 'critical', 
          `System memory usage critical: ${systemMemory.usagePercentage.toFixed(2)}%`);
      }
    }
    
    // Container memory check
    const containerStats = await getContainerStats();
    logger.info(`Checked ${containerStats.length} containers`);
    
    // Log summary
    const highMemoryContainers = containerStats.filter(c => c.memoryPercentage > CONFIG.memoryThresholds.warning);
    if (highMemoryContainers.length > 0) {
      logger.info(`High memory containers: ${highMemoryContainers.map(c => 
        `${c.name}(${c.memoryPercentage.toFixed(1)}%)`).join(', ')}`);
    }
    
  } catch (error) {
    logger.error('Memory check failed:', error);
  }
}

// Cleanup old alerts
async function cleanupOldAlerts() {
  try {
    const logFile = '/app/logs/memory-monitor.log';
    const stats = await fs.stat(logFile);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    // Rotate log if it's larger than 10MB
    if (fileSizeMB > 10) {
      const backupFile = `/app/logs/memory-monitor.log.${Date.now()}.bak`;
      await fs.rename(logFile, backupFile);
      logger.info(`Log file rotated to ${backupFile}`);
    }
  } catch (error) {
    // Log file might not exist yet
    logger.debug('Log cleanup skipped:', error.message);
  }
}

// Schedule monitoring tasks
cron.schedule(`*/${CONFIG.checkInterval} * * * * *`, performMemoryCheck);
cron.schedule('0 0 * * *', cleanupOldAlerts); // Daily log cleanup

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

// Start server
app.listen(CONFIG.port, () => {
  logger.info(`Memory monitor started on port ${CONFIG.port}`);
  logger.info(`Check interval: ${CONFIG.checkInterval} seconds`);
  logger.info(`Memory thresholds: Warning ${CONFIG.memoryThresholds.warning}%, Critical ${CONFIG.memoryThresholds.critical}%`);
  
  // Perform initial check
  performMemoryCheck();
});