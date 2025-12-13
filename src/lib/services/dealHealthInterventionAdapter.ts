/**
 * Deal Health Intervention Adapter
 *
 * Converts deal health data to intervention context format
 * to enable AI intervention templates for deal health alerts.
 */

import type { DealHealthScore, ExtendedHealthScore } from '@/lib/services/dealHealthService';
import type { RelationshipHealthScore } from '@/lib/services/relationshipHealthService';
import type { GhostRiskAssessment, GhostDetectionSignal } from '@/lib/services/ghostDetectionService';
import type { PersonalizationContext } from './interventionTemplateService';
import { supabase } from '@/lib/supabase/clientV2';

/**
 * Convert deal health score to intervention context
 */
export async function adaptDealHealthToInterventionContext(
  dealHealthScore: ExtendedHealthScore,
  userId: string
): Promise<PersonalizationContext | null> {
  try {
    // Fetch deal details
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('id, name, company, contact_name, primary_contact_id, company_id, stage_id')
      .eq('id', dealHealthScore.deal_id)
      .single();

    if (dealError || !deal) {
      console.error('Error fetching deal:', dealError);
      return null;
    }

    // Fetch contact details if available
    let contactName = deal.contact_name || 'there';
    let companyName = deal.company || null;
    let contactId = deal.primary_contact_id || dealHealthScore.contact_id || null;

    if (contactId) {
      try {
        const { data: contact } = await supabase
          .from('contacts')
          .select('first_name, last_name, email, company')
          .eq('id', contactId)
          .single();

        if (contact) {
          contactName = contact.first_name
            ? `${contact.first_name} ${contact.last_name || ''}`.trim()
            : contact.email || contactName;
          if (!companyName && contact.company) {
            companyName = contact.company;
          }
        }
      } catch (err) {
        // Use deal data if contact fetch fails
      }
    }

    // Create a relationship health score-like object from deal health
    const relationshipHealth: RelationshipHealthScore = {
      id: `deal-${dealHealthScore.id}`,
      user_id: userId,
      relationship_type: contactId ? 'contact' : 'company',
      contact_id: contactId,
      company_id: deal.company_id || null,
      overall_health_score: dealHealthScore.overall_health_score,
      health_status: mapDealHealthStatusToRelationshipStatus(dealHealthScore.health_status),
      risk_level: dealHealthScore.risk_level,
      communication_frequency_score: dealHealthScore.activity_score,
      response_behavior_score: dealHealthScore.response_time_score,
      engagement_quality_score: dealHealthScore.engagement_score,
      sentiment_score: dealHealthScore.sentiment_score,
      meeting_pattern_score: null,
      days_since_last_contact: dealHealthScore.days_since_last_activity,
      days_since_last_response: dealHealthScore.days_since_last_activity,
      avg_response_time_hours: dealHealthScore.avg_response_time_hours,
      response_rate_percent: null,
      email_open_rate_percent: null,
      meeting_count_30_days: dealHealthScore.meeting_count_last_30_days,
      email_count_30_days: dealHealthScore.activity_count_last_30_days,
      total_interactions_30_days: dealHealthScore.activity_count_last_30_days,
      baseline_response_time_hours: null,
      baseline_contact_frequency_days: null,
      baseline_meeting_frequency_days: null,
      is_ghost_risk: dealHealthScore.health_status === 'stalled' || dealHealthScore.health_status === 'critical',
      ghost_signals: null,
      ghost_probability_percent: dealHealthScore.health_status === 'stalled' ? 80 : dealHealthScore.health_status === 'critical' ? 60 : 30,
      days_until_predicted_ghost: null,
      sentiment_trend: dealHealthScore.sentiment_trend,
      risk_factors: dealHealthScore.risk_factors || [],
      created_at: dealHealthScore.created_at,
      updated_at: dealHealthScore.updated_at,
    };

    // Create ghost risk assessment from deal health
    const ghostRisk: GhostRiskAssessment = {
      isGhostRisk: dealHealthScore.health_status === 'stalled' || dealHealthScore.health_status === 'critical',
      ghostProbabilityPercent: dealHealthScore.health_status === 'stalled' ? 80 : dealHealthScore.health_status === 'critical' ? 60 : 30,
      daysUntilPredictedGhost: null,
      signals: convertDealHealthToGhostSignals(dealHealthScore),
      highestSeverity: mapDealRiskToGhostSeverity(dealHealthScore.risk_level),
      recommendedAction: getRecommendedAction(dealHealthScore),
      contextTrigger: getContextTrigger(dealHealthScore),
    };

    // Try to get last meaningful interaction
    const lastMeaningfulInteraction = await getLastMeaningfulInteraction(dealHealthScore.deal_id, userId);

    // Complete the relationship health object with missing fields
    relationshipHealth.last_meaningful_interaction = lastMeaningfulInteraction || null;
    relationshipHealth.avg_sentiment_last_3_interactions = dealHealthScore.avg_sentiment_last_3_meetings;
    relationshipHealth.related_deals_count = 1; // This deal
    relationshipHealth.total_deal_value = deal.value || 0;
    relationshipHealth.at_risk_deal_value = (dealHealthScore.health_status === 'critical' || dealHealthScore.health_status === 'stalled') ? (deal.value || 0) : 0;
    relationshipHealth.last_calculated_at = dealHealthScore.last_calculated_at;

    return {
      contactId: contactId || '',
      contactName,
      companyName,
      relationshipHealth,
      ghostRisk,
      lastMeaningfulInteraction,
    };
  } catch (error) {
    console.error('Error adapting deal health to intervention context:', error);
    return null;
  }
}

