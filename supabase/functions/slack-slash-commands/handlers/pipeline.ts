// supabase/functions/slack-slash-commands/handlers/pipeline.ts
// Handler for /sixty pipeline - Pipeline summary with filters

import { type SlackMessage } from '../../_shared/slackBlocks.ts';
import { buildErrorResponse } from '../../_shared/slackAuth.ts';
import type { CommandContext } from '../index.ts';

interface DealStage {
  id: string;
  name: string;
  position: number;
}

interface PipelineDeal {
  id: string;
  name: string;
  company: string | null;
  value: number;
  stage_id: string;
  stage_name: string;
  probability: number | null;
  expected_close_date: string | null;
  days_in_stage: number | null;
  last_activity_date: string | null;
  is_at_risk: boolean;
}

interface StageGroup {
  stage: DealStage;
  deals: PipelineDeal[];
  total_value: number;
}

/**
 * Handle /sixty pipeline [filter] command
 * Filter can be: "at-risk", "closing", "stale", or empty (all)
 */
export async function handlePipeline(ctx: CommandContext, filter: string): Promise<SlackMessage> {
  const { supabase, userContext, appUrl } = ctx;
  const userId = userContext.userId;
  const orgId = userContext.orgId;

  if (!orgId) {
    return buildErrorResponse('Unable to determine your organization. Please contact support.');
  }

  const filterLower = filter.toLowerCase().trim();

  try {
    // Get pipeline stages
    const stages = await getPipelineStages(ctx, orgId);
    if (stages.length === 0) {
      return buildErrorResponse('No pipeline stages found. Please configure your pipeline in Settings.');
    }

    // Get deals with stage info
    const deals = await getPipelineDeals(ctx, userId, filterLower);

    // Get currency settings
    const { currencyCode, currencyLocale } = await getOrgCurrency(supabase, orgId);

    // Group deals by stage
    const stageGroups = groupDealsByStage(deals, stages);

    // Build the pipeline message
    return buildPipelineMessage({
      stageGroups,
      filter: filterLower,
      currencyCode,
      currencyLocale,
      appUrl,
      totalDeals: deals.length,
      totalValue: deals.reduce((sum, d) => sum + d.value, 0),
    });

  } catch (error) {
    console.error('Error in handlePipeline:', error);
    return buildErrorResponse('Failed to load pipeline. Please try again.');
  }
}

/**
 * Get pipeline stages for org
 */
async function getPipelineStages(ctx: CommandContext, orgId: string): Promise<DealStage[]> {
  const { supabase } = ctx;

  const { data: stages } = await supabase
    .from('deal_stages')
    .select('id, name, position')
    .eq('org_id', orgId)
    .order('position', { ascending: true });

  return (stages || []) as DealStage[];
}

/**
 * Get pipeline deals with filtering
 */
