// src/lib/services/subscriptionService.ts
// Service layer for subscription management

import { supabase } from '@/lib/supabase/clientV2';
import type {
  SubscriptionPlan,
  OrganizationSubscription,
  SubscriptionWithPlan,
  OrganizationUsage,
  BillingHistoryItem,
  UserNotification,
  TrialStatus,
  UsageLimits,
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
  CreatePortalSessionRequest,
  CreatePortalSessionResponse,
  StartFreeTrialRequest,
  StartFreeTrialResponse,
  BillingCycle,
} from '../types/subscription';

// ============================================================================
// Plan Operations
// ============================================================================

/**
 * Fetch all active subscription plans
 */
export async function getPlans(): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching plans:', error);
    throw new Error('Failed to fetch subscription plans');
  }

  return data || [];
}

/**
 * Fetch a specific plan by ID
 */
export async function getPlanById(planId: string): Promise<SubscriptionPlan | null> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Error fetching plan:', error);
    throw new Error('Failed to fetch plan');
  }

  return data;
}

/**
 * Fetch a plan by slug
 */
export async function getPlanBySlug(slug: string): Promise<SubscriptionPlan | null> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching plan by slug:', error);
    throw new Error('Failed to fetch plan');
  }

  return data;
}

// ============================================================================
// Subscription Operations
// ============================================================================

/**
 * Get subscription for an organization with plan details
 */
export async function getOrgSubscription(orgId: string): Promise<SubscriptionWithPlan | null> {
  const { data, error } = await supabase
    .from('organization_subscriptions')
    .select(`
      *,
      plan:subscription_plans(*)
    `)
    .eq('org_id', orgId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching subscription:', error);
    throw new Error('Failed to fetch subscription');
  }

  return data as SubscriptionWithPlan;
}

/**
 * Calculate trial status from subscription
 */
