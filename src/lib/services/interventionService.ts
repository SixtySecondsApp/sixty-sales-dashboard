/**
 * Intervention Service
 *
 * Handles deployment and tracking of interventions.
 * Manages the full intervention lifecycle from deployment to outcome tracking.
 */

import { supabase } from '@/lib/supabase/clientV2';
import type { PersonalizedTemplate } from './interventionTemplateService';

// =====================================================
// Types
// =====================================================

export interface Intervention {
  id: string;
  user_id: string;
  relationship_health_id: string;
  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  template_id: string | null;
  template_type: string;
  context_trigger: string;
  subject_line: string | null;
  intervention_body: string;
  personalization_data: any;
  intervention_channel: 'email' | 'linkedin' | 'phone' | 'video' | 'in_person';
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'recovered' | 'failed';
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  first_open_at: string | null;
  clicked_at: string | null;
  replied_at: string | null;
  recovered_at: string | null;
  open_count: number;
  click_count: number;
  response_type: string | null;
  response_text: string | null;
  suggested_reply: string | null;
  outcome: string | null;
  outcome_notes: string | null;
  health_score_at_send: number | null;
  days_since_last_contact: number | null;
  ai_recommendation_score: number | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface InterventionDeployment {
  relationshipHealthId: string;
  contactId: string;
  personalizedTemplate: PersonalizedTemplate;
  channel: 'email' | 'linkedin' | 'phone' | 'video' | 'in_person';
  healthScoreAtSend: number;
  daysSinceLastContact: number | null;
  aiRecommendationScore: number;
}

export interface InterventionOutcome {
  interventionId: string;
  outcome: 'relationship_recovered' | 'moved_to_nurture' | 'deal_closed_won' | 'deal_closed_lost' | 'permanent_ghost' | 'pending';
  outcomeNotes?: string;
  responseType?: 'interested_later' | 'still_interested' | 'not_interested' | 'went_competitor' | 'not_fit' | 'apologetic' | 'ghosted_again';
  responseText?: string;
}

// =====================================================
// Intervention Deployment
// =====================================================

/**
 * Create a new intervention record and initialize it with a pending status.
 *
 * @param deployment - Deployment details including relationship, contact, personalized template, channel, and scoring metadata
 * @param userId - ID of the user creating the intervention
 * @returns The created `Intervention` on success, `null` on failure
 */
export async function deployIntervention(
  deployment: InterventionDeployment,
  userId: string
): Promise<Intervention | null> {
  try {
    const { data, error } = await supabase
      .from('interventions')
      .insert({
        user_id: userId,
        relationship_health_id: deployment.relationshipHealthId,
        contact_id: deployment.contactId,
        company_id: null, // TODO: Link company if needed
        deal_id: null, // TODO: Link deal if applicable
        template_id: deployment.personalizedTemplate.templateId,
        template_type: 'permission_to_close', // TODO: Get from template
        context_trigger: 'general_ghosting', // TODO: Get from ghost risk
        subject_line: deployment.personalizedTemplate.subject,
        intervention_body: deployment.personalizedTemplate.body,
        personalization_data: deployment.personalizedTemplate.personalizationData,
        intervention_channel: deployment.channel,
        status: 'pending',
        health_score_at_send: deployment.healthScoreAtSend,
        days_since_last_contact: deployment.daysSinceLastContact,
        ai_recommendation_score: deployment.aiRecommendationScore,
        metadata: {},
      })
      .select()
      .single();

    if (error) {
      console.error('Error deploying intervention:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in deployIntervention:', error);
    return null;
  }
}

/**
 * Mark an intervention's status as 'sent' and record the current time in `sent_at`.
 *
 * @returns `true` if the database update succeeded, `false` otherwise.
 */
export async function markInterventionAsSent(interventionId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('interventions')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', interventionId);

    return !error;
  } catch (error) {
    console.error('Error marking intervention as sent:', error);
    return false;
  }
}

/**
 * Mark an intervention as opened, increment its open count, and set open timestamps.
 *
 * Sets the intervention's status to `opened`, updates `opened_at`, increments `open_count`, and sets `first_open_at` when this is the first recorded open.
 *
 * @param interventionId - The ID of the intervention to update
 * @returns `true` if the intervention record was successfully updated, `false` otherwise.
 */
export async function trackInterventionOpened(interventionId: string): Promise<boolean> {
  try {
    // Get current intervention
    const { data: intervention } = await supabase
      .from('interventions')
      .select('open_count, first_open_at')
      .eq('id', interventionId)
      .single();

    if (!intervention) return false;

    const updates: any = {
      status: 'opened',
      opened_at: new Date().toISOString(),
      open_count: (intervention.open_count || 0) + 1,
    };

    // Set first_open_at if this is the first open
    if (!intervention.first_open_at) {
      updates.first_open_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('interventions')
      .update(updates)
      .eq('id', interventionId);

    return !error;
  } catch (error) {
    console.error('Error tracking intervention opened:', error);
    return false;
  }
}

/**
 * Record that an intervention's link was clicked and increment its click count.
 *
 * @param interventionId - The ID of the intervention to update
 * @returns `true` if the intervention was updated successfully, `false` otherwise.
 */
export async function trackInterventionClicked(interventionId: string): Promise<boolean> {
  try {
    const { data: intervention } = await supabase
      .from('interventions')
      .select('click_count')
      .eq('id', interventionId)
      .single();

    if (!intervention) return false;

    const { error } = await supabase
      .from('interventions')
      .update({
        status: 'clicked',
        clicked_at: new Date().toISOString(),
        click_count: (intervention.click_count || 0) + 1,
      })
      .eq('id', interventionId);

    return !error;
  } catch (error) {
    console.error('Error tracking intervention clicked:', error);
    return false;
  }
}

/**
 * Mark an intervention as replied and record the respondent's details.
 *
 * Updates the intervention's status to `replied`, sets `replied_at` to the current time,
 * stores the provided `responseType` and optional `responseText`.
 *
 * @param interventionId - The ID of the intervention to update
 * @param responseType - The categorized response type (e.g., `interested_later`, `not_interested`)
 * @param responseText - Optional free-form text of the respondent's message
 * @returns `true` if the database update succeeded, `false` otherwise
 */
export async function trackInterventionReplied(
  interventionId: string,
  responseType: InterventionOutcome['responseType'],
  responseText?: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('interventions')
      .update({
        status: 'replied',
        replied_at: new Date().toISOString(),
        response_type: responseType,
        response_text: responseText,
      })
      .eq('id', interventionId);

    return !error;
  } catch (error) {
    console.error('Error tracking intervention replied:', error);
    return false;
  }
}

/**
 * Set an intervention's status to recovered and record the recovery timestamp and outcome.
 *
 * @param interventionId - The intervention's identifier
 * @returns `true` if the intervention was updated successfully, `false` otherwise
 */
export async function markInterventionRecovered(interventionId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('interventions')
      .update({
        status: 'recovered',
        recovered_at: new Date().toISOString(),
        outcome: 'relationship_recovered',
      })
      .eq('id', interventionId);

    return !error;
  } catch (error) {
    console.error('Error marking intervention recovered:', error);
    return false;
  }
}

