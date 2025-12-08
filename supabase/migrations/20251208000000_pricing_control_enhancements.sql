-- ============================================================================
-- PRICING CONTROL ENHANCEMENTS
-- Adds fields for dynamic pricing page, free tier control, and Stripe sync
-- ============================================================================

-- ============================================================================
-- EXTEND SUBSCRIPTION_PLANS TABLE
-- ============================================================================

-- Add free tier marker
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS is_free_tier BOOLEAN DEFAULT false;

-- Add public visibility control (for pricing page display)
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;

-- Add custom CTA fields for pricing cards
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS cta_text TEXT DEFAULT 'Get Started';
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS cta_url TEXT; -- Optional custom URL

-- Add highlighted features for pricing cards (array of bullet points)
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS highlight_features TEXT[] DEFAULT '{}';

-- Add stripe sync metadata
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS stripe_synced_at TIMESTAMPTZ;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS stripe_sync_error TEXT;

-- ============================================================================
-- CREATE/UPDATE FREE TIER PLAN
-- ============================================================================

-- Update or insert the Free tier plan with 50 meetings/month
INSERT INTO subscription_plans (
  name,
  slug,
  description,
  price_monthly,
  price_yearly,
  currency,
  max_users,
  max_meetings_per_month,
  max_ai_tokens_per_month,
  max_storage_mb,
  included_seats,
  per_seat_price,
  meeting_retention_months,
  trial_days,
  features,
  is_active,
  is_default,
  is_free_tier,
  is_public,
  display_order,
  badge_text,
  cta_text,
  highlight_features
) VALUES (
  'Free',
  'free',
  'Get started with up to 50 meetings per month',
  0,
  0,
  'GBP',
  1,
  50,  -- 50 meetings free per month
  10000,
  100,
  1,
  0,
  1,  -- 1 month retention
  0,  -- No trial needed for free
  '{"analytics": true, "team_insights": false, "api_access": false, "custom_branding": false, "priority_support": false}'::jsonb,
  true,
  true,  -- Default plan for new signups
  true,  -- This is the free tier
  true,  -- Show on public pricing page
  0,     -- First in display order
  NULL,  -- No badge
  'Get Started Free',
  ARRAY['Up to 50 meetings/month', 'Basic analytics', '1 month history', '1 user']
) ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_users = EXCLUDED.max_users,
  max_meetings_per_month = EXCLUDED.max_meetings_per_month,
  max_ai_tokens_per_month = EXCLUDED.max_ai_tokens_per_month,
  max_storage_mb = EXCLUDED.max_storage_mb,
  included_seats = EXCLUDED.included_seats,
  meeting_retention_months = EXCLUDED.meeting_retention_months,
  trial_days = EXCLUDED.trial_days,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  is_default = EXCLUDED.is_default,
  is_free_tier = EXCLUDED.is_free_tier,
  is_public = EXCLUDED.is_public,
  display_order = EXCLUDED.display_order,
  cta_text = EXCLUDED.cta_text,
  highlight_features = EXCLUDED.highlight_features;

-- ============================================================================
-- UPDATE EXISTING PLANS WITH NEW FIELDS
-- ============================================================================

-- Update Starter plan
UPDATE subscription_plans SET
  is_free_tier = false,
  is_public = true,
  cta_text = 'Start Free Trial',
  highlight_features = ARRAY['Up to 50 meetings/month', 'Full analytics', '1 month history', '1 user', '14-day free trial']
WHERE slug = 'starter' AND is_free_tier IS NULL;

-- Update Growth plan
UPDATE subscription_plans SET
  is_free_tier = false,
  is_public = true,
  cta_text = 'Start Free Trial',
  highlight_features = ARRAY['Up to 150 meetings/month', 'Team insights', 'API access', '4 month history', '14-day free trial']
WHERE slug = 'growth' AND is_free_tier IS NULL;

-- Update Team plan
UPDATE subscription_plans SET
  is_free_tier = false,
  is_public = true,
  cta_text = 'Start Free Trial',
  highlight_features = ARRAY['Up to 500 meetings/month', 'Up to 5 users', 'Custom branding', '24 month history', 'Priority support']
WHERE slug = 'team' AND is_free_tier IS NULL;

