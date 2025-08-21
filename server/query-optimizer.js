/**
 * ================================================================
 * ADVANCED QUERY OPTIMIZATION SYSTEM
 * Prepared statements, query analysis, and performance optimization
 * ================================================================
 */

import { logger } from './performance-middleware.js';

/**
 * Query optimization and prepared statement manager
 */
class QueryOptimizer {
  constructor(pool) {
    this.pool = pool;
    this.preparedStatements = new Map();
    this.queryStats = new Map();
    this.slowQueryThreshold = 100; // 100ms
    this.analysisEnabled = process.env.NODE_ENV !== 'production';
  }

  /**
   * Prepare and cache commonly used queries
   */
  async initializePreparedStatements() {
    const statements = {
      // Companies queries
      'get_companies_with_stats': {
        name: 'get_companies_with_stats',
        text: `
          SELECT 
            c.*,
            COALESCE(contact_counts.contact_count, 0) as contact_count,
            COALESCE(deal_counts.deal_count, 0) as deals_count,
            COALESCE(deal_counts.deal_value, 0) as deals_value
          FROM companies c
          LEFT JOIN (
            SELECT company_id, COUNT(*) as contact_count
            FROM contacts 
            WHERE company_id IS NOT NULL
            GROUP BY company_id
          ) contact_counts ON c.id = contact_counts.company_id
          LEFT JOIN (
            SELECT company_id, COUNT(*) as deal_count, COALESCE(SUM(value), 0) as deal_value
            FROM deals 
            WHERE company_id IS NOT NULL
            GROUP BY company_id
          ) deal_counts ON c.id = deal_counts.company_id
          WHERE ($1::uuid IS NULL OR c.owner_id = $1)
            AND ($2::text IS NULL OR (c.name ILIKE $2 OR c.domain ILIKE $2))
          ORDER BY c.updated_at DESC
          LIMIT $3
        `
      },

      'get_companies_simple': {
        name: 'get_companies_simple',
        text: `
          SELECT id, name, domain, industry, size, website, owner_id, created_at, updated_at,
                 0 as contact_count, 0 as deals_count, 0 as deals_value
          FROM companies
          WHERE ($1::uuid IS NULL OR owner_id = $1)
            AND ($2::text IS NULL OR (name ILIKE $2 OR domain ILIKE $2))
          ORDER BY updated_at DESC
          LIMIT $3
        `
      },

      // Deals queries
      'get_deals_with_relationships': {
        name: 'get_deals_with_relationships',
        text: `
          SELECT 
            d.*,
            c.name as company_name,
            c.domain as company_domain,
            c.size as company_size,
            c.industry as company_industry,
            ct.full_name as contact_name,
            ct.email as contact_email,
            ct.title as contact_title,
            ds.name as stage_name,
            ds.color as stage_color,
            ds.default_probability as stage_probability
          FROM deals d
          LEFT JOIN companies c ON d.company_id = c.id
          LEFT JOIN contacts ct ON d.primary_contact_id = ct.id
          LEFT JOIN deal_stages ds ON d.stage_id = ds.id
          WHERE ($1::uuid IS NULL OR d.owner_id = $1)
          ORDER BY d.updated_at DESC
          LIMIT $2
        `
      },

      'get_deals_simple': {
        name: 'get_deals_simple',
        text: `
          SELECT d.*,
                 null as company_name, null as company_domain, 
                 null as contact_name, null as contact_email
          FROM deals d
          WHERE ($1::uuid IS NULL OR d.owner_id = $1)
          ORDER BY d.updated_at DESC
          LIMIT $2
        `
      },

      // Contacts queries
      'get_contacts_with_company': {
        name: 'get_contacts_with_company',
        text: `
          SELECT 
            ct.*,
            c.id as company_id,
            c.name as company_name,
            c.domain as company_domain,
            c.size as company_size,
            c.industry as company_industry,
            c.website as company_website
          FROM contacts ct
          LEFT JOIN companies c ON ct.company_id = c.id
          WHERE ($1::uuid IS NULL OR ct.owner_id = $1)
            AND ($2::text IS NULL OR (ct.first_name ILIKE $2 OR ct.last_name ILIKE $2 OR ct.full_name ILIKE $2 OR ct.email ILIKE $2))
            AND ($3::uuid IS NULL OR ct.company_id = $3)
          ORDER BY ct.updated_at DESC
          LIMIT $4
        `
      },

      'get_contacts_simple': {
        name: 'get_contacts_simple',
        text: `
          SELECT id, first_name, last_name, full_name, email, phone, title, 
                 company_id, owner_id, created_at, updated_at
          FROM contacts
          WHERE ($1::uuid IS NULL OR owner_id = $1)
            AND ($2::text IS NULL OR (first_name ILIKE $2 OR last_name ILIKE $2 OR full_name ILIKE $2 OR email ILIKE $2))
            AND ($3::uuid IS NULL OR company_id = $3)
          ORDER BY updated_at DESC
          LIMIT $4
        `
      },

      // Contact sub-resources
      'get_contact_deals': {
        name: 'get_contact_deals',
        text: `
          SELECT 
            d.*,
            ds.name as stage_name,
            ds.color as stage_color,
            ds.default_probability
          FROM deals d
          LEFT JOIN deal_stages ds ON d.stage_id = ds.id
          WHERE d.primary_contact_id = $1 OR d.id IN (
            SELECT deal_id FROM deal_contacts WHERE contact_id = $1
          )
          ORDER BY d.updated_at DESC
        `
      },

      'get_contact_activities': {
        name: 'get_contact_activities',
        text: `
          SELECT 
            a.*,
            c.name as company_name
          FROM activities a
          LEFT JOIN companies c ON a.company_id = c.id
          WHERE a.contact_id = $1
          ORDER BY a.created_at DESC
          LIMIT $2
        `
      },

      'get_contact_stats': {
        name: 'get_contact_stats',
        text: `
          WITH activity_stats AS (
            SELECT 
              type,
              COUNT(*) as count
            FROM activities 
            WHERE contact_id = $1
            GROUP BY type
          ),
          deal_stats AS (
            SELECT 
              COUNT(*) as total_deals,
              COUNT(CASE WHEN status = 'active' THEN 1 END) as active_deals,
              COALESCE(SUM(value), 0) as total_value
            FROM deals 
            WHERE primary_contact_id = $1 OR id IN (
              SELECT deal_id FROM deal_contacts WHERE contact_id = $1
            )
          )
          SELECT 
            COALESCE((SELECT count FROM activity_stats WHERE type = 'meeting'), 0) as meetings,
            COALESCE((SELECT count FROM activity_stats WHERE type = 'email'), 0) as emails,
            COALESCE((SELECT count FROM activity_stats WHERE type = 'call'), 0) as calls,
            COALESCE(ds.total_deals, 0) as total_deals,
            COALESCE(ds.active_deals, 0) as active_deals,
            COALESCE(ds.total_value, 0) as total_deals_value
          FROM deal_stats ds
        `
      },

      // Utility queries
      'get_deal_stages': {
        name: 'get_deal_stages',
        text: `
          SELECT id, name, color, default_probability, order_position, created_at, updated_at
          FROM deal_stages
          ORDER BY order_position ASC, created_at ASC
        `
      },

      'get_owners_with_stats': {
        name: 'get_owners_with_stats',
        text: `
          SELECT DISTINCT
            p.id,
            p.first_name,
            p.last_name,
            p.stage,
            p.email,
            (p.first_name || ' ' || p.last_name) as full_name,
            COALESCE(deal_counts.deal_count, 0) as deal_count,
            COALESCE(deal_counts.total_value, 0) as total_value
          FROM profiles p
          LEFT JOIN (
            SELECT 
              owner_id,
              COUNT(*) as deal_count,
              COALESCE(SUM(value), 0) as total_value
            FROM deals
            GROUP BY owner_id
          ) deal_counts ON p.id = deal_counts.owner_id
          WHERE p.id IS NOT NULL
            AND (p.first_name IS NOT NULL OR p.last_name IS NOT NULL OR p.email IS NOT NULL)
          ORDER BY p.first_name, p.last_name
        `
      },

      // Performance monitoring
      'get_slow_queries': {
        name: 'get_slow_queries',
        text: `
          SELECT query, calls, total_time, mean_time, max_time
          FROM pg_stat_statements 
          WHERE mean_time > $1
          ORDER BY mean_time DESC
          LIMIT 20
        `
      },

      'get_table_sizes': {
        name: 'get_table_sizes',
        text: `
          SELECT 
            schemaname,
            tablename,
            attname,
            n_distinct,
            correlation,
            most_common_vals,
            most_common_freqs
          FROM pg_stats
          WHERE schemaname = 'public'
          ORDER BY schemaname, tablename, attname
        `
      }
    };

    // Prepare all statements
    for (const [key, statement] of Object.entries(statements)) {
      try {
        await this.pool.query(`DEALLOCATE ${statement.name}`).catch(() => {}); // Ignore if doesn't exist
        await this.pool.query(`PREPARE ${statement.name} AS ${statement.text}`);
        this.preparedStatements.set(key, statement.name);
        logger.info(`✅ Prepared statement: ${statement.name}`);
      } catch (error) {
        logger.error(`❌ Failed to prepare statement ${statement.name}:`, error.message);
      }
    }

    logger.info(`📊 Prepared ${this.preparedStatements.size} optimized queries`);
  }

