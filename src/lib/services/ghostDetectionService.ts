/**
 * Ghost Detection Service
 *
 * Detects specific behavioral signals that indicate a prospect is about to ghost.
 * Works in conjunction with relationship health service to identify early warning signs.
 *
 * Ghost Detection Triggers (from feature brief):
 * - 2+ ignored follow-ups after meaningful interaction
 * - 7+ days past expected response time based on historical pattern
 * - Meeting rescheduled twice without new date set
 * - Email opens dropped to zero after consistent engagement
 * - Response time increased by 3x+ compared to baseline
 */

import { supabase } from '@/lib/supabase/clientV2';
import type { RelationshipHealthScore } from './relationshipHealthService';

// =====================================================
// Types
// =====================================================

export interface GhostDetectionSignal {
  id: string;
  relationship_health_id: string;
  user_id: string;
  signal_type:
    | 'email_no_response'
    | 'response_time_increased'
    | 'email_opens_declined'
    | 'meeting_cancelled'
    | 'meeting_rescheduled_repeatedly'
    | 'one_word_responses'
    | 'thread_dropout'
    | 'attendee_count_decreased'
    | 'meeting_duration_shortened'
    | 'sentiment_declining'
    | 'formal_language_shift'
    | 'engagement_pattern_break'
    | 'champion_disappeared'
    | 'delayed_meeting_acceptance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  signal_context: string;
  signal_data: any;
  detected_at: string;
  resolved_at: string | null;
  metadata: any;
  created_at: string;
}

export interface GhostRiskAssessment {
  isGhostRisk: boolean;
  ghostProbabilityPercent: number;
  daysUntilPredictedGhost: number | null;
  signals: GhostDetectionSignal[];
  highestSeverity: 'low' | 'medium' | 'high' | 'critical' | 'none';
  recommendedAction: 'monitor' | 'intervene_soon' | 'intervene_now' | 'urgent';
  contextTrigger: string | null; // Which intervention template context to use
}

// =====================================================
// Signal Detection Functions
// =====================================================

/**
 * Detects when a contact has sent multiple emails without receiving a reply within the last 14 days.
 *
 * Returns a partial `GhostDetectionSignal` for `email_no_response` including `severity`, `signal_context`, and `signal_data` with counts and last email details; returns `null` if no signal is detected.
 *
 * Severity: `high` when exactly 2 unreplied emails are found, `critical` when 3 or more unreplied emails are found.
 *
 * @returns A `Partial<GhostDetectionSignal>` describing the detected `email_no_response` signal, or `null` if the condition is not met.
 */
async function detectEmailNoResponse(
  contactId: string,
  userId: string
): Promise<Partial<GhostDetectionSignal> | null> {
  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: recentEmails } = await supabase
      .from('communication_events')
      .select('*')
      .eq('contact_id', contactId)
      .eq('user_id', userId)
      .eq('event_type', 'email_sent')
      .gte('event_timestamp', fourteenDaysAgo)
      .order('event_timestamp', { ascending: false });

    if (!recentEmails || recentEmails.length < 2) return null;

    const unrepliedCount = recentEmails.filter((e) => !e.was_replied).length;

    if (unrepliedCount >= 2) {
      const lastEmail = recentEmails[0];
      const daysSinceLast = Math.floor(
        (Date.now() - new Date(lastEmail.event_timestamp).getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        signal_type: 'email_no_response',
        severity: unrepliedCount >= 3 ? 'critical' : 'high',
        signal_context: `${unrepliedCount} emails sent in last 14 days with no response. Last email sent ${daysSinceLast} days ago.`,
        signal_data: {
          unreplied_count: unrepliedCount,
          days_since_last_email: daysSinceLast,
          last_email_subject: lastEmail.subject,
        },
      };
    }

    return null;
  } catch (error) {
    console.error('Error detecting email no-response:', error);
    return null;
  }
}

/**
 * Detects whether recent inbound response times have increased enough to indicate a ghosting risk.
 *
 * Evaluates up to five inbound response times from the last 30 days and compares their average to the provided baseline. If the average is at least 3× the baseline, returns a signal with severity `high` (or `critical` when the increase is ≥5×); otherwise returns `null`.
 *
 * @param contactId - The contact whose communication events will be evaluated
 * @param userId - The user associated with the communication events
 * @param baselineResponseTimeHours - Baseline inbound response time in hours used for comparison; when `null` no detection is performed
 * @returns A partial `GhostDetectionSignal` describing the response-time increase when detected, `null` if no signal is triggered or on error
 */