-- Update Enterprise plan (if exists) - usually not public, contact sales
UPDATE subscription_plans SET
  is_free_tier = false,
  is_public = true,
  cta_text = 'Contact Sales',
  highlight_features = ARRAY['Unlimited meetings', 'Unlimited users', 'Custom integrations', 'Dedicated support', 'SLA guarantee']
WHERE slug = 'enterprise' AND is_free_tier IS NULL;

-- Ensure all plans have is_free_tier set
UPDATE subscription_plans SET is_free_tier = false WHERE is_free_tier IS NULL;
UPDATE subscription_plans SET is_public = true WHERE is_public IS NULL;
UPDATE subscription_plans SET cta_text = 'Get Started' WHERE cta_text IS NULL;
UPDATE subscription_plans SET highlight_features = '{}' WHERE highlight_features IS NULL;

-- ============================================================================
-- INDEXES FOR NEW COLUMNS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_subscription_plans_is_free_tier ON subscription_plans(is_free_tier);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_is_public ON subscription_plans(is_public);

-- ============================================================================
-- HELPER FUNCTION: Get public plans for pricing page
-- ============================================================================

CREATE OR REPLACE FUNCTION get_public_subscription_plans()
RETURNS TABLE(
  id UUID,
  name TEXT,
  slug TEXT,
  description TEXT,
  price_monthly INTEGER,
  price_yearly INTEGER,
  currency TEXT,
  max_users INTEGER,
  max_meetings_per_month INTEGER,
  max_ai_tokens_per_month INTEGER,
  max_storage_mb INTEGER,
  meeting_retention_months INTEGER,
  included_seats INTEGER,
  per_seat_price INTEGER,
  trial_days INTEGER,
  features JSONB,
  is_free_tier BOOLEAN,
  display_order INTEGER,
  badge_text TEXT,
  cta_text TEXT,
  cta_url TEXT,
  highlight_features TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sp.id,
    sp.name,
    sp.slug,
    sp.description,
    sp.price_monthly,
    sp.price_yearly,
    sp.currency,
    sp.max_users,
    sp.max_meetings_per_month,
    sp.max_ai_tokens_per_month,
    sp.max_storage_mb,
    sp.meeting_retention_months,
    sp.included_seats,
    sp.per_seat_price,
    sp.trial_days,
    sp.features,
    sp.is_free_tier,
    sp.display_order,
    sp.badge_text,
    sp.cta_text,
    sp.cta_url,
    sp.highlight_features
  FROM subscription_plans sp
  WHERE sp.is_active = true
  AND sp.is_public = true
  ORDER BY sp.display_order ASC, sp.price_monthly ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- HELPER FUNCTION: Get free tier plan
-- ============================================================================

CREATE OR REPLACE FUNCTION get_free_tier_plan()
RETURNS TABLE(
  id UUID,
  name TEXT,
  slug TEXT,
  max_meetings_per_month INTEGER,
  max_users INTEGER,
  features JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sp.id,
    sp.name,
    sp.slug,
    sp.max_meetings_per_month,
    sp.max_users,
    sp.features
  FROM subscription_plans sp
  WHERE sp.is_free_tier = true
  AND sp.is_active = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN subscription_plans.is_free_tier IS 'Marks this plan as the free tier (no payment required)';
COMMENT ON COLUMN subscription_plans.is_public IS 'Whether to show this plan on the public pricing page';
COMMENT ON COLUMN subscription_plans.cta_text IS 'Custom call-to-action button text for pricing cards';
COMMENT ON COLUMN subscription_plans.cta_url IS 'Optional custom URL for CTA button (if not standard checkout)';
COMMENT ON COLUMN subscription_plans.highlight_features IS 'Array of feature bullet points for pricing cards';
COMMENT ON COLUMN subscription_plans.stripe_synced_at IS 'Last time this plan was synced with Stripe';
COMMENT ON COLUMN subscription_plans.stripe_sync_error IS 'Error message from last Stripe sync attempt';
COMMENT ON FUNCTION get_public_subscription_plans() IS 'Returns all active public plans for pricing page display';
COMMENT ON FUNCTION get_free_tier_plan() IS 'Returns the free tier plan details';