  /**
   * Execute optimized query with automatic prepared statement selection
   */
  async executeOptimized(queryKey, params = [], options = {}) {
    const startTime = process.hrtime.bigint();
    let result;
    let usedPrepared = false;

    try {
      const preparedName = this.preparedStatements.get(queryKey);
      
      if (preparedName) {
        // Use prepared statement
        result = await this.pool.query(`EXECUTE ${preparedName}(${params.map((_, i) => `$${i + 1}`).join(',')})`, params);
        usedPrepared = true;
      } else {
        // Fallback to direct query (shouldn't happen with proper implementation)
        logger.warn(`No prepared statement found for query key: ${queryKey}`);
        throw new Error(`Unknown query key: ${queryKey}`);
      }

      const duration = Number(process.hrtime.bigint() - startTime) / 1000000; // Convert to milliseconds
      
      // Track query statistics
      this.trackQueryStats(queryKey, duration, usedPrepared, result.rowCount);
      
      // Log slow queries
      if (duration > this.slowQueryThreshold) {
        logger.warn('Slow query detected', {
          queryKey,
          duration: `${duration.toFixed(2)}ms`,
          rowCount: result.rowCount,
          usedPrepared
        });
      }

      return result;

    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      
      logger.error('Query execution failed', {
        queryKey,
        duration: `${duration.toFixed(2)}ms`,
        error: error.message,
        usedPrepared
      });
      
      throw error;
    }
  }

