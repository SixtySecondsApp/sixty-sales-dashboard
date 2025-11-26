/**
 * Admin Database Connection & Utilities
 *
 * This module manages connections to the Admin SaaS Control Plane database
 * which stores customer metadata, API keys, feature modules, and usage tracking.
 *
 * Database: saas_admin (separate from customer databases)
 * Purpose: Central control plane for multi-tenant SaaS
 */

import pkg from 'pg';
const { Pool } = pkg;

// ============================================================================
// CONNECTION POOL
// ============================================================================

let adminPool: pkg.Pool | null = null;

/**
 * Initialize Admin Database Connection Pool
 * Called once during application startup
 */
export function initializeAdminDb(): pkg.Pool {
  if (adminPool) {
    return adminPool;
  }

  const {
    ADMIN_DB_HOST = 'localhost',
    ADMIN_DB_PORT = '5433',
    ADMIN_DB_USER = 'admin_user',
    ADMIN_DB_PASSWORD = 'admin_password',
    ADMIN_DB_NAME = 'saas_admin'
  } = process.env;

  adminPool = new Pool({
    host: ADMIN_DB_HOST,
    port: parseInt(ADMIN_DB_PORT, 10),
    user: ADMIN_DB_USER,
    password: ADMIN_DB_PASSWORD,
    database: ADMIN_DB_NAME,
    max: 20, // Maximum pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  adminPool.on('error', (err) => {
    console.error('[AdminDB Pool Error]', err);
  });

  return adminPool;
}

/**
 * Get the Admin Database connection pool
 */
export function getAdminPool(): pkg.Pool {
  if (!adminPool) {
    return initializeAdminDb();
  }
  return adminPool;
}

/**
 * Close Admin Database connection pool
 */
export async function closeAdminDb(): Promise<void> {
  if (adminPool) {
    await adminPool.end();
    adminPool = null;
  }
}

// ============================================================================
// CUSTOMER QUERIES
// ============================================================================