/**
 * Apply an outcome and optional response details to an intervention record.
 *
 * @param outcome - Outcome details specifying the intervention id, outcome state, optional outcome notes, and optional response type/text to store on the intervention
 * @returns `true` if the database update succeeded, `false` otherwise.
 */
export async function updateInterventionOutcome(outcome: InterventionOutcome): Promise<boolean> {
  try {
    const updates: any = {
      outcome: outcome.outcome,
      outcome_notes: outcome.outcomeNotes,
    };

    if (outcome.responseType) {
      updates.response_type = outcome.responseType;
    }
    if (outcome.responseText) {
      updates.response_text = outcome.responseText;
    }

    const { error } = await supabase
      .from('interventions')
      .update(updates)
      .eq('id', outcome.interventionId);

    return !error;
  } catch (error) {
    console.error('Error updating intervention outcome:', error);
    return false;
  }
}

// =====================================================
// Intervention Retrieval
// =====================================================

/**
 * Fetches a single intervention by its unique identifier.
 *
 * @returns The matching `Intervention`, or `null` if not found or on error.
 */
export async function getIntervention(interventionId: string): Promise<Intervention | null> {
  try {
    const { data, error } = await supabase
      .from('interventions')
      .select('*')
      .eq('id', interventionId)
      .single();

    if (error) return null;
    return data;
  } catch (error) {
    return null;
  }
}