  /**
   * Track query performance statistics
   */
  trackQueryStats(queryKey, duration, usedPrepared, rowCount) {
    if (!this.queryStats.has(queryKey)) {
      this.queryStats.set(queryKey, {
        executions: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: 0,
        totalRows: 0,
        preparedUsage: 0
      });
    }

    const stats = this.queryStats.get(queryKey);
    stats.executions++;
    stats.totalTime += duration;
    stats.minTime = Math.min(stats.minTime, duration);
    stats.maxTime = Math.max(stats.maxTime, duration);
    stats.totalRows += rowCount || 0;
    if (usedPrepared) stats.preparedUsage++;

    this.queryStats.set(queryKey, stats);
  }

  /**
   * Get query performance statistics
   */
  getQueryStats() {
    const stats = {};
    
    for (const [queryKey, data] of this.queryStats) {
      stats[queryKey] = {
        executions: data.executions,
        averageTime: `${(data.totalTime / data.executions).toFixed(2)}ms`,
        minTime: `${data.minTime.toFixed(2)}ms`,
        maxTime: `${data.maxTime.toFixed(2)}ms`,
        totalTime: `${data.totalTime.toFixed(2)}ms`,
        averageRows: Math.round(data.totalRows / data.executions),
        preparedUsagePercent: `${((data.preparedUsage / data.executions) * 100).toFixed(1)}%`
      };
    }

    return {
      queryStats: stats,
      slowQueryThreshold: `${this.slowQueryThreshold}ms`,
      totalQueries: Array.from(this.queryStats.values()).reduce((sum, stat) => sum + stat.executions, 0)
    };
  }

