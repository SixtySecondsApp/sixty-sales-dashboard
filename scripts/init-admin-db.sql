-- ============================================================================
-- ADMIN SAAS DATABASE SCHEMA INITIALIZATION
-- ============================================================================
-- This database stores all SaaS control plane data:
-- - Customer metadata and organizations
-- - Feature modules and enablement
-- - API keys and usage tracking
-- - AI key management and token consumption
-- - Subscription and billing information
-- - Audit logs for all actions
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- For encryption
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search

-- ============================================================================
-- CUSTOM TYPES
-- ============================================================================

CREATE TYPE subscription_status AS ENUM (
  'active',
  'trial',
  'suspended',
  'canceled',
  'expired'
);

CREATE TYPE plan_type AS ENUM (
  'starter',
  'pro',
  'enterprise'
);

CREATE TYPE rate_limit_period AS ENUM (
  'minute',
  'hour',
  'day',
  'month'
);

CREATE TYPE api_key_status AS ENUM (
  'active',
  'revoked',
  'expired'
);

CREATE TYPE ai_provider_type AS ENUM (
  'openai',
  'gemini',
  'anthropic'
);

CREATE TYPE key_owner_type AS ENUM (
  'system',   -- Using SaaS provider's key
  'customer'  -- Using customer's own key
);

CREATE TYPE audit_action AS ENUM (
  'customer_created',
  'customer_updated',
  'customer_deleted',
  'module_enabled',
  'module_disabled',
  'api_key_created',
  'api_key_revoked',
  'api_key_used',
  'ai_key_added',
  'ai_key_removed',
  'subscription_upgraded',
  'subscription_downgraded',
  'subscription_canceled'
);

-- ============================================================================
-- TABLE: FEATURE MODULES (Master data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_feature_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Module Definition
  module_key VARCHAR(100) NOT NULL UNIQUE,
  module_name VARCHAR(255) NOT NULL,
  module_description TEXT,

  -- Pricing (USD)
  base_price_monthly DECIMAL(10, 2) NOT NULL DEFAULT 0,
  base_price_annual DECIMAL(10, 2) NOT NULL DEFAULT 0,

  -- Configuration
  enabled_by_default BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT valid_module_key CHECK (module_key ~ '^[a-z_]+$')
);

CREATE INDEX idx_admin_feature_modules_key ON admin_feature_modules(module_key);

-- ============================================================================
-- TABLE: CUSTOMERS (Main tenant records)
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ─────────────────────────────────────────────────────────────────
  -- Company Information
  -- ─────────────────────────────────────────────────────────────────
  company_name VARCHAR(255) NOT NULL,
  company_domain VARCHAR(255) UNIQUE NOT NULL,
  company_logo_url TEXT,
  industry VARCHAR(100),
  company_size VARCHAR(50), -- "1-10", "11-50", "50-100", "100+"
  timezone VARCHAR(50) DEFAULT 'UTC',

  -- ─────────────────────────────────────────────────────────────────
  -- Database Configuration (encrypted)
  -- ─────────────────────────────────────────────────────────────────
  database_host VARCHAR(255) NOT NULL,
  database_port INT DEFAULT 5432,
  database_name VARCHAR(100) NOT NULL UNIQUE,
  database_user VARCHAR(100) NOT NULL,
  database_password_encrypted TEXT NOT NULL, -- Encrypted with pgcrypto

  -- ─────────────────────────────────────────────────────────────────
  -- Clerk Integration
  -- ─────────────────────────────────────────────────────────────────
  clerk_org_id VARCHAR(255) UNIQUE NOT NULL,
  clerk_admin_user_id VARCHAR(255) NOT NULL,

  -- ─────────────────────────────────────────────────────────────────
  -- Subscription Details
  -- ─────────────────────────────────────────────────────────────────
  subscription_plan plan_type NOT NULL DEFAULT 'starter'::plan_type,
  subscription_status subscription_status DEFAULT 'trial'::subscription_status,
  billing_email VARCHAR(255) NOT NULL,

  -- Trial Period
  trial_started_at TIMESTAMP,
  trial_ends_at TIMESTAMP,

  -- Active Subscription
  subscription_started_at TIMESTAMP,
  subscription_ends_at TIMESTAMP,
  auto_renew BOOLEAN DEFAULT true,

  -- ─────────────────────────────────────────────────────────────────
  -- Feature Configuration
  -- ─────────────────────────────────────────────────────────────────
  use_customer_ai_keys BOOLEAN DEFAULT false, -- false = use our keys

  -- ─────────────────────────────────────────────────────────────────
  -- Metadata & Tracking
  -- ─────────────────────────────────────────────────────────────────
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP, -- Soft delete

  CONSTRAINT valid_status CHECK (subscription_status IN ('active', 'trial', 'suspended', 'canceled', 'expired')),
  CONSTRAINT trial_period_check CHECK (trial_ends_at IS NULL OR trial_started_at IS NULL OR trial_ends_at > trial_started_at),
  CONSTRAINT subscription_period_check CHECK (subscription_ends_at IS NULL OR subscription_started_at IS NULL OR subscription_ends_at > subscription_started_at)
);

