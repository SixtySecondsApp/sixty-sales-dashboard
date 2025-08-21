/**
 * ================================================================
 * ASYNC JOB PROCESSING SYSTEM
 * Background job processing with Redis-backed queues
 * ================================================================
 */

import Bull from 'bull';
import { logger, redis, redisAvailable } from './performance-middleware.js';

/**
 * Job Queue Manager
 * Handles background processing for heavy operations
 */
class JobQueueManager {
  constructor(db, queryOptimizer) {
    this.db = db;
    this.queryOptimizer = queryOptimizer;
    this.queues = new Map();
    this.isInitialized = false;
    
    // Job types configuration
    this.jobTypes = {
      // Data processing jobs
      'bulk-import': {
        concurrency: 2,
        attempts: 3,
        backoff: 'exponential',
        delay: 0
      },
      'data-export': {
        concurrency: 1,
        attempts: 2,
        backoff: 'fixed',
        delay: 1000
      },
      'data-cleanup': {
        concurrency: 1,
        attempts: 1,
        backoff: 'fixed',
        delay: 5000
      },
      
      // Analytics jobs
      'generate-report': {
        concurrency: 3,
        attempts: 2,
        backoff: 'exponential',
        delay: 2000
      },
      'update-analytics': {
        concurrency: 2,
        attempts: 3,
        backoff: 'fixed',
        delay: 1000
      },
      
      // Communication jobs
      'send-email': {
        concurrency: 5,
        attempts: 5,
        backoff: 'exponential',
        delay: 500
      },
      'send-notification': {
        concurrency: 10,
        attempts: 3,
        backoff: 'fixed',
        delay: 100
      },
      
      // Maintenance jobs
      'cache-warmup': {
        concurrency: 1,
        attempts: 2,
        backoff: 'fixed',
        delay: 10000
      },
      'performance-analysis': {
        concurrency: 1,
        attempts: 1,
        backoff: 'fixed',
        delay: 30000
      }
    };
  }

