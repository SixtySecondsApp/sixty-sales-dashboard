/**
 * Email Quality Scoring
 *
 * Determines quality tier for emails based on categorization and sales signals.
 * Used for categorizing emails in skill testing.
 */

import { type QualityScore, type QualityTier } from './entityTestTypes';

/**
 * Email categories from email_categorizations table
 */
export type EmailCategory =
  | 'to_respond'
  | 'fyi'
  | 'marketing'
  | 'calendar_related'
  | 'automated'
  | 'uncategorized';

/**
 * Urgency levels from email signals
 */
export type EmailUrgency = 'high' | 'medium' | 'low';

/**
 * Email signals JSONB structure
 */
export interface EmailSignals {
  response_required?: boolean;
  urgency?: EmailUrgency;
  keywords?: string[];
  deal_id?: string;
  contact_id?: string;
  sentiment?: number; // -1 to 1
  ghost_risk?: boolean;
  follow_up_due?: string; // date
  action_items?: string[];
}

/**
 * Email quality score with email-specific breakdown
 */
export interface EmailQualityScore extends QualityScore {
  breakdown: {
    categoryScore: number;      // 0-40 points (based on category)
    urgencyScore: number;       // 0-25 points (based on urgency/signals)
    signalsScore: number;       // 0-20 points (action items, ghost risk, etc.)
    recencyScore: number;       // 0-15 points (based on received_at)
  };
}

/**
 * Input data for email quality scoring
 */
export interface EmailForScoring {
  category: EmailCategory;
  category_confidence: number | null;
  signals: EmailSignals | null;
  received_at: string | null;
  direction: 'inbound' | 'outbound';
}

/**
 * Quality thresholds for email tiers
 */
export const EMAIL_QUALITY_THRESHOLDS = {
  good: {
    categories: ['to_respond'] as EmailCategory[],
    urgencyLevels: ['high', 'medium'] as EmailUrgency[],
    requiresResponseRequired: true,
  },
  average: {
    categories: ['fyi', 'to_respond'] as EmailCategory[],
    urgencyLevels: ['medium', 'low'] as EmailUrgency[],
  },
  bad: {
    categories: ['marketing', 'automated', 'calendar_related', 'uncategorized'] as EmailCategory[],
  },
} as const;

/**
 * Calculate recency score based on days since received
 */
function calculateRecencyScore(receivedAt: string | null): number {
  if (!receivedAt) return 0;

  const daysSinceReceived = Math.floor(
    (Date.now() - new Date(receivedAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceReceived <= 1) return 15;  // Today or yesterday
  if (daysSinceReceived <= 3) return 12;  // Last 3 days
  if (daysSinceReceived <= 7) return 8;   // Last week
  if (daysSinceReceived <= 14) return 4;  // Last 2 weeks
  return 0;                                // Older
}

/**
 * Calculate quality score for an email
 */
export function calculateEmailQualityScore(email: EmailForScoring): EmailQualityScore {
  const signals = email.signals || {};

  // Category score (0-40)
  let categoryScore = 0;
  switch (email.category) {
    case 'to_respond':
      categoryScore = 40;
      break;
    case 'fyi':
      categoryScore = 25;
      break;
    case 'calendar_related':
      categoryScore = 15;
      break;
    case 'marketing':
      categoryScore = 8;
      break;
    case 'automated':
      categoryScore = 5;
      break;
    case 'uncategorized':
    default:
      categoryScore = 10;
  }

  // Urgency score (0-25)
  let urgencyScore = 0;
  if (signals.response_required) {
    urgencyScore += 10;
  }
  switch (signals.urgency) {
    case 'high':
      urgencyScore += 15;
      break;
    case 'medium':
      urgencyScore += 8;
      break;
    case 'low':
      urgencyScore += 3;
      break;
  }

  // Signals score (0-20)
  let signalsScore = 0;
  if (signals.action_items && signals.action_items.length > 0) {
    signalsScore += Math.min(signals.action_items.length * 4, 10);
  }
  if (signals.deal_id) {
    signalsScore += 5;  // Connected to a deal
  }
  if (signals.ghost_risk) {
    signalsScore += 3;  // Interesting for testing
  }
  if (signals.follow_up_due) {
    signalsScore += 2;
  }

  // Recency score (0-15)
  const recencyScore = calculateRecencyScore(email.received_at);

  // Total score (0-100)
  const score = categoryScore + urgencyScore + signalsScore + recencyScore;

  // Determine tier based on category and signals
  let tier: QualityTier;
  const reasons: string[] = [];

  if (email.category === 'to_respond' || (score >= 65 && signals.response_required)) {
    tier = 'good';
    reasons.push(`Category: ${email.category}`);
    if (signals.urgency === 'high') {
      reasons.push('High urgency');
    }
    if (signals.action_items && signals.action_items.length > 0) {
      reasons.push(`${signals.action_items.length} action item(s)`);
    }
  } else if (email.category === 'fyi' || (score >= 35 && score < 65)) {
    tier = 'average';
    reasons.push(`Category: ${email.category}`);
    if (signals.deal_id) {
      reasons.push('Connected to deal');
    }
  } else {
    tier = 'bad';
    reasons.push(`Category: ${email.category}`);
    if (!signals.response_required) {
      reasons.push('No response required');
    }
  }

  return {
    tier,
    score,
    breakdown: {
      categoryScore,
      urgencyScore,
      signalsScore,
      recencyScore,
    },
    reasons,
  };
}

/**
 * Get category badge styling
 */
export function getEmailCategoryBadgeStyle(category: EmailCategory): {
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string;
} {
  switch (category) {
    case 'to_respond':
      return {
        variant: 'default',
        className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      };
    case 'fyi':
      return {
        variant: 'secondary',
        className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      };
    case 'marketing':
      return {
        variant: 'outline',
        className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      };
    case 'calendar_related':
      return {
        variant: 'outline',
        className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      };
    case 'automated':
      return {
        variant: 'outline',
        className: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
      };
    case 'uncategorized':
    default:
      return {
        variant: 'outline',
        className: 'text-gray-600 dark:text-gray-400',
      };
  }
}

/**
 * Get urgency badge styling
 */
export function getUrgencyBadgeStyle(urgency: EmailUrgency | undefined): {
  className: string;
  label: string;
} {
  switch (urgency) {
    case 'high':
      return {
        className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        label: 'High',
      };
    case 'medium':
      return {
        className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        label: 'Medium',
      };
    case 'low':
      return {
        className: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
        label: 'Low',
      };
    default:
      return {
        className: '',
        label: '',
      };
  }
}
