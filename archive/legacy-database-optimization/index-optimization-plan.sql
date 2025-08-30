-- ================================================================
-- DATABASE INDEX OPTIMIZATION PLAN
-- Performance optimization for CRM system critical query patterns
-- ================================================================

-- Performance analysis queries to run before optimization
-- ================================================================

-- 1. Analyze current query performance
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) 
SELECT d.*, c.* FROM deals d 
LEFT JOIN clients c ON d.id = c.deal_id 
WHERE d.company ILIKE '%viewpoint%' AND d.owner_id = 'user-uuid';

-- 2. Check existing indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;

-- 3. Identify missing indexes using pg_stat_user_tables
SELECT 
    schemaname,
    tablename,
    n_tup_ins + n_tup_upd + n_tup_del as total_writes,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    CASE WHEN seq_scan > 0 THEN seq_tup_read/seq_scan ELSE 0 END as avg_seq_read
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
ORDER BY seq_tup_read DESC;

-- CRITICAL PERFORMANCE INDEXES
-- ================================================================

-- 1. DEALS TABLE OPTIMIZATION
-- Composite index for company name + owner filtering (useCompany hook primary query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_company_owner_optimized 
ON deals (owner_id, company) 
WHERE company IS NOT NULL;

-- Text search optimization for company name matching
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_company_text_search 
ON deals USING gin (to_tsvector('english', company))
WHERE company IS NOT NULL;

-- Status and stage filtering optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_status_stage_date 
ON deals (status, stage_id, created_at DESC)
WHERE status IS NOT NULL;

-- Value-based queries optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_value_date 
ON deals (value DESC, created_at DESC)
WHERE value > 0;

-- 2. CLIENTS TABLE OPTIMIZATION  
-- Company name search optimization (PaymentsTable primary query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_company_name_optimized
ON clients (owner_id, company_name)
WHERE company_name IS NOT NULL;

-- Deal relationship optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_deal_status 
ON clients (deal_id, status, owner_id)
WHERE deal_id IS NOT NULL;

-- Subscription tracking optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_subscription_tracking
ON clients (status, subscription_start_date DESC, owner_id)
WHERE status IN ('active', 'churned', 'paused');

-- Text search for company names
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_company_text_search
ON clients USING gin (to_tsvector('english', company_name))
WHERE company_name IS NOT NULL;

-- 3. ACTIVITIES TABLE OPTIMIZATION
-- Client name and user filtering (useCompany secondary query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_client_user_date
ON activities (user_id, client_name, date DESC)
WHERE client_name IS NOT NULL;

-- Deal relationship optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_deal_type_status
ON activities (deal_id, type, status, date DESC)
WHERE deal_id IS NOT NULL;

-- Sales activity tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_sales_tracking
ON activities (type, status, date DESC, user_id)
WHERE type = 'sale' AND status = 'completed';

-- Text search for client names in activities
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_client_text_search
ON activities USING gin (to_tsvector('english', client_name))
WHERE client_name IS NOT NULL;

-- 4. PROFILES TABLE OPTIMIZATION (User lookups)
-- Name-based user resolution (PaymentsTable N+1 elimination)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_name_lookup
ON profiles (id, first_name, last_name, email);

-- Full name search optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_full_name_search
ON profiles USING gin (to_tsvector('english', coalesce(first_name || ' ' || last_name, email)));

-- 5. COMPANIES TABLE OPTIMIZATION
-- Name and domain search optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_name_domain_search
ON companies (name, domain)
WHERE name IS NOT NULL;

-- Text search for company information
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_text_search
ON companies USING gin (to_tsvector('english', coalesce(name, domain)));

-- PERFORMANCE MONITORING INDEXES
-- ================================================================

-- Query performance tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_performance_tracking
ON deals (created_at DESC, updated_at DESC, owner_id)
INCLUDE (name, company, value, status);

-- Join optimization includes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_join_optimization
ON clients (deal_id)
INCLUDE (company_name, contact_name, contact_email, subscription_amount, status);

-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ================================================================

-- Multi-table join optimization for useCompany hook
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_clients_join_optimized
ON deals (id, owner_id, company)
INCLUDE (name, value, stage_id, status, created_at, monthly_mrr, one_off_revenue, annual_value);

-- PaymentsTable filtering optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_payments_filtering
ON clients (owner_id, status, subscription_start_date DESC)
INCLUDE (company_name, contact_name, subscription_amount, deal_id);

-- Activity correlation optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_correlation
ON activities (user_id, date DESC, type, status)
INCLUDE (client_name, details, amount, deal_id);

-- PARTIAL INDEXES FOR SPECIFIC CONDITIONS
-- ================================================================

-- Active deals only (reduces index size by ~70%)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_active_only
ON deals (owner_id, company, value DESC)
WHERE status NOT IN ('lost', 'cancelled')
  AND company IS NOT NULL;

-- Active clients only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_active_only  
ON clients (owner_id, company_name)
WHERE status = 'active'
  AND company_name IS NOT NULL;

-- Recent activities (last 2 years)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_recent
ON activities (user_id, client_name, date DESC)
WHERE date >= (CURRENT_DATE - INTERVAL '2 years')
  AND client_name IS NOT NULL;

-- EXPRESSION INDEXES FOR SEARCH OPTIMIZATION
-- ================================================================

-- Case-insensitive company name search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deals_company_lower
ON deals (owner_id, lower(company))
WHERE company IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_company_lower  
ON clients (owner_id, lower(company_name))
WHERE company_name IS NOT NULL;

-- STATISTICS UPDATE AND MAINTENANCE
-- ================================================================

-- Update table statistics for better query planning
ANALYZE deals;
ANALYZE clients; 
ANALYZE activities;
ANALYZE profiles;
ANALYZE companies;

-- Check index usage after implementation
-- Run this query after 24 hours to verify index effectiveness
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
  AND idx_scan > 0
ORDER BY idx_scan DESC;

-- PERFORMANCE VALIDATION QUERIES
-- ================================================================

-- Test optimized useCompany query performance
EXPLAIN (ANALYZE, BUFFERS) 
WITH company_deals AS (
  SELECT d.*, p.first_name || ' ' || p.last_name as owner_name
  FROM deals d
  LEFT JOIN profiles p ON d.owner_id = p.id  
  WHERE d.company ILIKE '%test%' AND d.owner_id = 'test-uuid'
),
company_clients AS (
  SELECT c.*, p.first_name || ' ' || p.last_name as owner_name
  FROM clients c
  LEFT JOIN profiles p ON c.owner_id = p.id
  WHERE c.company_name ILIKE '%test%' AND c.owner_id = 'test-uuid'
)
SELECT * FROM company_deals
UNION ALL  
SELECT NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, company_name, contact_name, contact_email, subscription_amount, status, deal_id, owner_id, subscription_start_date, churn_date, created_at, updated_at, owner_name FROM company_clients;

-- Expected performance improvements:
-- useCompany hook: 500ms-2s → <200ms (80%+ improvement)
-- PaymentsTable: N+1 queries → Single JOIN query (90%+ improvement)  
-- Overall query throughput: 3-5x improvement
-- Cache hit ratio: 85%+ for repeat queries

-- MAINTENANCE SCHEDULE
-- ================================================================

-- Weekly maintenance (automated)
-- REINDEX CONCURRENTLY idx_deals_company_owner_optimized;
-- REINDEX CONCURRENTLY idx_clients_company_name_optimized;
-- ANALYZE deals, clients, activities;

-- Monthly maintenance
-- Check for unused indexes and remove if not being used
-- Monitor index bloat and rebuild if necessary
-- Update statistics and review query performance

-- ROLLBACK PLAN
-- ================================================================

-- If performance degrades, remove indexes in reverse order:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_activities_recent;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_clients_active_only;  
-- DROP INDEX CONCURRENTLY IF EXISTS idx_deals_active_only;
-- -- Continue with remaining indexes...

-- Monitor disk usage impact:
-- SELECT pg_size_pretty(pg_total_relation_size('deals')) as deals_size;
-- SELECT pg_size_pretty(pg_total_relation_size('clients')) as clients_size;