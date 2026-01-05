// supabase/functions/slack-slash-commands/handlers/contact.ts
// Handler for /sixty contact <query> - Contact lookup with CRM fallback

import {
  buildContactCardMessage,
  buildSearchResultsPickerMessage,
  type ContactCardData,
  type SearchResultsPickerData,
  type SlackMessage,
} from '../../_shared/slackBlocks.ts';
import { searchContacts, getContactById, type ContactResult } from '../../_shared/slackSearch.ts';
import { buildErrorResponse } from '../../_shared/slackAuth.ts';
import type { CommandContext } from '../index.ts';

/**
 * Handle /sixty contact <query> command
 * Searches for contacts using hybrid search (Sixty DB + HubSpot fallback)
 */
export async function handleContact(ctx: CommandContext, query: string): Promise<SlackMessage> {
  const { supabase, userContext, appUrl } = ctx;
  const orgId = userContext.orgId;

  if (!orgId) {
    return buildErrorResponse('Unable to determine your organization. Please contact support.');
  }

  // Search for contacts
  const searchResult = await searchContacts(supabase, orgId, query, {
    limit: 5,
    includeCrmFallback: true,
    confidenceThreshold: 0.6,
  });

  if (searchResult.results.length === 0) {
    // No results found
    const crmNote = searchResult.crmAvailable
      ? '\n\nWe searched both Sixty and HubSpot.'
      : '';

    return buildErrorResponse(
      `No contacts found matching "${query}".${crmNote}\n\nTry:\n• A different spelling\n• Email address\n• Company name`
    );
  }

  // Get org settings for currency
  const { currencyCode, currencyLocale } = await getOrgCurrency(supabase, orgId);

  // Single confident result → show contact card
  if (searchResult.results.length === 1) {
    return await buildContactCardForResult(ctx, searchResult.results[0], currencyCode, currencyLocale);
  }

  // Multiple results → check if first result is highly confident
  const firstResult = searchResult.results[0];
  const secondResult = searchResult.results[1];

  // If first result is exact email match or very high confidence, show it directly
  if (
    firstResult.email?.toLowerCase() === query.toLowerCase() ||
    (firstResult.full_name?.toLowerCase() === query.toLowerCase() && firstResult.source === 'sixty')
  ) {
    return await buildContactCardForResult(ctx, firstResult, currencyCode, currencyLocale);
  }

  // Multiple ambiguous results → show picker
  return buildSearchResultsPickerMessage({
    query,
    entityType: 'contact',
    results: searchResult.results.map(c => ({
      id: c.id,
      primaryText: c.full_name || c.email || 'Unknown',
      secondaryText: c.company || undefined,
      metadata: c.source === 'hubspot' ? 'HubSpot' : undefined,
    })),
    sources: searchResult.sources,
    crmAvailable: searchResult.crmAvailable,
    appUrl,
  });
}

/**
 * Build contact card for a search result
 */
async function buildContactCardForResult(
  ctx: CommandContext,
  contact: ContactResult,
  currencyCode: string,
  currencyLocale: string
): Promise<SlackMessage> {
  const { supabase, appUrl } = ctx;

  // Get additional context if it's a Sixty contact
  let lastTouch: ContactCardData['lastTouch'] | undefined;
  let nextStep: string | undefined;
  let riskSignals: string[] = [];

  if (contact.source === 'sixty' && !contact.id.startsWith('hs_')) {
    // Get last activity
    const { data: lastActivity } = await supabase
      .from('activities')
      .select('activity_type, activity_date, notes')
      .eq('contact_id', contact.id)
      .order('activity_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastActivity) {
      lastTouch = {
        date: lastActivity.activity_date,
        type: formatActivityType(lastActivity.activity_type),
        summary: lastActivity.notes?.slice(0, 60),
      };
    }

    // Get next task
    const { data: nextTask } = await supabase
      .from('tasks')
      .select('title')
      .eq('contact_id', contact.id)
      .in('status', ['pending', 'in_progress'])
      .order('due_date', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextTask) {
      nextStep = nextTask.title;
    }

    // Calculate risk signals
    riskSignals = calculateRiskSignals(contact);
  }

  // Build deal context
  let dealContext: ContactCardData['dealContext'] | undefined;
  if (contact.active_deal_id && contact.active_deal_name) {
    // Get deal stage
    const { data: deal } = await supabase
      .from('deals')
      .select('stage_id, deal_stages ( name )')
      .eq('id', contact.active_deal_id)
      .maybeSingle();

    dealContext = {
      id: contact.active_deal_id,
      name: contact.active_deal_name,
      value: contact.active_deal_value || 0,
      stage: (deal as any)?.deal_stages?.name || 'Unknown',
    };
  }

  const data: ContactCardData = {
    contact: {
      id: contact.id,
      email: contact.email,
      full_name: contact.full_name,
      phone: contact.phone,
      title: contact.title,
      company: contact.company,
      source: contact.source,
    },
    dealContext,
    lastTouch,
    nextStep,
    riskSignals: riskSignals.length > 0 ? riskSignals : undefined,
    healthScore: contact.health_score ?? undefined,
    totalMeetings: contact.total_meetings_count ?? undefined,
    currencyCode,
    currencyLocale,
    appUrl,
  };

  return buildContactCardMessage(data);
}

/**
 * Get org currency settings
 */
async function getOrgCurrency(
  supabase: any,
  orgId: string
): Promise<{ currencyCode: string; currencyLocale: string }> {
  const { data: orgSettings } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .maybeSingle();

  if (orgSettings?.settings) {
    const settings = orgSettings.settings as Record<string, unknown>;
    return {
      currencyCode: (settings.currency_code as string) || 'USD',
      currencyLocale: (settings.currency_locale as string) || 'en-US',
    };
  }

  return { currencyCode: 'USD', currencyLocale: 'en-US' };
}

/**
 * Format activity type for display
 */
function formatActivityType(type: string): string {
  const typeMap: Record<string, string> = {
    call: 'Call',
    email: 'Email',
    meeting: 'Meeting',
    note: 'Note',
    task: 'Task',
    demo: 'Demo',
  };
  return typeMap[type?.toLowerCase()] || type || 'Activity';
}

/**
 * Calculate risk signals for a contact
 */
function calculateRiskSignals(contact: ContactResult): string[] {
  const signals: string[] = [];
  const now = new Date();

  // No activity in 7+ days
  if (contact.last_interaction_at) {
    const lastInteraction = new Date(contact.last_interaction_at);
    const daysSinceInteraction = Math.floor((now.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceInteraction >= 14) {
      signals.push(`No activity in ${daysSinceInteraction} days`);
    } else if (daysSinceInteraction >= 7) {
      signals.push(`Going cold - ${daysSinceInteraction} days since last contact`);
    }
  }

  // Low health score
  if (contact.health_score !== undefined && contact.health_score !== null) {
    if (contact.health_score < 30) {
      signals.push('Low engagement score');
    } else if (contact.health_score < 50) {
      signals.push('Engagement declining');
    }
  }

  // Low engagement level
  if (contact.engagement_level === 'cold' || contact.engagement_level === 'disengaged') {
    signals.push('Contact disengaged');
  }

  return signals.slice(0, 2); // Max 2 risk signals
}
