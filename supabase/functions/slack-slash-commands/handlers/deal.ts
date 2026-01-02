// supabase/functions/slack-slash-commands/handlers/deal.ts
// Handler for /sixty deal <query> - Deal snapshot with CRM fallback + momentum view

import {
  buildDealSnapshotMessage,
  buildSearchResultsPickerMessage,
  buildDealMomentumMessage,
  type DealSnapshotData,
  type DealMomentumData,
  type DealMomentumTruthField,
  type DealMomentumMilestone,
  type SlackMessage,
} from '../../_shared/slackBlocks.ts';
import { searchDeals, getDealById, type DealResult } from '../../_shared/slackSearch.ts';
import { buildErrorResponse } from '../../_shared/slackAuth.ts';
import type { CommandContext } from '../index.ts';

// Stage display names
const STAGE_NAMES: Record<string, string> = {
  lead: 'Lead',
  sql: 'SQL',
  opportunity: 'Opportunity',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  verbal: 'Verbal Commit',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

// Field display labels
const FIELD_LABELS: Record<string, string> = {
  pain: 'Pain Point',
  success_metric: 'Success Metric',
  champion: 'Champion',
  economic_buyer: 'Economic Buyer',
  next_step: 'Next Step',
  top_risks: 'Top Risks',
};

// Milestone display titles
const MILESTONE_TITLES: Record<string, string> = {
  success_criteria: 'Success criteria confirmed',
  stakeholders_mapped: 'Stakeholders mapped',
  solution_fit: 'Solution fit confirmed',
  commercials_aligned: 'Commercials aligned',
  legal_procurement: 'Legal/procurement progressing',
  signature_kickoff: 'Signature + kickoff scheduled',
};

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
 * Includes momentum view if Deal Truth and Close Plan data exists
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

  // Momentum data (if available)
  let hasMomentumData = false;
  let momentumData: DealMomentumData | undefined;

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

    // Try to fetch momentum data (Deal Truth + Close Plan)
    const momentumResult = await fetchMomentumData(supabase, deal.id, appUrl, currencyCode, currencyLocale, deal);
    if (momentumResult) {
      hasMomentumData = true;
      momentumData = momentumResult;
    }
  }

  // If we have momentum data with truth fields or close plan, use momentum view
  if (hasMomentumData && momentumData) {
    return buildDealMomentumMessage(momentumData);
  }

  // Fall back to standard snapshot
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
 * Fetch Deal Truth, Close Plan, and Scores for momentum view
 */
