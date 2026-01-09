-- SaaS Admin Tables: Subscription Plans, Usage Tracking, Feature Flags
-- This migration adds tables for managing SaaS customers, subscriptions, and usage

-- ============================================================================
-- SUBSCRIPTION PLANS TABLE
-- ============================================================================
-- Defines available subscription tiers with their features and limits
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE, -- e.g., 'free', 'starter', 'pro', 'enterprise'
  description TEXT,

  -- Pricing
  price_monthly INTEGER NOT NULL DEFAULT 0, -- in cents
  price_yearly INTEGER NOT NULL DEFAULT 0, -- in cents (annual total, not monthly)
  currency TEXT NOT NULL DEFAULT 'USD',

  -- Limits
  max_users INTEGER, -- NULL = unlimited
  max_meetings_per_month INTEGER, -- NULL = unlimited
  max_ai_tokens_per_month INTEGER, -- NULL = unlimited
  max_storage_mb INTEGER, -- NULL = unlimited

  -- Feature flags (what's included)
  features JSONB NOT NULL DEFAULT '{}', -- e.g., {"analytics": true, "api_access": false}

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false, -- Default plan for new signups

  -- Display
  display_order INTEGER DEFAULT 0,
  badge_text TEXT, -- e.g., "Most Popular", "Best Value"

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ORGANIZATION SUBSCRIPTIONS TABLE
-- ============================================================================
-- Links organizations to their subscription plans
CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,

  -- Subscription details
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'paused')),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),

  -- Dates
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
  trial_ends_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,

  -- External payment references
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,

  -- Override limits (NULL = use plan defaults)
  custom_max_users INTEGER,
  custom_max_meetings INTEGER,
  custom_max_ai_tokens INTEGER,
  custom_max_storage_mb INTEGER,

  -- Notes for admin
  admin_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each org can only have one active subscription
  CONSTRAINT unique_active_subscription UNIQUE (org_id)
);

-- ============================================================================
-- USAGE TRACKING TABLES
-- ============================================================================

-- Monthly usage snapshots per organization
CREATE TABLE IF NOT EXISTS organization_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Usage counts
  meetings_count INTEGER NOT NULL DEFAULT 0,
  meetings_duration_minutes INTEGER NOT NULL DEFAULT 0,
  ai_tokens_used INTEGER NOT NULL DEFAULT 0,
  storage_used_mb INTEGER NOT NULL DEFAULT 0,
  active_users_count INTEGER NOT NULL DEFAULT 0,

  -- Breakdowns (stored as JSONB for flexibility)
  usage_breakdown JSONB DEFAULT '{}', -- e.g., {"transcription_tokens": 1000, "analysis_tokens": 500}

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One record per org per period
  CONSTRAINT unique_org_period UNIQUE (org_id, period_start)
);

-- Daily usage events for detailed tracking
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Event details
  event_type TEXT NOT NULL, -- 'meeting', 'ai_tokens', 'storage', 'api_call'
  event_subtype TEXT, -- e.g., 'transcription', 'analysis', 'summary'
  quantity INTEGER NOT NULL DEFAULT 1,

  -- Metadata
  metadata JSONB DEFAULT '{}', -- Additional event-specific data

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FEATURE FLAGS TABLE
-- ============================================================================
-- Per-organization feature overrides (beyond what plan provides)
CREATE TABLE IF NOT EXISTS organization_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  feature_key TEXT NOT NULL, -- e.g., 'beta_analytics', 'custom_branding', 'api_access'
  is_enabled BOOLEAN NOT NULL DEFAULT false,

  -- Limits (for features that have usage limits)
  usage_limit INTEGER, -- NULL = unlimited if enabled

  -- Admin override
  override_reason TEXT,
  enabled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  enabled_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- NULL = never expires

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One flag per feature per org
  CONSTRAINT unique_org_feature UNIQUE (org_id, feature_key)
);