/**
 * Map deal health status to relationship health status
 */
function mapDealHealthStatusToRelationshipStatus(
  dealStatus: 'healthy' | 'warning' | 'critical' | 'stalled'
): 'healthy' | 'at_risk' | 'critical' | 'ghost' {
  switch (dealStatus) {
    case 'healthy':
      return 'healthy';
    case 'warning':
      return 'at_risk';
    case 'critical':
      return 'critical';
    case 'stalled':
      return 'ghost';
    default:
      return 'at_risk';
  }
}

/**
 * Map deal risk level to ghost severity
 */
function mapDealRiskToGhostSeverity(
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
): 'low' | 'medium' | 'high' | 'critical' | 'none' {
  switch (riskLevel) {
    case 'low':
      return 'low';
    case 'medium':
      return 'medium';
    case 'high':
      return 'high';
    case 'critical':
      return 'critical';
    default:
      return 'none';
  }
}

/**
 * Convert deal health risk factors to ghost detection signals
 */
function convertDealHealthToGhostSignals(dealHealth: ExtendedHealthScore): GhostDetectionSignal[] {
  const signals: GhostDetectionSignal[] = [];

  // Map risk factors to ghost signals
  if (dealHealth.risk_factors) {
    dealHealth.risk_factors.forEach((factor, index) => {
      let signalType: GhostDetectionSignal['signal_type'] = 'engagement_pattern_break';
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
      let signalContext = `Deal risk factor: ${factor.replace(/_/g, ' ')}`;

      if (factor.includes('no_response') || factor.includes('response')) {
        signalType = 'email_no_response';
        severity = dealHealth.days_since_last_activity && dealHealth.days_since_last_activity > 14 ? 'high' : 'medium';
        signalContext = `No response for ${dealHealth.days_since_last_activity || 0} days`;
      } else if (factor.includes('sentiment')) {
        signalType = 'sentiment_declining';
        severity = 'medium';
        signalContext = `Sentiment trend: ${dealHealth.sentiment_trend}`;
      } else if (factor.includes('stage') || factor.includes('velocity')) {
        signalType = 'engagement_pattern_break';
        severity = dealHealth.days_in_current_stage > 30 ? 'high' : 'medium';
        signalContext = `Deal stalled in stage for ${dealHealth.days_in_current_stage} days`;
      }

      signals.push({
        id: `deal-${dealHealth.id}-${factor}-${index}`,
        relationship_health_id: `deal-${dealHealth.id}`,
        user_id: dealHealth.user_id,
        signal_type: signalType,
        severity,
        signal_context: signalContext,
        signal_data: {
          deal_id: dealHealth.deal_id,
          risk_factor: factor,
          days_in_stage: dealHealth.days_in_current_stage,
        },
        detected_at: new Date().toISOString(),
        resolved_at: null,
        metadata: {
          deal_id: dealHealth.deal_id,
          risk_factor: factor,
        },
        created_at: new Date().toISOString(),
      });
    });
  }

  // Add signal for stalled deals
  if (dealHealth.health_status === 'stalled') {
    signals.push({
      id: `deal-${dealHealth.id}-stalled`,
      relationship_health_id: `deal-${dealHealth.id}`,
      user_id: dealHealth.user_id,
      signal_type: 'engagement_pattern_break',
      severity: 'critical',
      signal_context: `Deal has been stalled for ${dealHealth.days_in_current_stage} days in current stage`,
      signal_data: {
        deal_id: dealHealth.deal_id,
        days_in_stage: dealHealth.days_in_current_stage,
        health_status: dealHealth.health_status,
      },
      detected_at: new Date().toISOString(),
      resolved_at: null,
      metadata: {
        deal_id: dealHealth.deal_id,
        days_in_stage: dealHealth.days_in_current_stage,
      },
      created_at: new Date().toISOString(),
    });
  }

  // Add signal for critical deals with no activity
  if (dealHealth.health_status === 'critical' && dealHealth.days_since_last_activity && dealHealth.days_since_last_activity > 7) {
    signals.push({
      id: `deal-${dealHealth.id}-no-activity`,
      relationship_health_id: `deal-${dealHealth.id}`,
      user_id: dealHealth.user_id,
      signal_type: 'email_no_response',
      severity: 'high',
      signal_context: `No activity for ${dealHealth.days_since_last_activity} days`,
      signal_data: {
        deal_id: dealHealth.deal_id,
        days_since_last_activity: dealHealth.days_since_last_activity,
      },
      detected_at: new Date().toISOString(),
      resolved_at: null,
      metadata: {
        deal_id: dealHealth.deal_id,
      },
      created_at: new Date().toISOString(),
    });
  }

  return signals;
}

