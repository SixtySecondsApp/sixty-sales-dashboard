/**
 * Deal Quality Scoring
 *
 * Determines quality tier for deals based on health scores from dealHealthService.
 * Used for categorizing deals in skill testing.
 */

import { type QualityScore, type QualityTier } from './entityTestTypes';

/**
 * Deal quality score with deal-specific breakdown
 */
export interface DealQualityScore extends QualityScore {
  breakdown: {
    healthScore: number;      // 0-40 points (from overall_health_score)
    velocityScore: number;    // 0-25 points (from stage_velocity_score)
    engagementScore: number;  // 0-20 points (from engagement_score)
    sentimentScore: number;   // 0-15 points (from sentiment_score)
  };
}

/**
 * Input data for deal quality scoring
 */
export interface DealForScoring {
  overall_health_score: number | null;
  health_status: string | null;
  stage_velocity_score: number | null;
  engagement_score: number | null;
  sentiment_score: number | null;
  days_in_current_stage: number | null;
  meeting_count_last_30_days: number | null;
}

/**
 * Quality thresholds for deal tiers
 */
export const DEAL_QUALITY_THRESHOLDS = {
  good: {
    minHealthScore: 75,
    healthStatuses: ['healthy'],
  },
  average: {
    minHealthScore: 50,
    maxHealthScore: 74,
    healthStatuses: ['warning'],
  },
  bad: {
    maxHealthScore: 49,
    healthStatuses: ['critical', 'stalled'],
  },
} as const;

/**
 * Calculate quality score for a deal
 */
export function calculateDealQualityScore(deal: DealForScoring): DealQualityScore {
  // Extract component scores (normalize to our breakdown weights)
  const healthScore = deal.overall_health_score
    ? Math.round((deal.overall_health_score / 100) * 40)
    : 0;

  const velocityScore = deal.stage_velocity_score
    ? Math.round((deal.stage_velocity_score / 100) * 25)
    : 0;

  const engagementScore = deal.engagement_score
    ? Math.round((deal.engagement_score / 100) * 20)
    : 0;

  const sentimentScore = deal.sentiment_score
    ? Math.round((deal.sentiment_score / 100) * 15)
    : 0;

  // Total score (0-100)
  const score = healthScore + velocityScore + engagementScore + sentimentScore;

  // Determine tier
  let tier: QualityTier;
  const reasons: string[] = [];

  if (deal.health_status === 'healthy' || score >= 75) {
    tier = 'good';
    if (deal.meeting_count_last_30_days && deal.meeting_count_last_30_days >= 3) {
      reasons.push(`${deal.meeting_count_last_30_days} meetings in last 30 days`);
    }
    if (deal.overall_health_score && deal.overall_health_score >= 75) {
      reasons.push(`Health score: ${deal.overall_health_score}`);
    }
  } else if (
    deal.health_status === 'warning' ||
    (score >= 50 && score < 75)
  ) {
    tier = 'average';
    if (deal.days_in_current_stage && deal.days_in_current_stage > 14) {
      reasons.push(`${deal.days_in_current_stage} days in current stage`);
    }
    reasons.push('Moderate engagement metrics');
  } else {
    tier = 'bad';
    if (deal.health_status === 'critical') {
      reasons.push('Critical health status');
    }
    if (deal.health_status === 'stalled') {
      reasons.push('Deal is stalled');
    }
    if (!deal.meeting_count_last_30_days || deal.meeting_count_last_30_days === 0) {
      reasons.push('No meetings in last 30 days');
    }
    if (deal.days_in_current_stage && deal.days_in_current_stage > 30) {
      reasons.push(`${deal.days_in_current_stage} days in stage`);
    }
  }

  return {
    tier,
    score,
    breakdown: {
      healthScore,
      velocityScore,
      engagementScore,
      sentimentScore,
    },
    reasons,
  };
}

/**
 * Get tier-specific badge styling
 */
export function getDealHealthBadgeStyle(healthStatus: string | null): {
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string;
} {
  switch (healthStatus) {
    case 'healthy':
      return {
        variant: 'default',
        className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      };
    case 'warning':
      return {
        variant: 'secondary',
        className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      };
    case 'critical':
    case 'stalled':
      return {
        variant: 'destructive',
        className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      };
    default:
      return {
        variant: 'outline',
        className: 'text-gray-600 dark:text-gray-400',
      };
  }
}