export interface AdminCustomer {
  id: string;
  company_name: string;
  company_domain: string;
  company_logo_url?: string;
  industry?: string;
  company_size?: string;
  timezone: string;
  database_host: string;
  database_port: number;
  database_name: string;
  database_user: string;
  clerk_org_id: string;
  clerk_admin_user_id: string;
  subscription_plan: 'starter' | 'pro' | 'enterprise';
  subscription_status: 'active' | 'trial' | 'suspended' | 'canceled' | 'expired';
  billing_email: string;
  use_customer_ai_keys: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Get customer by UUID
 */
export async function getCustomerById(customerId: string): Promise<AdminCustomer | null> {
  const pool = getAdminPool();
  const query = `
    SELECT
      id, company_name, company_domain, company_logo_url, industry,
      company_size, timezone, database_host, database_port, database_name,
      database_user, clerk_org_id, clerk_admin_user_id,
      subscription_plan, subscription_status, billing_email,
      use_customer_ai_keys, created_at, updated_at
    FROM admin_customers
    WHERE id = $1 AND deleted_at IS NULL
  `;

  const result = await pool.query(query, [customerId]);
  return result.rows[0] || null;
}

/**
 * Get customer by Clerk organization ID
 */
export async function getCustomerByClerkOrgId(clerkOrgId: string): Promise<AdminCustomer | null> {
  const pool = getAdminPool();
  const query = `
    SELECT
      id, company_name, company_domain, company_logo_url, industry,
      company_size, timezone, database_host, database_port, database_name,
      database_user, clerk_org_id, clerk_admin_user_id,
      subscription_plan, subscription_status, billing_email,
      use_customer_ai_keys, created_at, updated_at
    FROM admin_customers
    WHERE clerk_org_id = $1 AND deleted_at IS NULL
  `;

  const result = await pool.query(query, [clerkOrgId]);
  return result.rows[0] || null;
}

/**
 * Get customer by domain
 */
export async function getCustomerByDomain(domain: string): Promise<AdminCustomer | null> {
  const pool = getAdminPool();
  const query = `
    SELECT
      id, company_name, company_domain, company_logo_url, industry,
      company_size, timezone, database_host, database_port, database_name,
      database_user, clerk_org_id, clerk_admin_user_id,
      subscription_plan, subscription_status, billing_email,
      use_customer_ai_keys, created_at, updated_at
    FROM admin_customers
    WHERE company_domain = $1 AND deleted_at IS NULL
  `;

  const result = await pool.query(query, [domain]);
  return result.rows[0] || null;
}

/**
 * Get all active customers (with pagination)
 */
export async function getActiveCustomers(
  limit = 50,
  offset = 0
): Promise<{ customers: AdminCustomer[]; total: number }> {
  const pool = getAdminPool();

  const countQuery = `SELECT COUNT(*) as total FROM admin_customers WHERE subscription_status = 'active' AND deleted_at IS NULL`;
  const countResult = await pool.query(countQuery);
  const total = parseInt(countResult.rows[0].total, 10);

  const dataQuery = `
    SELECT
      id, company_name, company_domain, company_logo_url, industry,
      company_size, timezone, database_host, database_port, database_name,
      database_user, clerk_org_id, clerk_admin_user_id,
      subscription_plan, subscription_status, billing_email,
      use_customer_ai_keys, created_at, updated_at
    FROM admin_customers
    WHERE subscription_status = 'active' AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
  `;

  const result = await pool.query(dataQuery, [limit, offset]);
  return { customers: result.rows, total };
}

// ============================================================================
// FEATURE MODULE QUERIES
// ============================================================================

export interface FeatureModule {
  id: string;
  module_key: string;
  module_name: string;
  module_description?: string;
  base_price_monthly: number;
  base_price_annual: number;
  enabled_by_default: boolean;
}

export interface CustomerModuleStatus {
  id: string;
  customer_id: string;
  module_id: string;
  module_name: string;
  enabled: boolean;
  usage_count: number;
  usage_limit: number | null;
  enabled_at: string;
  disabled_at: string | null;
}

/**
 * Get all feature modules
 */
export async function getAllFeatureModules(): Promise<FeatureModule[]> {
  const pool = getAdminPool();
  const query = `
    SELECT
      id, module_key, module_name, module_description,
      base_price_monthly, base_price_annual, enabled_by_default, is_active
    FROM admin_feature_modules
    WHERE is_active = true
    ORDER BY module_key
  `;

  const result = await pool.query(query);
  return result.rows;
}

/**
 * Check if module is enabled for customer
 */
export async function isModuleEnabledForCustomer(
  customerId: string,
  moduleKey: string
): Promise<boolean> {
  const pool = getAdminPool();
  const query = `
    SELECT acm.enabled
    FROM admin_customer_modules acm
    JOIN admin_feature_modules afm ON acm.module_id = afm.id
    WHERE acm.customer_id = $1 AND afm.module_key = $2 AND acm.enabled = true
  `;

  const result = await pool.query(query, [customerId, moduleKey]);
  return result.rows.length > 0;
}

/**
 * Get all enabled modules for a customer
 */
export async function getCustomerEnabledModules(customerId: string): Promise<CustomerModuleStatus[]> {
  const pool = getAdminPool();
  const query = `
    SELECT
      acm.id, acm.customer_id, acm.module_id,
      afm.module_name, afm.module_key,
      acm.enabled, acm.usage_count, acm.usage_limit,
      acm.enabled_at, acm.disabled_at
    FROM admin_customer_modules acm
    JOIN admin_feature_modules afm ON acm.module_id = afm.id
    WHERE acm.customer_id = $1 AND acm.enabled = true
    ORDER BY afm.module_name
  `;

  const result = await pool.query(query, [customerId]);
  return result.rows;
}

// ============================================================================
// API KEY QUERIES
// ============================================================================

export interface ApiKey {
  id: string;
  customer_id: string;
  key_prefix: string;
  name: string;
  permissions: string[];
  rate_limit_requests: number;
  rate_limit_period: 'minute' | 'hour' | 'day' | 'month';
  status: 'active' | 'revoked' | 'expired';
  last_used_at?: string;
  created_at: string;
}

/**
 * Get active API keys for customer
 */
export async function getCustomerApiKeys(customerId: string): Promise<ApiKey[]> {
  const pool = getAdminPool();
  const query = `
    SELECT
      id, customer_id, key_prefix, name, permissions,
      rate_limit_requests, rate_limit_period, status,
      last_used_at, created_at
    FROM admin_api_keys
    WHERE customer_id = $1 AND status = 'active'
    ORDER BY created_at DESC
  `;

  const result = await pool.query(query, [customerId]);
  return result.rows.map((row: any) => ({
    ...row,
    permissions: JSON.parse(row.permissions)
  }));
}

/**
 * Validate API key hash
 */
export async function validateApiKeyHash(keyHash: string): Promise<ApiKey | null> {
  const pool = getAdminPool();
  const query = `
    SELECT
      id, customer_id, key_prefix, name, permissions,
      rate_limit_requests, rate_limit_period, status,
      last_used_at, created_at
    FROM admin_api_keys
    WHERE key_hash = $1 AND status = 'active'
  `;

  const result = await pool.query(query, [keyHash]);
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    ...row,
    permissions: JSON.parse(row.permissions)
  };
}

