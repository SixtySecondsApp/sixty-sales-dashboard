/**
 * ================================================================
 * OPTIMIZED DATABASE CONNECTION POOLING
 * sixty-sales-dashboard performance optimization
 * Replaces single client with proper connection pool
 * ================================================================
 */

import pkg from 'pg';
import NodeCache from 'node-cache';

const { Pool } = pkg;

// ================================================================
// CONNECTION POOL CONFIGURATION
// ================================================================

/**
 * Optimized connection pool for production workloads
 * Based on Neon PostgreSQL best practices
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_p29ezkLxYgqh@ep-divine-heart-abzonafv-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require',
  
  // Connection pool settings
  max: 20,                    // Maximum connections (Neon supports up to 100)
  min: 2,                     // Minimum connections to maintain
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Wait 10s for connection
  
  // Query settings
  query_timeout: 30000,       // 30s query timeout
  statement_timeout: 30000,   // 30s statement timeout
  
  // Keep alive settings
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  
  // SSL settings for Neon
  ssl: {
    rejectUnauthorized: false
  },
  
  // Application name for monitoring
  application_name: 'sixty-sales-dashboard'
});

// ================================================================
// QUERY RESULT CACHING SYSTEM
// ================================================================

/**
 * Multi-tier caching strategy:
 * - Tier 1: In-memory cache (5 min TTL) for frequent queries
 * - Tier 2: Session cache (1 min TTL) for user-specific data
 * - Tier 3: Static cache (1 hour TTL) for reference data
 */
const cacheConfig = {
  // Tier 1: Frequent queries cache
  frequent: new NodeCache({ 
    stdTTL: 300,          // 5 minutes
    checkperiod: 60,      // Check for expired keys every minute
    useClones: false,     // Better performance, but be careful with mutations
    maxKeys: 1000         // Limit memory usage
  }),
  
  // Tier 2: User session cache
  session: new NodeCache({ 
    stdTTL: 60,           // 1 minute
    checkperiod: 30,      // Check every 30 seconds
    useClones: false,
    maxKeys: 500
  }),
  
  // Tier 3: Static reference data cache
  static: new NodeCache({ 
    stdTTL: 3600,         // 1 hour
    checkperiod: 300,     // Check every 5 minutes
    useClones: false,
    maxKeys: 100
  })
};

// ================================================================
// ENHANCED DATABASE CLASS
// ================================================================

class DatabaseManager {
  constructor() {
    this.pool = pool;
    this.cache = cacheConfig;
    this.setupEventHandlers();
    this.stats = {
      queries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0
    };
  }

  /**
   * Setup pool event handlers for monitoring
   */
  setupEventHandlers() {
    this.pool.on('connect', (client) => {
      console.log('🔗 New database connection established');
    });

    this.pool.on('error', (err) => {
      console.error('❌ Database pool error:', err);
      this.stats.errors++;
    });

    this.pool.on('remove', (client) => {
      console.log('🔌 Database connection removed from pool');
    });

    // Log pool status every 5 minutes
    setInterval(() => {
      console.log('📊 Pool Status:', {
        total: this.pool.totalCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount,
        ...this.stats
      });
    }, 300000);
  }

  /**
   * Generate cache key for query and parameters
   */
  generateCacheKey(query, params = []) {
    const queryHash = Buffer.from(query).toString('base64').slice(0, 20);
    const paramsHash = params.length > 0 ? 
      Buffer.from(JSON.stringify(params)).toString('base64').slice(0, 10) : '';
    return `${queryHash}:${paramsHash}`;
  }