CREATE INDEX idx_admin_customers_domain ON admin_customers(company_domain);
CREATE INDEX idx_admin_customers_clerk_org ON admin_customers(clerk_org_id);
CREATE INDEX idx_admin_customers_status ON admin_customers(subscription_status);
CREATE INDEX idx_admin_customers_created ON admin_customers(created_at DESC);
CREATE INDEX idx_admin_customers_deleted ON admin_customers(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- TABLE: CUSTOMER MODULES (Which features each customer has enabled)
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_customer_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES admin_customers(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES admin_feature_modules(id) ON DELETE CASCADE,

  -- Status
  enabled BOOLEAN DEFAULT true,
  enabled_at TIMESTAMP DEFAULT NOW(),
  disabled_at TIMESTAMP,

  -- Usage Tracking (module-specific)
  usage_limit INT, -- e.g., max workflows
  usage_count INT DEFAULT 0,
  reset_date TIMESTAMP, -- When counter resets

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(customer_id, module_id)
);

CREATE INDEX idx_admin_customer_modules_customer ON admin_customer_modules(customer_id);
CREATE INDEX idx_admin_customer_modules_enabled ON admin_customer_modules(customer_id, enabled);

-- ============================================================================
-- TABLE: API KEYS
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES admin_customers(id) ON DELETE CASCADE,

  -- ─────────────────────────────────────────────────────────────────
  -- Key Information (store hashed key, not plain)
  -- ─────────────────────────────────────────────────────────────────
  key_hash VARCHAR(255) NOT NULL UNIQUE,
  key_prefix VARCHAR(20) NOT NULL, -- e.g., 'sk_prod_abc123' for display

  -- ─────────────────────────────────────────────────────────────────
  -- Metadata
  -- ─────────────────────────────────────────────────────────────────
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- ─────────────────────────────────────────────────────────────────
  -- Permissions (JSON array of permission strings)
  -- ─────────────────────────────────────────────────────────────────
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Example: ["read:deals", "write:contacts", "execute:workflows", "read:reports"]

  -- ─────────────────────────────────────────────────────────────────
  -- Rate Limiting
  -- ─────────────────────────────────────────────────────────────────
  rate_limit_requests INT DEFAULT 1000, -- requests per period
  rate_limit_period rate_limit_period DEFAULT 'month'::rate_limit_period,

  -- ─────────────────────────────────────────────────────────────────
  -- Status & Expiration
  -- ─────────────────────────────────────────────────────────────────
  status api_key_status DEFAULT 'active'::api_key_status,
  expires_at TIMESTAMP,

  -- ─────────────────────────────────────────────────────────────────
  -- Usage Tracking
  -- ─────────────────────────────────────────────────────────────────
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  revoked_at TIMESTAMP
);

CREATE INDEX idx_admin_api_keys_customer ON admin_api_keys(customer_id);
CREATE INDEX idx_admin_api_keys_status ON admin_api_keys(status);
CREATE INDEX idx_admin_api_keys_key_hash ON admin_api_keys(key_hash);

-- ============================================================================
-- TABLE: API USAGE TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES admin_api_keys(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES admin_customers(id) ON DELETE CASCADE,

  -- ─────────────────────────────────────────────────────────────────
  -- Request Information
  -- ─────────────────────────────────────────────────────────────────
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL, -- GET, POST, PUT, DELETE, PATCH
  status_code INT,

  -- ─────────────────────────────────────────────────────────────────
  -- Metrics
  -- ─────────────────────────────────────────────────────────────────
  response_time_ms INT,
  request_size_bytes INT,
  response_size_bytes INT,

  -- ─────────────────────────────────────────────────────────────────
  -- Tracking
  -- ─────────────────────────────────────────────────────────────────
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_admin_api_usage_customer ON admin_api_usage(customer_id);
CREATE INDEX idx_admin_api_usage_api_key ON admin_api_usage(api_key_id);
CREATE INDEX idx_admin_api_usage_created ON admin_api_usage(customer_id, created_at DESC);

-- ============================================================================
-- TABLE: CUSTOMER AI KEYS
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_customer_ai_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES admin_customers(id) ON DELETE CASCADE,

  -- ─────────────────────────────────────────────────────────────────
  -- Provider & Key Information
  -- ─────────────────────────────────────────────────────────────────
  ai_provider ai_provider_type NOT NULL,
  api_key_encrypted TEXT NOT NULL, -- Encrypted with pgcrypto

  -- ─────────────────────────────────────────────────────────────────
  -- Configuration
  -- ─────────────────────────────────────────────────────────────────
  is_active BOOLEAN DEFAULT true,
  set_at TIMESTAMP DEFAULT NOW(),
  last_verified_at TIMESTAMP,

  -- ─────────────────────────────────────────────────────────────────
  -- Budget & Limits
  -- ─────────────────────────────────────────────────────────────────
  monthly_token_budget INT,
  tokens_used_this_month INT DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(customer_id, ai_provider)
);