async function detectResponseTimeIncrease(
  contactId: string,
  userId: string,
  baselineResponseTimeHours: number | null
): Promise<Partial<GhostDetectionSignal> | null> {
  if (!baselineResponseTimeHours) return null;

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: recentResponses } = await supabase
      .from('communication_events')
      .select('response_time_hours')
      .eq('contact_id', contactId)
      .eq('user_id', userId)
      .eq('direction', 'inbound')
      .gte('event_timestamp', thirtyDaysAgo)
      .not('response_time_hours', 'is', null)
      .order('event_timestamp', { ascending: false })
      .limit(5);

    if (!recentResponses || recentResponses.length === 0) return null;

    const avgRecentResponseTime =
      recentResponses.reduce((sum, r) => sum + (r.response_time_hours || 0), 0) /
      recentResponses.length;

    const increaseRatio = avgRecentResponseTime / baselineResponseTimeHours;

    if (increaseRatio >= 3.0) {
      return {
        signal_type: 'response_time_increased',
        severity: increaseRatio >= 5.0 ? 'critical' : 'high',
        signal_context: `Response time increased ${Math.round(increaseRatio)}x from baseline (${Math.round(baselineResponseTimeHours)}h → ${Math.round(avgRecentResponseTime)}h)`,
        signal_data: {
          baseline_hours: baselineResponseTimeHours,
          current_avg_hours: avgRecentResponseTime,
          increase_ratio: increaseRatio,
        },
      };
    }

    return null;
  } catch (error) {
    console.error('Error detecting response time increase:', error);
    return null;
  }
}

/**
 * Detects a significant drop in email open rate for a contact compared to the prior 30-day period.
 *
 * Compares recent (last 30 days) and historical (30–60 days ago) email open rates and produces a ghosting signal
 * when the open rate declines by 40 percentage points or more, or when the recent open rate falls below 20%.
 *
 * @param contactId - The contact's unique identifier
 * @param userId - The user's unique identifier performing the detection
 * @returns A `Partial<GhostDetectionSignal>` with `signal_type: 'email_opens_declined'`, `severity`, `signal_context`, and `signal_data` when a decline is detected; `null` otherwise.
 */
async function detectEmailOpensDeclined(
  contactId: string,
  userId: string
): Promise<Partial<GhostDetectionSignal> | null> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

    // Get recent emails (last 30 days)
    const { data: recentEmails } = await supabase
      .from('communication_events')
      .select('was_opened')
      .eq('contact_id', contactId)
      .eq('user_id', userId)
      .eq('event_type', 'email_sent')
      .gte('event_timestamp', thirtyDaysAgo);

    // Get historical emails (30-60 days ago)
    const { data: historicalEmails } = await supabase
      .from('communication_events')
      .select('was_opened')
      .eq('contact_id', contactId)
      .eq('user_id', userId)
      .eq('event_type', 'email_sent')
      .gte('event_timestamp', sixtyDaysAgo)
      .lt('event_timestamp', thirtyDaysAgo);

    if (!recentEmails || recentEmails.length < 2) return null;
    if (!historicalEmails || historicalEmails.length < 2) return null;

    const recentOpenRate =
      (recentEmails.filter((e) => e.was_opened).length / recentEmails.length) * 100;
    const historicalOpenRate =
      (historicalEmails.filter((e) => e.was_opened).length / historicalEmails.length) * 100;

    const decline = historicalOpenRate - recentOpenRate;

    // Trigger if open rate declined by 40%+ or dropped below 20%
    if (decline >= 40 || recentOpenRate < 20) {
      return {
        signal_type: 'email_opens_declined',
        severity: recentOpenRate === 0 ? 'critical' : decline >= 60 ? 'high' : 'medium',
        signal_context: `Email open rate declined from ${Math.round(historicalOpenRate)}% to ${Math.round(recentOpenRate)}%`,
        signal_data: {
          historical_open_rate: historicalOpenRate,
          recent_open_rate: recentOpenRate,
          decline_percent: decline,
          recent_emails_count: recentEmails.length,
        },
      };
    }

    return null;
  } catch (error) {
    console.error('Error detecting email opens declined:', error);
    return null;
  }
}