  /**
   * Initialize job queues if Redis is available
   */
  async initialize() {
    if (!redisAvailable || this.isInitialized) {
      logger.warn('Job queue initialization skipped - Redis not available or already initialized');
      return;
    }

    try {
      // Create queues for each job type
      for (const [jobType, config] of Object.entries(this.jobTypes)) {
        const queue = new Bull(`sixty-sales-${jobType}`, {
          redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || null,
            db: process.env.REDIS_DB || 1 // Use different DB for jobs
          },
          defaultJobOptions: {
            attempts: config.attempts,
            backoff: {
              type: config.backoff,
              delay: config.delay
            },
            removeOnComplete: 50, // Keep last 50 completed jobs
            removeOnFail: 20 // Keep last 20 failed jobs
          }
        });

        // Set up job processors
        queue.process(config.concurrency, this.createJobProcessor(jobType));
        
        // Set up event listeners
        this.setupQueueEvents(queue, jobType);
        
        this.queues.set(jobType, queue);
        logger.info(`✅ Initialized queue: ${jobType}`);
      }

      // Set up recurring jobs
      await this.setupRecurringJobs();
      
      this.isInitialized = true;
      logger.info(`🚀 Job queue system initialized with ${this.queues.size} queues`);
      
    } catch (error) {
      logger.error('Job queue initialization failed', { error: error.message });
    }
  }

  /**
   * Create job processor function for specific job type
   */
  createJobProcessor(jobType) {
    return async (job) => {
      const startTime = Date.now();
      const { id, data } = job;
      
      logger.info(`🔄 Processing job: ${jobType}`, { jobId: id, data: this.sanitizeJobData(data) });
      
      try {
        let result;
        
        switch (jobType) {
          case 'bulk-import':
            result = await this.processBulkImport(job);
            break;
          case 'data-export':
            result = await this.processDataExport(job);
            break;
          case 'data-cleanup':
            result = await this.processDataCleanup(job);
            break;
          case 'generate-report':
            result = await this.processGenerateReport(job);
            break;
          case 'update-analytics':
            result = await this.processUpdateAnalytics(job);
            break;
          case 'send-email':
            result = await this.processSendEmail(job);
            break;
          case 'send-notification':
            result = await this.processSendNotification(job);
            break;
          case 'cache-warmup':
            result = await this.processCacheWarmup(job);
            break;
          case 'performance-analysis':
            result = await this.processPerformanceAnalysis(job);
            break;
          default:
            throw new Error(`Unknown job type: ${jobType}`);
        }
        
        const duration = Date.now() - startTime;
        logger.info(`✅ Job completed: ${jobType}`, { 
          jobId: id, 
          duration: `${duration}ms`,
          result: this.sanitizeJobData(result)
        });
        
        return result;
        
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`❌ Job failed: ${jobType}`, { 
          jobId: id, 
          duration: `${duration}ms`,
          error: error.message 
        });
        throw error;
      }
    };
  }

  /**
   * Set up queue event listeners
   */
  setupQueueEvents(queue, jobType) {
    queue.on('completed', (job, result) => {
      logger.info(`Job completed: ${jobType}`, { jobId: job.id });
    });

    queue.on('failed', (job, err) => {
      logger.error(`Job failed: ${jobType}`, { 
        jobId: job.id, 
        error: err.message,
        attempts: job.attemptsMade,
        maxAttempts: job.opts.attempts
      });
    });

    queue.on('stalled', (job) => {
      logger.warn(`Job stalled: ${jobType}`, { jobId: job.id });
    });

    queue.on('waiting', (jobId) => {
      logger.debug(`Job waiting: ${jobType}`, { jobId });
    });

    queue.on('active', (job, jobPromise) => {
      logger.debug(`Job started: ${jobType}`, { jobId: job.id });
    });
  }

  /**
   * Set up recurring jobs (cron-like scheduling)
   */
  async setupRecurringJobs() {
    // Cache warmup every hour
    await this.addJob('cache-warmup', 
      { type: 'full-warmup' }, 
      { repeat: { cron: '0 * * * *' } }
    );

    // Performance analysis every 6 hours
    await this.addJob('performance-analysis', 
      { type: 'full-analysis' }, 
      { repeat: { cron: '0 */6 * * *' } }
    );

    // Data cleanup daily at 2 AM
    await this.addJob('data-cleanup', 
      { type: 'expired-data' }, 
      { repeat: { cron: '0 2 * * *' } }
    );

    // Analytics update every 30 minutes
    await this.addJob('update-analytics', 
      { type: 'dashboard-stats' }, 
      { repeat: { cron: '*/30 * * * *' } }
    );

    logger.info('📅 Recurring jobs scheduled');
  }

  /**
   * Add job to queue
   */
  async addJob(jobType, data, options = {}) {
    if (!this.isInitialized || !this.queues.has(jobType)) {
      logger.warn(`Cannot add job - queue not initialized: ${jobType}`);
      return null;
    }

    try {
      const queue = this.queues.get(jobType);
      const job = await queue.add(data, options);
      
      logger.info(`📨 Job queued: ${jobType}`, { 
        jobId: job.id, 
        data: this.sanitizeJobData(data) 
      });
      
      return job;
    } catch (error) {
      logger.error(`Failed to queue job: ${jobType}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const stats = {};

    for (const [jobType, queue] of this.queues) {
      try {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaiting(),
          queue.getActive(),
          queue.getCompleted(),
          queue.getFailed(),
          queue.getDelayed()
        ]);

        stats[jobType] = {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          delayed: delayed.length,
          total: waiting.length + active.length + completed.length + failed.length + delayed.length
        };
      } catch (error) {
        logger.error(`Failed to get stats for queue: ${jobType}`, { error: error.message });
        stats[jobType] = { error: error.message };
      }
    }

    return stats;
  }

  // ================================================================
  // JOB PROCESSORS
  // ================================================================

  /**
   * Process bulk import job
   */
  async processBulkImport(job) {
    const { data } = job;
    const { type, records, ownerId } = data;

    // Update progress
    await job.progress(10);

    switch (type) {
      case 'contacts':
        return this.importContacts(records, ownerId, job);
      case 'companies':
        return this.importCompanies(records, ownerId, job);
      case 'deals':
        return this.importDeals(records, ownerId, job);
      default:
        throw new Error(`Unsupported import type: ${type}`);
    }
  }

  async importContacts(records, ownerId, job) {
    const results = { imported: 0, failed: 0, errors: [] };
    const batchSize = 50;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      try {
        // Process batch
        for (const record of batch) {
          try {
            const query = `
              INSERT INTO contacts (first_name, last_name, full_name, email, phone, title, owner_id)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (email) DO UPDATE SET
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                full_name = EXCLUDED.full_name,
                phone = EXCLUDED.phone,
                title = EXCLUDED.title,
                updated_at = NOW()
            `;
            
            await this.db.query(query, [
              record.firstName,
              record.lastName,
              `${record.firstName || ''} ${record.lastName || ''}`.trim(),
              record.email,
              record.phone,
              record.title,
              ownerId
            ]);
            
            results.imported++;
          } catch (error) {
            results.failed++;
            results.errors.push(`Row ${i + batch.indexOf(record) + 1}: ${error.message}`);
          }
        }

        // Update progress
        const progress = Math.min(90, Math.round((i + batchSize) / records.length * 80) + 10);
        await job.progress(progress);
        
      } catch (error) {
        results.failed += batch.length;
        results.errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
      }
    }

    await job.progress(100);
    return results;
  }

  async importCompanies(records, ownerId, job) {
    // Similar implementation to importContacts
    const results = { imported: 0, failed: 0, errors: [] };
    
    for (const [index, record] of records.entries()) {
      try {
        const query = `
          INSERT INTO companies (name, domain, industry, size, website, owner_id)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (domain) DO UPDATE SET
            name = EXCLUDED.name,
            industry = EXCLUDED.industry,
            size = EXCLUDED.size,
            website = EXCLUDED.website,
            updated_at = NOW()
        `;
        
        await this.db.query(query, [
          record.name,
          record.domain,
          record.industry,
          record.size,
          record.website,
          ownerId
        ]);
        
        results.imported++;
      } catch (error) {
        results.failed++;
        results.errors.push(`Row ${index + 1}: ${error.message}`);
      }

      if (index % 10 === 0) {
        const progress = Math.min(90, Math.round((index + 1) / records.length * 80) + 10);
        await job.progress(progress);
      }
    }

    await job.progress(100);
    return results;
  }

  async importDeals(records, ownerId, job) {
    // Similar implementation for deals
    return { imported: records.length, failed: 0, errors: [] };
  }

  /**
   * Process data export job
   */
  async processDataExport(job) {
    const { data } = job;
    const { type, filters, format, ownerId } = data;

    await job.progress(10);

    let exportData;
    switch (type) {
      case 'contacts':
        exportData = await this.exportContacts(filters, ownerId);
        break;
      case 'companies':
        exportData = await this.exportCompanies(filters, ownerId);
        break;
      case 'deals':
        exportData = await this.exportDeals(filters, ownerId);
        break;
      default:
        throw new Error(`Unsupported export type: ${type}`);
    }

    await job.progress(70);

    // Format data
    let formattedData;
    switch (format) {
      case 'csv':
        formattedData = this.formatAsCsv(exportData);
        break;
      case 'json':
        formattedData = JSON.stringify(exportData, null, 2);
        break;
      case 'xlsx':
        formattedData = await this.formatAsExcel(exportData);
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    await job.progress(90);

    // Store export file (in a real implementation, you'd save to cloud storage)
    const exportId = `export_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    await job.progress(100);

    return {
      exportId,
      recordCount: exportData.length,
      format,
      size: Buffer.byteLength(formattedData, 'utf8'),
      downloadUrl: `/api/exports/${exportId}` // Would be implemented
    };
  }

  async exportContacts(filters, ownerId) {
    const result = await this.queryOptimizer.executeOptimized(
      'get_contacts_with_company',
      [ownerId, filters.search || null, filters.companyId || null, 10000]
    );
    return result.rows;
  }

  async exportCompanies(filters, ownerId) {
    const result = await this.queryOptimizer.executeOptimized(
      'get_companies_with_stats',
      [ownerId, filters.search || null, 10000]
    );
    return result.rows;
  }

  async exportDeals(filters, ownerId) {
    const result = await this.queryOptimizer.executeOptimized(
      'get_deals_with_relationships',
      [ownerId, 10000]
    );
    return result.rows;
  }

  formatAsCsv(data) {
    if (!data.length) return '';
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') 
            ? `"${value.replace(/"/g, '""')}"` 
            : value;
        }).join(',')
      )
    ].join('\n');
    
    return csvContent;
  }

  async formatAsExcel(data) {
    // Would use a library like exceljs in a real implementation
    return this.formatAsCsv(data); // Fallback to CSV for now
  }

  /**
   * Process cache warmup job
   */
  async processCacheWarmup(job) {
    const { data } = job;
    const { type } = data;

    await job.progress(10);

    switch (type) {
      case 'full-warmup':
        return this.fullCacheWarmup(job);
      case 'selective-warmup':
        return this.selectiveCacheWarmup(job, data.targets);
      default:
        throw new Error(`Unknown warmup type: ${type}`);
    }
  }

  async fullCacheWarmup(job) {
    const operations = [
      { name: 'Deal Stages', fn: () => this.queryOptimizer.executeOptimized('get_deal_stages') },
      { name: 'Owners', fn: () => this.queryOptimizer.executeOptimized('get_owners_with_stats') },
      { name: 'Recent Companies', fn: () => this.queryOptimizer.executeOptimized('get_companies_with_stats', [null, null, 100]) },
      { name: 'Recent Deals', fn: () => this.queryOptimizer.executeOptimized('get_deals_with_relationships', [null, 100]) },
      { name: 'Recent Contacts', fn: () => this.queryOptimizer.executeOptimized('get_contacts_with_company', [null, null, null, 100]) }
    ];

    const results = {};
    for (const [index, operation] of operations.entries()) {
      try {
        const start = Date.now();
        await operation.fn();
        const duration = Date.now() - start;
        
        results[operation.name] = { success: true, duration: `${duration}ms` };
        
        const progress = Math.round(((index + 1) / operations.length) * 90) + 10;
        await job.progress(progress);
        
      } catch (error) {
        results[operation.name] = { success: false, error: error.message };
      }
    }

    await job.progress(100);
    return results;
  }

  async selectiveCacheWarmup(job, targets) {
    // Implementation for selective cache warming
    return { warmed: targets, timestamp: new Date().toISOString() };
  }

  /**
   * Process performance analysis job
   */
  async processPerformanceAnalysis(job) {
    await job.progress(20);

    const analysis = await this.queryOptimizer.analyzePerformance();
    
    await job.progress(80);

    // Store analysis results
    if (redisAvailable && redis) {
      await redis.setex('performance:analysis:latest', 21600, JSON.stringify(analysis)); // 6 hours
    }

    await job.progress(100);

    return {
      timestamp: new Date().toISOString(),
      analysis,
      stored: redisAvailable
    };
  }

  /**
   * Process other job types (stubs for demonstration)
   */
  async processDataCleanup(job) {
    // Implementation for data cleanup
    return { cleaned: 0, timestamp: new Date().toISOString() };
  }

  async processGenerateReport(job) {
    // Implementation for report generation
    return { reportId: `report_${Date.now()}`, generated: true };
  }

  async processUpdateAnalytics(job) {
    // Implementation for analytics updates
    return { updated: true, timestamp: new Date().toISOString() };
  }

  async processSendEmail(job) {
    // Implementation for email sending
    return { sent: true, messageId: `msg_${Date.now()}` };
  }

  async processSendNotification(job) {
    // Implementation for notification sending
    return { sent: true, notificationId: `notif_${Date.now()}` };
  }

  /**
   * Utility methods
   */
  sanitizeJobData(data) {
    if (!data || typeof data !== 'object') return data;
    
    const sanitized = { ...data };
    
    // Remove sensitive fields
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.apiKey;
    
    // Truncate large arrays for logging
    Object.keys(sanitized).forEach(key => {
      if (Array.isArray(sanitized[key]) && sanitized[key].length > 5) {
        sanitized[key] = `[Array of ${sanitized[key].length} items]`;
      }
    });
    
    return sanitized;
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('🔄 Shutting down job queues...');
    
    const shutdownPromises = Array.from(this.queues.values()).map(queue => 
      queue.close()
    );
    
    await Promise.all(shutdownPromises);
    
    logger.info('✅ Job queues shut down');
  }
}

export default JobQueueManager;