CREATE INDEX idx_admin_customer_ai_keys_customer ON admin_customer_ai_keys(customer_id);
CREATE INDEX idx_admin_customer_ai_keys_active ON admin_customer_ai_keys(customer_id, is_active);

-- ============================================================================
-- TABLE: AI TOKEN USAGE TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_ai_key_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES admin_customers(id) ON DELETE CASCADE,

  -- ─────────────────────────────────────────────────────────────────
  -- Provider Information
  -- ─────────────────────────────────────────────────────────────────
  ai_provider ai_provider_type NOT NULL,
  key_owner key_owner_type NOT NULL, -- 'system' or 'customer'

  -- ─────────────────────────────────────────────────────────────────
  -- Token Consumption
  -- ─────────────────────────────────────────────────────────────────
  prompt_tokens INT DEFAULT 0,
  completion_tokens INT DEFAULT 0,
  total_tokens INT DEFAULT 0,

  -- ─────────────────────────────────────────────────────────────────
  -- Cost Estimation (USD)
  -- ─────────────────────────────────────────────────────────────────
  estimated_cost_usd DECIMAL(10, 4) DEFAULT 0,

  -- ─────────────────────────────────────────────────────────────────
  -- Period (daily, monthly, etc.)
  -- ─────────────────────────────────────────────────────────────────
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_admin_ai_key_usage_customer ON admin_ai_key_usage(customer_id);
CREATE INDEX idx_admin_ai_key_usage_provider ON admin_ai_key_usage(customer_id, ai_provider);
CREATE INDEX idx_admin_ai_key_usage_period ON admin_ai_key_usage(customer_id, period_start, period_end);

-- ============================================================================
-- TABLE: AUDIT LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES admin_customers(id) ON DELETE SET NULL,
  admin_user_id VARCHAR(255), -- Clerk user ID

  -- ─────────────────────────────────────────────────────────────────
  -- Action Information
  -- ─────────────────────────────────────────────────────────────────
  action audit_action NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),

  -- ─────────────────────────────────────────────────────────────────
  -- Change Tracking
  -- ─────────────────────────────────────────────────────────────────
  old_values JSONB,
  new_values JSONB,

  -- ─────────────────────────────────────────────────────────────────
  -- Request Context
  -- ─────────────────────────────────────────────────────────────────
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_logs_customer ON admin_audit_logs(customer_id);
CREATE INDEX idx_admin_audit_logs_action ON admin_audit_logs(customer_id, action);
CREATE INDEX idx_admin_audit_logs_created ON admin_audit_logs(customer_id, created_at DESC);

-- ============================================================================
-- TABLE: SUBSCRIPTION INVOICES
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_subscription_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES admin_customers(id) ON DELETE CASCADE,

  -- ─────────────────────────────────────────────────────────────────
  -- Invoice Information
  -- ─────────────────────────────────────────────────────────────────
  invoice_number VARCHAR(100) NOT NULL UNIQUE,
  invoice_date TIMESTAMP NOT NULL DEFAULT NOW(),
  due_date TIMESTAMP,

  -- ─────────────────────────────────────────────────────────────────
  -- Amount
  -- ─────────────────────────────────────────────────────────────────
  subtotal DECIMAL(10, 2) NOT NULL,
  tax DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',

  -- ─────────────────────────────────────────────────────────────────
  -- Status & Payment
  -- ─────────────────────────────────────────────────────────────────
  status VARCHAR(50) DEFAULT 'draft', -- draft, sent, paid, overdue, canceled
  paid_at TIMESTAMP,

  -- ─────────────────────────────────────────────────────────────────
  -- Billing Period
  -- ─────────────────────────────────────────────────────────────────
  billing_period_start TIMESTAMP,
  billing_period_end TIMESTAMP,

  -- ─────────────────────────────────────────────────────────────────
  -- Line Items (JSON for flexibility)
  -- ─────────────────────────────────────────────────────────────────
  line_items JSONB NOT NULL,
  -- Example: [
  --   {"module": "crm_core", "quantity": 1, "unit_price": 0, "total": 0},
  --   {"module": "ai_assistant", "quantity": 1, "unit_price": 49, "total": 49}
  -- ]

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_admin_subscription_invoices_customer ON admin_subscription_invoices(customer_id);
CREATE INDEX idx_admin_subscription_invoices_status ON admin_subscription_invoices(customer_id, status);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger: Update updated_at on admin_customers
CREATE TRIGGER update_admin_customers_updated_at BEFORE UPDATE ON admin_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Update updated_at on admin_customer_modules
CREATE TRIGGER update_admin_customer_modules_updated_at BEFORE UPDATE ON admin_customer_modules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Update updated_at on admin_api_keys
CREATE TRIGGER update_admin_api_keys_updated_at BEFORE UPDATE ON admin_api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Update updated_at on admin_customer_ai_keys
CREATE TRIGGER update_admin_customer_ai_keys_updated_at BEFORE UPDATE ON admin_customer_ai_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Update updated_at on admin_ai_key_usage
CREATE TRIGGER update_admin_ai_key_usage_updated_at BEFORE UPDATE ON admin_ai_key_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Update updated_at on admin_subscription_invoices
CREATE TRIGGER update_admin_subscription_invoices_updated_at BEFORE UPDATE ON admin_subscription_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INITIAL DATA - Feature Modules
-- ============================================================================

