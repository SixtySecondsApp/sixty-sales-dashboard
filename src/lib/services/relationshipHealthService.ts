/**
 * Relationship Health Monitoring Service
 *
 * Calculates health scores at the relationship level (contact/company) not just deal-level.
 * Enables ghost detection and proactive intervention recommendations.
 *
 * Key differences from deal health:
 * - Analyzes all communications, not just deal-specific
 * - Tracks response patterns and baseline behavior
 * - Detects ghosting signals across entire relationship
 * - Aggregates health from multiple deals if they exist
 */

import { supabase } from '@/lib/supabase/clientV2';
import { getDealHealthScore } from './dealHealthService';

// =====================================================
// Types
// =====================================================

export interface RelationshipHealthScore {
  id: string;
  user_id: string;
  relationship_type: 'contact' | 'company';
  contact_id: string | null;
  company_id: string | null;

  // Overall health
  overall_health_score: number;
  health_status: 'healthy' | 'at_risk' | 'critical' | 'ghost';
  risk_level: 'low' | 'medium' | 'high' | 'critical';

  // Signal scores
  communication_frequency_score: number | null;
  response_behavior_score: number | null;
  engagement_quality_score: number | null;
  sentiment_score: number | null;
  meeting_pattern_score: number | null;

  // Raw metrics
  days_since_last_contact: number | null;
  days_since_last_response: number | null;
  avg_response_time_hours: number | null;
  response_rate_percent: number | null;
  email_open_rate_percent: number | null;
  meeting_count_30_days: number;
  email_count_30_days: number;
  total_interactions_30_days: number;

  // Baseline (for anomaly detection)
  baseline_response_time_hours: number | null;
  baseline_contact_frequency_days: number | null;
  baseline_meeting_frequency_days: number | null;

  // Ghost detection
  is_ghost_risk: boolean;
  ghost_signals: any;
  ghost_probability_percent: number | null;
  days_until_predicted_ghost: number | null;

  // Sentiment
  sentiment_trend: 'improving' | 'stable' | 'declining' | 'unknown';
  avg_sentiment_last_3_interactions: number | null;

  // Risk factors
  risk_factors: string[];

  // Metadata
  last_meaningful_interaction: any;
  related_deals_count: number;
  total_deal_value: number;
  at_risk_deal_value: number;

  // Timestamps
  last_calculated_at: string;
  created_at: string;
  updated_at: string;
}

export interface RelationshipMetrics {
  relationshipId: string;
  relationshipType: 'contact' | 'company';

  // Communication metrics
  daysSinceLastContact: number | null;
  daysSinceLastResponse: number | null;
  avgResponseTimeHours: number | null;
  responseRatePercent: number | null;
  emailOpenRatePercent: number | null;
  communicationCount30Days: number;

  // Meeting metrics
  meetingCount30Days: number;
  daysSinceLastMeeting: number | null;

  // Sentiment
  avgSentiment: number | null;
  sentimentTrend: 'improving' | 'stable' | 'declining' | 'unknown';

  // Baseline
  baselineResponseTimeHours: number | null;
  baselineContactFrequencyDays: number | null;
  baselineMeetingFrequencyDays: number | null;

  // Deal aggregation
  relatedDealsCount: number;
  totalDealValue: number;
  atRiskDealValue: number;
}

// =====================================================
// Health Score Calculation Functions
// =====================================================

/**
 * Scores recent communication frequency on a 0–100 scale relative to an established baseline or fixed thresholds.
 *
 * When `baselineFrequencyDays` is provided, the score reflects the ratio of observed 30-day communications to the expected count derived from the baseline. When `baselineFrequencyDays` is `null`, predefined absolute thresholds for `currentCount30Days` are used.
 *
 * @param currentCount30Days - Number of communications observed in the last 30 days
 * @param baselineFrequencyDays - Average number of days between communications in the baseline period, or `null` if no baseline exists
 * @returns A score from `0` to `100` where higher values indicate healthier communication frequency relative to the baseline or absolute thresholds
 */