  /**
   * Analyze query performance and provide recommendations
   */
  async analyzePerformance() {
    if (!this.analysisEnabled) {
      return { message: 'Performance analysis disabled in production' };
    }

    try {
      // Get slow queries from PostgreSQL stats
      const slowQueries = await this.executeOptimized('get_slow_queries', [this.slowQueryThreshold]);
      
      // Get table statistics
      const tableStats = await this.executeOptimized('get_table_sizes', []);
      
      // Get current connection pool status
      const poolStats = {
        total: this.pool.totalCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount
      };

      // Analyze prepared statement usage
      const preparedStats = this.getQueryStats();

      return {
        slowQueries: slowQueries.rows,
        tableStats: tableStats.rows,
        poolStats,
        preparedStatements: {
          total: this.preparedStatements.size,
          usage: preparedStats
        },
        recommendations: this.generateRecommendations(slowQueries.rows, poolStats)
      };

    } catch (error) {
      logger.error('Performance analysis failed', { error: error.message });
      return { error: 'Performance analysis failed' };
    }
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(slowQueries, poolStats) {
    const recommendations = [];

    // Analyze slow queries
    if (slowQueries.length > 0) {
      recommendations.push({
        type: 'slow_queries',
        severity: 'high',
        message: `Found ${slowQueries.length} slow queries. Consider adding indexes or optimizing query logic.`,
        details: slowQueries.slice(0, 5) // Top 5 slowest
      });
    }

    // Analyze connection pool
    if (poolStats.waiting > 0) {
      recommendations.push({
        type: 'connection_pool',
        severity: 'medium',
        message: `${poolStats.waiting} queries waiting for connections. Consider increasing pool size.`,
        details: poolStats
      });
    }

    if (poolStats.idle / poolStats.total < 0.2) {
      recommendations.push({
        type: 'connection_pool',
        severity: 'low',
        message: 'Low idle connection ratio. Monitor for connection exhaustion.',
        details: poolStats
      });
    }

    // Check prepared statement effectiveness
    const queryStats = this.getQueryStats();
    const totalQueries = queryStats.totalQueries;
    const preparedQueries = Object.values(queryStats.queryStats)
      .reduce((sum, stat) => sum + (parseFloat(stat.preparedUsagePercent) / 100), 0);

    if (preparedQueries / totalQueries < 0.8 && totalQueries > 100) {
      recommendations.push({
        type: 'prepared_statements',
        severity: 'medium',
        message: 'Low prepared statement usage. Consider adding more query patterns.',
        details: { preparedUsagePercent: `${((preparedQueries / totalQueries) * 100).toFixed(1)}%` }
      });
    }

    return recommendations;
  }

  /**
   * Clear query statistics
   */
  clearStats() {
    this.queryStats.clear();
    logger.info('Query statistics cleared');
  }

  /**
   * Refresh prepared statements
   */
  async refreshPreparedStatements() {
    // Clear existing
    for (const statementName of this.preparedStatements.values()) {
      try {
        await this.pool.query(`DEALLOCATE ${statementName}`);
      } catch (error) {
        // Ignore errors - statement might not exist
      }
    }
    
    this.preparedStatements.clear();
    
    // Re-initialize
    await this.initializePreparedStatements();
    
    logger.info('Prepared statements refreshed');
  }
}

export default QueryOptimizer;