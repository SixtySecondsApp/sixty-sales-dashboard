-- ============================================================================
-- STRIPE SUBSCRIPTION INTEGRATION
-- Extends existing SaaS admin tables with Stripe-specific fields
-- ============================================================================

-- ============================================================================
-- EXTEND SUBSCRIPTION_PLANS TABLE WITH STRIPE IDS
-- ============================================================================
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS stripe_product_id TEXT;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS stripe_price_id_monthly TEXT;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS stripe_price_id_yearly TEXT;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS stripe_seat_price_id TEXT; -- For per-seat overage billing
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS included_seats INTEGER DEFAULT 1;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS per_seat_price INTEGER DEFAULT 0; -- In pence (e.g., 2500 = £25)
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS meeting_retention_months INTEGER; -- NULL = unlimited
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 14;

-- ============================================================================
-- EXTEND ORGANIZATION_SUBSCRIPTIONS WITH TRIAL TRACKING
-- ============================================================================
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS trial_start_at TIMESTAMPTZ;
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS stripe_latest_invoice_id TEXT;
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT;

-- ============================================================================
-- SEAT USAGE TRACKING TABLE (For Tier C per-seat overage)
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscription_seat_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES organization_subscriptions(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  active_seats INTEGER NOT NULL DEFAULT 0,
  included_seats INTEGER NOT NULL DEFAULT 1,
  overage_seats INTEGER GENERATED ALWAYS AS (GREATEST(0, active_seats - included_seats)) STORED,
  overage_amount_cents INTEGER DEFAULT 0,
  stripe_usage_record_id TEXT,
  billed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_subscription_period UNIQUE (subscription_id, period_start)
);

-- ============================================================================
-- IN-APP NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'trial_ending', 'trial_ended', 'payment_failed', 'subscription_updated', 'usage_warning'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  action_text TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- EXTEND BILLING_HISTORY WITH MORE STRIPE FIELDS
-- ============================================================================
ALTER TABLE billing_history ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT;
ALTER TABLE billing_history ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT;
ALTER TABLE billing_history ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE billing_history ADD COLUMN IF NOT EXISTS hosted_invoice_url TEXT;
ALTER TABLE billing_history ADD COLUMN IF NOT EXISTS pdf_url TEXT;
ALTER TABLE billing_history ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ;
ALTER TABLE billing_history ADD COLUMN IF NOT EXISTS period_end TIMESTAMPTZ;