/**
 * Fetches all interventions associated with a contact, ordered by newest first.
 *
 * @returns An array of Intervention objects for the contact, or an empty array if none are found or on error.
 */
export async function getContactInterventions(contactId: string): Promise<Intervention[]> {
  try {
    const { data, error } = await supabase
      .from('interventions')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });

    if (error) return [];
    return data || [];
  } catch (error) {
    return [];
  }
}

/**
 * Fetch interventions for a user that are considered active (statuses: pending, sent, delivered, opened) and still have an outcome of "pending", ordered newest first.
 *
 * @param userId - The user id to filter interventions by
 * @returns An array of matching Intervention objects; returns an empty array when no interventions are found or on error
 */
export async function getActiveInterventions(userId: string): Promise<Intervention[]> {
  try {
    const { data, error } = await supabase
      .from('interventions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'sent', 'delivered', 'opened'])
      .eq('outcome', 'pending')
      .order('created_at', { ascending: false});

    if (error) return [];
    return data || [];
  } catch (error) {
    return [];
  }
}

/**
 * Fetches all interventions belonging to a user, ordered by newest first.
 *
 * @param userId - The ID of the user whose interventions to fetch
 * @returns The interventions for `userId` ordered by `created_at` descending; an empty array if none are found or on error
 */
export async function getUserInterventions(userId: string): Promise<Intervention[]> {
  try {
    const { data, error } = await supabase
      .from('interventions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return [];
    return data || [];
  } catch (error) {
    return [];
  }
}

// =====================================================
// Analytics & Reporting
// =====================================================

/**
 * Compute aggregate success metrics for a user's interventions.
 *
 * @param userId - The user identifier to scope the metrics
 * @returns An object with:
 *   - `totalSent`: number of interventions with a non-null `sent_at`
 *   - `totalReplied`: number of interventions whose status is `replied` or `recovered`
 *   - `totalRecovered`: number of interventions whose status is `recovered`
 *   - `responseRate`: `totalReplied` as a percentage of `totalSent` (rounded)
 *   - `recoveryRate`: `totalRecovered` as a percentage of `totalSent` (rounded)
 *   - `avgResponseTimeHours`: average hours between `sent_at` and `replied_at` for replied interventions, or `null` if not applicable
 */
export async function getInterventionSuccessRate(userId: string): Promise<{
  totalSent: number;
  totalReplied: number;
  totalRecovered: number;
  responseRate: number;
  recoveryRate: number;
  avgResponseTimeHours: number | null;
}> {
  try {
    const { data: interventions } = await supabase
      .from('interventions')
      .select('status, sent_at, replied_at, recovered_at')
      .eq('user_id', userId)
      .not('sent_at', 'is', null);

    if (!interventions || interventions.length === 0) {
      return {
        totalSent: 0,
        totalReplied: 0,
        totalRecovered: 0,
        responseRate: 0,
        recoveryRate: 0,
        avgResponseTimeHours: null,
      };
    }

    const totalSent = interventions.length;
    const replied = interventions.filter((i) => i.status === 'replied' || i.status === 'recovered');
    const recovered = interventions.filter((i) => i.status === 'recovered');

    const totalReplied = replied.length;
    const totalRecovered = recovered.length;

    const responseRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0;
    const recoveryRate = totalSent > 0 ? Math.round((totalRecovered / totalSent) * 100) : 0;

    // Calculate average response time
    const responseTimes = replied
      .filter((i) => i.sent_at && i.replied_at)
      .map((i) => {
        const sent = new Date(i.sent_at!).getTime();
        const replied = new Date(i.replied_at!).getTime();
        return (replied - sent) / (1000 * 60 * 60); // hours
      });

    const avgResponseTimeHours =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
        : null;

    return {
      totalSent,
      totalReplied,
      totalRecovered,
      responseRate,
      recoveryRate,
      avgResponseTimeHours,
    };
  } catch (error) {
    console.error('Error getting intervention success rate:', error);
    return {
      totalSent: 0,
      totalReplied: 0,
      totalRecovered: 0,
      responseRate: 0,
      recoveryRate: 0,
      avgResponseTimeHours: null,
    };
  }
}

/**
 * Produce aggregated intervention metrics for a user over a recent time window.
 *
 * @param userId - The user identifier to filter interventions by
 * @param days - Number of days to look back from now (defaults to 30)
 * @returns An object with:
 *  - `period`: human-readable label for the window,
 *  - `sent`: number of interventions sent in the window,
 *  - `opened`: number of interventions opened (or clicked/replied/recovered),
 *  - `replied`: number of interventions with a reply (including recovered),
 *  - `recovered`: number of interventions marked recovered,
 *  - `responseRate`: percentage of sent interventions that were replied to (rounded),
 *  - `recoveryRate`: percentage of sent interventions that were recovered (rounded)
 */
export async function getInterventionAnalytics(
  userId: string,
  days: number = 30
): Promise<{
  period: string;
  sent: number;
  opened: number;
  replied: number;
  recovered: number;
  responseRate: number;
  recoveryRate: number;
}> {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: interventions } = await supabase
      .from('interventions')
      .select('status')
      .eq('user_id', userId)
      .gte('sent_at', startDate)
      .not('sent_at', 'is', null);

    if (!interventions || interventions.length === 0) {
      return {
        period: `Last ${days} days`,
        sent: 0,
        opened: 0,
        replied: 0,
        recovered: 0,
        responseRate: 0,
        recoveryRate: 0,
      };
    }

    const sent = interventions.length;
    const opened = interventions.filter((i) => ['opened', 'clicked', 'replied', 'recovered'].includes(i.status)).length;
    const replied = interventions.filter((i) => ['replied', 'recovered'].includes(i.status)).length;
    const recovered = interventions.filter((i) => i.status === 'recovered').length;

    const responseRate = sent > 0 ? Math.round((replied / sent) * 100) : 0;
    const recoveryRate = sent > 0 ? Math.round((recovered / sent) * 100) : 0;

    return {
      period: `Last ${days} days`,
      sent,
      opened,
      replied,
      recovered,
      responseRate,
      recoveryRate,
    };
  } catch (error) {
    console.error('Error getting intervention analytics:', error);
    return {
      period: `Last ${days} days`,
      sent: 0,
      opened: 0,
      replied: 0,
      recovered: 0,
      responseRate: 0,
      recoveryRate: 0,
    };
  }
}