/**
 * Get recommended action based on deal health
 */
function getRecommendedAction(
  dealHealth: ExtendedHealthScore
): 'monitor' | 'intervene_soon' | 'intervene_now' | 'urgent' {
  if (dealHealth.health_status === 'stalled') return 'urgent';
  if (dealHealth.health_status === 'critical') return 'intervene_now';
  if (dealHealth.health_status === 'warning') return 'intervene_soon';
  return 'monitor';
}

/**
 * Get context trigger for intervention template selection
 */
function getContextTrigger(dealHealth: ExtendedHealthScore): string | null {
  // Map deal health status to intervention template context
  if (dealHealth.health_status === 'stalled') {
    return 'multiple_followups_ignored';
  }

  // Check for proposal-related context
  if (dealHealth.risk_factors?.some((f) => f.includes('proposal'))) {
    return 'after_proposal';
  }

  // Check for meeting-related context
  if (dealHealth.risk_factors?.some((f) => f.includes('meeting'))) {
    return 'after_meeting_noshow';
  }

  // Default to general ghosting
  if (dealHealth.health_status === 'critical' || dealHealth.health_status === 'warning') {
    return 'general_ghosting';
  }

  return null;
}

/**
 * Get last meaningful interaction for a deal
 */
async function getLastMeaningfulInteraction(
  dealId: string,
  userId: string
): Promise<PersonalizationContext['lastMeaningfulInteraction'] | undefined> {
  try {
    // Check for recent proposals
    const { data: proposals } = await supabase
      .from('activities')
      .select('id, type, notes, created_at')
      .eq('deal_id', dealId)
      .eq('user_id', userId)
      .eq('type', 'proposal')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (proposals) {
      return {
        type: 'proposal',
        date: proposals.created_at,
        topic: proposals.notes || 'proposal',
      };
    }

    // Check for recent meetings
    const { data: meetings } = await supabase
      .from('meetings')
      .select('id, title, summary, start_time, owner_user_id')
      .eq('owner_user_id', userId)
      .order('start_time', { ascending: false })
      .limit(1)
      .single();

    if (meetings) {
      return {
        type: 'meeting',
        date: meetings.start_time,
        topic: meetings.title || meetings.summary || 'meeting',
      };
    }

    // Check for recent activities
    const { data: activities } = await supabase
      .from('activities')
      .select('id, type, notes, created_at')
      .eq('deal_id', dealId)
      .eq('user_id', userId)
      .in('type', ['call', 'email', 'demo'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (activities) {
      return {
        type: activities.type,
        date: activities.created_at,
        topic: activities.notes || activities.type,
      };
    }
  } catch (error) {
    // Return undefined if no interaction found
  }

  return undefined;
}

// =====================================================
// Testable helpers (pure mapping)
// =====================================================

/**
 * Exposes internal, deterministic helpers for unit tests.
 * These do not perform any I/O.
 */
export const __dealHealthInterventionAdapterTestables = {
  mapDealHealthStatusToRelationshipStatus,
  mapDealRiskToGhostSeverity,
  convertDealHealthToGhostSignals,
};