-- ============================================================================
-- BILLING HISTORY TABLE
-- ============================================================================
-- Track billing events and invoices
CREATE TABLE IF NOT EXISTS billing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES organization_subscriptions(id) ON DELETE SET NULL,

  -- Event details
  event_type TEXT NOT NULL, -- 'invoice', 'payment', 'refund', 'credit', 'plan_change'
  amount INTEGER NOT NULL, -- in cents
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'failed', 'refunded'

  -- Description
  description TEXT,

  -- External references
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_subscription_plans_slug ON subscription_plans(slug);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_is_active ON subscription_plans(is_active);

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_org_id ON organization_subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_plan_id ON organization_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_status ON organization_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_stripe_id ON organization_subscriptions(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_org_usage_org_id ON organization_usage(org_id);
CREATE INDEX IF NOT EXISTS idx_org_usage_period ON organization_usage(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_usage_events_org_id ON usage_events(org_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_user_id ON usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_type ON usage_events(event_type);
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON usage_events(created_at);

CREATE INDEX IF NOT EXISTS idx_org_feature_flags_org_id ON organization_feature_flags(org_id);
CREATE INDEX IF NOT EXISTS idx_org_feature_flags_key ON organization_feature_flags(feature_key);

CREATE INDEX IF NOT EXISTS idx_billing_history_org_id ON billing_history(org_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_subscription_id ON billing_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_created_at ON billing_history(created_at);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;

-- Subscription Plans: Everyone can read active plans, only super admins can modify
CREATE POLICY "Anyone can view active subscription plans"
  ON subscription_plans FOR SELECT
  USING (is_active = true OR is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage subscription plans"
  ON subscription_plans FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Organization Subscriptions: Org members can view, super admins can manage
CREATE POLICY "Org members can view their subscription"
  ON organization_subscriptions FOR SELECT
  USING (
    is_org_member(auth.uid(), org_id)
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Super admins can manage all subscriptions"
  ON organization_subscriptions FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Organization Usage: Org admins can view, super admins can manage
CREATE POLICY "Org admins can view their usage"
  ON organization_usage FOR SELECT
  USING (
    get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Super admins can manage all usage records"
  ON organization_usage FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Usage Events: Service role only for inserts, org admins can view
CREATE POLICY "Org admins can view their usage events"
  ON usage_events FOR SELECT
  USING (
    get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Super admins can manage usage events"
  ON usage_events FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Feature Flags: Org members can view, super admins can manage
CREATE POLICY "Org members can view their feature flags"
  ON organization_feature_flags FOR SELECT
  USING (
    is_org_member(auth.uid(), org_id)
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Super admins can manage feature flags"
  ON organization_feature_flags FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Billing History: Org owners/admins can view, super admins can manage
CREATE POLICY "Org admins can view their billing history"
  ON billing_history FOR SELECT
  USING (
    get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Super admins can manage billing history"
  ON billing_history FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- ============================================================================
-- DEFAULT SUBSCRIPTION PLANS
-- ============================================================================
INSERT INTO subscription_plans (name, slug, description, price_monthly, price_yearly, max_users, max_meetings_per_month, max_ai_tokens_per_month, max_storage_mb, features, is_active, is_default, display_order)
VALUES
  ('Free', 'free', 'Get started with basic meeting intelligence', 0, 0, 1, 10, 10000, 100, '{"analytics": false, "team_insights": false, "api_access": false, "custom_branding": false, "priority_support": false}'::jsonb, true, true, 1),
  ('Starter', 'starter', 'Perfect for individuals and small teams', 2900, 29000, 5, 50, 100000, 1000, '{"analytics": true, "team_insights": false, "api_access": false, "custom_branding": false, "priority_support": false}'::jsonb, true, false, 2),
  ('Pro', 'pro', 'For growing teams that need more power', 7900, 79000, 25, 200, 500000, 5000, '{"analytics": true, "team_insights": true, "api_access": true, "custom_branding": false, "priority_support": false}'::jsonb, true, false, 3),
  ('Enterprise', 'enterprise', 'Custom solutions for large organizations', 0, 0, NULL, NULL, NULL, NULL, '{"analytics": true, "team_insights": true, "api_access": true, "custom_branding": true, "priority_support": true}'::jsonb, true, false, 4)
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
-- HELPER FUNCTIONS
-- ============================================================================

-- Get organization's current plan features
CREATE OR REPLACE FUNCTION get_org_plan_features(p_org_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_features JSONB;
BEGIN
  SELECT sp.features INTO v_features
  FROM organization_subscriptions os
  JOIN subscription_plans sp ON sp.id = os.plan_id
  WHERE os.org_id = p_org_id
  AND os.status IN ('active', 'trialing');

  RETURN COALESCE(v_features, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get organization's usage limits (considering custom overrides)
CREATE OR REPLACE FUNCTION get_org_limits(p_org_id UUID)
RETURNS TABLE(
  max_users INTEGER,
  max_meetings INTEGER,
  max_ai_tokens INTEGER,
  max_storage_mb INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(os.custom_max_users, sp.max_users) as max_users,
    COALESCE(os.custom_max_meetings, sp.max_meetings_per_month) as max_meetings,
    COALESCE(os.custom_max_ai_tokens, sp.max_ai_tokens_per_month) as max_ai_tokens,
    COALESCE(os.custom_max_storage_mb, sp.max_storage_mb) as max_storage_mb
  FROM organization_subscriptions os
  JOIN subscription_plans sp ON sp.id = os.plan_id
  WHERE os.org_id = p_org_id
  AND os.status IN ('active', 'trialing');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if organization has a specific feature enabled
CREATE OR REPLACE FUNCTION org_has_feature(p_org_id UUID, p_feature_key TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_plan_feature BOOLEAN;
  v_override_enabled BOOLEAN;
BEGIN
  -- First check for explicit override
  SELECT is_enabled INTO v_override_enabled
  FROM organization_feature_flags
  WHERE org_id = p_org_id
  AND feature_key = p_feature_key
  AND (expires_at IS NULL OR expires_at > NOW());

  IF v_override_enabled IS NOT NULL THEN
    RETURN v_override_enabled;
  END IF;

  -- Fall back to plan features
  SELECT (sp.features->p_feature_key)::boolean INTO v_plan_feature
  FROM organization_subscriptions os
  JOIN subscription_plans sp ON sp.id = os.plan_id
  WHERE os.org_id = p_org_id
  AND os.status IN ('active', 'trialing');

  RETURN COALESCE(v_plan_feature, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Record a usage event
CREATE OR REPLACE FUNCTION record_usage_event(
  p_org_id UUID,
  p_user_id UUID,
  p_event_type TEXT,
  p_event_subtype TEXT DEFAULT NULL,
  p_quantity INTEGER DEFAULT 1,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO usage_events (org_id, user_id, event_type, event_subtype, quantity, metadata)
  VALUES (p_org_id, p_user_id, p_event_type, p_event_subtype, p_quantity, p_metadata)
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE subscription_plans IS 'Available subscription tiers with pricing and limits';
COMMENT ON TABLE organization_subscriptions IS 'Links organizations to their active subscription plan';
COMMENT ON TABLE organization_usage IS 'Monthly usage snapshots per organization';
COMMENT ON TABLE usage_events IS 'Detailed usage event log for tracking';
COMMENT ON TABLE organization_feature_flags IS 'Per-organization feature overrides';
COMMENT ON TABLE billing_history IS 'Billing events and payment history';
COMMENT ON FUNCTION get_org_plan_features(UUID) IS 'Gets the feature flags for an org based on their plan';
COMMENT ON FUNCTION get_org_limits(UUID) IS 'Gets usage limits for an org (with custom overrides)';
COMMENT ON FUNCTION org_has_feature(UUID, TEXT) IS 'Checks if an org has access to a specific feature';
COMMENT ON FUNCTION record_usage_event(UUID, UUID, TEXT, TEXT, INTEGER, JSONB) IS 'Records a usage event for tracking';