async function getPipelineDeals(
  ctx: CommandContext,
  userId: string,
  filter: string
): Promise<PipelineDeal[]> {
  const { supabase } = ctx;
  const now = new Date();

  // Get all active deals
  const { data: deals, error } = await supabase
    .from('deals')
    .select(`
      id,
      name,
      company,
      value,
      stage_id,
      probability,
      expected_close_date,
      stage_entered_at,
      last_activity_date,
      deal_stages ( name )
    `)
    .eq('user_id', userId)
    .not('status', 'eq', 'closed_won')
    .not('status', 'eq', 'closed_lost')
    .order('value', { ascending: false });

  if (error || !deals) {
    console.error('Error fetching deals:', error);
    return [];
  }

  // Process and filter deals
  const processedDeals: PipelineDeal[] = deals.map((deal: any) => {
    const daysInStage = deal.stage_entered_at
      ? Math.floor((now.getTime() - new Date(deal.stage_entered_at).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const daysSinceActivity = deal.last_activity_date
      ? Math.floor((now.getTime() - new Date(deal.last_activity_date).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Determine if at risk
    const isAtRisk =
      (daysInStage !== null && daysInStage > 14) ||
      (daysSinceActivity !== null && daysSinceActivity > 7) ||
      (deal.probability !== null && deal.probability < 30);

    return {
      id: deal.id,
      name: deal.name,
      company: deal.company,
      value: deal.value || 0,
      stage_id: deal.stage_id,
      stage_name: deal.deal_stages?.name || 'Unknown',
      probability: deal.probability,
      expected_close_date: deal.expected_close_date,
      days_in_stage: daysInStage,
      last_activity_date: deal.last_activity_date,
      is_at_risk: isAtRisk,
    };
  });

  // Apply filter
  if (filter === 'at-risk' || filter === 'risk') {
    return processedDeals.filter(d => d.is_at_risk);
  }

  if (filter === 'closing') {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return processedDeals.filter(d => {
      if (!d.expected_close_date) return false;
      const closeDate = new Date(d.expected_close_date);
      return closeDate <= weekEnd;
    });
  }

  if (filter === 'stale') {
    return processedDeals.filter(d =>
      (d.days_in_stage !== null && d.days_in_stage > 14) ||
      (d.last_activity_date && new Date(d.last_activity_date) < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))
    );
  }

  return processedDeals;
}

/**
 * Group deals by stage
 */
function groupDealsByStage(deals: PipelineDeal[], stages: DealStage[]): StageGroup[] {
  const groups: StageGroup[] = stages.map(stage => ({
    stage,
    deals: deals.filter(d => d.stage_id === stage.id),
    total_value: 0,
  }));

  // Calculate totals
  groups.forEach(group => {
    group.total_value = group.deals.reduce((sum, d) => sum + d.value, 0);
  });

  // Remove empty stages
  return groups.filter(g => g.deals.length > 0);
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
 * Build the pipeline Slack message
 */
function buildPipelineMessage(data: {
  stageGroups: StageGroup[];
  filter: string;
  currencyCode: string;
  currencyLocale: string;
  appUrl: string;
  totalDeals: number;
  totalValue: number;
}): SlackMessage {
  const {
    stageGroups,
    filter,
    currencyCode,
    currencyLocale,
    appUrl,
    totalDeals,
    totalValue,
  } = data;

  const formatCurrency = (value: number): string => {
    try {
      if (value >= 1000000) {
        return new Intl.NumberFormat(currencyLocale, {
          style: 'currency',
          currency: currencyCode,
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(value / 1000000) + 'M';
      }
      if (value >= 1000) {
        return new Intl.NumberFormat(currencyLocale, {
          style: 'currency',
          currency: currencyCode,
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value / 1000) + 'K';
      }
      return new Intl.NumberFormat(currencyLocale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      return `$${value.toLocaleString()}`;
    }
  };

  const getTitle = (): string => {
    switch (filter) {
      case 'at-risk':
      case 'risk':
        return ':warning: At-Risk Deals';
      case 'closing':
        return ':calendar: Closing This Week';
      case 'stale':
        return ':hourglass: Stale Deals';
      default:
        return ':chart_with_upwards_trend: Pipeline Overview';
    }
  };

  const blocks: unknown[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: getTitle(), emoji: true },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `*${totalDeals} deal${totalDeals !== 1 ? 's' : ''}* • *${formatCurrency(totalValue)}* total value`,
        },
      ],
    },
    { type: 'divider' },
  ];

  // No deals
  if (stageGroups.length === 0 || totalDeals === 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: filter
          ? `No deals found matching the "${filter}" filter.\n\nTry a different filter or view all deals.`
          : 'No active deals in your pipeline.\n\nStart prospecting to build your pipeline!',
      },
    });

    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: ':heavy_plus_sign: Add Deal', emoji: true },
          action_id: 'pipeline_add_deal',
          url: `${appUrl}/deals/new`,
        },
      ],
    });

    return {
      blocks,
      text: 'Pipeline Overview - No deals found',
    };
  }

  // Stage-by-stage view (for overview) or deal list (for filtered)
  if (!filter) {
    // Overview: show stages with summary
    stageGroups.forEach(group => {
      const atRiskCount = group.deals.filter(d => d.is_at_risk).length;
      const riskIndicator = atRiskCount > 0 ? ` • :warning: ${atRiskCount} at risk` : '';

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${group.stage.name}*\n` +
                `${group.deals.length} deal${group.deals.length !== 1 ? 's' : ''} • ${formatCurrency(group.total_value)}${riskIndicator}`,
        },
        accessory: {
          type: 'button',
          text: { type: 'plain_text', text: 'View', emoji: true },
          action_id: 'pipeline_view_stage',
          value: group.stage.id,
        },
      });
    });
  } else {
    // Filtered: show individual deals
    const dealsToShow = stageGroups.flatMap(g => g.deals).slice(0, 8);

    dealsToShow.forEach(deal => {
      const riskEmoji = deal.is_at_risk ? ':warning: ' : '';
      const probText = deal.probability !== null ? ` • ${deal.probability}%` : '';
      const daysText = deal.days_in_stage !== null ? ` • ${deal.days_in_stage}d in stage` : '';

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${riskEmoji}*<${appUrl}/deals/${deal.id}|${deal.name}>*\n` +
                `${deal.company ? `_${deal.company}_ • ` : ''}${formatCurrency(deal.value)} • ${deal.stage_name}${probText}${daysText}`,
        },
        accessory: {
          type: 'overflow',
          action_id: 'pipeline_deal_actions',
          options: [
            {
              text: { type: 'plain_text', text: ':clipboard: View Deal', emoji: true },
              value: `view:${deal.id}`,
            },
            {
              text: { type: 'plain_text', text: ':speech_balloon: Draft Check-in', emoji: true },
              value: `draft_checkin:${deal.id}:${deal.name}`,
            },
            {
              text: { type: 'plain_text', text: ':arrows_counterclockwise: Update Stage', emoji: true },
              value: `update_stage:${deal.id}:${deal.name}`,
            },
          ],
        },
      });
    });

    if (totalDeals > 8) {
      blocks.push({
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `_Showing 8 of ${totalDeals} deals. <${appUrl}/deals|View all in Sixty>_` },
        ],
      });
    }
  }

  blocks.push({ type: 'divider' });

  // Filter buttons
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: ':chart_with_upwards_trend: All', emoji: true },
        action_id: 'pipeline_filter_all',
        value: 'all',
        ...(filter === '' ? { style: 'primary' } : {}),
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: ':warning: At Risk', emoji: true },
        action_id: 'pipeline_filter_risk',
        value: 'at-risk',
        ...(filter === 'at-risk' || filter === 'risk' ? { style: 'primary' } : {}),
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: ':calendar: Closing', emoji: true },
        action_id: 'pipeline_filter_closing',
        value: 'closing',
        ...(filter === 'closing' ? { style: 'primary' } : {}),
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: ':hourglass: Stale', emoji: true },
        action_id: 'pipeline_filter_stale',
        value: 'stale',
        ...(filter === 'stale' ? { style: 'primary' } : {}),
      },
    ],
  });

  return {
    blocks,
    text: `Pipeline Overview - ${totalDeals} deals worth ${formatCurrency(totalValue)}`,
  };
}
