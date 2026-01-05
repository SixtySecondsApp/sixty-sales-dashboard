// src/lib/services/billingAnalyticsService.ts
// Service for billing analytics metrics (RevenueCat-inspired)

import { supabase } from '@/lib/supabase/clientV2';

// ============================================================================
// Types
// ============================================================================

export interface MRRData {
  total_mrr_cents: number;
  active_subscriptions: number;
  trialing_subscriptions: number;
  currency: string;
}

export interface MRRByDate {
  date: string;
  mrr_cents: number;
  active_subscriptions: number;
  trialing_subscriptions: number;
  currency: string;
}

export interface ChurnRate {
  period_start: string;
  period_end: string;
  subscriber_churn_rate: number;
  mrr_churn_rate: number;
  subscribers_canceled: number;
  mrr_lost_cents: number;
  active_subscriptions_start: number;
  mrr_start_cents: number;
  currency: string;
}

export interface RetentionCohort {
  cohort_month: string;
  cohort_size: number;
  retention_month: number;
  retained_count: number;
  retention_rate: number;
  mrr_retained_cents: number;
}

export interface RealizedLTV {
  org_id: string;
  cohort_month: string;
  total_paid_cents: number;
  subscription_months: number;
  avg_monthly_revenue_cents: number;
  currency: string;
}

export interface TrialConversion {
  period_start: string;
  period_end: string;
  trials_started: number;
  trials_converted: number;
  conversion_rate: number;
  avg_trial_days: number;
}

export interface MRRMovement {
  change_date: string;
  currency: string;
  new_subscriptions: number;
  new_mrr_cents: number;
  plan_changes: number;
  canceled_subscriptions: number;
  churned_mrr_cents: number;
}

// ============================================================================
// Current MRR
// ============================================================================

export async function getCurrentMRR(): Promise<MRRData[]> {
  const { data, error } = await supabase
    .from('mrr_current_view')
    .select('*');

  if (error) {
    console.error('Error fetching current MRR:', error);
    throw new Error('Failed to fetch current MRR');
  }

  return data || [];
}

// ============================================================================
// MRR by Date Range
// ============================================================================

export async function getMRRByDateRange(
  startDate: Date,
  endDate: Date,
  currency?: string
): Promise<MRRByDate[]> {
  const { data, error } = await supabase.rpc('get_mrr_by_date_range', {
    p_start_date: startDate.toISOString().split('T')[0],
    p_end_date: endDate.toISOString().split('T')[0],
    p_currency: currency || null,
  });

  if (error) {
    console.error('Error fetching MRR by date range:', error);
    throw new Error('Failed to fetch MRR by date range');
  }

  return data || [];
}

// ============================================================================
// Churn Rate
// ============================================================================

export async function getChurnRate(
  startDate: Date,
  endDate: Date,
  currency?: string
): Promise<ChurnRate[]> {
  const { data, error } = await supabase.rpc('calculate_churn_rate', {
    p_start_date: startDate.toISOString().split('T')[0],
    p_end_date: endDate.toISOString().split('T')[0],
    p_currency: currency || null,
  });

  if (error) {
    console.error('Error calculating churn rate:', error);
    throw new Error('Failed to calculate churn rate');
  }

  return data || [];
}

// ============================================================================
// Retention Cohorts
// ============================================================================

export async function getRetentionCohorts(
  cohortStart: Date,
  cohortEnd: Date,
  retentionMonths: number[] = [1, 3, 6, 12]
): Promise<RetentionCohort[]> {
  const { data, error } = await supabase.rpc('get_subscription_retention_cohorts', {
    p_cohort_start: cohortStart.toISOString().split('T')[0],
    p_cohort_end: cohortEnd.toISOString().split('T')[0],
    p_retention_months: retentionMonths,
  });

  if (error) {
    console.error('Error fetching retention cohorts:', error);
    throw new Error('Failed to fetch retention cohorts');
  }

  return data || [];
}

// ============================================================================
// Realized LTV
// ============================================================================

export async function getRealizedLTV(
  cohortStart?: Date,
  cohortEnd?: Date,
  currency?: string
): Promise<RealizedLTV[]> {
  const { data, error } = await supabase.rpc('calculate_realized_ltv', {
    p_cohort_start: cohortStart?.toISOString().split('T')[0] || null,
    p_cohort_end: cohortEnd?.toISOString().split('T')[0] || null,
    p_currency: currency || null,
  });

  if (error) {
    console.error('Error calculating realized LTV:', error);
    throw new Error('Failed to calculate realized LTV');
  }

  return data || [];
}

// ============================================================================
// Trial Conversion Rate
// ============================================================================

export async function getTrialConversionRate(
  startDate: Date,
  endDate: Date
): Promise<TrialConversion[]> {
  const { data, error } = await supabase.rpc('calculate_trial_conversion_rate', {
    p_start_date: startDate.toISOString().split('T')[0],
    p_end_date: endDate.toISOString().split('T')[0],
  });

  if (error) {
    console.error('Error calculating trial conversion rate:', error);
    throw new Error('Failed to calculate trial conversion rate');
  }

  return data || [];
}

// ============================================================================
// MRR Movement
// ============================================================================

export async function getMRRMovement(limit: number = 30): Promise<MRRMovement[]> {
  const { data, error } = await supabase
    .from('mrr_movement_view')
    .select('*')
    .order('change_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching MRR movement:', error);
    throw new Error('Failed to fetch MRR movement');
  }

  return data || [];
}