INSERT INTO admin_feature_modules (module_key, module_name, module_description, base_price_monthly, base_price_annual, enabled_by_default) VALUES
('crm_core', 'CRM Core', 'Basic CRM with deals, contacts, activities, and tasks', 0, 0, true),
('advanced_pipeline', 'Advanced Pipeline', 'Custom pipeline stages, automation rules, and workflows', 29.99, 299.99, true),
('calendar_integration', 'Google Calendar Integration', 'Google Calendar sync, event management, and scheduling', 19.99, 199.99, false),
('ai_assistant', 'AI Assistant', 'AI-powered insights, proposal generation, and email assistance', 49.99, 499.99, false),
('workflow_automation', 'Workflow Automation', 'Custom workflow creation, triggers, and task automation', 39.99, 399.99, false),
('analytics_reporting', 'Analytics & Reporting', 'Advanced analytics, custom reports, and executive dashboards', 59.99, 599.99, false),
('api_access', 'API Access', 'REST API access for third-party integrations', 79.99, 799.99, false),
('custom_fields', 'Custom Fields', 'Create custom fields for deals, contacts, and other objects', 19.99, 199.99, false),
('bulk_operations', 'Bulk Operations', 'Bulk import/export, batch updates, and data management', 29.99, 299.99, false),
('compliance_audit', 'Compliance & Audit', 'Audit logs, compliance tracking, and data export capabilities', 99.99, 999.99, false)
ON CONFLICT (module_key) DO NOTHING;

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Customer subscription details with module count
CREATE OR REPLACE VIEW admin_customer_summary AS
SELECT
  c.id,
  c.company_name,
  c.company_domain,
  c.subscription_plan,
  c.subscription_status,
  c.created_at,
  COUNT(CASE WHEN acm.enabled = true THEN 1 END) as enabled_module_count,
  COUNT(aak.id) as api_key_count,
  COUNT(aaik.id) as ai_key_count
FROM admin_customers c
LEFT JOIN admin_customer_modules acm ON c.id = acm.customer_id
LEFT JOIN admin_api_keys aak ON c.id = aak.customer_id AND aak.status = 'active'::api_key_status
LEFT JOIN admin_customer_ai_keys aaik ON c.id = aaik.customer_id AND aaik.is_active = true
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.company_name, c.company_domain, c.subscription_plan, c.subscription_status, c.created_at;

-- View: API usage summary per customer
CREATE OR REPLACE VIEW admin_api_usage_summary AS
SELECT
  customer_id,
  DATE(created_at) as usage_date,
  COUNT(*) as total_requests,
  COUNT(CASE WHEN status_code < 400 THEN 1 END) as successful_requests,
  COUNT(CASE WHEN status_code >= 400 THEN 1 END) as failed_requests,
  AVG(response_time_ms) as avg_response_time_ms,
  MAX(response_time_ms) as max_response_time_ms
FROM admin_api_usage
GROUP BY customer_id, DATE(created_at);

-- View: Token usage summary per customer
CREATE OR REPLACE VIEW admin_token_usage_summary AS
SELECT
  customer_id,
  ai_provider,
  key_owner,
  DATE(period_start) as usage_date,
  SUM(total_tokens) as total_tokens,
  SUM(prompt_tokens) as total_prompt_tokens,
  SUM(completion_tokens) as total_completion_tokens,
  SUM(estimated_cost_usd) as total_estimated_cost
FROM admin_ai_key_usage
GROUP BY customer_id, ai_provider, key_owner, DATE(period_start);

-- ============================================================================
-- END OF ADMIN DATABASE INITIALIZATION
-- ============================================================================
