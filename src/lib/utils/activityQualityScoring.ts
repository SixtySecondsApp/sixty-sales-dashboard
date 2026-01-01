/**
 * Activity Quality Scoring
 *
 * Determines quality tier for activities based on type, status, recency, and amount.
 * Used for categorizing activities in skill testing.
 */

import { type QualityScore, type QualityTier } from './entityTestTypes';

/**
 * Activity types from the database enum
 */
export type ActivityType = 'outbound' | 'meeting' | 'proposal' | 'sale';

/**
 * Activity status from the database enum
 */
export type ActivityStatus = 'pending' | 'completed' | 'cancelled';

/**
 * Activity priority from the database enum
 */
export type ActivityPriority = 'low' | 'medium' | 'high';

/**
 * Engagement quality from enhanced fields
 */
export type EngagementQuality = 'low' | 'medium' | 'high' | 'excellent';

/**
 * Activity quality score with activity-specific breakdown
 */
export interface ActivityQualityScore extends QualityScore {
  breakdown: {
    typeScore: number;       // 0-30 points (based on activity type)
    statusScore: number;     // 0-25 points (based on status)
    recencyScore: number;    // 0-20 points (based on date)
    amountScore: number;     // 0-15 points (based on amount value)
    engagementScore: number; // 0-10 points (based on engagement quality)
  };
}

/**
 * Input data for activity quality scoring
 */
export interface ActivityForScoring {
  type: ActivityType;
  status: ActivityStatus;
  priority: ActivityPriority | null;
  date: string | null;
  amount: number | null;
  engagement_quality: EngagementQuality | null;
  sentiment_score: number | null;
  deal_id: string | null;
}

/**
 * Quality thresholds for activity tiers
 */
export const ACTIVITY_QUALITY_THRESHOLDS = {
  good: {
    types: ['meeting', 'proposal', 'sale'] as ActivityType[],
    statuses: ['completed'] as ActivityStatus[],
    requiresAmount: false, // For meetings, amount not required
    requiresRecentDate: true,
  },
  average: {
    types: ['outbound', 'meeting', 'proposal'] as ActivityType[],
    statuses: ['pending', 'completed'] as ActivityStatus[],
  },
  bad: {
    types: ['outbound'] as ActivityType[],
    statuses: ['cancelled'] as ActivityStatus[],
  },
} as const;

/**
 * Calculate recency score based on days since activity
 */
