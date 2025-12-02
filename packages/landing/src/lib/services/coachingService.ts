/**
 * Coaching Service
 * Provides AI-powered coaching insights based on talk time and sentiment metrics
 */

export interface TalkTimeMetrics {
  repPct: number;
  customerPct: number;
  sentimentScore?: number;
  meetingId: string;
  meetingDate: string;
}

export interface CoachingInsight {
  type: 'talk_time' | 'sentiment' | 'engagement';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  recommendation: string;
  actionableSteps?: string[];
}

export interface TalkTimeTrend {
  date: string;
  repPct: number;
  customerPct: number;
  sentimentScore?: number;
}

/**
 * Coaching rules engine
 */
const COACHING_RULES = [
  {
    condition: (metrics: TalkTimeMetrics) => metrics.repPct > 65,
    type: 'talk_time' as const,
    severity: 'warning' as const,
    message: 'You\'re talking more than 65% of the time',
    recommendation: 'Consider asking more open-ended questions to encourage customer participation',
    actionableSteps: [
      'Start questions with "What", "How", or "Tell me about"',
      'Wait 3-5 seconds after asking a question before speaking',
      'Use phrases like "Tell me more" or "What else?"',
    ],
  },
  {
    condition: (metrics: TalkTimeMetrics) => metrics.repPct < 35,
    type: 'talk_time' as const,
    severity: 'warning' as const,
    message: 'You may be losing control of the conversation',
    recommendation: 'Take more initiative to guide the discussion and share your expertise',
    actionableSteps: [
      'Share relevant case studies or examples',
      'Ask clarifying questions to understand needs',
      'Provide structured recommendations',
    ],
  },
  {
    condition: (metrics: TalkTimeMetrics) => 
      metrics.repPct > 60 && metrics.sentimentScore !== undefined && metrics.sentimentScore < -0.3,
    type: 'sentiment' as const,
    severity: 'critical' as const,
    message: 'High talk time correlates with negative sentiment',
    recommendation: 'Reduce your talking time and focus on listening to customer concerns',
    actionableSteps: [
      'Practice active listening techniques',
      'Acknowledge customer concerns before responding',
      'Ask permission before sharing solutions',
    ],
  },
  {
    condition: (metrics: TalkTimeMetrics) => 
      metrics.repPct >= 40 && metrics.repPct <= 60 && metrics.sentimentScore !== undefined && metrics.sentimentScore > 0.5,
    type: 'engagement' as const,
    severity: 'info' as const,
    message: 'Great balance! You\'re maintaining good engagement',
    recommendation: 'Continue this balanced approach',
    actionableSteps: [],
  },
  {
    condition: (metrics: TalkTimeMetrics) => 
      metrics.sentimentScore !== undefined && metrics.sentimentScore < -0.5,
    type: 'sentiment' as const,
    severity: 'critical' as const,
    message: 'Very negative sentiment detected',
    recommendation: 'Address concerns immediately and check in with the customer',
    actionableSteps: [
      'Acknowledge the negative sentiment directly',
      'Ask what\'s causing the concern',
      'Offer to pause and address issues',
    ],
  },
];

/**
 * Analyze talk time metrics and generate coaching insights
 */
export function analyzeTalkTime(metrics: TalkTimeMetrics): CoachingInsight[] {
  const insights: CoachingInsight[] = [];

  // Apply coaching rules
  for (const rule of COACHING_RULES) {
    if (rule.condition(metrics)) {
      insights.push({
        type: rule.type,
        severity: rule.severity,
        message: rule.message,
        recommendation: rule.recommendation,
        actionableSteps: rule.actionableSteps,
      });
    }
  }

  // Sort by severity (critical > warning > info)
  const severityOrder = { critical: 3, warning: 2, info: 1 };
  insights.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);

  return insights;
}

/**
 * Calculate talk time trend from historical data
 */
export function calculateTalkTimeTrend(trendData: TalkTimeTrend[]): {
  averageRepPct: number;
  averageCustomerPct: number;
  trend: 'improving' | 'stable' | 'declining';
  trendDirection: number; // Positive = improving, negative = declining
} {
  if (trendData.length === 0) {
    return {
      averageRepPct: 0,
      averageCustomerPct: 0,
      trend: 'stable',
      trendDirection: 0,
    };
  }

  // Calculate averages
  const totalRepPct = trendData.reduce((sum, data) => sum + data.repPct, 0);
  const totalCustomerPct = trendData.reduce((sum, data) => sum + data.customerPct, 0);
  const averageRepPct = totalRepPct / trendData.length;
  const averageCustomerPct = totalCustomerPct / trendData.length;

  // Calculate trend (compare first half vs second half)
  if (trendData.length >= 4) {
    const midpoint = Math.floor(trendData.length / 2);
    const firstHalf = trendData.slice(0, midpoint);
    const secondHalf = trendData.slice(midpoint);

    const firstHalfAvg = firstHalf.reduce((sum, d) => sum + d.repPct, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, d) => sum + d.repPct, 0) / secondHalf.length;

    const trendDirection = secondHalfAvg - firstHalfAvg;
    const threshold = 5; // 5% change threshold

    let trend: 'improving' | 'stable' | 'declining';
    if (trendDirection < -threshold) {
      trend = 'improving'; // Rep talking less = better balance
    } else if (trendDirection > threshold) {
      trend = 'declining'; // Rep talking more = worse balance
    } else {
      trend = 'stable';
    }

    return {
      averageRepPct,
      averageCustomerPct,
      trend,
      trendDirection,
    };
  }

  return {
    averageRepPct,
    averageCustomerPct,
    trend: 'stable',
    trendDirection: 0,
  };
}

/**
 * Get ideal talk time range
 */
export function getIdealTalkTimeRange(): { min: number; max: number } {
  return {
    min: 35,
    max: 60,
  };
}

/**
 * Check if talk time is in ideal range
 */
export function isTalkTimeIdeal(repPct: number): boolean {
  const ideal = getIdealTalkTimeRange();
  return repPct >= ideal.min && repPct <= ideal.max;
}

