-- ============================================================================
-- UPDATE TEAM PLAN PRICING
-- New structure: £78/mo (2 seats included), £39/extra seat
-- ============================================================================

-- Update or create Team plan with new pricing structure
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
  'Team',
  'team',
  'Collaboration at scale - 2 seats included',
  7800,         -- £78/month (in pence) for 2 seats
  74900,        -- £749/year (20% discount, in pence)
  'GBP',
  NULL,         -- Unlimited users (seat-based)
  NULL,         -- Unlimited meetings
  NULL,         -- Unlimited AI tokens
  NULL,         -- Unlimited storage
  2,            -- 2 seats included in base price
  3900,         -- £39/seat for additional seats (in pence)
  NULL,         -- Unlimited retention
  14,           -- 14-day trial
  '{
    "analytics": true,
    "team_insights": true,
    "api_access": true,
    "custom_branding": false,
    "priority_support": true,
    "integrations": true,
    "sso": true
  }'::jsonb,
  true,         -- is_active
  false,        -- is_default
  false,        -- is_free_tier
  true,         -- is_public
  40,           -- display_order (after Pro at 30)
  NULL,         -- No badge (Pro is "Most Popular")
  'Start Free Trial',
  ARRAY[
    '2 seats included',
    '£39/seat for additional users',
    'Unlimited meetings',
    'Unlimited retention',
    'Team workspaces',
    'Manager dashboard',
    'SSO / SAML',
    'Priority support'
  ]
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  currency = EXCLUDED.currency,
  max_users = EXCLUDED.max_users,
  max_meetings_per_month = EXCLUDED.max_meetings_per_month,
  max_ai_tokens_per_month = EXCLUDED.max_ai_tokens_per_month,
  max_storage_mb = EXCLUDED.max_storage_mb,
  included_seats = EXCLUDED.included_seats,
  per_seat_price = EXCLUDED.per_seat_price,
  meeting_retention_months = EXCLUDED.meeting_retention_months,
  trial_days = EXCLUDED.trial_days,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  is_public = EXCLUDED.is_public,
  display_order = EXCLUDED.display_order,
  badge_text = EXCLUDED.badge_text,
  cta_text = EXCLUDED.cta_text,
  highlight_features = EXCLUDED.highlight_features,
  updated_at = now();

-- ============================================================================
-- ALSO UPDATE PRO PLAN FOR CONSISTENCY
-- Ensure Pro plan is correctly priced at £49/mo for single user
-- ============================================================================

UPDATE subscription_plans
SET
  description = 'Unlimited everything for power users',
  price_monthly = 4900,      -- £49/month (in pence)
  price_yearly = 47000,      -- £470/year (20% discount, in pence)
  max_users = 1,             -- Single user plan
  included_seats = 1,
  per_seat_price = 0,        -- No additional seats (upgrade to Team for more)
  max_meetings_per_month = NULL,  -- Unlimited
  meeting_retention_months = NULL, -- Unlimited
  badge_text = 'Most Popular',
  display_order = 30,
  highlight_features = ARRAY[
    'Unlimited meetings',
    'Unlimited proposals',
    'Unlimited retention',
    'API access',
    'Priority support'
  ],
  updated_at = now()
WHERE slug = 'pro';

-- ============================================================================
-- UPDATE SOLO PLAN FOR CONSISTENCY
-- Ensure Solo plan is correctly priced at £29/mo
-- ============================================================================

UPDATE subscription_plans
SET
  name = 'Solo',
  description = 'Perfect for individual sales reps',
  price_monthly = 2900,      -- £29/month (in pence)
  price_yearly = 29000,      -- £290/year (17% discount, in pence)
  max_users = 1,
  included_seats = 1,
  per_seat_price = 0,
  max_meetings_per_month = 100,
  meeting_retention_months = 6,
  display_order = 20,
  highlight_features = ARRAY[
    '100 meetings/month',
    '5 proposals/month',
    '6-month retention',
    'Basic CRM'
  ],
  updated_at = now()
WHERE slug = 'solo' OR slug = 'starter';

-- Ensure slug is 'solo' not 'starter' for consistency
UPDATE subscription_plans
SET slug = 'solo'
WHERE slug = 'starter';

-- ============================================================================
-- ADD STRIPE SEAT PRICE ID COLUMN IF NOT EXISTS
-- This will store the Stripe price ID for additional seats
-- ============================================================================

-- Note: This column should already exist from previous migrations
-- Adding this comment for documentation

COMMENT ON COLUMN subscription_plans.included_seats IS 'Number of seats included in the base price (e.g., 2 for Team plan)';
COMMENT ON COLUMN subscription_plans.per_seat_price IS 'Price in pence for each additional seat beyond included_seats';
COMMENT ON COLUMN subscription_plans.stripe_seat_price_id IS 'Stripe price ID for additional seat billing';