-- ============================================================================
-- INDEXES FOR NEW TABLES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_seat_usage_subscription_id ON subscription_seat_usage(subscription_id);
CREATE INDEX IF NOT EXISTS idx_seat_usage_org_id ON subscription_seat_usage(org_id);
CREATE INDEX IF NOT EXISTS idx_seat_usage_period ON subscription_seat_usage(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_org_id ON user_notifications(org_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_type ON user_notifications(type);
CREATE INDEX IF NOT EXISTS idx_user_notifications_is_read ON user_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON user_notifications(created_at);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_stripe_product ON subscription_plans(stripe_product_id);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_stripe_price ON organization_subscriptions(stripe_price_id);

-- ============================================================================
-- RLS POLICIES FOR NEW TABLES
-- ============================================================================
ALTER TABLE subscription_seat_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

-- Seat Usage: Org admins can view, super admins can manage
CREATE POLICY "Org admins can view their seat usage"
  ON subscription_seat_usage FOR SELECT
  USING (
    get_org_role(auth.uid(), org_id) IN ('owner', 'admin')
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Super admins can manage seat usage"
  ON subscription_seat_usage FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- User Notifications: Users can view/update their own
CREATE POLICY "Users can view their notifications"
  ON user_notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their notifications"
  ON user_notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Super admins can manage all notifications"
  ON user_notifications FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Service role can insert notifications (for webhooks)
CREATE POLICY "Service role can insert notifications"
  ON user_notifications FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get trial status for an organization
CREATE OR REPLACE FUNCTION get_trial_status(p_org_id UUID)
RETURNS TABLE(
  is_trialing BOOLEAN,
  trial_ends_at TIMESTAMPTZ,
  days_remaining INTEGER,
  trial_start_at TIMESTAMPTZ,
  has_payment_method BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    os.status = 'trialing' as is_trialing,
    os.trial_ends_at,
    GREATEST(0, EXTRACT(DAY FROM (os.trial_ends_at - NOW()))::INTEGER) as days_remaining,
    os.trial_start_at,
    os.stripe_payment_method_id IS NOT NULL as has_payment_method
  FROM organization_subscriptions os
  WHERE os.org_id = p_org_id
  AND os.status IN ('active', 'trialing')
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Calculate seat overage for a subscription
CREATE OR REPLACE FUNCTION calculate_seat_overage(p_subscription_id UUID)
RETURNS TABLE(
  active_seats INTEGER,
  included_seats INTEGER,
  overage_seats INTEGER,
  overage_amount_cents INTEGER
) AS $$
DECLARE
  v_included_seats INTEGER;
  v_per_seat_price INTEGER;
  v_active_count INTEGER;
  v_org_id UUID;
BEGIN
  -- Get plan details and org_id
  SELECT sp.included_seats, sp.per_seat_price, os.org_id
  INTO v_included_seats, v_per_seat_price, v_org_id
  FROM organization_subscriptions os
  JOIN subscription_plans sp ON sp.id = os.plan_id
  WHERE os.id = p_subscription_id;

  -- Count active org members
  SELECT COUNT(*)::INTEGER
  INTO v_active_count
  FROM organization_memberships om
  WHERE om.org_id = v_org_id;

  RETURN QUERY
  SELECT
    v_active_count as active_seats,
    COALESCE(v_included_seats, 1) as included_seats,
    GREATEST(0, v_active_count - COALESCE(v_included_seats, 1)) as overage_seats,
    GREATEST(0, v_active_count - COALESCE(v_included_seats, 1)) * COALESCE(v_per_seat_price, 0) as overage_amount_cents;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get organization subscription with plan details
CREATE OR REPLACE FUNCTION get_org_subscription_details(p_org_id UUID)
RETURNS TABLE(
  subscription_id UUID,
  plan_id UUID,
  plan_name TEXT,
  plan_slug TEXT,
  status TEXT,
  billing_cycle TEXT,
  price_monthly INTEGER,
  price_yearly INTEGER,
  currency TEXT,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN,
  max_users INTEGER,
  max_meetings_per_month INTEGER,
  meeting_retention_months INTEGER,
  included_seats INTEGER,
  per_seat_price INTEGER,
  features JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    os.id as subscription_id,
    os.plan_id,
    sp.name as plan_name,
    sp.slug as plan_slug,
    os.status,
    os.billing_cycle,
    sp.price_monthly,
    sp.price_yearly,
    sp.currency,
    os.stripe_subscription_id,
    os.stripe_customer_id,
    os.current_period_start,
    os.current_period_end,
    os.trial_ends_at,
    os.cancel_at_period_end,
    COALESCE(os.custom_max_users, sp.max_users) as max_users,
    COALESCE(os.custom_max_meetings, sp.max_meetings_per_month) as max_meetings_per_month,
    sp.meeting_retention_months,
    sp.included_seats,
    sp.per_seat_price,
    sp.features
  FROM organization_subscriptions os
  JOIN subscription_plans sp ON sp.id = os.plan_id
  WHERE os.org_id = p_org_id
  AND os.status IN ('active', 'trialing', 'past_due')
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create notification for org admins
CREATE OR REPLACE FUNCTION create_org_admin_notification(
  p_org_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_action_url TEXT DEFAULT NULL,
  p_action_text TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS SETOF UUID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Create notification for all org owners and admins
  FOR v_user_id IN
    SELECT om.user_id
    FROM organization_memberships om
    WHERE om.org_id = p_org_id
    AND om.role IN ('owner', 'admin')
  LOOP
    RETURN NEXT (
      INSERT INTO user_notifications (user_id, org_id, type, title, message, action_url, action_text, metadata)
      VALUES (v_user_id, p_org_id, p_type, p_title, p_message, p_action_url, p_action_text, p_metadata)
      RETURNING id
    );
  END LOOP;
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UPDATE EXISTING PLANS WITH STRIPE PRODUCT IDS
-- NOTE: Price IDs need to be updated with actual Stripe price IDs
-- ============================================================================

-- Update or insert Tier A (Starter) - £49/mo
INSERT INTO subscription_plans (
  name, slug, description,
  price_monthly, price_yearly, currency,
  max_users, max_meetings_per_month,
  stripe_product_id, stripe_price_id_monthly,
  included_seats, meeting_retention_months, trial_days,
  features, is_active, display_order, badge_text
) VALUES (
  'Starter', 'starter', 'Perfect for individual sales professionals',
  4900, 49000, 'GBP',
  1, 50,
  'prod_TV8pjd0ONjNDbr', 'price_TIER_A_MONTHLY', -- UPDATE with actual price ID
  1, 1, 14,
  '{"analytics": true, "team_insights": false, "api_access": false, "custom_branding": false, "priority_support": false}'::jsonb,
  true, 1, NULL
) ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  currency = EXCLUDED.currency,
  max_users = EXCLUDED.max_users,
  max_meetings_per_month = EXCLUDED.max_meetings_per_month,
  stripe_product_id = EXCLUDED.stripe_product_id,
  stripe_price_id_monthly = EXCLUDED.stripe_price_id_monthly,
  included_seats = EXCLUDED.included_seats,
  meeting_retention_months = EXCLUDED.meeting_retention_months,
  trial_days = EXCLUDED.trial_days,
  features = EXCLUDED.features,
  display_order = EXCLUDED.display_order;

-- Update or insert Tier B (Growth) - £79/mo
INSERT INTO subscription_plans (
  name, slug, description,
  price_monthly, price_yearly, currency,
  max_users, max_meetings_per_month,
  stripe_product_id, stripe_price_id_monthly,
  included_seats, meeting_retention_months, trial_days,
  features, is_active, display_order, badge_text
) VALUES (
  'Growth', 'growth', 'For growing sales teams',
  7900, 79000, 'GBP',
  1, 150,
  'prod_TV8r5Y9RLQQ22G', 'price_TIER_B_MONTHLY', -- UPDATE with actual price ID
  1, 4, 14,
  '{"analytics": true, "team_insights": true, "api_access": true, "custom_branding": false, "priority_support": false}'::jsonb,
  true, 2, 'Most Popular'
) ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  currency = EXCLUDED.currency,
  max_users = EXCLUDED.max_users,
  max_meetings_per_month = EXCLUDED.max_meetings_per_month,
  stripe_product_id = EXCLUDED.stripe_product_id,
  stripe_price_id_monthly = EXCLUDED.stripe_price_id_monthly,
  included_seats = EXCLUDED.included_seats,
  meeting_retention_months = EXCLUDED.meeting_retention_months,
  trial_days = EXCLUDED.trial_days,
  features = EXCLUDED.features,
  display_order = EXCLUDED.display_order,
  badge_text = EXCLUDED.badge_text;

-- Update or insert Tier C (Team) - £129/mo
INSERT INTO subscription_plans (
  name, slug, description,
  price_monthly, price_yearly, currency,
  max_users, max_meetings_per_month,
  stripe_product_id, stripe_price_id_monthly, stripe_seat_price_id,
  included_seats, per_seat_price, meeting_retention_months, trial_days,
  features, is_active, display_order, badge_text
) VALUES (
  'Team', 'team', 'For sales teams up to 5 users',
  12900, 129000, 'GBP',
  5, 500,
  'prod_TV8rcKkiMBldKq', 'price_TIER_C_MONTHLY', 'price_SEAT_OVERAGE', -- UPDATE with actual price IDs
  5, 2500, 24, 14, -- £25 per additional seat
  '{"analytics": true, "team_insights": true, "api_access": true, "custom_branding": true, "priority_support": true}'::jsonb,
  true, 3, 'Best Value'
) ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  currency = EXCLUDED.currency,
  max_users = EXCLUDED.max_users,
  max_meetings_per_month = EXCLUDED.max_meetings_per_month,
  stripe_product_id = EXCLUDED.stripe_product_id,
  stripe_price_id_monthly = EXCLUDED.stripe_price_id_monthly,
  stripe_seat_price_id = EXCLUDED.stripe_seat_price_id,
  included_seats = EXCLUDED.included_seats,
  per_seat_price = EXCLUDED.per_seat_price,
  meeting_retention_months = EXCLUDED.meeting_retention_months,
  trial_days = EXCLUDED.trial_days,
  features = EXCLUDED.features,
  display_order = EXCLUDED.display_order,
  badge_text = EXCLUDED.badge_text;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE subscription_seat_usage IS 'Tracks per-seat overage for Team tier billing';
COMMENT ON TABLE user_notifications IS 'In-app notifications for subscription events';
COMMENT ON FUNCTION get_trial_status(UUID) IS 'Returns trial status details for an organization';
COMMENT ON FUNCTION calculate_seat_overage(UUID) IS 'Calculates seat overage and cost for a subscription';
COMMENT ON FUNCTION get_org_subscription_details(UUID) IS 'Returns full subscription details with plan info';
COMMENT ON FUNCTION create_org_admin_notification(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) IS 'Creates notifications for org owners and admins';
