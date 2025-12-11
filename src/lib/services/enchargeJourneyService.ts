/**
 * Encharge Journey Service
 * 
 * Manages email journeys and triggers emails based on user lifecycle events.
 * Connects onboarding simulator to real email automation flows.
 */

import { supabase } from '@/lib/supabase/clientV2';
import { sendEmail, type EmailType } from './enchargeEmailService';

export interface EmailJourney {
  id: string;
  journey_name: string;
  trigger_event: string;
  delay_minutes: number;
  email_template_id?: string;
  email_type: EmailType;
  conditions: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface JourneyEmail {
  journey: EmailJourney;
  shouldSend: boolean;
  reason?: string;
}

/**
 * Get all active email journeys for a specific trigger event
 */
export async function getJourneysForEvent(
  triggerEvent: string
): Promise<EmailJourney[]> {
  try {
    const { data, error } = await supabase
      .from('email_journeys')
      .select('*')
      .eq('trigger_event', triggerEvent)
      .eq('is_active', true)
      .order('delay_minutes', { ascending: true });

    if (error) {
      console.error('[enchargeJourneyService] Error fetching journeys:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[enchargeJourneyService] Exception fetching journeys:', error);
    return [];
  }
}

/**
 * Get email journeys for a specific day in the onboarding/trial timeline
 */
export async function getJourneyEmailsForDay(
  day: number
): Promise<JourneyEmail[]> {
  // Map day to trigger events
  const dayToEvents: Record<number, string[]> = {
    0: ['account_created', 'waitlist_invite'],
    1: ['account_created'], // 24h reminder
    3: ['account_created'], // 3 day reminder
    7: ['first_summary_viewed', 'trial_midpoint'],
    11: ['trial_will_end'], // 3 days left
    13: ['trial_will_end'], // 1 day left
    14: ['trial_expired'],
    16: ['trial_expired'], // Win-back
  };

  const events = dayToEvents[day] || [];
  const allJourneys: JourneyEmail[] = [];

  for (const event of events) {
    const journeys = await getJourneysForEvent(event);
    for (const journey of journeys) {
      // Check if delay matches the day
      const delayDays = Math.floor(journey.delay_minutes / 1440);
      if (delayDays === day || (day === 0 && journey.delay_minutes === 0)) {
        allJourneys.push({
          journey,
          shouldSend: true,
        });
      }
    }
  }

  return allJourneys;
}

/**
 * Check if conditions are met for sending an email
 */
export async function checkJourneyConditions(
  journey: EmailJourney,
  userId: string
): Promise<boolean> {
  const conditions = journey.conditions || {};
  
  // If no conditions, always send
  if (Object.keys(conditions).length === 0) {
    return true;
  }

  try {
    // Check user onboarding progress
    const { data: progress } = await supabase
      .from('user_onboarding_progress')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!progress) {
      // If no progress record, check conditions that might require it
      if (conditions.fathom_connected === false || conditions.first_meeting_synced === false) {
        return true; // User hasn't done these, so condition is met
      }
      return false;
    }

    // Check each condition
    for (const [key, expectedValue] of Object.entries(conditions)) {
      const actualValue = progress[key as keyof typeof progress];
      
      // Handle boolean conditions
      if (expectedValue === false && actualValue !== false) {
        return false; // Condition requires false, but value is not false
      }
      if (expectedValue === true && actualValue !== true) {
        return false; // Condition requires true, but value is not true
      }
      
      // Handle other value comparisons
      if (expectedValue !== true && expectedValue !== false && actualValue !== expectedValue) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('[enchargeJourneyService] Error checking conditions:', error);
    return false;
  }
}

/**
 * Check if email was already sent (deduplication)
 */
export async function wasEmailAlreadySent(
  userId: string,
  emailType: EmailType,
  hoursWindow: number = 24
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('was_email_sent', {
      p_user_id: userId,
      p_email_type: emailType,
      p_hours_window: hoursWindow,
    });

    if (error) {
      console.error('[enchargeJourneyService] Error checking email send:', error);
      return false; // Assume not sent if error
    }

    return data || false;
  } catch (error) {
    console.error('[enchargeJourneyService] Exception checking email send:', error);
    return false;
  }
}

/**
 * Trigger an email journey for a user
 */
export async function triggerJourneyEmail(
  journey: EmailJourney,
  userId: string,
  userEmail: string,
  userName?: string,
  additionalData?: Record<string, any>
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    // Check if already sent
    const alreadySent = await wasEmailAlreadySent(userId, journey.email_type);
    if (alreadySent) {
      return {
        success: false,
        error: 'Email already sent within time window',
      };
    }

    // Check conditions
    const conditionsMet = await checkJourneyConditions(journey, userId);
    if (!conditionsMet) {
      return {
        success: false,
        error: 'Journey conditions not met',
      };
    }

    // Send email via AWS SES using Supabase templates (no Encharge UI needed)
    // Also track event in Encharge for analytics
    const { sendEmailWithTemplate } = await import('./enchargeTemplateService');
    
    const result = await sendEmailWithTemplate({
      template_type: journey.email_type,
      to_email: userEmail,
      to_name: userName,
      user_id: userId,
      variables: {
        ...additionalData,
        journey_name: journey.journey_name,
        trigger_event: journey.trigger_event,
      },
    });

    // Record email send if successful
    if (result.success) {
      try {
        await supabase.rpc('record_email_send', {
          p_user_id: userId,
          p_journey_id: journey.id,
          p_email_type: journey.email_type,
          p_to_email: userEmail,
          p_encharge_message_id: result.messageId,
          p_metadata: {
            journey_name: journey.journey_name,
            trigger_event: journey.trigger_event,
            ...additionalData,
          },
        });
      } catch (logError) {
        console.warn('[enchargeJourneyService] Failed to log email send:', logError);
        // Non-fatal
      }
    }

    return {
      success: result.success,
      error: result.error,
      messageId: result.message_id,
    };
  } catch (error) {
    console.error('[enchargeJourneyService] Exception triggering journey:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Simulate journey day - send all emails for a specific day
 * Used by onboarding simulator
 */
export async function simulateJourneyDay(
  day: number,
  userId: string,
  userEmail: string,
  userName?: string
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const journeyEmails = await getJourneyEmailsForDay(day);
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const journeyEmail of journeyEmails) {
    if (!journeyEmail.shouldSend) {
      continue;
    }

    const result = await triggerJourneyEmail(
      journeyEmail.journey,
      userId,
      userEmail,
      userName,
      { simulated_day: day }
    );

    if (result.success) {
      sent++;
    } else {
      failed++;
      errors.push(`${journeyEmail.journey.email_type}: ${result.error}`);
    }
  }

  return { sent, failed, errors };
}

/**
 * Trigger all journeys for a specific event
 */
export async function triggerJourneysForEvent(
  eventName: string,
  userId: string,
  userEmail: string,
  userName?: string,
  eventData?: Record<string, any>
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const journeys = await getJourneysForEvent(eventName);
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const journey of journeys) {
    // Apply delay if specified (for scheduled emails, handled by cron)
    if (journey.delay_minutes > 0) {
      // Skip immediate sends - these should be handled by cron
      continue;
    }

    const result = await triggerJourneyEmail(
      journey,
      userId,
      userEmail,
      userName,
      {
        ...eventData,
        trigger_event: eventName,
      }
    );

    if (result.success) {
      sent++;
    } else {
      failed++;
      errors.push(`${journey.email_type}: ${result.error}`);
    }
  }

  return { sent, failed, errors };
}

export default {
  getJourneysForEvent,
  getJourneyEmailsForDay,
  checkJourneyConditions,
  wasEmailAlreadySent,
  triggerJourneyEmail,
  simulateJourneyDay,
  triggerJourneysForEvent,
};
