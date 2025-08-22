// Advanced Connection Pool Manager for Supabase
// Optimizes database connections and query execution

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import logger from '@/lib/utils/logger';

interface PoolConfig {
  maxConnections: number;
  idleTimeout: number;
  connectionTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  healthCheckInterval: number;
}

interface ConnectionMetrics {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  failedConnections: number;
  totalQueries: number;
  avgQueryTime: number;
  errorRate: number;
}

interface Connection {
  client: SupabaseClient;
  id: string;
  createdAt: number;
  lastUsed: number;
  queryCount: number;
  isHealthy: boolean;
  inUse: boolean;
}

class SupabaseConnectionPool {
  private connections: Map<string, Connection> = new Map();
  private config: PoolConfig;
  private metrics: ConnectionMetrics = {
    activeConnections: 0,
    idleConnections: 0,
    totalConnections: 0,
    failedConnections: 0,
    totalQueries: 0,
    avgQueryTime: 0,
    errorRate: 0
  };
  private queryTimes: number[] = [];
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(
    private supabaseUrl: string,
    private supabaseKey: string,
    config: Partial<PoolConfig> = {}
  ) {
    this.config = {
      maxConnections: config.maxConnections || 10,
      idleTimeout: config.idleTimeout || 5 * 60 * 1000, // 5 minutes
      connectionTimeout: config.connectionTimeout || 10000, // 10 seconds
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000, // 1 second
      healthCheckInterval: config.healthCheckInterval || 60000, // 1 minute
    };

    this.startHealthCheck();
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createConnection(): Connection {
    const client = createClient(this.supabaseUrl, this.supabaseKey, {
      auth: {
        persistSession: false, // Don't persist sessions in connection pool
        autoRefreshToken: false
      },
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'X-Connection-Pool': 'optimized-v1'
        }
      }
    });

    const connection: Connection = {
      client,
      id: this.generateConnectionId(),
      createdAt: Date.now(),
      lastUsed: Date.now(),
      queryCount: 0,
      isHealthy: true,
      inUse: false
    };