  /**
   * Execute query with intelligent caching
   */
  async query(query, params = [], options = {}) {
    const { 
      cache = 'session',     // Cache tier: 'frequent', 'session', 'static', 'none'
      cacheTTL = null,       // Override default TTL
      forceRefresh = false   // Bypass cache
    } = options;

    this.stats.queries++;

    // Generate cache key
    const cacheKey = this.generateCacheKey(query, params);

    // Try cache first (unless forced refresh)
    if (cache !== 'none' && !forceRefresh && this.cache[cache]) {
      const cached = this.cache[cache].get(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        return cached;
      }
    }

    try {
      // Execute query
      const result = await this.pool.query(query, params);
      
      // Cache result if caching enabled
      if (cache !== 'none' && this.cache[cache]) {
        if (cacheTTL) {
          this.cache[cache].set(cacheKey, result, cacheTTL);
        } else {
          this.cache[cache].set(cacheKey, result);
        }
      }

      this.stats.cacheMisses++;
      return result;

    } catch (error) {
      this.stats.errors++;
      console.error('❌ Database query error:', error);
      throw error;
    }
  }

  /**
   * Execute transaction with automatic retry
   */
  async transaction(callback, maxRetries = 3) {
    const client = await this.pool.connect();
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        console.log(`🔄 Retrying transaction (attempt ${attempt + 1}/${maxRetries})`);
      } finally {
        if (attempt === maxRetries) {
          client.release();
        }
      }
    }
  }

  /**
   * Get optimized companies with stats
   */
  async getCompaniesWithStats(ownerId, filters = {}) {
    const { search, limit = 50, includeStats = true } = filters;
    
    let query, params;
    
    if (includeStats) {
      // Use optimized view
      query = `
        SELECT * FROM companies_with_stats 
        WHERE owner_id = $1
        ${search ? 'AND (name ILIKE $2 OR domain ILIKE $2)' : ''}
        ORDER BY updated_at DESC
        ${limit ? `LIMIT $${search ? 3 : 2}` : ''}
      `;
      params = search ? [ownerId, `%${search}%`, limit] : [ownerId, limit];
    } else {
      // Simple query without stats
      query = `
        SELECT id, name, domain, industry, size, website, owner_id, created_at, updated_at,
               0 as contact_count, 0 as deals_count, 0 as deals_value
        FROM companies
        WHERE owner_id = $1
        ${search ? 'AND (name ILIKE $2 OR domain ILIKE $2)' : ''}
        ORDER BY updated_at DESC
        ${limit ? `LIMIT $${search ? 3 : 2}` : ''}
      `;
      params = search ? [ownerId, `%${search}%`, limit] : [ownerId, limit];
    }

    return this.query(query, params, { 
      cache: includeStats ? 'frequent' : 'session',
      cacheTTL: includeStats ? 300 : 60 // 5 min for stats, 1 min for simple
    });
  }

  /**
   * Get optimized deals with relationships
   */
  async getDealsWithRelationships(ownerId, options = {}) {
    const { limit = 50, includeRelationships = true } = options;

    if (includeRelationships) {
      const query = `
        SELECT * FROM deals_with_relationships
        WHERE owner_id = $1
        ORDER BY updated_at DESC
        ${limit ? 'LIMIT $2' : ''}
      `;
      const params = limit ? [ownerId, limit] : [ownerId];
      
      return this.query(query, params, { 
        cache: 'frequent',
        cacheTTL: 120 // 2 minutes for deals with relationships
      });
    } else {
      const query = `
        SELECT id, name, value, owner_id, created_at, updated_at
        FROM deals
        WHERE owner_id = $1
        ORDER BY updated_at DESC
        ${limit ? 'LIMIT $2' : ''}
      `;
      const params = limit ? [ownerId, limit] : [ownerId];
      
      return this.query(query, params, { cache: 'session' });
    }
  }

  /**
   * Get optimized contacts with company info
   */
  async getContactsWithCompany(ownerId, filters = {}) {
    const { search, companyId, includeCompany = true, limit = 50 } = filters;
    
    let query, params;
    const conditions = ['owner_id = $1'];
    params = [ownerId];
    
    if (search) {
      conditions.push(`(first_name ILIKE $${params.length + 1} OR last_name ILIKE $${params.length + 1} OR full_name ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    
    if (companyId) {
      conditions.push(`company_id = $${params.length + 1}`);
      params.push(companyId);
    }

    if (includeCompany) {
      query = `
        SELECT * FROM contacts_with_company
        WHERE ${conditions.join(' AND ')}
        ORDER BY updated_at DESC
        ${limit ? `LIMIT $${params.length + 1}` : ''}
      `;
    } else {
      query = `
        SELECT id, first_name, last_name, full_name, email, phone, title, 
               company_id, owner_id, created_at, updated_at
        FROM contacts
        WHERE ${conditions.join(' AND ')}
        ORDER BY updated_at DESC
        ${limit ? `LIMIT $${params.length + 1}` : ''}
      `;
    }
    
    if (limit) {
      params.push(limit);
    }

    return this.query(query, params, { 
      cache: includeCompany ? 'frequent' : 'session' 
    });
  }

  /**
   * Get contact deals efficiently
   */
  async getContactDeals(contactId) {
    return this.query(
      'SELECT * FROM get_contact_deals($1)',
      [contactId],
      { cache: 'frequent', cacheTTL: 180 } // 3 minutes
    );
  }

  /**
   * Get contact stats efficiently
   */
  async getContactStats(contactId) {
    return this.query(
      'SELECT * FROM get_contact_stats($1)',
      [contactId],
      { cache: 'frequent', cacheTTL: 300 } // 5 minutes
    );
  }

  /**
   * Get contact activities efficiently
   */
  async getContactActivities(contactId, limit = 10) {
    return this.query(
      'SELECT * FROM get_contact_activities($1, $2)',
      [contactId, limit],
      { cache: 'session', cacheTTL: 120 } // 2 minutes
    );
  }

  /**
   * Get owners with stats (cached for longer)
   */
  async getOwnersWithStats() {
    return this.query(
      'SELECT * FROM owners_with_stats ORDER BY first_name, last_name',
      [],
      { cache: 'static', cacheTTL: 1800 } // 30 minutes
    );
  }

  /**
   * Get deal stages (rarely changes, cache longer)
   */
  async getDealStages() {
    return this.query(
      'SELECT id, name, color, default_probability, order_position FROM deal_stages ORDER BY order_position ASC',
      [],
      { cache: 'static', cacheTTL: 3600 } // 1 hour
    );
  }

  /**
   * Refresh dashboard stats
   */
  async refreshDashboardStats() {
    return this.query(
      'SELECT refresh_dashboard_stats()',
      [],
      { cache: 'none' } // Never cache the refresh operation
    );
  }

  /**
   * Clear cache by tier or key pattern
   */
  clearCache(tier = 'all', pattern = null) {
    if (tier === 'all') {
      Object.values(this.cache).forEach(cache => cache.flushAll());
      console.log('🧹 All caches cleared');
    } else if (this.cache[tier]) {
      if (pattern) {
        const keys = this.cache[tier].keys().filter(key => key.includes(pattern));
        this.cache[tier].del(keys);
        console.log(`🧹 Cleared ${keys.length} keys matching "${pattern}" from ${tier} cache`);
      } else {
        this.cache[tier].flushAll();
        console.log(`🧹 Cleared ${tier} cache`);
      }
    }
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheHitRatio: this.stats.queries > 0 ? 
        (this.stats.cacheHits / this.stats.queries * 100).toFixed(2) + '%' : '0%',
      pool: {
        total: this.pool.totalCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount
      },
      cacheStats: {
        frequent: this.cache.frequent.getStats(),
        session: this.cache.session.getStats(),
        static: this.cache.static.getStats()
      }
    };
  }

  /**
   * Graceful shutdown
   */
  async close() {
    console.log('🔄 Closing database connections...');
    Object.values(this.cache).forEach(cache => cache.close());
    await this.pool.end();
    console.log('✅ Database connections closed');
  }
}

// ================================================================
// SINGLETON INSTANCE
// ================================================================

const db = new DatabaseManager();

// Graceful shutdown handling
process.on('SIGINT', async () => {
  await db.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await db.close();
  process.exit(0);
});

export default db;