/**
 * Detects when meetings for a contact have been rescheduled or cancelled repeatedly without a new meeting being scheduled.
 *
 * @returns A partial GhostDetectionSignal for a `meeting_rescheduled_repeatedly` signal containing severity, `signal_context`, and `signal_data`, or `null` if no signal is detected.
 */
async function detectMeetingRescheduledRepeatedly(
  contactId: string,
  userId: string
): Promise<Partial<GhostDetectionSignal> | null> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: meetingEvents } = await supabase
      .from('communication_events')
      .select('*')
      .eq('contact_id', contactId)
      .eq('user_id', userId)
      .in('event_type', ['meeting_rescheduled', 'meeting_cancelled'])
      .gte('event_timestamp', thirtyDaysAgo)
      .order('event_timestamp', { ascending: false });

    if (!meetingEvents || meetingEvents.length < 2) return null;

    const rescheduleCount = meetingEvents.filter((e) => e.event_type === 'meeting_rescheduled').length;
    const cancelCount = meetingEvents.filter((e) => e.event_type === 'meeting_cancelled').length;

    if (rescheduleCount >= 2 || cancelCount >= 1) {
      // Check if a new meeting was actually scheduled
      const { data: scheduledMeetings } = await supabase
        .from('communication_events')
        .select('id')
        .eq('contact_id', contactId)
        .eq('user_id', userId)
        .eq('event_type', 'meeting_scheduled')
        .gte('event_timestamp', meetingEvents[0].event_timestamp);

      const hasNewMeeting = scheduledMeetings && scheduledMeetings.length > 0;

      if (!hasNewMeeting) {
        return {
          signal_type: 'meeting_rescheduled_repeatedly',
          severity: cancelCount >= 1 ? 'critical' : 'high',
          signal_context: `${rescheduleCount} meeting reschedules and ${cancelCount} cancellations with no new date set`,
          signal_data: {
            reschedule_count: rescheduleCount,
            cancel_count: cancelCount,
            has_new_meeting: hasNewMeeting,
            last_event: meetingEvents[0].event_type,
          },
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error detecting meeting rescheduled:', error);
    return null;
  }
}

/**
 * Detects a declining trend in meeting sentiment for a contact.
 *
 * Triggers when there are at least three meetings with sentiment scores and the most recent score is lower than the average of the two previous scores by 0.15 or more. Severity is set to `critical` if the recent score is below -0.3, `high` if the decline is 0.25 or greater, and `medium` otherwise. The returned signal includes `signal_type: 'sentiment_declining'`, a human-readable `signal_context`, and `signal_data` with recent/previous sentiment values, change magnitude, and meeting count.
 *
 * @returns A Partial<GhostDetectionSignal> describing the detected `'sentiment_declining'` signal, or `null` if no decline is detected or on error.
 */
async function detectSentimentDeclining(
  contactId: string,
  userId: string
): Promise<Partial<GhostDetectionSignal> | null> {
  try {
    const { data: meetings } = await supabase
      .from('meetings')
      .select('sentiment_score, meeting_start')
      .eq('primary_contact_id', contactId)
      .eq('owner_user_id', userId)
      .not('sentiment_score', 'is', null)
      .order('meeting_start', { ascending: false })
      .limit(5);

    if (!meetings || meetings.length < 3) return null;

    const sentiments = meetings.map((m) => m.sentiment_score as number);
    const recent = sentiments[0];
    const older = (sentiments[1] + sentiments[2]) / 2;
    const change = recent - older;

    if (change < -0.15) {
      // Significant decline
      return {
        signal_type: 'sentiment_declining',
        severity: recent < -0.3 ? 'critical' : change < -0.25 ? 'high' : 'medium',
        signal_context: `Meeting sentiment declined from ${older.toFixed(2)} to ${recent.toFixed(2)}`,
        signal_data: {
          recent_sentiment: recent,
          previous_avg_sentiment: older,
          change: change,
          meeting_count: meetings.length,
        },
      };
    }

    return null;
  } catch (error) {
    console.error('Error detecting sentiment declining:', error);
    return null;
  }
}

/**
 * Detects when a conversation thread appears to have dropped out after the prospect stopped replying.
 *
 * Considers recent email events and signals when a thread with at least three messages ends with an outbound message
 * and the last message was sent by us at least 5 days ago. Severity is `high` if the last message was >= 10 days ago,
 * otherwise `medium`.
 *
 * @returns A `Partial<GhostDetectionSignal>` for a `thread_dropout` signal containing `signal_data` (including
 * `thread_length`, `days_since_last`, `thread_position`, and `last_subject`) when a dropout is detected, or `null`
 * if no dropout is found or an error occurs.
 */
async function detectThreadDropout(
  contactId: string,
  userId: string
): Promise<Partial<GhostDetectionSignal> | null> {
  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: emails } = await supabase
      .from('communication_events')
      .select('*')
      .eq('contact_id', contactId)
      .eq('user_id', userId)
      .in('event_type', ['email_sent', 'email_received'])
      .gte('event_timestamp', fourteenDaysAgo)
      .not('thread_id', 'is', null)
      .order('event_timestamp', { ascending: false });

    if (!emails || emails.length < 3) return null;

    // Find threads with multiple back-and-forth
    const threadCounts: Record<string, { total: number; lastDirection: string; position: number }> = {};

    emails.forEach((email) => {
      if (!email.thread_id) return;
      if (!threadCounts[email.thread_id]) {
        threadCounts[email.thread_id] = { total: 0, lastDirection: email.direction, position: email.thread_position || 0 };
      }
      threadCounts[email.thread_id].total += 1;
      if (email.thread_position && email.thread_position > threadCounts[email.thread_id].position) {
        threadCounts[email.thread_id].lastDirection = email.direction;
        threadCounts[email.thread_id].position = email.thread_position;
      }
    });

    // Find threads that had back-and-forth (3+ messages) but ended with our message
    for (const [threadId, info] of Object.entries(threadCounts)) {
      if (info.total >= 3 && info.lastDirection === 'outbound' && info.position >= 2) {
        const threadEmails = emails.filter((e) => e.thread_id === threadId);
        const lastEmail = threadEmails[0];
        const daysSinceLast = Math.floor(
          (Date.now() - new Date(lastEmail.event_timestamp).getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceLast >= 5) {
          return {
            signal_type: 'thread_dropout',
            severity: daysSinceLast >= 10 ? 'high' : 'medium',
            signal_context: `Active conversation thread (${info.total} messages) went silent after our last message ${daysSinceLast} days ago`,
            signal_data: {
              thread_length: info.total,
              days_since_last: daysSinceLast,
              thread_position: info.position,
              last_subject: lastEmail.subject,
            },
          };
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error detecting thread dropout:', error);
    return null;
  }
}

/**
 * Detects when the time since last contact significantly exceeds the expected contact cadence.
 *
 * Returns a partial `GhostDetectionSignal` when days since last contact exceed twice the provided baseline contact frequency.
 * Severity is `critical` if the gap exceeds four times the baseline, otherwise `high`. The returned object includes
 * `signal_context` describing the gap and `signal_data` with `days_since_last_contact`, `baseline_frequency_days`,
 * and `expected_contact_days`.
 *
 * @param baselineContactFrequencyDays - The typical number of days between contacts for this relationship; detection is skipped when `null`.
 * @returns A partial `GhostDetectionSignal` describing the engagement gap, or `null` if no signal is triggered.
 */
async function detectEngagementPatternBreak(
  contactId: string,
  userId: string,
  baselineContactFrequencyDays: number | null
): Promise<Partial<GhostDetectionSignal> | null> {
  if (!baselineContactFrequencyDays) return null;

  try {
    const { data: lastContact } = await supabase
      .from('communication_events')
      .select('event_timestamp')
      .eq('contact_id', contactId)
      .eq('user_id', userId)
      .order('event_timestamp', { ascending: false })
      .limit(1)
      .single();

    if (!lastContact) return null;

    const daysSinceLastContact = Math.floor(
      (Date.now() - new Date(lastContact.event_timestamp).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Trigger if we've exceeded 2x the baseline frequency
    const expectedContactDays = baselineContactFrequencyDays * 2;

    if (daysSinceLastContact > expectedContactDays) {
      return {
        signal_type: 'engagement_pattern_break',
        severity: daysSinceLastContact > expectedContactDays * 2 ? 'critical' : 'high',
        signal_context: `No contact for ${daysSinceLastContact} days (baseline: every ${Math.round(baselineContactFrequencyDays)} days)`,
        signal_data: {
          days_since_last_contact: daysSinceLastContact,
          baseline_frequency_days: baselineContactFrequencyDays,
          expected_contact_days: expectedContactDays,
        },
      };
    }

    return null;
  } catch (error) {
    console.error('Error detecting engagement pattern break:', error);
    return null;
  }
}

// =====================================================
// Main Detection Function
// =====================================================

/**
 * Run all ghost-detection checks for a relationship and persist any newly found signals.
 *
 * @param relationshipHealthId - The relationship health record identifier to attach detected signals to
 * @param contactId - The contact (prospect) identifier to analyze
 * @param userId - The user identifier performing or owning the detection
 * @param healthScore - Current relationship health score and baselines used by detectors
 * @returns An array of active (unresolved) GhostDetectionSignal records for the relationship; includes newly inserted signals or existing unresolved signals
 */
export async function detectGhostingSignals(
  relationshipHealthId: string,
  contactId: string,
  userId: string,
  healthScore: RelationshipHealthScore
): Promise<GhostDetectionSignal[]> {
  try {
    const detectedSignals: Partial<GhostDetectionSignal>[] = [];

    // Run all detection functions
    const signals = await Promise.all([
      detectEmailNoResponse(contactId, userId),
      detectResponseTimeIncrease(contactId, userId, healthScore.baseline_response_time_hours),
      detectEmailOpensDeclined(contactId, userId),
      detectMeetingRescheduledRepeatedly(contactId, userId),
      detectSentimentDeclining(contactId, userId),
      detectThreadDropout(contactId, userId),
      detectEngagementPatternBreak(contactId, userId, healthScore.baseline_contact_frequency_days),
    ]);

    // Filter out nulls and add to detected signals
    signals.forEach((signal) => {
      if (signal) detectedSignals.push(signal);
    });

    if (detectedSignals.length === 0) return [];

    // Get existing signals to avoid duplicates
    const { data: existingSignals } = await supabase
      .from('ghost_detection_signals')
      .select('signal_type')
      .eq('relationship_health_id', relationshipHealthId)
      .is('resolved_at', null);

    const existingTypes = new Set(existingSignals?.map((s) => s.signal_type) || []);

    // Insert new signals
    const signalsToInsert = detectedSignals
      .filter((s) => !existingTypes.has(s.signal_type!))
      .map((signal) => ({
        relationship_health_id: relationshipHealthId,
        user_id: userId,
        ...signal,
        detected_at: new Date().toISOString(),
      }));

    if (signalsToInsert.length === 0) {
      // Return existing signals
      const { data } = await supabase
        .from('ghost_detection_signals')
        .select('*')
        .eq('relationship_health_id', relationshipHealthId)
        .is('resolved_at', null);

      return data || [];
    }

    const { data: insertedSignals, error } = await supabase
      .from('ghost_detection_signals')
      .insert(signalsToInsert)
      .select();

    if (error) {
      console.error('Error inserting ghost signals:', error);
      return [];
    }

    return insertedSignals || [];
  } catch (error) {
    console.error('Error detecting ghosting signals:', error);
    return [];
  }
}

/**
 * Compute overall ghosting risk for a relationship by aggregating detected ghosting signals and the provided health score.
 *
 * @param healthScore - Current relationship health metrics used as the base for probability adjustments.
 * @returns A GhostRiskAssessment with:
 *  - `isGhostRisk`: `true` when the computed probability meets the risk threshold,
 *  - `ghostProbabilityPercent`: the final ghost probability (0–100),
 *  - `daysUntilPredictedGhost`: estimated days until a ghosting event or `null` if not predicted,
 *  - `signals`: detected ghosting signals considered in the assessment,
 *  - `highestSeverity`: the most severe level among detected signals or `none`,
 *  - `recommendedAction`: suggested next step (`monitor`, `intervene_soon`, `intervene_now`, `urgent`),
 *  - `contextTrigger`: optional intervention template context derived from signal types.
 */
export async function assessGhostRisk(
  relationshipHealthId: string,
  contactId: string,
  userId: string,
  healthScore: RelationshipHealthScore
): Promise<GhostRiskAssessment> {
  // Detect all signals
  const signals = await detectGhostingSignals(relationshipHealthId, contactId, userId, healthScore);

  // Calculate ghost probability
  let ghostProbability = 0;

  // Base probability from health score
  if (healthScore.overall_health_score < 30) ghostProbability += 40;
  else if (healthScore.overall_health_score < 50) ghostProbability += 20;

  // Add probability based on signals
  const criticalSignals = signals.filter((s) => s.severity === 'critical').length;
  const highSignals = signals.filter((s) => s.severity === 'high').length;
  const mediumSignals = signals.filter((s) => s.severity === 'medium').length;

  ghostProbability += criticalSignals * 25;
  ghostProbability += highSignals * 15;
  ghostProbability += mediumSignals * 5;

  ghostProbability = Math.min(100, Math.max(0, ghostProbability));

  // Determine highest severity
  let highestSeverity: 'low' | 'medium' | 'high' | 'critical' | 'none' = 'none';
  if (criticalSignals > 0) highestSeverity = 'critical';
  else if (highSignals > 0) highestSeverity = 'high';
  else if (mediumSignals > 0) highestSeverity = 'medium';
  else if (signals.length > 0) highestSeverity = 'low';

  // Recommend action
  let recommendedAction: 'monitor' | 'intervene_soon' | 'intervene_now' | 'urgent' = 'monitor';
  if (ghostProbability >= 75) recommendedAction = 'urgent';
  else if (ghostProbability >= 50) recommendedAction = 'intervene_now';
  else if (ghostProbability >= 30) recommendedAction = 'intervene_soon';

  // Determine context trigger for intervention template
  let contextTrigger: string | null = null;
  if (signals.some((s) => s.signal_type === 'meeting_rescheduled_repeatedly')) {
    contextTrigger = 'meeting_rescheduled';
  } else if (signals.some((s) => s.signal_type === 'email_no_response')) {
    contextTrigger = 'multiple_followups_ignored';
  } else if (signals.some((s) => s.signal_type === 'thread_dropout')) {
    contextTrigger = 'multiple_followups_ignored';
  } else if (signals.some((s) => s.signal_type === 'email_opens_declined')) {
    contextTrigger = 'email_opens_stopped';
  } else if (signals.length > 0) {
    contextTrigger = 'general_ghosting';
  }

  // Predict days until ghost (simple heuristic)
  let daysUntilPredictedGhost: number | null = null;
  if (ghostProbability >= 50) {
    daysUntilPredictedGhost = Math.max(1, Math.round((100 - ghostProbability) / 10));
  }

  return {
    isGhostRisk: ghostProbability >= 40,
    ghostProbabilityPercent: Math.round(ghostProbability),
    daysUntilPredictedGhost,
    signals,
    highestSeverity,
    recommendedAction,
    contextTrigger,
  };
}

/**
 * Mark a ghost detection signal as resolved by setting its `resolved_at` timestamp.
 *
 * @param signalId - The ID of the ghost detection signal to resolve
 * @returns `true` if the signal was successfully updated, `false` otherwise
 */
export async function resolveGhostSignal(signalId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('ghost_detection_signals')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', signalId);

    return !error;
  } catch (error) {
    console.error('Error resolving ghost signal:', error);
    return false;
  }
}

/**
 * Mark all unresolved ghost detection signals for a relationship as resolved.
 *
 * Sets the `resolved_at` timestamp on every `ghost_detection_signals` row where
 * `relationship_health_id` matches `relationshipHealthId` and `resolved_at` is null.
 *
 * @param relationshipHealthId - The ID of the relationship health record whose signals should be resolved
 * @returns `true` if the update completed without error, `false` otherwise
 */
export async function resolveAllSignalsForRelationship(relationshipHealthId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('ghost_detection_signals')
      .update({ resolved_at: new Date().toISOString() })
      .eq('relationship_health_id', relationshipHealthId)
      .is('resolved_at', null);

    return !error;
  } catch (error) {
    console.error('Error resolving all signals:', error);
    return false;
  }
}

/**
 * Retrieve unresolved ghost detection signals for the given relationship.
 *
 * @param relationshipHealthId - The ID of the relationship_health record to query
 * @returns An array of active (unresolved) GhostDetectionSignal records; returns an empty array if none are found or on error
 */
export async function getActiveGhostSignals(relationshipHealthId: string): Promise<GhostDetectionSignal[]> {
  try {
    const { data, error } = await supabase
      .from('ghost_detection_signals')
      .select('*')
      .eq('relationship_health_id', relationshipHealthId)
      .is('resolved_at', null)
      .order('severity', { ascending: false })
      .order('detected_at', { ascending: false });

    if (error) return [];
    return data || [];
  } catch (error) {
    return [];
  }
}