// ============================================================================
// USAGE TRACKING QUERIES
// ============================================================================

/**
 * Log API request usage
 */
export async function logApiUsage(
  apiKeyId: string,
  customerId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTimeMs: number
): Promise<void> {
  const pool = getAdminPool();
  const query = `
    INSERT INTO admin_api_usage (api_key_id, customer_id, endpoint, method, status_code, response_time_ms, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
  `;

  await pool.query(query, [apiKeyId, customerId, endpoint, method, statusCode, responseTimeMs]);
}

/**
 * Log AI token usage
 */
export async function logAiTokenUsage(
  customerId: string,
  aiProvider: 'openai' | 'gemini' | 'anthropic',
  keyOwner: 'system' | 'customer',
  promptTokens: number,
  completionTokens: number,
  estimatedCostUsd: number
): Promise<void> {
  const pool = getAdminPool();

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1); // First day of month
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of month

  const query = `
    INSERT INTO admin_ai_key_usage (
      customer_id, ai_provider, key_owner,
      prompt_tokens, completion_tokens, total_tokens,
      estimated_cost_usd, period_start, period_end, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    ON CONFLICT (customer_id, ai_provider, key_owner, period_start, period_end)
    DO UPDATE SET
      prompt_tokens = admin_ai_key_usage.prompt_tokens + $4,
      completion_tokens = admin_ai_key_usage.completion_tokens + $5,
      total_tokens = admin_ai_key_usage.total_tokens + $6,
      estimated_cost_usd = admin_ai_key_usage.estimated_cost_usd + $7,
      updated_at = NOW()
  `;

  await pool.query(query, [
    customerId,
    aiProvider,
    keyOwner,
    promptTokens,
    completionTokens,
    promptTokens + completionTokens,
    estimatedCostUsd,
    periodStart,
    periodEnd
  ]);
}

/**
 * Get AI usage summary for customer (current month)
 */
export async function getAiUsageSummary(customerId: string): Promise<any> {
  const pool = getAdminPool();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const query = `
    SELECT
      ai_provider,
      key_owner,
      SUM(total_tokens) as total_tokens,
      SUM(prompt_tokens) as prompt_tokens,
      SUM(completion_tokens) as completion_tokens,
      SUM(estimated_cost_usd) as estimated_cost
    FROM admin_ai_key_usage
    WHERE customer_id = $1
      AND period_start >= $2
      AND period_end <= $3
    GROUP BY ai_provider, key_owner
  `;

  const result = await pool.query(query, [customerId, monthStart, monthEnd]);
  return result.rows;
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

/**
 * Log administrative action
 */
export async function logAuditAction(
  customerId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  oldValues: Record<string, any> | null,
  newValues: Record<string, any> | null,
  adminUserId?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const pool = getAdminPool();
  const query = `
    INSERT INTO admin_audit_logs (
      customer_id, admin_user_id, action, resource_type, resource_id,
      old_values, new_values, ip_address, user_agent, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
  `;

  await pool.query(query, [
    customerId,
    adminUserId || null,
    action,
    resourceType,
    resourceId,
    oldValues ? JSON.stringify(oldValues) : null,
    newValues ? JSON.stringify(newValues) : null,
    ipAddress || null,
    userAgent || null
  ]);
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Check Admin DB connection health
 */
export async function checkAdminDbHealth(): Promise<boolean> {
  try {
    const pool = getAdminPool();
    const result = await pool.query('SELECT NOW()');
    return result.rows.length > 0;
  } catch (error) {
    console.error('[AdminDB Health Check] Failed:', error);
    return false;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  initializeAdminDb,
  getAdminPool,
  closeAdminDb,
  checkAdminDbHealth,

  // Customer queries
  getCustomerById,
  getCustomerByClerkOrgId,
  getCustomerByDomain,
  getActiveCustomers,

  // Module queries
  getAllFeatureModules,
  isModuleEnabledForCustomer,
  getCustomerEnabledModules,

  // API key queries
  getCustomerApiKeys,
  validateApiKeyHash,

  // Usage tracking
  logApiUsage,
  logAiTokenUsage,
  getAiUsageSummary,

  // Audit logging
  logAuditAction,
};
