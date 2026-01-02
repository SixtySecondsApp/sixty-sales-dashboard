-- ============================================================================
-- BILLING ANALYTICS METRICS
-- RevenueCat-inspired subscription analytics (MRR, churn, retention, LTV)
-- ============================================================================

-- ============================================================================
-- VIEW: Current MRR (Monthly Recurring Revenue)
-- ============================================================================
CREATE OR REPLACE VIEW mrr_current_view AS
SELECT
  COALESCE(SUM(normalized_mrr_cents), 0) as total_mrr_cents,
  COUNT(*) FILTER (WHERE is_active) as active_subscriptions,
  COUNT(*) FILTER (WHERE is_trialing) as trialing_subscriptions,
  currency
FROM subscription_facts_view
WHERE is_active = true
GROUP BY currency;

-- ============================================================================
-- FUNCTION: Get MRR for a date range
-- ============================================================================
CREATE OR REPLACE FUNCTION get_mrr_by_date_range(
  p_start_date DATE,
  p_end_date DATE,
  p_currency TEXT DEFAULT NULL
)
RETURNS TABLE (
  date DATE,
  mrr_cents BIGINT,
  active_subscriptions INTEGER,
  trialing_subscriptions INTEGER,
  currency TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::DATE as date
  ),
  daily_mrr AS (
    SELECT
      ds.date,
      COALESCE(SUM(
        CASE
          WHEN sfv.is_active AND sfv.started_at <= ds.date AND (sfv.canceled_at IS NULL OR sfv.canceled_at > ds.date)
          THEN sfv.normalized_mrr_cents
          ELSE 0
        END
      ), 0) as mrr_cents,
      COUNT(*) FILTER (
        WHERE sfv.is_active 
        AND sfv.started_at <= ds.date 
        AND (sfv.canceled_at IS NULL OR sfv.canceled_at > ds.date)
      ) as active_subscriptions,
      COUNT(*) FILTER (
        WHERE sfv.is_trialing 
        AND sfv.started_at <= ds.date 
        AND (sfv.canceled_at IS NULL OR sfv.canceled_at > ds.date)
      ) as trialing_subscriptions,
      COALESCE(p_currency, sfv.currency) as currency
    FROM date_series ds
    CROSS JOIN subscription_facts_view sfv
    WHERE (p_currency IS NULL OR sfv.currency = p_currency)
    GROUP BY ds.date, currency
  )
  SELECT * FROM daily_mrr
  ORDER BY date, currency;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: Calculate churn rate
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_churn_rate(
  p_start_date DATE,
  p_end_date DATE,
  p_currency TEXT DEFAULT NULL
)
RETURNS TABLE (
  period_start DATE,
  period_end DATE,
  subscriber_churn_rate NUMERIC,
  mrr_churn_rate NUMERIC,
  subscribers_canceled INTEGER,
  mrr_lost_cents BIGINT,
  active_subscriptions_start INTEGER,
  mrr_start_cents BIGINT,
  currency TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH period_start_subs AS (
    -- Active subscriptions at start of period
    SELECT
      COUNT(*) as count,
      COALESCE(SUM(normalized_mrr_cents), 0) as mrr,
      currency
    FROM subscription_facts_view
    WHERE is_active = true
      AND started_at <= p_start_date
      AND (canceled_at IS NULL OR canceled_at > p_start_date)
      AND (p_currency IS NULL OR currency = p_currency)
    GROUP BY currency
  ),
  period_cancellations AS (
    -- Subscriptions canceled during period
    SELECT
      COUNT(*) as count,
      COALESCE(SUM(normalized_mrr_cents), 0) as mrr_lost,
      currency
    FROM subscription_facts_view
    WHERE canceled_at BETWEEN p_start_date AND p_end_date
      AND (p_currency IS NULL OR currency = p_currency)
    GROUP BY currency
  )
  SELECT
    p_start_date as period_start,
    p_end_date as period_end,
    CASE
      WHEN pss.count > 0 THEN (pc.count::NUMERIC / pss.count::NUMERIC * 100)
      ELSE 0
    END as subscriber_churn_rate,
    CASE
      WHEN pss.mrr > 0 THEN (pc.mrr_lost::NUMERIC / pss.mrr::NUMERIC * 100)
      ELSE 0
    END as mrr_churn_rate,
    COALESCE(pc.count, 0)::INTEGER as subscribers_canceled,
    COALESCE(pc.mrr_lost, 0) as mrr_lost_cents,
    COALESCE(pss.count, 0)::INTEGER as active_subscriptions_start,
    COALESCE(pss.mrr, 0) as mrr_start_cents,
    COALESCE(pss.currency, pc.currency) as currency
  FROM period_start_subs pss
  FULL OUTER JOIN period_cancellations pc ON pss.currency = pc.currency;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: Get subscription retention by cohort
-- ============================================================================
CREATE OR REPLACE FUNCTION get_subscription_retention_cohorts(
  p_cohort_start DATE,
  p_cohort_end DATE,
  p_retention_months INTEGER[] DEFAULT ARRAY[1, 3, 6, 12]
)
RETURNS TABLE (
  cohort_month DATE,
  cohort_size INTEGER,
  retention_month INTEGER,
  retained_count INTEGER,
  retention_rate NUMERIC,
  mrr_retained_cents BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH cohorts AS (
    SELECT
      DATE_TRUNC('month', started_at)::DATE as cohort_month,
      COUNT(*) as cohort_size,
      SUM(normalized_mrr_cents) as cohort_mrr
    FROM subscription_facts_view
    WHERE DATE_TRUNC('month', started_at)::DATE BETWEEN p_cohort_start AND p_cohort_end
    GROUP BY DATE_TRUNC('month', started_at)::DATE
  ),
  retention_data AS (
    SELECT
      c.cohort_month,
      c.cohort_size,
      rm.retention_month,
      COUNT(*) FILTER (
        WHERE sfv.is_active 
        OR (sfv.canceled_at IS NOT NULL AND sfv.canceled_at > c.cohort_month + (rm.retention_month || ' months')::INTERVAL)
      ) as retained_count,
      SUM(sfv.normalized_mrr_cents) FILTER (
        WHERE sfv.is_active 
        OR (sfv.canceled_at IS NOT NULL AND sfv.canceled_at > c.cohort_month + (rm.retention_month || ' months')::INTERVAL)
      ) as mrr_retained
    FROM cohorts c
    CROSS JOIN UNNEST(p_retention_months) as rm(retention_month)
    LEFT JOIN subscription_facts_view sfv ON 
      DATE_TRUNC('month', sfv.started_at)::DATE = c.cohort_month
      AND (
        sfv.is_active 
        OR (sfv.canceled_at IS NOT NULL AND sfv.canceled_at > c.cohort_month + (rm.retention_month || ' months')::INTERVAL)
      )
    GROUP BY c.cohort_month, c.cohort_size, rm.retention_month
  )
  SELECT
    rd.cohort_month,
    rd.cohort_size,
    rd.retention_month,
    rd.retained_count,
    CASE
      WHEN rd.cohort_size > 0 THEN (rd.retained_count::NUMERIC / rd.cohort_size::NUMERIC * 100)
      ELSE 0
    END as retention_rate,
    COALESCE(rd.mrr_retained, 0) as mrr_retained_cents
  FROM retention_data rd
  ORDER BY rd.cohort_month, rd.retention_month;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: Calculate realized LTV (Lifetime Value)
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_realized_ltv(
  p_cohort_start DATE DEFAULT NULL,
  p_cohort_end DATE DEFAULT NULL,
  p_currency TEXT DEFAULT NULL
)
RETURNS TABLE (
  org_id UUID,
  cohort_month DATE,
  total_paid_cents BIGINT,
  subscription_months INTEGER,
  avg_monthly_revenue_cents INTEGER,
  currency TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH org_payments AS (
    SELECT
      bh.org_id,
      SUM(bh.amount) as total_paid,
      COUNT(DISTINCT DATE_TRUNC('month', bh.created_at)) as months_active,
      bh.currency
    FROM billing_history bh
    WHERE bh.status = 'paid'
      AND bh.event_type = 'payment'
      AND (p_currency IS NULL OR bh.currency = p_currency)
    GROUP BY bh.org_id, bh.currency
  ),
  org_cohorts AS (
    SELECT
      os.org_id,
      DATE_TRUNC('month', os.started_at)::DATE as cohort_month,
      os.currency
    FROM organization_subscriptions os
    WHERE (p_cohort_start IS NULL OR DATE_TRUNC('month', os.started_at)::DATE >= p_cohort_start)
      AND (p_cohort_end IS NULL OR DATE_TRUNC('month', os.started_at)::DATE <= p_cohort_end)
      AND (p_currency IS NULL OR os.currency = p_currency)
  )
  SELECT
    oc.org_id,
    oc.cohort_month,
    COALESCE(op.total_paid, 0) as total_paid_cents,
    COALESCE(op.months_active, 0)::INTEGER as subscription_months,
    CASE
      WHEN op.months_active > 0 THEN (op.total_paid / op.months_active)::INTEGER
      ELSE 0
    END as avg_monthly_revenue_cents,
    COALESCE(oc.currency, op.currency) as currency
  FROM org_cohorts oc
  LEFT JOIN org_payments op ON oc.org_id = op.org_id AND oc.currency = op.currency
  ORDER BY oc.cohort_month, oc.org_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: Calculate trial conversion rate
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_trial_conversion_rate(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  period_start DATE,
  period_end DATE,
  trials_started INTEGER,
  trials_converted INTEGER,
  conversion_rate NUMERIC,
  avg_trial_days NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH trials AS (
    SELECT
      os.id,
      os.trial_start_at,
      os.trial_ends_at,
      os.status,
      CASE
        WHEN os.status = 'active' AND os.trial_ends_at IS NOT NULL THEN true
        ELSE false
      END as converted,
      EXTRACT(DAY FROM (os.trial_ends_at - os.trial_start_at)) as trial_days
    FROM organization_subscriptions os
    WHERE os.trial_start_at BETWEEN p_start_date AND p_end_date
      AND os.trial_start_at IS NOT NULL
  )
  SELECT
    p_start_date as period_start,
    p_end_date as period_end,
    COUNT(*)::INTEGER as trials_started,
    COUNT(*) FILTER (WHERE converted)::INTEGER as trials_converted,
    CASE
      WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE converted)::NUMERIC / COUNT(*)::NUMERIC * 100)
      ELSE 0
    END as conversion_rate,
    AVG(trial_days) as avg_trial_days
  FROM trials;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- VIEW: MRR Movement (New, Expansion, Contraction, Churned)
-- ============================================================================
CREATE OR REPLACE VIEW mrr_movement_view AS
WITH subscription_changes AS (
  SELECT
    bel.org_id,
    bel.event_type,
    bel.occurred_at::DATE as change_date,
    bel.metadata->>'subscription_id' as subscription_id,
    bel.metadata->>'amount' as amount,
    bel.metadata->>'currency' as currency
  FROM billing_event_log bel
  WHERE bel.provider = 'stripe'
    AND bel.event_type IN ('subscription_created', 'subscription_updated', 'subscription_canceled')
    AND bel.processed_at IS NOT NULL
)
SELECT
  sc.change_date,
  sc.currency,
  COUNT(*) FILTER (WHERE sc.event_type = 'subscription_created') as new_subscriptions,
  SUM((sc.metadata->>'amount')::BIGINT) FILTER (WHERE sc.event_type = 'subscription_created') as new_mrr_cents,
  COUNT(*) FILTER (WHERE sc.event_type = 'subscription_updated' AND (sc.metadata->>'plan_id') IS NOT NULL) as plan_changes,
  COUNT(*) FILTER (WHERE sc.event_type = 'subscription_canceled') as canceled_subscriptions,
  SUM((sc.metadata->>'amount')::BIGINT) FILTER (WHERE sc.event_type = 'subscription_canceled') as churned_mrr_cents
FROM subscription_changes sc
GROUP BY sc.change_date, sc.currency
ORDER BY sc.change_date DESC, sc.currency;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON VIEW mrr_current_view IS 'Current MRR snapshot (active subscriptions only)';
COMMENT ON FUNCTION get_mrr_by_date_range IS 'Get MRR for a date range (daily breakdown)';
COMMENT ON FUNCTION calculate_churn_rate IS 'Calculate subscriber and MRR churn rate for a period';
COMMENT ON FUNCTION get_subscription_retention_cohorts IS 'Get subscription retention by cohort (monthly cohorts)';
COMMENT ON FUNCTION calculate_realized_ltv IS 'Calculate realized lifetime value (based on actual payments)';
COMMENT ON FUNCTION calculate_trial_conversion_rate IS 'Calculate trial conversion rate and average trial duration';
COMMENT ON VIEW mrr_movement_view IS 'MRR movement breakdown (new, expansion, contraction, churned)';