// =====================================================
// AI Response Suggestion (Placeholder)
// =====================================================

/**
 * Generate a suggested reply based on a prospect's response.
 *
 * @param interventionId - Identifier of the intervention the response belongs to
 * @param responseText - The prospect's response message used to contextualize the suggestion
 * @param responseType - Categorization of the response; expected values include `interested_later`, `still_interested`, `not_interested`, `went_competitor`, or other custom types
 * @returns A suggested reply message tailored to the response; returns an empty string if a suggestion cannot be generated
 */
export async function generateSuggestedReply(
  interventionId: string,
  responseText: string,
  responseType: string
): Promise<string> {
  try {
    // TODO: Call edge function 'ai-response-suggester'
    // For now, return template-based suggestions

    if (responseType === 'interested_later') {
      return "Totally understand - timing is everything.\n\nWhat would make sense? Should I check back in a few weeks or wait for you to reach out?\n\nEither way, I'll keep you in the loop on [relevant updates].\n\nAll the best,\n[Your Name]";
    } else if (responseType === 'still_interested') {
      return "No worries at all!\n\nWhen things calm down, here's the easiest next step: [ultra-simple action]\n\nJust reply with a time that works or I'll check back in [timeframe].\n\n[Your Name]";
    } else if (responseType === 'not_interested') {
      return "Thanks for being straight with me - saves us both time.\n\nIf [different use case] ever comes up on your radar, feel free to reach out.\n\nAll the best,\n[Your Name]";
    } else if (responseType === 'went_competitor') {
      return "Appreciate you letting me know - always better to know than wonder!\n\nIf [competitor] doesn't work out or you need [specific capability], I'm around.\n\nAll the best,\n[Your Name]";
    } else {
      return "Thanks for getting back to me!\n\n[Personalized response based on their message]\n\nAll the best,\n[Your Name]";
    }
  } catch (error) {
    console.error('Error generating suggested reply:', error);
    return '';
  }
}