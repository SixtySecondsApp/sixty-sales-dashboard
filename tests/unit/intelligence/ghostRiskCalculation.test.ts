import { describe, expect, test } from 'vitest';
import { computeGhostRiskAssessmentFromSignals } from '@/lib/services/ghostDetectionService';
import type { RelationshipHealthScore } from '@/lib/services/relationshipHealthService';

function makeHealth(overall: number): RelationshipHealthScore {
  return {
    id: 'x',
    user_id: 'u',
    relationship_type: 'contact',
    contact_id: 'c',
    company_id: null,
    overall_health_score: overall,
    health_status: 'at_risk',
    risk_level: 'medium',
    communication_frequency_score: null,
    response_behavior_score: null,
    engagement_quality_score: null,
    sentiment_score: null,
    meeting_pattern_score: null,
    days_since_last_contact: null,
    days_since_last_response: null,
    avg_response_time_hours: null,
    response_rate_percent: null,
    email_open_rate_percent: null,
    meeting_count_30_days: 0,
    email_count_30_days: 0,
    total_interactions_30_days: 0,
    baseline_response_time_hours: null,
    baseline_contact_frequency_days: null,
    baseline_meeting_frequency_days: null,
    is_ghost_risk: false,
    ghost_signals: null,
    ghost_probability_percent: null,
    days_until_predicted_ghost: null,
    sentiment_trend: 'unknown',
    avg_sentiment_last_3_interactions: null,
    risk_factors: [],
    last_meaningful_interaction: null,
    related_deals_count: 0,
    total_deal_value: 0,
    at_risk_deal_value: 0,
    last_calculated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe('computeGhostRiskAssessmentFromSignals', () => {
  test('no signals: low probability, monitor', () => {
    const r = computeGhostRiskAssessmentFromSignals(makeHealth(90), []);
    expect(r.isGhostRisk).toBe(false);
    expect(r.ghostProbabilityPercent).toBeGreaterThanOrEqual(0);
    expect(r.recommendedAction).toBe('monitor');
  });

  test('critical signals + low health => urgent', () => {
    const r = computeGhostRiskAssessmentFromSignals(makeHealth(20), [
      { severity: 'critical', signal_type: 'email_no_response' },
      { severity: 'critical', signal_type: 'meeting_rescheduled_repeatedly' },
    ]);
    expect(r.isGhostRisk).toBe(true);
    expect(r.highestSeverity).toBe('critical');
    expect(r.recommendedAction).toBe('urgent');
    expect(r.contextTrigger).toBe('meeting_rescheduled');
  });
});

