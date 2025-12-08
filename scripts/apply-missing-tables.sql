-- Combined Migration Script for Missing Cost Analysis Tables
-- Run this in Supabase Dashboard > SQL Editor if CLI connection fails
-- This creates all tables needed by costAnalysisService.ts

-- ============================================================================
-- 1. SUBSCRIPTION PLANS TABLE (if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price_monthly INTEGER NOT NULL DEFAULT 0,
  price_yearly INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'GBP',
  max_users INTEGER,
  max_meetings_per_month INTEGER,
  max_ai_tokens_per_month INTEGER,
  max_storage_mb INTEGER,
  stripe_product_id TEXT,
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,
  stripe_seat_price_id TEXT,
  included_seats INTEGER DEFAULT 1,
  per_seat_price INTEGER DEFAULT 0,
  meeting_retention_months INTEGER,
  trial_days INTEGER DEFAULT 14,
  features JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  is_free_tier BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  badge_text TEXT,
  cta_text TEXT DEFAULT 'Get Started',
  cta_url TEXT,
  highlight_features TEXT[] DEFAULT '{}',
  stripe_synced_at TIMESTAMPTZ,
  stripe_sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. ORGANIZATION SUBSCRIPTIONS TABLE (if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'paused')),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
  trial_start_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  stripe_price_id TEXT,
  stripe_payment_method_id TEXT,
  stripe_latest_invoice_id TEXT,
  quantity INTEGER DEFAULT 1,
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancellation_reason TEXT,
  custom_max_users INTEGER,
  custom_max_meetings INTEGER,
  custom_max_ai_tokens INTEGER,
  custom_max_storage_mb INTEGER,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_active_subscription UNIQUE (org_id)
);

-- ============================================================================
-- 3. ORGANIZATION USAGE TABLE (if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS organization_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  meetings_count INTEGER NOT NULL DEFAULT 0,
  meetings_duration_minutes INTEGER NOT NULL DEFAULT 0,
  ai_tokens_used INTEGER NOT NULL DEFAULT 0,
  storage_used_mb INTEGER NOT NULL DEFAULT 0,
  active_users_count INTEGER NOT NULL DEFAULT 0,
  usage_breakdown JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_org_period UNIQUE (org_id, period_start)
);

-- ============================================================================
-- 4. COST RATES TABLE (if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cost_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'gemini', 'supabase')),
  model TEXT NOT NULL,
  input_cost_per_million DECIMAL(10, 4) NOT NULL,
  output_cost_per_million DECIMAL(10, 4) NOT NULL,
  effective_from TIMESTAMPTZ DEFAULT NOW(),
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, model, effective_from)
);

-- ============================================================================
-- 5. AI COST EVENTS TABLE (if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_cost_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'gemini')),
  model TEXT NOT NULL,
  feature TEXT,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  estimated_cost DECIMAL(10, 6) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_subscription_plans_slug ON subscription_plans(slug);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_is_active ON subscription_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_org_id ON organization_subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_plan_id ON organization_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_status ON organization_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_org_usage_org_id ON organization_usage(org_id);