function calculateRecencyScore(activityDate: string | null): number {
  if (!activityDate) return 0;

  const daysSinceActivity = Math.floor(
    (Date.now() - new Date(activityDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceActivity <= 1) return 20;  // Today or yesterday
  if (daysSinceActivity <= 3) return 16;  // Last 3 days
  if (daysSinceActivity <= 7) return 12;  // Last week
  if (daysSinceActivity <= 14) return 8;  // Last 2 weeks
  if (daysSinceActivity <= 30) return 4;  // Last month
  return 0;                                // Older
}

/**
 * Calculate amount score based on activity value
 */
function calculateAmountScore(amount: number | null): number {
  if (!amount || amount <= 0) return 0;

  if (amount >= 100000) return 15;   // $100K+
  if (amount >= 50000) return 12;    // $50K+
  if (amount >= 20000) return 10;    // $20K+
  if (amount >= 10000) return 7;     // $10K+
  if (amount >= 5000) return 5;      // $5K+
  if (amount >= 1000) return 3;      // $1K+
  return 1;                           // Any amount
}

/**
 * Calculate quality score for an activity
 */
export function calculateActivityQualityScore(activity: ActivityForScoring): ActivityQualityScore {
  // Type score (0-30)
  let typeScore = 0;
  switch (activity.type) {
    case 'sale':
      typeScore = 30;
      break;
    case 'proposal':
      typeScore = 25;
      break;
    case 'meeting':
      typeScore = 20;
      break;
    case 'outbound':
      typeScore = 10;
      break;
    default:
      typeScore = 5;
  }

  // Status score (0-25)
  let statusScore = 0;
  switch (activity.status) {
    case 'completed':
      statusScore = 25;
      break;
    case 'pending':
      statusScore = 15;
      break;
    case 'cancelled':
      statusScore = 0;
      break;
  }

  // Priority bonus
  if (activity.priority === 'high') {
    statusScore = Math.min(statusScore + 5, 25);
  }

  // Recency score (0-20)
  const recencyScore = calculateRecencyScore(activity.date);

  // Amount score (0-15)
  const amountScore = calculateAmountScore(activity.amount);

  // Engagement score (0-10)
  let engagementScore = 0;
  switch (activity.engagement_quality) {
    case 'excellent':
      engagementScore = 10;
      break;
    case 'high':
      engagementScore = 8;
      break;
    case 'medium':
      engagementScore = 5;
      break;
    case 'low':
      engagementScore = 2;
      break;
  }

  // Sentiment bonus
  if (activity.sentiment_score !== null && activity.sentiment_score > 0.5) {
    engagementScore = Math.min(engagementScore + 2, 10);
  }

  // Total score (0-100)
  const score = typeScore + statusScore + recencyScore + amountScore + engagementScore;

  // Determine tier based on activity characteristics
  let tier: QualityTier;
  const reasons: string[] = [];

  if (
    activity.status === 'completed' &&
    ['meeting', 'proposal', 'sale'].includes(activity.type) &&
    score >= 60
  ) {
    tier = 'good';
    reasons.push(`Type: ${activity.type}`);
    reasons.push('Status: completed');
    if (recencyScore >= 12) {
      reasons.push('Recent activity');
    }
    if (amountScore >= 7) {
      reasons.push('Significant value');
    }
  } else if (
    activity.status === 'cancelled' ||
    (activity.type === 'sale' && (!activity.amount || activity.amount === 0)) ||
    score < 35
  ) {
    tier = 'bad';
    if (activity.status === 'cancelled') {
      reasons.push('Status: cancelled');
    }
    if (activity.type === 'sale' && (!activity.amount || activity.amount === 0)) {
      reasons.push('Sale with no value');
    }
    if (recencyScore === 0) {
      reasons.push('Old activity');
    }
  } else {
    tier = 'average';
    reasons.push(`Type: ${activity.type}`);
    reasons.push(`Status: ${activity.status}`);
    if (activity.deal_id) {
      reasons.push('Connected to deal');
    }
  }

  return {
    tier,
    score,
    breakdown: {
      typeScore,
      statusScore,
      recencyScore,
      amountScore,
      engagementScore,
    },
    reasons,
  };
}

/**
 * Get activity type badge styling
 */
export function getActivityTypeBadgeStyle(type: ActivityType): {
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string;
} {
  switch (type) {
    case 'sale':
      return {
        variant: 'default',
        className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      };
    case 'proposal':
      return {
        variant: 'secondary',
        className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      };
    case 'meeting':
      return {
        variant: 'secondary',
        className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      };
    case 'outbound':
      return {
        variant: 'outline',
        className: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
      };
    default:
      return {
        variant: 'outline',
        className: 'text-gray-600 dark:text-gray-400',
      };
  }
}

/**
 * Get activity status badge styling
 */
export function getActivityStatusBadgeStyle(status: ActivityStatus): {
  className: string;
  label: string;
} {
  switch (status) {
    case 'completed':
      return {
        className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
        label: 'Completed',
      };
    case 'pending':
      return {
        className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        label: 'Pending',
      };
    case 'cancelled':
      return {
        className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        label: 'Cancelled',
      };
    default:
      return {
        className: '',
        label: '',
      };
  }
}

/**
 * Format activity type for display
 */
export function formatActivityType(type: ActivityType): string {
  const typeLabels: Record<ActivityType, string> = {
    outbound: 'Outbound',
    meeting: 'Meeting',
    proposal: 'Proposal',
    sale: 'Sale',
  };
  return typeLabels[type] || type;
}
