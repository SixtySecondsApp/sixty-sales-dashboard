// supabase/functions/slack-slash-commands/handlers/deal.ts
// Handler for /sixty deal <query> - Deal snapshot with CRM fallback

import {
  buildDealSnapshotMessage,
  buildSearchResultsPickerMessage,
  type DealSnapshotData,
  type SlackMessage,
} from '../../_shared/slackBlocks.ts';
import { searchDeals, getDealById, type DealResult } from '../../_shared/slackSearch.ts';
import { buildErrorResponse } from '../../_shared/slackAuth.ts';
import type { CommandContext } from '../index.ts';

/**
 * Handle /sixty deal <query> command
 * Searches for deals using hybrid search (Sixty DB + HubSpot fallback)
 */
export async function handleDeal(ctx: CommandContext, query: string): Promise<SlackMessage> {
  const { supabase, userContext, appUrl } = ctx;
  const orgId = userContext.orgId;

  if (!orgId) {
    return buildErrorResponse('Unable to determine your organization. Please contact support.');
  }

  // Search for deals
  const searchResult = await searchDeals(supabase, orgId, query, {
    limit: 5,
    includeCrmFallback: true,
    confidenceThreshold: 0.6,
  });

  if (searchResult.results.length === 0) {
    const crmNote = searchResult.crmAvailable
      ? '\n\nWe searched both Sixty and HubSpot.'
      : '';

    return buildErrorResponse(
      `No deals found matching "${query}".${crmNote}\n\nTry:\n• A different spelling\n• Company name\n• Deal name`
    );
  }

  // Get org settings for currency
  const { currencyCode, currencyLocale } = await getOrgCurrency(supabase, orgId);

  // Single confident result → show deal snapshot
  if (searchResult.results.length === 1) {
    return await buildDealSnapshotForResult(ctx, searchResult.results[0], currencyCode, currencyLocale);
  }

  // Check if first result is a confident match
  const firstResult = searchResult.results[0];

  // If first result is exact name match, show it directly
  if (firstResult.name.toLowerCase() === query.toLowerCase() && firstResult.source === 'sixty') {
    return await buildDealSnapshotForResult(ctx, firstResult, currencyCode, currencyLocale);
  }

  // Multiple ambiguous results → show picker
  return buildSearchResultsPickerMessage({
    query,
    entityType: 'deal',
    results: searchResult.results.map(d => ({
      id: d.id,
      primaryText: d.name,
      secondaryText: d.company || undefined,
      tertiaryText: formatCurrencySimple(d.value, currencyCode),
      metadata: d.source === 'hubspot' ? 'HubSpot' : undefined,
    })),
    sources: searchResult.sources,
    crmAvailable: searchResult.crmAvailable,
    appUrl,
  });
}

/**
 * Build deal snapshot for a search result
 */
async function buildDealSnapshotForResult(
  ctx: CommandContext,
  deal: DealResult,
  currencyCode: string,
  currencyLocale: string
): Promise<SlackMessage> {
  const { supabase, appUrl } = ctx;

  // Get additional context if it's a Sixty deal
  let recentActivity: DealSnapshotData['recentActivity'];
  let risks: string[] = [];
  let primaryContact: DealSnapshotData['primaryContact'] | undefined;

  if (deal.source === 'sixty' && !deal.id.startsWith('hs_')) {
    // Get recent activities
    const { data: activities } = await supabase
      .from('activities')
      .select('activity_type, activity_date, notes')
      .eq('deal_id', deal.id)
      .order('activity_date', { ascending: false })
      .limit(3);

    if (activities && activities.length > 0) {
      recentActivity = activities.map((a: any) => ({
        date: a.activity_date,
        type: formatActivityType(a.activity_type),
        summary: a.notes?.slice(0, 50),
      }));
    }

    // Calculate risks
    risks = calculateDealRisks(deal);

    // Build primary contact from deal data
    if (deal.contact_name) {
      primaryContact = {
        name: deal.contact_name,
        email: deal.contact_email || undefined,
      };
    }
  }

  const data: DealSnapshotData = {
    deal: {
      id: deal.id,
      name: deal.name,
      company: deal.company,
      value: deal.value,
      stage: deal.stage || 'Unknown',
      stageName: deal.stage_name,
      expectedCloseDate: deal.expected_close_date,
      probability: deal.probability ?? undefined,
      source: deal.source,
    },
    primaryContact,
    daysInStage: deal.days_in_stage ?? undefined,
    nextSteps: deal.next_steps ?? undefined,
    recentActivity,
    risks: risks.length > 0 ? risks : undefined,
    currencyCode,
    currencyLocale,
    appUrl,
  };

  return buildDealSnapshotMessage(data);
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
    task: 'Task completed',
    demo: 'Demo',
    proposal_sent: 'Proposal sent',
    contract_sent: 'Contract sent',
  };
  return typeMap[type?.toLowerCase()] || type || 'Activity';
}

/**
 * Calculate risk signals for a deal
 */
function calculateDealRisks(deal: DealResult): string[] {
  const risks: string[] = [];
  const now = new Date();

  // Days in stage too long
  if (deal.days_in_stage !== undefined && deal.days_in_stage !== null) {
    if (deal.days_in_stage > 21) {
      risks.push(`Stalled - ${deal.days_in_stage} days in stage`);
    } else if (deal.days_in_stage > 14) {
      risks.push(`Slowing - ${deal.days_in_stage} days in stage`);
    }
  }

  // Close date in the past or soon
  if (deal.expected_close_date) {
    const closeDate = new Date(deal.expected_close_date);
    const daysUntilClose = Math.ceil((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilClose < 0) {
      risks.push(`Past due - close date was ${Math.abs(daysUntilClose)} days ago`);
    } else if (daysUntilClose <= 3 && deal.probability && deal.probability < 70) {
      risks.push('Close date in 3 days but probability low');
    }
  }

  // Low probability
  if (deal.probability !== undefined && deal.probability !== null) {
    if (deal.probability < 30) {
      risks.push('Low probability deal');
    }
  }

  return risks.slice(0, 2); // Max 2 risks
}

/**
 * Simple currency formatting for picker display
 */
function formatCurrencySimple(value: number, currencyCode: string): string {
  if (!value || value === 0) return '-';

  if (value >= 1000000) {
    return `${currencyCode === 'USD' ? '$' : currencyCode}${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${currencyCode === 'USD' ? '$' : currencyCode}${(value / 1000).toFixed(0)}K`;
  }
  return `${currencyCode === 'USD' ? '$' : currencyCode}${value}`;
}