function calculateCommunicationFrequencyScore(
  currentCount30Days: number,
  baselineFrequencyDays: number | null
): number {
  if (baselineFrequencyDays === null) {
    // No baseline established yet - use absolute thresholds
    if (currentCount30Days >= 8) return 100; // 2/week+
    if (currentCount30Days >= 4) return 75;  // 1/week
    if (currentCount30Days >= 2) return 50;  // 2/month
    if (currentCount30Days >= 1) return 25;  // 1/month
    return 0;
  }

  // Compare to baseline
  const expectedCount = 30 / baselineFrequencyDays;
  const ratio = currentCount30Days / expectedCount;

  if (ratio >= 1.0) return 100; // Meeting or exceeding baseline
  if (ratio >= 0.75) return 75; // Slight decline
  if (ratio >= 0.5) return 50;  // Noticeable decline
  if (ratio >= 0.25) return 25; // Significant decline
  return 0; // Severe decline
}

/**
 * Compute a 0–100 response behavior score from response rate and response time.
 *
 * Combines a response-rate component (up to 50 points) with a response-time component
 * (up to 50 points or penalties when slower than baseline, or evaluated against absolute
 * thresholds if no baseline is provided) and clamps the result to 0–100.
 *
 * @param responseRatePercent - Percentage of responses (0–100), or `null` if unavailable
 * @param avgResponseTimeHours - Average response time in hours, or `null` if unavailable
 * @param baselineResponseTimeHours - Historical baseline average response time in hours, or `null` if unavailable
 * @returns A number between `0` and `100` where higher values indicate better response behavior
 */