    logger.log(`🔗 Created new connection: ${connection.id}`);
    return connection;
  }

  private async testConnection(connection: Connection): Promise<boolean> {
    try {
      const { data, error } = await connection.client
        .from('deals')
        .select('count(*)', { count: 'exact', head: true });
      
      return !error;
    } catch (error) {
      logger.error(`❌ Health check failed for connection ${connection.id}:`, error);
      return false;
    }
  }

  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      logger.log('🔍 Running connection health check...');
      
      const unhealthyConnections: string[] = [];
      
      for (const [id, connection] of this.connections.entries()) {
        if (!connection.inUse) {
          const isHealthy = await this.testConnection(connection);
          
          if (!isHealthy) {
            unhealthyConnections.push(id);
            logger.warn(`⚠️ Connection ${id} is unhealthy, marking for removal`);
          } else {
            connection.isHealthy = true;
          }
        }
      }

      // Remove unhealthy connections
      unhealthyConnections.forEach(id => {
        this.connections.delete(id);
        this.metrics.failedConnections++;
      });

      this.updateMetrics();
    }, this.config.healthCheckInterval);
  }

  private updateMetrics(): void {
    let active = 0;
    let idle = 0;

    for (const connection of this.connections.values()) {
      if (connection.inUse) {
        active++;
      } else {
        idle++;
      }
    }

    this.metrics.activeConnections = active;
    this.metrics.idleConnections = idle;
    this.metrics.totalConnections = this.connections.size;

    // Calculate average query time
    if (this.queryTimes.length > 0) {
      const sum = this.queryTimes.reduce((a, b) => a + b, 0);
      this.metrics.avgQueryTime = sum / this.queryTimes.length;
      
      // Keep only last 1000 query times for memory efficiency
      if (this.queryTimes.length > 1000) {
        this.queryTimes = this.queryTimes.slice(-1000);
      }
    }
  }

  private async getConnection(): Promise<Connection> {
    // Try to find an idle, healthy connection
    for (const connection of this.connections.values()) {
      if (!connection.inUse && connection.isHealthy) {
        connection.inUse = true;
        connection.lastUsed = Date.now();
        this.updateMetrics();
        return connection;
      }
    }

    // Create new connection if we haven't reached the limit
    if (this.connections.size < this.config.maxConnections) {
      const connection = this.createConnection();
      connection.inUse = true;
      this.connections.set(connection.id, connection);
      this.updateMetrics();
      return connection;
    }

    // Wait for a connection to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout - all connections are busy'));
      }, this.config.connectionTimeout);

      const checkForConnection = () => {
        for (const connection of this.connections.values()) {
          if (!connection.inUse && connection.isHealthy) {
            clearTimeout(timeout);
            connection.inUse = true;
            connection.lastUsed = Date.now();
            this.updateMetrics();
            resolve(connection);
            return;
          }
        }
        
        // Check again in 100ms
        setTimeout(checkForConnection, 100);
      };

      checkForConnection();
    });
  }

  private releaseConnection(connection: Connection): void {
    connection.inUse = false;
    connection.lastUsed = Date.now();
    this.updateMetrics();
  }

  async executeQuery<T>(
    queryFn: (client: SupabaseClient) => Promise<T>,
    retries = this.config.retryAttempts
  ): Promise<T> {
    const startTime = Date.now();
    let lastError: Error;

    for (let attempt = 0; attempt <= retries; attempt++) {
      let connection: Connection | null = null;
      
      try {
        connection = await this.getConnection();
        
        const result = await queryFn(connection.client);
        
        // Record successful query
        connection.queryCount++;
        this.metrics.totalQueries++;
        const queryTime = Date.now() - startTime;
        this.queryTimes.push(queryTime);
        
        this.releaseConnection(connection);
        
        logger.log(`✅ Query completed in ${queryTime}ms on connection ${connection.id}`);
        return result;
        
      } catch (error: any) {
        lastError = error;
        
        if (connection) {
          // Mark connection as potentially unhealthy
          connection.isHealthy = false;
          this.releaseConnection(connection);
        }

        logger.warn(`⚠️ Query attempt ${attempt + 1} failed:`, error.message);
        
        // Don't retry on certain errors
        if (error.message.includes('duplicate key') || 
            error.message.includes('foreign key') ||
            error.message.includes('permission denied')) {
          throw error;
        }

        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * (attempt + 1)));
        }
      }
    }

    // All retries failed
    this.metrics.errorRate = (this.metrics.failedConnections / this.metrics.totalQueries) * 100;
    throw lastError!;
  }

  getMetrics(): ConnectionMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  async cleanup(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    // Release all connections
    for (const connection of this.connections.values()) {
      // Supabase client doesn't have explicit close method
      // Just mark as unhealthy
      connection.isHealthy = false;
    }

    this.connections.clear();
    logger.log('🧹 Connection pool cleaned up');
  }

  // Warm up the pool by creating initial connections
  async warmUp(initialConnections = 2): Promise<void> {
    logger.log(`🔄 Warming up connection pool with ${initialConnections} connections...`);
    
    const promises = Array(initialConnections).fill(null).map(async () => {
      try {
        const connection = this.createConnection();
        
        // Test the connection
        const isHealthy = await this.testConnection(connection);
        connection.isHealthy = isHealthy;
        
        if (isHealthy) {
          this.connections.set(connection.id, connection);
          return true;
        } else {
          logger.warn(`⚠️ Initial connection ${connection.id} failed health check`);
          return false;
        }
      } catch (error) {
        logger.error('❌ Failed to create initial connection:', error);
        return false;
      }
    });

    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
    
    logger.log(`✅ Connection pool warmed up: ${successful}/${initialConnections} connections ready`);
    this.updateMetrics();
  }
}

// Singleton instance for global use
let globalPool: SupabaseConnectionPool | null = null;

export function initializeConnectionPool(
  supabaseUrl: string,
  supabaseKey: string,
  config?: Partial<PoolConfig>
): SupabaseConnectionPool {
  if (globalPool) {
    logger.log('♻️ Reusing existing connection pool');
    return globalPool;
  }

  globalPool = new SupabaseConnectionPool(supabaseUrl, supabaseKey, config);
  logger.log('🚀 Initialized new connection pool');
  
  return globalPool;
}

export function getConnectionPool(): SupabaseConnectionPool | null {
  return globalPool;
}

export async function cleanupConnectionPool(): Promise<void> {
  if (globalPool) {
    await globalPool.cleanup();
    globalPool = null;
  }
}

// Utility function for executing queries with connection pooling
export async function executePooledQuery<T>(
  queryFn: (client: SupabaseClient) => Promise<T>
): Promise<T> {
  if (!globalPool) {
    throw new Error('Connection pool not initialized. Call initializeConnectionPool first.');
  }
  
  return globalPool.executeQuery(queryFn);
}

export type { PoolConfig, ConnectionMetrics, SupabaseConnectionPool };