export function calculateTrialStatus(subscription: SubscriptionWithPlan | null): TrialStatus {
  if (!subscription) {
    return {
      isTrialing: false,
      daysRemaining: 0,
      endsAt: null,
      startedAt: null,
      hasExpired: false,
      hasPaymentMethod: false,
    };
  }

  const now = new Date();
  const trialEndsAt = subscription.trial_ends_at ? new Date(subscription.trial_ends_at) : null;
  const trialStartedAt = subscription.trial_start_at ? new Date(subscription.trial_start_at) : null;
  const isTrialing = subscription.status === 'trialing' && trialEndsAt && trialEndsAt > now;
  const hasExpired = trialEndsAt ? trialEndsAt <= now && subscription.status === 'trialing' : false;

  let daysRemaining = 0;
  if (isTrialing && trialEndsAt) {
    daysRemaining = Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  return {
    isTrialing: isTrialing || false,
    daysRemaining,
    endsAt: trialEndsAt,
    startedAt: trialStartedAt,
    hasExpired,
    hasPaymentMethod: !!subscription.stripe_payment_method_id,
  };
}

/**
 * Get usage limits for an organization
 */
export async function getOrgUsageLimits(orgId: string): Promise<UsageLimits | null> {
  const subscription = await getOrgSubscription(orgId);
  if (!subscription) return null;

  // Get current period usage
  const { data: usage } = await supabase
    .from('organization_usage')
    .select('*')
    .eq('org_id', orgId)
    .gte('period_start', subscription.current_period_start)
    .lte('period_end', subscription.current_period_end)
    .order('period_start', { ascending: false })
    .limit(1)
    .single();

  // Get active user count
  const { count: activeUsers } = await supabase
    .from('organization_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'active');

  const plan = subscription.plan;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usageData = usage as any;
  const meetingsUsed = usageData?.meetings_count || 0;
  const meetingsLimit = subscription.custom_max_meetings || plan.max_meetings_per_month;
  const usersLimit = subscription.custom_max_users || plan.max_users;
  const includedSeats = plan.included_seats || 1;
  const perSeatPrice = plan.per_seat_price || 0;
  const activeUserCount = activeUsers || 1;

  // Calculate overage
  const overageCount = usersLimit ? Math.max(0, activeUserCount - includedSeats) : 0;
  const overageAmount = overageCount * perSeatPrice;

  return {
    meetings: {
      limit: meetingsLimit,
      used: meetingsUsed,
      remaining: meetingsLimit ? meetingsLimit - meetingsUsed : null,
      percentUsed: meetingsLimit ? Math.round((meetingsUsed / meetingsLimit) * 100) : 0,
    },
    users: {
      limit: usersLimit,
      active: activeUserCount,
      remaining: usersLimit ? usersLimit - activeUserCount : null,
      overageCount,
      overageAmount,
    },
    retentionMonths: subscription.custom_max_storage_mb
      ? null
      : plan.meeting_retention_months,
  };
}

// ============================================================================
// Stripe Integration
// ============================================================================

/**
 * Create a Stripe Checkout session for subscription
 */
export async function createCheckoutSession(
  request: CreateCheckoutSessionRequest
): Promise<CreateCheckoutSessionResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await supabase.functions.invoke('create-checkout-session', {
    body: request,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (response.error) {
    console.error('Checkout session error:', response.error);
    throw new Error(response.error.message || 'Failed to create checkout session');
  }

  return response.data as CreateCheckoutSessionResponse;
}

/**
 * Create a Stripe Customer Portal session
 */
export async function createPortalSession(
  request: CreatePortalSessionRequest
): Promise<CreatePortalSessionResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await supabase.functions.invoke('create-portal-session', {
    body: request,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (response.error) {
    console.error('Portal session error:', response.error);
    throw new Error(response.error.message || 'Failed to create portal session');
  }

  return response.data as CreatePortalSessionResponse;
}

/**
 * Start a free trial without payment method
 */
export async function startFreeTrial(
  request: StartFreeTrialRequest
): Promise<StartFreeTrialResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await supabase.functions.invoke('start-free-trial', {
    body: request,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (response.error) {
    console.error('Start trial error:', response.error);
    throw new Error(response.error.message || 'Failed to start free trial');
  }

  return response.data as StartFreeTrialResponse;
}

// ============================================================================
// Billing History
// ============================================================================

/**
 * Get billing history for an organization
 */
export async function getBillingHistory(
  orgId: string,
  limit = 20,
  offset = 0
): Promise<{ items: BillingHistoryItem[]; total: number }> {
  const { data, error, count } = await supabase
    .from('billing_history')
    .select('*', { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching billing history:', error);
    throw new Error('Failed to fetch billing history');
  }

  return {
    items: data || [],
    total: count || 0,
  };
}

// ============================================================================
// Notifications
// ============================================================================

/**
 * Get unread notifications for a user
 */
export async function getUserNotifications(
  userId: string,
  limit = 10
): Promise<UserNotification[]> {
  const { data, error } = await supabase
    .from('user_notifications')
    .select('*')
    .eq('user_id', userId)
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching notifications:', error);
    throw new Error('Failed to fetch notifications');
  }

  return data || [];
}

/**
 * Mark a notification as read
 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('user_notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    } as never)
    .eq('id', notificationId);

  if (error) {
    console.error('Error marking notification read:', error);
    throw new Error('Failed to mark notification as read');
  }
}

/**
 * Dismiss a notification
 */
export async function dismissNotification(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('user_notifications')
    .update({
      dismissed_at: new Date().toISOString(),
    } as never)
    .eq('id', notificationId);

  if (error) {
    console.error('Error dismissing notification:', error);
    throw new Error('Failed to dismiss notification');
  }
}

/**
 * Get count of unread notifications
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('user_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)
    .is('dismissed_at', null);

  if (error) {
    console.error('Error counting notifications:', error);
    return 0;
  }

  return count || 0;
}

// ============================================================================
// Feature Access & Gating
// ============================================================================

/**
 * Check if organization has access to a feature
 */
export async function hasFeatureAccess(
  orgId: string,
  feature: string
): Promise<boolean> {
  const subscription = await getOrgSubscription(orgId);
  if (!subscription) return false;

  // Check subscription status
  if (!['active', 'trialing'].includes(subscription.status)) {
    return false;
  }

  // Check plan features
  const plan = subscription.plan;
  if (plan.features && typeof plan.features === 'object') {
    return !!plan.features[feature];
  }

  return false;
}

/**
 * Check if organization can perform an action (within limits)
 */
export async function canPerformAction(
  orgId: string,
  action: 'create_meeting' | 'add_user'
): Promise<{ allowed: boolean; reason?: string }> {
  const limits = await getOrgUsageLimits(orgId);
  if (!limits) {
    return { allowed: false, reason: 'No active subscription' };
  }

  switch (action) {
    case 'create_meeting':
      if (limits.meetings.limit === null) {
        return { allowed: true };
      }
      if (limits.meetings.remaining !== null && limits.meetings.remaining <= 0) {
        return {
          allowed: false,
          reason: `Meeting limit reached (${limits.meetings.limit} per month)`
        };
      }
      return { allowed: true };

    case 'add_user':
      // Team plan allows unlimited users with overage billing
      const subscription = await getOrgSubscription(orgId);
      if (subscription?.plan.slug === 'team') {
        return { allowed: true };
      }
      // Other plans have hard limits
      if (limits.users.limit === null) {
        return { allowed: true };
      }
      if (limits.users.remaining !== null && limits.users.remaining <= 0) {
        return {
          allowed: false,
          reason: `User limit reached (${limits.users.limit} users)`
        };
      }
      return { allowed: true };

    default:
      return { allowed: true };
  }
}

// ============================================================================
// Subscription Helpers
// ============================================================================

/**
 * Check if organization has an active subscription
 */
export async function hasActiveSubscription(orgId: string): Promise<boolean> {
  const subscription = await getOrgSubscription(orgId);
  if (!subscription) return false;
  return ['active', 'trialing'].includes(subscription.status);
}

/**
 * Get subscription status summary
 */
export async function getSubscriptionSummary(orgId: string): Promise<{
  hasSubscription: boolean;
  status: string;
  planName: string;
  planSlug: string;
  isTrialing: boolean;
  trialDaysRemaining: number;
  needsPaymentMethod: boolean;
} | null> {
  const subscription = await getOrgSubscription(orgId);
  if (!subscription) return null;

  const trial = calculateTrialStatus(subscription);

  return {
    hasSubscription: true,
    status: subscription.status,
    planName: subscription.plan.name,
    planSlug: subscription.plan.slug,
    isTrialing: trial.isTrialing,
    trialDaysRemaining: trial.daysRemaining,
    needsPaymentMethod: trial.isTrialing && !trial.hasPaymentMethod,
  };
}

/**
 * Upgrade or change subscription plan
 */
export async function changePlan(
  orgId: string,
  newPlanId: string,
  billingCycle: BillingCycle = 'monthly'
): Promise<CreateCheckoutSessionResponse> {
  // For plan changes, we use Stripe Checkout which handles prorations
  return createCheckoutSession({
    org_id: orgId,
    plan_id: newPlanId,
    billing_cycle: billingCycle,
  });
}