async function fetchMomentumData(
  supabase: any,
  dealId: string,
  appUrl: string,
  currencyCode: string,
  currencyLocale: string,
  deal: DealResult
): Promise<DealMomentumData | null> {
  try {
    // Parallel fetch of truth fields, close plan, and scores
    const [truthResult, closePlanResult, clarityResult, healthResult, riskResult] = await Promise.all([
      supabase
        .from('deal_truth_fields')
        .select('field_key, value, confidence, source, last_updated_at')
        .eq('deal_id', dealId),
      supabase
        .from('deal_close_plan_items')
        .select('milestone_key, title, status, owner_id, due_date, blocker_note, completed_at, profiles:owner_id(full_name)')
        .eq('deal_id', dealId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('deal_clarity_scores')
        .select('clarity_score, momentum_score, calculated_at')
        .eq('deal_id', dealId)
        .maybeSingle(),
      supabase
        .from('deal_health_scores')
        .select('health_score, health_status, calculated_at')
        .eq('deal_id', dealId)
        .maybeSingle(),
      supabase
        .from('deal_risk_aggregates')
        .select('overall_risk_level, risk_score')
        .eq('deal_id', dealId)
        .maybeSingle(),
    ]);

    const truthFields = truthResult.data || [];
    const closePlanItems = closePlanResult.data || [];
    const clarityData = clarityResult.data;
    const healthData = healthResult.data;
    const riskData = riskResult.data;

    // Only return momentum data if we have at least some truth fields or close plan items
    if (truthFields.length === 0 && closePlanItems.length === 0) {
      return null;
    }

    // Build truth field data for display
    const truthFieldMap = new Map(truthFields.map((f: any) => [f.field_key, f]));
    const displayTruthFields: DealMomentumTruthField[] = [
      'pain', 'success_metric', 'champion', 'economic_buyer', 'next_step', 'top_risks'
    ].map(key => {
      const field = truthFieldMap.get(key);
      const isKeyField = key === 'economic_buyer' || key === 'next_step';
      const isLowConfidence = (field?.confidence || 0) < 0.6;

      return {
        fieldKey: key,
        label: FIELD_LABELS[key] || key,
        value: field?.value || null,
        confidence: field?.confidence || 0,
        isWarning: isKeyField && isLowConfidence,
        nextStepDate: key === 'next_step' ? extractDateFromValue(field?.value) : undefined,
      };
    });

    // Build close plan data for display
    const completedMilestones = closePlanItems.filter((m: any) => m.status === 'completed').length;
    const totalMilestones = closePlanItems.length || 6;
    const overdueMilestones = closePlanItems.filter((m: any) => {
      if (m.status === 'completed' || !m.due_date) return false;
      return new Date(m.due_date) < new Date();
    }).length;
    const blockedMilestones = closePlanItems.filter((m: any) => m.status === 'blocked').length;

    const displayMilestones: DealMomentumMilestone[] = closePlanItems.map((m: any) => ({
      milestoneKey: m.milestone_key,
      title: m.title || MILESTONE_TITLES[m.milestone_key] || m.milestone_key,
      status: m.status,
      ownerName: m.profiles?.full_name,
      dueDate: m.due_date,
      isOverdue: m.status !== 'completed' && m.due_date && new Date(m.due_date) < new Date(),
      blockerNote: m.blocker_note,
    }));

    // Generate recommended actions
    const recommendedActions = generateRecommendedActions(
      displayTruthFields,
      displayMilestones,
      healthData?.health_status,
      riskData?.overall_risk_level
    );

    // Get scores
    const clarityScore = clarityData?.clarity_score ?? 0;
    const momentumScore = clarityData?.momentum_score ?? 0;
    const healthScore = healthData?.health_score ?? 0;
    const riskScore = riskData?.risk_score ?? 0;

    return {
      deal: {
        id: dealId,
        name: deal.name,
        company: deal.company,
        value: deal.value || 0,
        stage: deal.stage || 'unknown',
        stageName: deal.stage_name || STAGE_NAMES[deal.stage || ''] || deal.stage,
      },
      scores: {
        momentum: Math.round(momentumScore),
        clarity: Math.round(clarityScore),
        health: Math.round(healthScore),
        risk: Math.round(riskScore),
      },
      truthFields: displayTruthFields,
      closePlan: {
        completed: completedMilestones,
        total: totalMilestones,
        overdue: overdueMilestones,
        blocked: blockedMilestones,
        milestones: displayMilestones,
      },
      recommendedActions,
      currencyCode,
      currencyLocale,
      appUrl,
    };
  } catch (error) {
    console.error('[deal handler] Error fetching momentum data:', error);
    return null;
  }
}

/**
 * Extract a date from a next_step value (e.g., "Demo to team - Jan 15")
 */
function extractDateFromValue(value: string | null | undefined): string | undefined {
  if (!value) return undefined;

  const datePatterns = [
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
    /([A-Z][a-z]{2}\s+\d{1,2})/,
    /(\d{1,2}\s+[A-Z][a-z]{2})/,
  ];

  for (const pattern of datePatterns) {
    const match = value.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return undefined;
}

/**
 * Generate recommended actions based on deal state
 */
function generateRecommendedActions(
  truthFields: DealMomentumTruthField[],
  milestones: DealMomentumMilestone[],
  healthStatus?: string,
  riskLevel?: string
): string[] {
  const actions: string[] = [];

  const ebField = truthFields.find(f => f.fieldKey === 'economic_buyer');
  const nextStepField = truthFields.find(f => f.fieldKey === 'next_step');
  const championField = truthFields.find(f => f.fieldKey === 'champion');
  const successMetricField = truthFields.find(f => f.fieldKey === 'success_metric');

  if (!ebField?.value || ebField.confidence < 0.6) {
    actions.push('Identify and confirm economic buyer');
  }

  if (!nextStepField?.value || !nextStepField.nextStepDate) {
    actions.push('Set a dated next step');
  }

  if (!championField?.value || championField.confidence < 0.6) {
    actions.push('Confirm or strengthen champion relationship');
  }

  if (!successMetricField?.value) {
    actions.push('Define success metrics with customer');
  }

  const blockedMilestones = milestones.filter(m => m.status === 'blocked');
  if (blockedMilestones.length > 0) {
    actions.push(`Resolve blocked milestone: ${blockedMilestones[0].title}`);
  }

  const overdueMilestones = milestones.filter(m => m.isOverdue);
  if (overdueMilestones.length > 0 && actions.length < 4) {
    actions.push(`Complete overdue: ${overdueMilestones[0].title}`);
  }

  if (healthStatus === 'stalled' && actions.length < 4) {
    actions.push('Re-engage key stakeholders');
  }

  if (riskLevel === 'critical' && actions.length < 4) {
    actions.push('Address critical risks immediately');
  }

  return actions.slice(0, 4);
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
