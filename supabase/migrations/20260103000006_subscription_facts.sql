-- ============================================================================
-- SUBSCRIPTION FACTS FOR ANALYTICS
-- Add fields to organization_subscriptions for accurate MRR/churn calculations
-- ============================================================================

-- ============================================================================
-- EXTEND ORGANIZATION_SUBSCRIPTIONS WITH ANALYTICS FIELDS
-- ============================================================================

-- Current recurring amount (in cents) - actual amount charged, accounting for discounts
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS current_recurring_amount_cents INTEGER;

-- Recurring interval (month/year) - for MRR normalization
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS recurring_interval TEXT CHECK (recurring_interval IN ('month', 'year'));

-- Interval count (1 for monthly, 12 for yearly)
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS interval_count INTEGER DEFAULT 1;

-- Discount information (JSONB for flexibility)
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS discount_info JSONB DEFAULT '{}';

-- Customer country/region (for segmentation)
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS customer_country TEXT;

-- First payment date (for cohort analysis)
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS first_payment_at TIMESTAMPTZ;

-- Last payment date (for churn detection)
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMPTZ;

-- ============================================================================
-- HELPER FUNCTION: Calculate normalized monthly amount
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_normalized_monthly_amount(
  p_amount_cents INTEGER,
  p_interval TEXT,
  p_interval_count INTEGER DEFAULT 1
)
RETURNS INTEGER AS $$
BEGIN
  IF p_amount_cents IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Normalize to monthly
  CASE p_interval
    WHEN 'month' THEN
      RETURN p_amount_cents / p_interval_count;
    WHEN 'year' THEN
      RETURN p_amount_cents / (p_interval_count * 12);
    ELSE
      -- Default to monthly if unknown
      RETURN p_amount_cents;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- HELPER FUNCTION: Update subscription facts from Stripe subscription
-- ============================================================================
CREATE OR REPLACE FUNCTION update_subscription_facts(
  p_subscription_id UUID,
  p_recurring_amount_cents INTEGER,
  p_interval TEXT,
  p_interval_count INTEGER DEFAULT 1,
  p_discount_info JSONB DEFAULT '{}'::jsonb,
  p_customer_country TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE organization_subscriptions
  SET
    current_recurring_amount_cents = p_recurring_amount_cents,
    recurring_interval = p_interval,
    interval_count = p_interval_count,
    discount_info = p_discount_info,
    customer_country = COALESCE(p_customer_country, customer_country),
    updated_at = NOW()
  WHERE id = p_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VIEW: Subscription facts with normalized MRR
-- ============================================================================
CREATE OR REPLACE VIEW subscription_facts_view AS
SELECT
  os.id,
  os.org_id,
  os.plan_id,
  sp.slug as plan_slug,
  sp.name as plan_name,
  os.status,
  os.billing_cycle,
  os.started_at,
  os.current_period_start,
  os.current_period_end,
  os.trial_start_at,
  os.trial_ends_at,
  os.canceled_at,
  os.cancel_at_period_end,
  
  -- Recurring amount (actual, not plan price)
  os.current_recurring_amount_cents,
  os.recurring_interval,
  os.interval_count,
  os.currency,
  
  -- Normalized MRR (monthly recurring revenue)
  calculate_normalized_monthly_amount(
    os.current_recurring_amount_cents,
    os.recurring_interval,
    os.interval_count
  ) as normalized_mrr_cents,
  
  -- Discount info
  os.discount_info,
  
  -- Customer location
  os.customer_country,
  
  -- Payment dates
  os.first_payment_at,
  os.last_payment_at,
  
  -- Stripe IDs
  os.stripe_subscription_id,
  os.stripe_customer_id,
  os.stripe_price_id,
  
  -- Dates for cohort analysis
  DATE_TRUNC('month', os.started_at) as cohort_month,
  DATE_TRUNC('week', os.started_at) as cohort_week,
  
  -- Is active (for MRR calculations)
  os.status IN ('active', 'trialing') as is_active,
  
  -- Is trialing
  os.status = 'trialing' as is_trialing,
  
  os.created_at,
  os.updated_at
FROM organization_subscriptions os
JOIN subscription_plans sp ON sp.id = os.plan_id;

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_recurring_amount ON organization_subscriptions(current_recurring_amount_cents) WHERE current_recurring_amount_cents IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_recurring_interval ON organization_subscriptions(recurring_interval);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_customer_country ON organization_subscriptions(customer_country) WHERE customer_country IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_first_payment ON organization_subscriptions(first_payment_at) WHERE first_payment_at IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON COLUMN organization_subscriptions.current_recurring_amount_cents IS 'Actual recurring amount in cents (accounts for discounts/coupons)';
COMMENT ON COLUMN organization_subscriptions.recurring_interval IS 'Recurring interval: month or year';
COMMENT ON COLUMN organization_subscriptions.interval_count IS 'Number of intervals (1 for monthly, 12 for yearly)';
COMMENT ON COLUMN organization_subscriptions.discount_info IS 'Discount/coupon information (JSONB)';
COMMENT ON COLUMN organization_subscriptions.customer_country IS 'Customer country code (for segmentation)';
COMMENT ON COLUMN organization_subscriptions.first_payment_at IS 'Date of first successful payment (for cohort analysis)';
COMMENT ON COLUMN organization_subscriptions.last_payment_at IS 'Date of last successful payment (for churn detection)';
COMMENT ON FUNCTION calculate_normalized_monthly_amount IS 'Normalizes subscription amount to monthly recurring revenue';
COMMENT ON FUNCTION update_subscription_facts IS 'Updates subscription facts from Stripe subscription data';
COMMENT ON VIEW subscription_facts_view IS 'View of subscription facts with normalized MRR for analytics';