function calculateResponseBehaviorScore(
  responseRatePercent: number | null,
  avgResponseTimeHours: number | null,
  baselineResponseTimeHours: number | null
): number {
  let score = 50; // Base score

  // Response rate component (max 50 points)
  if (responseRatePercent !== null) {
    if (responseRatePercent >= 80) score += 50;
    else if (responseRatePercent >= 60) score += 35;
    else if (responseRatePercent >= 40) score += 20;
    else if (responseRatePercent >= 20) score += 10;
    // Below 20% adds nothing
  }

  // Response time component (max 50 points or penalty)
  if (avgResponseTimeHours !== null && baselineResponseTimeHours !== null) {
    const timeRatio = avgResponseTimeHours / baselineResponseTimeHours;

    if (timeRatio <= 1.0) {
      // Responding faster than baseline
      score += 50;
    } else if (timeRatio <= 1.5) {
      // Slightly slower (within 50% of baseline)
      score += 30;
    } else if (timeRatio <= 2.0) {
      // Notably slower (up to 2x baseline)
      score += 10;
    } else if (timeRatio <= 3.0) {
      // Significantly slower (2-3x baseline) - penalty
      score -= 20;
    } else {
      // Severely delayed (3x+ baseline) - major penalty
      score -= 40;
    }
  } else if (avgResponseTimeHours !== null) {
    // No baseline - use absolute thresholds
    if (avgResponseTimeHours <= 4) score += 50;
    else if (avgResponseTimeHours <= 24) score += 30;
    else if (avgResponseTimeHours <= 48) score += 10;
    else score -= 20;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Computes an engagement-quality score based on email open rate, recent meeting frequency, and meeting recency.
 *
 * @param emailOpenRatePercent - Email open rate as a percentage (0–100). Use `null` when open-rate data is unavailable.
 * @param meetingCount30Days - Number of meetings in the last 30 days.
 * @param daysSinceLastMeeting - Days since the most recent meeting. Use `null` when no prior meetings are recorded.
 * @returns A number between 0 and 100 where higher values indicate stronger engagement quality.
 */
function calculateEngagementQualityScore(
  emailOpenRatePercent: number | null,
  meetingCount30Days: number,
  daysSinceLastMeeting: number | null
): number {
  let score = 50; // Base score

  // Email open rate component (max 30 points)
  if (emailOpenRatePercent !== null) {
    if (emailOpenRatePercent >= 70) score += 30;
    else if (emailOpenRatePercent >= 50) score += 20;
    else if (emailOpenRatePercent >= 30) score += 10;
    // Below 30% adds nothing (ghost signal)
  }

  // Meeting frequency component (max 40 points)
  if (meetingCount30Days >= 4) score += 40;
  else if (meetingCount30Days >= 2) score += 25;
  else if (meetingCount30Days === 1) score += 10;

  // Meeting recency component (max 30 points or penalty)
  if (daysSinceLastMeeting !== null) {
    if (daysSinceLastMeeting <= 7) score += 30;
    else if (daysSinceLastMeeting <= 14) score += 15;
    else if (daysSinceLastMeeting <= 21) score += 5;
    else if (daysSinceLastMeeting > 45) score -= 30; // Long gap
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Convert an average sentiment and its trend into a 0–100 sentiment score.
 *
 * @param avgSentiment - Average sentiment on a -1 (very negative) to 1 (very positive) scale; `null` indicates no available sentiment data
 * @param trend - Direction of recent sentiment change: `improving`, `stable`, `declining`, or `unknown`
 * @returns A sentiment score from 0 to 100; returns 50 when `avgSentiment` is `null`
 */
function calculateSentimentScore(
  avgSentiment: number | null,
  trend: 'improving' | 'stable' | 'declining' | 'unknown'
): number {
  if (avgSentiment === null) return 50; // Neutral when no data

  // Convert -1 to 1 scale to 0-100
  let score = Math.round(((avgSentiment + 1) / 2) * 100);

  // Apply trend modifier
  if (trend === 'improving') score = Math.min(100, score + 15);
  else if (trend === 'declining') score = Math.max(0, score - 20);

  return score;
}

/**
 * Scores meeting frequency against expected baseline to produce a meeting-pattern score from 0–100.
 *
 * When a baseline is not provided, absolute 30-day thresholds are used: 4+ meetings => 100, 2–3 => 75, 1 => 50, 0 => 25.
 * When a baseline (average days between meetings) is provided, an expected 30-day meeting count is computed as `30 / baselineMeetingFrequencyDays`
 * and the actual count is compared to that expectation using ratio bands: ratio >= 1.0 => 100, >= 0.75 => 75, >= 0.5 => 50, >= 0.25 => 25, else 0.
 *
 * @param meetingCount30Days - Number of meetings in the last 30 days.
 * @param baselineMeetingFrequencyDays - Baseline average days between meetings, or `null` if no baseline is available.
 * @returns Meeting pattern score between 0 and 100; higher values indicate meeting frequency meets or exceeds expectations.
 */
function calculateMeetingPatternScore(
  meetingCount30Days: number,
  baselineMeetingFrequencyDays: number | null
): number {
  if (baselineMeetingFrequencyDays === null) {
    // No baseline - use absolute thresholds
    if (meetingCount30Days >= 4) return 100;
    if (meetingCount30Days >= 2) return 75;
    if (meetingCount30Days === 1) return 50;
    return 25;
  }

  // Compare to baseline
  const expectedCount = 30 / baselineMeetingFrequencyDays;
  const ratio = meetingCount30Days / expectedCount;

  if (ratio >= 1.0) return 100;
  if (ratio >= 0.75) return 75;
  if (ratio >= 0.5) return 50;
  if (ratio >= 0.25) return 25;
  return 0;
}

/**
 * Compute the overall relationship health score as a weighted aggregation of available signal scores.
 *
 * @returns The overall health score (0–100) rounded to the nearest integer; returns 50 if no signal scores are provided.
 */
function calculateOverallHealthScore(scores: {
  communicationFrequency: number | null;
  responseBehavior: number | null;
  engagementQuality: number | null;
  sentiment: number | null;
  meetingPattern: number | null;
}): number {
  // Weighted calculation
  const weights = {
    communicationFrequency: 0.25,
    responseBehavior: 0.30,      // Most important for ghost detection
    engagementQuality: 0.20,
    sentiment: 0.15,
    meetingPattern: 0.10,
  };

  let weightedSum = 0;
  let totalWeight = 0;

  // Only include scores that exist
  if (scores.communicationFrequency !== null) {
    weightedSum += scores.communicationFrequency * weights.communicationFrequency;
    totalWeight += weights.communicationFrequency;
  }
  if (scores.responseBehavior !== null) {
    weightedSum += scores.responseBehavior * weights.responseBehavior;
    totalWeight += weights.responseBehavior;
  }
  if (scores.engagementQuality !== null) {
    weightedSum += scores.engagementQuality * weights.engagementQuality;
    totalWeight += weights.engagementQuality;
  }
  if (scores.sentiment !== null) {
    weightedSum += scores.sentiment * weights.sentiment;
    totalWeight += weights.sentiment;
  }
  if (scores.meetingPattern !== null) {
    weightedSum += scores.meetingPattern * weights.meetingPattern;
    totalWeight += weights.meetingPattern;
  }

  if (totalWeight === 0) return 50; // Default if no scores

  return Math.round(weightedSum / totalWeight);
}

/**
 * Map overall health score and ghost flag to a health status label.
 *
 * @param score - Overall health score on a 0–100 scale
 * @param isGhostRisk - When true, indicates the relationship is considered a ghost risk and forces the `ghost` status
 * @returns `ghost` if `isGhostRisk` is true; `healthy` if `score` is greater than or equal to 70; `at_risk` if `score` is greater than or equal to 50; `critical` otherwise
 */
function determineHealthStatus(score: number, isGhostRisk: boolean): RelationshipHealthScore['health_status'] {
  if (isGhostRisk) return 'ghost';
  if (score >= 70) return 'healthy';
  if (score >= 50) return 'at_risk';
  return 'critical';
}

/**
 * Map an overall health score and detected risk factors to a discrete risk level.
 *
 * @param healthScore - Overall health score on a 0–100 scale
 * @param riskFactors - Array of identified risk factor identifiers
 * @returns The risk level: `critical` when there are 4+ risk factors or `healthScore` < 30; `high` when there are 3+ risk factors or `healthScore` < 45; `medium` when there are 2+ risk factors or `healthScore` < 60; otherwise `low`
 */
function determineRiskLevel(
  healthScore: number,
  riskFactors: string[]
): RelationshipHealthScore['risk_level'] {
  if (riskFactors.length >= 4 || healthScore < 30) return 'critical';
  if (riskFactors.length >= 3 || healthScore < 45) return 'high';
  if (riskFactors.length >= 2 || healthScore < 60) return 'medium';
  return 'low';
}

/**
 * Produce a list of risk factor identifiers inferred from relationship metrics.
 *
 * @param metrics - Computed relationship metrics used to evaluate contact, response, engagement, sentiment, and deal risks
 * @returns An array of risk factor keys (e.g. `no_contact_21_days`, `low_response_rate`, `sentiment_declining`, `majority_deals_at_risk`) representing observed risks for the relationship
 */
function identifyRiskFactors(metrics: RelationshipMetrics): string[] {
  const factors: string[] = [];

  // Communication risks
  if (metrics.daysSinceLastContact !== null && metrics.daysSinceLastContact > 21) {
    factors.push('no_contact_21_days');
  }
  if (metrics.communicationCount30Days < 2) {
    factors.push('low_communication_frequency');
  }

  // Response risks
  if (metrics.responseRatePercent !== null && metrics.responseRatePercent < 30) {
    factors.push('low_response_rate');
  }
  if (metrics.daysSinceLastResponse !== null && metrics.daysSinceLastResponse > 14) {
    factors.push('no_response_14_days');
  }
  if (
    metrics.avgResponseTimeHours !== null &&
    metrics.baselineResponseTimeHours !== null &&
    metrics.avgResponseTimeHours > metrics.baselineResponseTimeHours * 3
  ) {
    factors.push('response_time_increased_3x');
  }

  // Engagement risks
  if (metrics.emailOpenRatePercent !== null && metrics.emailOpenRatePercent < 20) {
    factors.push('email_opens_stopped');
  }
  if (metrics.meetingCount30Days === 0 && metrics.daysSinceLastMeeting !== null && metrics.daysSinceLastMeeting > 30) {
    factors.push('no_meetings_30_days');
  }

  // Sentiment risks
  if (metrics.sentimentTrend === 'declining') {
    factors.push('sentiment_declining');
  }
  if (metrics.avgSentiment !== null && metrics.avgSentiment < -0.2) {
    factors.push('negative_sentiment');
  }

  // Deal risks
  if (metrics.atRiskDealValue > 0 && metrics.atRiskDealValue / Math.max(metrics.totalDealValue, 1) > 0.5) {
    factors.push('majority_deals_at_risk');
  }

  return factors;
}

// =====================================================
// Data Fetching Functions
// =====================================================

/**
 * Gather raw communication, meeting, sentiment, deal, and baseline metrics for a relationship required to compute health scores.
 *
 * This function queries communication events, meetings, deals, and recent history to derive metrics used by the health calculators, including contact/response timings, response and email-open rates, 30-day counts, meeting counts and recency, recent sentiment and trend, related deal counts/values, and 90-day baselines for response time, contact frequency, and meeting frequency.
 *
 * @param relationshipType - Either `'contact'` or `'company'`, indicating which relationship column to query
 * @param relationshipId - The ID of the contact or company to collect metrics for
 * @param userId - The owner user's ID used to scope queries
 * @returns A populated `RelationshipMetrics` object with the gathered metrics, or `null` if an error occurs while fetching data
 */
async function fetchRelationshipMetrics(
  relationshipType: 'contact' | 'company',
  relationshipId: string,
  userId: string
): Promise<RelationshipMetrics | null> {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Get communication events (from communication_events table)
    const { data: communications } = await supabase
      .from('communication_events')
      .select('*')
      .eq('user_id', userId)
      .eq(relationshipType === 'contact' ? 'contact_id' : 'company_id', relationshipId)
      .order('event_timestamp', { ascending: false });

    const recentComms = communications?.filter(
      (c) => new Date(c.event_timestamp) >= new Date(thirtyDaysAgo)
    ) || [];

    // Calculate communication metrics
    const daysSinceLastContact = communications && communications.length > 0
      ? Math.floor((now.getTime() - new Date(communications[0].event_timestamp).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const lastInbound = communications?.find((c) => c.direction === 'inbound');
    const daysSinceLastResponse = lastInbound
      ? Math.floor((now.getTime() - new Date(lastInbound.event_timestamp).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Response rate calculation
    const outboundCount = recentComms.filter((c) => c.direction === 'outbound').length;
    const repliedCount = recentComms.filter((c) => c.direction === 'outbound' && c.was_replied).length;
    const responseRatePercent = outboundCount > 0 ? Math.round((repliedCount / outboundCount) * 100) : null;

    // Email open rate
    const emailsSent = recentComms.filter((c) => c.event_type === 'email_sent').length;
    const emailsOpened = recentComms.filter((c) => c.event_type === 'email_sent' && c.was_opened).length;
    const emailOpenRatePercent = emailsSent > 0 ? Math.round((emailsOpened / emailsSent) * 100) : null;

    // Average response time
    const responseTimes = recentComms
      .filter((c) => c.direction === 'inbound' && c.response_time_hours !== null)
      .map((c) => c.response_time_hours as number);
    const avgResponseTimeHours = responseTimes.length > 0
      ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
      : null;

    // 2. Get meeting data
    const whereClause = relationshipType === 'contact'
      ? { primary_contact_id: relationshipId }
      : { company_id: relationshipId };

    const { data: meetings } = await supabase
      .from('meetings')
      .select('id, meeting_start, sentiment_score')
      .eq('owner_user_id', userId)
      .match(whereClause)
      .gte('meeting_start', thirtyDaysAgo)
      .order('meeting_start', { ascending: false });

    const meetingCount30Days = meetings?.length || 0;

    const { data: allMeetings } = await supabase
      .from('meetings')
      .select('meeting_start, sentiment_score')
      .eq('owner_user_id', userId)
      .match(whereClause)
      .order('meeting_start', { ascending: false })
      .limit(10);

    const daysSinceLastMeeting = allMeetings && allMeetings.length > 0 && allMeetings[0].meeting_start
      ? Math.floor((now.getTime() - new Date(allMeetings[0].meeting_start).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Sentiment from meetings
    const recentSentiments = allMeetings
      ?.slice(0, 3)
      .map((m) => m.sentiment_score)
      .filter((s): s is number => s !== null) || [];

    const avgSentiment = recentSentiments.length > 0
      ? recentSentiments.reduce((sum, s) => sum + s, 0) / recentSentiments.length
      : null;

    let sentimentTrend: 'improving' | 'stable' | 'declining' | 'unknown' = 'unknown';
    if (recentSentiments.length >= 3) {
      const recent = recentSentiments[0];
      const older = (recentSentiments[1] + recentSentiments[2]) / 2;
      const change = recent - older;

      if (change > 0.1) sentimentTrend = 'improving';
      else if (change < -0.1) sentimentTrend = 'declining';
      else sentimentTrend = 'stable';
    }

    // 3. Get related deals
    const dealWhereClause = relationshipType === 'contact'
      ? `or(primary_contact_id.eq.${relationshipId},contact_email.eq.${relationshipId})`
      : `or(company.eq.${relationshipId},company_id.eq.${relationshipId})`;

    const { data: deals } = await supabase
      .from('deals')
      .select(`
        id,
        value,
        deal_health_scores(overall_health_score, health_status)
      `)
      .eq('owner_id', userId)
      .or(dealWhereClause);

    const relatedDealsCount = deals?.length || 0;
    const totalDealValue = deals?.reduce((sum, d) => sum + (d.value || 0), 0) || 0;
    const atRiskDealValue = deals
      ?.filter((d) => {
        const health = (d as any).deal_health_scores?.[0];
        return health && (health.health_status === 'critical' || health.health_status === 'stalled');
      })
      .reduce((sum, d) => sum + (d.value || 0), 0) || 0;

    // 4. Calculate baseline (average behavior over 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: historicalComms } = await supabase
      .from('communication_events')
      .select('event_timestamp, direction, response_time_hours')
      .eq('user_id', userId)
      .eq(relationshipType === 'contact' ? 'contact_id' : 'company_id', relationshipId)
      .gte('event_timestamp', ninetyDaysAgo)
      .order('event_timestamp', { ascending: false });

    const baselineResponseTimes = historicalComms
      ?.filter((c) => c.direction === 'inbound' && c.response_time_hours !== null)
      .map((c) => c.response_time_hours as number) || [];
    const baselineResponseTimeHours = baselineResponseTimes.length > 0
      ? baselineResponseTimes.reduce((sum, t) => sum + t, 0) / baselineResponseTimes.length
      : null;

    const commDates = historicalComms?.map((c) => new Date(c.event_timestamp).getTime()).sort((a, b) => a - b) || [];
    let baselineContactFrequencyDays: number | null = null;
    if (commDates.length >= 2) {
      const gaps = commDates.slice(1).map((date, i) => (date - commDates[i]) / (1000 * 60 * 60 * 24));
      baselineContactFrequencyDays = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    }

    const { data: historicalMeetings } = await supabase
      .from('meetings')
      .select('meeting_start')
      .eq('owner_user_id', userId)
      .match(whereClause)
      .gte('meeting_start', ninetyDaysAgo)
      .order('meeting_start', { ascending: true });

    const meetingDates = historicalMeetings?.map((m) => new Date(m.meeting_start).getTime()) || [];
    let baselineMeetingFrequencyDays: number | null = null;
    if (meetingDates.length >= 2) {
      const gaps = meetingDates.slice(1).map((date, i) => (date - meetingDates[i]) / (1000 * 60 * 60 * 24));
      baselineMeetingFrequencyDays = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    }

    return {
      relationshipId,
      relationshipType,
      daysSinceLastContact,
      daysSinceLastResponse,
      avgResponseTimeHours,
      responseRatePercent,
      emailOpenRatePercent,
      communicationCount30Days: recentComms.length,
      meetingCount30Days,
      daysSinceLastMeeting,
      avgSentiment,
      sentimentTrend,
      baselineResponseTimeHours,
      baselineContactFrequencyDays,
      baselineMeetingFrequencyDays,
      relatedDealsCount,
      totalDealValue,
      atRiskDealValue,
    };
  } catch (error) {
    console.error('Error fetching relationship metrics:', error);
    return null;
  }
}

// =====================================================
// Main Health Calculation Function
// =====================================================

/**
 * Compute signal-based health scores for a contact or company, persist the result to the database, and return the stored record.
 *
 * @param relationshipType - Either `'contact'` or `'company'` indicating which relationship type to evaluate
 * @param relationshipId - The ID of the contact or company to evaluate
 * @param userId - The owner user's ID for whom the health score is being calculated
 * @returns The persisted RelationshipHealthScore record, or `null` if calculation or persistence failed
 */
export async function calculateRelationshipHealth(
  relationshipType: 'contact' | 'company',
  relationshipId: string,
  userId: string
): Promise<RelationshipHealthScore | null> {
  try {
    // Fetch all metrics
    const metrics = await fetchRelationshipMetrics(relationshipType, relationshipId, userId);
    if (!metrics) return null;

    // Calculate individual signal scores
    const scores = {
      communicationFrequency: calculateCommunicationFrequencyScore(
        metrics.communicationCount30Days,
        metrics.baselineContactFrequencyDays
      ),
      responseBehavior: calculateResponseBehaviorScore(
        metrics.responseRatePercent,
        metrics.avgResponseTimeHours,
        metrics.baselineResponseTimeHours
      ),
      engagementQuality: calculateEngagementQualityScore(
        metrics.emailOpenRatePercent,
        metrics.meetingCount30Days,
        metrics.daysSinceLastMeeting
      ),
      sentiment: calculateSentimentScore(metrics.avgSentiment, metrics.sentimentTrend),
      meetingPattern: calculateMeetingPatternScore(
        metrics.meetingCount30Days,
        metrics.baselineMeetingFrequencyDays
      ),
    };

    // Calculate overall health score
    const overallScore = calculateOverallHealthScore(scores);

    // Identify risk factors
    const riskFactors = identifyRiskFactors(metrics);

    // Determine ghost risk (separate from risk level)
    const isGhostRisk = riskFactors.some((f) =>
      ['no_response_14_days', 'email_opens_stopped', 'response_time_increased_3x'].includes(f)
    );

    // Determine health status and risk level
    const healthStatus = determineHealthStatus(overallScore, isGhostRisk);
    const riskLevel = determineRiskLevel(overallScore, riskFactors);

    // Prepare health score data
    const healthScoreData = {
      user_id: userId,
      relationship_type: relationshipType,
      contact_id: relationshipType === 'contact' ? relationshipId : null,
      company_id: relationshipType === 'company' ? relationshipId : null,

      overall_health_score: overallScore,
      health_status: healthStatus,
      risk_level: riskLevel,

      communication_frequency_score: scores.communicationFrequency,
      response_behavior_score: scores.responseBehavior,
      engagement_quality_score: scores.engagementQuality,
      sentiment_score: scores.sentiment,
      meeting_pattern_score: scores.meetingPattern,

      days_since_last_contact: metrics.daysSinceLastContact,
      days_since_last_response: metrics.daysSinceLastResponse,
      avg_response_time_hours: metrics.avgResponseTimeHours,
      response_rate_percent: metrics.responseRatePercent,
      email_open_rate_percent: metrics.emailOpenRatePercent,
      meeting_count_30_days: metrics.meetingCount30Days,
      email_count_30_days: metrics.communicationCount30Days, // TODO: Filter to emails only
      total_interactions_30_days: metrics.communicationCount30Days,

      baseline_response_time_hours: metrics.baselineResponseTimeHours,
      baseline_contact_frequency_days: metrics.baselineContactFrequencyDays,
      baseline_meeting_frequency_days: metrics.baselineMeetingFrequencyDays,

      is_ghost_risk: isGhostRisk,
      ghost_signals: null, // Will be populated by ghost detection service
      ghost_probability_percent: isGhostRisk ? Math.max(60, 100 - overallScore) : null,
      days_until_predicted_ghost: null, // TODO: Implement predictive model

      sentiment_trend: metrics.sentimentTrend,
      avg_sentiment_last_3_interactions: metrics.avgSentiment,

      risk_factors: riskFactors,

      last_meaningful_interaction: null, // TODO: Extract from communication events
      related_deals_count: metrics.relatedDealsCount,
      total_deal_value: metrics.totalDealValue,
      at_risk_deal_value: metrics.atRiskDealValue,

      last_calculated_at: new Date().toISOString(),
    };

    // Upsert health score
    const { data: savedScore, error: upsertError } = await supabase
      .from('relationship_health_scores')
      .upsert(healthScoreData, {
        onConflict: 'user_id,relationship_type,contact_id,company_id',
      })
      .select()
      .single();

    if (upsertError) {
      console.error('Error upserting relationship health:', upsertError);
      return null;
    }

    return savedScore;
  } catch (error) {
    console.error('Error calculating relationship health:', error);
    return null;
  }
}

/**
 * Compute and return relationship health scores for every contact owned by the specified user.
 *
 * @param userId - ID of the user whose contacts will be processed
 * @returns An array of persisted RelationshipHealthScore records for each contact; empty if none or on error
 */
export async function calculateAllContactsHealth(userId: string): Promise<RelationshipHealthScore[]> {
  try {
    // Get all contacts for user
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', userId);

    if (error || !contacts) return [];

    // Calculate health for each contact
    const healthScores: RelationshipHealthScore[] = [];
    for (const contact of contacts) {
      const score = await calculateRelationshipHealth('contact', contact.id, userId);
      if (score) healthScores.push(score);
    }

    return healthScores;
  } catch (error) {
    console.error('Error calculating all contacts health:', error);
    return [];
  }
}

/**
 * Retrieve the stored health score for a contact or company relationship.
 *
 * @returns The RelationshipHealthScore for the relationship, or `null` if none exists or an error occurs.
 */
export async function getRelationshipHealthScore(
  relationshipType: 'contact' | 'company',
  relationshipId: string
): Promise<RelationshipHealthScore | null> {
  try {
    const { data, error } = await supabase
      .from('relationship_health_scores')
      .select('*')
      .eq('relationship_type', relationshipType)
      .eq(relationshipType === 'contact' ? 'contact_id' : 'company_id', relationshipId)
      .single();

    if (error) return null;
    return data;
  } catch (error) {
    return null;
  }
}

/**
 * Retrieve all relationship health scores for a user, ordered by worst health first.
 *
 * @param userId - The ID of the user whose relationship health scores to retrieve
 * @returns An array of RelationshipHealthScore records ordered by `overall_health_score` ascending (worst first)
 */
export async function getUserRelationshipHealthScores(userId: string): Promise<RelationshipHealthScore[]> {
  try {
    const { data, error } = await supabase
      .from('relationship_health_scores')
      .select('*')
      .eq('user_id', userId)
      .order('overall_health_score', { ascending: true }); // Worst first

    if (error) return [];
    return data || [];
  } catch (error) {
    return [];
  }
}

/**
 * Retrieve all relationship health records for a user that are flagged as ghost risk, ordered by highest ghost probability.
 *
 * @param userId - The ID of the user whose relationships should be queried
 * @returns An array of RelationshipHealthScore objects for relationships with `is_ghost_risk = true`, ordered by `ghost_probability_percent` descending; returns an empty array if none found or on error
 */
export async function getGhostRiskRelationships(userId: string): Promise<RelationshipHealthScore[]> {
  try {
    const { data, error } = await supabase
      .from('relationship_health_scores')
      .select('*')
      .eq('user_id', userId)
      .eq('is_ghost_risk', true)
      .order('ghost_probability_percent', { ascending: false });

    if (error) return [];
    return data || [];
  } catch (error) {
    return [];
  }
}