CREATE INDEX IF NOT EXISTS idx_org_usage_period ON organization_usage(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_cost_rates_active ON cost_rates(provider, model) WHERE effective_to IS NULL;
CREATE INDEX IF NOT EXISTS idx_ai_cost_events_org_id ON ai_cost_events(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_cost_events_created_at ON ai_cost_events(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_cost_events_org_date ON ai_cost_events(org_id, created_at);

-- ============================================================================
-- 7. ENABLE RLS
-- ============================================================================
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cost_events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 8. RLS POLICIES (Drop existing first to avoid conflicts)
-- ============================================================================

-- Subscription Plans Policies
DROP POLICY IF EXISTS "Anyone can view active subscription plans" ON subscription_plans;
DROP POLICY IF EXISTS "Admins can manage subscription plans" ON subscription_plans;

CREATE POLICY "Anyone can view active subscription plans"
  ON subscription_plans FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage subscription plans"
  ON subscription_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Organization Subscriptions Policies
DROP POLICY IF EXISTS "Org members can view their subscription" ON organization_subscriptions;
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON organization_subscriptions;

CREATE POLICY "Org members can view their subscription"
  ON organization_subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = organization_subscriptions.org_id
      AND organization_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all subscriptions"
  ON organization_subscriptions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Organization Usage Policies
DROP POLICY IF EXISTS "Org members can view their usage" ON organization_usage;
DROP POLICY IF EXISTS "Admins can manage all usage" ON organization_usage;

CREATE POLICY "Org members can view their usage"
  ON organization_usage FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = organization_usage.org_id
      AND organization_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all usage"
  ON organization_usage FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Cost Rates Policies
DROP POLICY IF EXISTS "Cost rates are readable by authenticated users" ON cost_rates;
DROP POLICY IF EXISTS "Cost rates are writable by admins" ON cost_rates;

CREATE POLICY "Cost rates are readable by authenticated users"
  ON cost_rates FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Cost rates are writable by admins"
  ON cost_rates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- AI Cost Events Policies
DROP POLICY IF EXISTS "Users can view their organization's cost events" ON ai_cost_events;
DROP POLICY IF EXISTS "Admins can view all cost events" ON ai_cost_events;
DROP POLICY IF EXISTS "Service role can insert cost events" ON ai_cost_events;

CREATE POLICY "Users can view their organization's cost events"
  ON ai_cost_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = ai_cost_events.org_id
      AND organization_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all cost events"
  ON ai_cost_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Service role can insert cost events"
  ON ai_cost_events FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- 9. SEED DEFAULT DATA
-- ============================================================================

-- Default cost rates
INSERT INTO cost_rates (provider, model, input_cost_per_million, output_cost_per_million) VALUES
  ('anthropic', 'claude-haiku-4-5', 0.20, 0.99),
  ('anthropic', 'claude-sonnet-4', 2.37, 11.85),
  ('anthropic', 'claude-3-5-sonnet', 2.37, 11.85),
  ('gemini', 'gemini-2.5-flash', 0.059, 0.237)
ON CONFLICT DO NOTHING;

-- Default subscription plans
INSERT INTO subscription_plans (name, slug, description, price_monthly, price_yearly, max_users, max_meetings_per_month, max_ai_tokens_per_month, max_storage_mb, features, is_active, is_default, is_free_tier, display_order)
VALUES
  ('Free', 'free', 'Get started with basic meeting intelligence', 0, 0, 1, 10, 10000, 100, '{"analytics": false, "team_insights": false, "api_access": false, "custom_branding": false, "priority_support": false}'::jsonb, true, true, true, 1),
  ('Starter', 'starter', 'Perfect for individuals and small teams', 2900, 29000, 5, 50, 100000, 1000, '{"analytics": true, "team_insights": false, "api_access": false, "custom_branding": false, "priority_support": false}'::jsonb, true, false, false, 2),
  ('Growth', 'growth', 'For growing teams that need more power', 7900, 79000, 25, 200, 500000, 5000, '{"analytics": true, "team_insights": true, "api_access": true, "custom_branding": false, "priority_support": false}'::jsonb, true, false, false, 3),
  ('Team', 'team', 'Custom solutions for larger organizations', 19900, 199000, NULL, NULL, NULL, NULL, '{"analytics": true, "team_insights": true, "api_access": true, "custom_branding": true, "priority_support": true}'::jsonb, true, false, false, 4)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_users = EXCLUDED.max_users,
  max_meetings_per_month = EXCLUDED.max_meetings_per_month,
  max_ai_tokens_per_month = EXCLUDED.max_ai_tokens_per_month,
  max_storage_mb = EXCLUDED.max_storage_mb,
  features = EXCLUDED.features,
  display_order = EXCLUDED.display_order;

-- ============================================================================
-- 10. VERIFICATION
-- ============================================================================
-- Run these to verify tables were created:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('subscription_plans', 'organization_subscriptions', 'organization_usage', 'cost_rates', 'ai_cost_events');
