// supabase/functions/slack-slash-commands/handlers/risks.ts
// Handler for /sixty risks [stale|all] - At-risk and stale deals

import { type SlackMessage } from '../../_shared/slackBlocks.ts';
import { buildErrorResponse } from '../../_shared/slackAuth.ts';
import type { CommandContext } from '../index.ts';

interface AtRiskDeal {
  id: string;
  name: string;
  company: string | null;
  value: number;
  stage_name: string | null;
  expected_close_date: string | null;
  days_in_stage: number | null;
  probability: number | null;
  last_activity_date: string | null;
  risks: string[];
  riskScore: number;
}

/**
 * Handle /sixty risks [filter] command
 * Filter can be: "stale" (stalled deals), "closing" (closing soon), or default (all at-risk)
 */
export async function handleRisks(ctx: CommandContext, filter: string): Promise<SlackMessage> {
  const { supabase, userContext, appUrl } = ctx;
  const userId = userContext.userId;
  const orgId = userContext.orgId;

  if (!orgId) {
    return buildErrorResponse('Unable to determine your organization. Please contact support.');
  }

  const filterLower = filter.toLowerCase().trim();

  try {
    // Fetch deals with risk indicators
    const atRiskDeals = await fetchAtRiskDeals(ctx, userId, filterLower);

    if (atRiskDeals.length === 0) {
      const filterMessage = getNoRisksMessage(filterLower);
      return {
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: '✅ No At-Risk Deals', emoji: true },
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: filterMessage },
          },
          {
            type: 'context',
            elements: [
              { type: 'mrkdwn', text: `_Checked ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}_` },
            ],
          },
        ],
        text: 'No at-risk deals found',
      };
    }

    // Get org currency settings
    const { currencyCode, currencyLocale } = await getOrgCurrency(supabase, orgId);

    // Build the risk report
    return buildRiskReportMessage(atRiskDeals, filterLower, currencyCode, currencyLocale, appUrl);

  } catch (error) {
    console.error('Error in handleRisks:', error);
    return buildErrorResponse('Failed to fetch at-risk deals. Please try again.');
  }
}

/**
 * Fetch deals with risk indicators
 */
async function fetchAtRiskDeals(
  ctx: CommandContext,
  userId: string,
  filter: string
): Promise<AtRiskDeal[]> {
  const { supabase } = ctx;
  const now = new Date();

  // Fetch open deals with stage info and last activity
  const { data: deals, error } = await supabase
    .from('deals')
    .select(`
      id,
      name,
      company,
      value,
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

  if (error) {
    console.error('Error fetching deals:', error);
    throw error;
  }

  if (!deals || deals.length === 0) {
    return [];
  }

  // Analyze each deal for risks
  const analyzedDeals: AtRiskDeal[] = [];

  for (const deal of deals) {
    const risks: string[] = [];
    let riskScore = 0;

    // Calculate days in current stage
    const daysInStage = deal.stage_entered_at
      ? Math.floor((now.getTime() - new Date(deal.stage_entered_at).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Calculate days since last activity
    const daysSinceActivity = deal.last_activity_date
      ? Math.floor((now.getTime() - new Date(deal.last_activity_date).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Risk: Stalled in stage
    if (daysInStage !== null && daysInStage > 21) {
      risks.push(`Stalled ${daysInStage} days in stage`);
      riskScore += 30;
    } else if (daysInStage !== null && daysInStage > 14) {
      risks.push(`${daysInStage} days in stage`);
      riskScore += 15;
    }

    // Risk: No recent activity
    if (daysSinceActivity !== null && daysSinceActivity > 14) {
      risks.push(`No activity in ${daysSinceActivity} days`);
      riskScore += 25;
    } else if (daysSinceActivity !== null && daysSinceActivity > 7) {
      risks.push(`Last activity ${daysSinceActivity} days ago`);
      riskScore += 10;
    }

    // Risk: Past due close date
    if (deal.expected_close_date) {
      const closeDate = new Date(deal.expected_close_date);
      const daysUntilClose = Math.ceil((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilClose < 0) {
        risks.push(`Past due by ${Math.abs(daysUntilClose)} days`);
        riskScore += 35;
      } else if (daysUntilClose <= 7 && (deal.probability === null || deal.probability < 70)) {
        risks.push(`Closing in ${daysUntilClose} days, low confidence`);
        riskScore += 20;
      }
    }

    // Risk: Low probability
    if (deal.probability !== null && deal.probability < 30) {
      risks.push('Low probability');
      riskScore += 20;
    }

    // Only include deals with risks
    if (risks.length > 0) {
      const atRiskDeal: AtRiskDeal = {
        id: deal.id,
        name: deal.name,
        company: deal.company,
        value: deal.value || 0,
        stage_name: (deal.deal_stages as any)?.name || null,
        expected_close_date: deal.expected_close_date,
        days_in_stage: daysInStage,
        probability: deal.probability,
        last_activity_date: deal.last_activity_date,
        risks,
        riskScore,
      };

      // Apply filter
      if (filter === 'stale') {
        // Only show stale deals (no recent activity or stalled)
        if (daysSinceActivity !== null && daysSinceActivity > 7) {
          analyzedDeals.push(atRiskDeal);
        } else if (daysInStage !== null && daysInStage > 14) {
          analyzedDeals.push(atRiskDeal);
        }
      } else if (filter === 'closing') {
        // Only show deals closing soon
        if (deal.expected_close_date) {
          const closeDate = new Date(deal.expected_close_date);
          const daysUntilClose = Math.ceil((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (daysUntilClose <= 14) {
            analyzedDeals.push(atRiskDeal);
          }
        }
      } else {
        // Default: all at-risk deals
        analyzedDeals.push(atRiskDeal);
      }
    }
  }

  // Sort by risk score (highest first)
  analyzedDeals.sort((a, b) => b.riskScore - a.riskScore);

  return analyzedDeals.slice(0, 10); // Max 10 deals
}

/**
 * Build the risk report Slack message
 */
function buildRiskReportMessage(
  deals: AtRiskDeal[],
  filter: string,
  currencyCode: string,
  currencyLocale: string,
  appUrl: string
): SlackMessage {
  const title = getRiskReportTitle(filter, deals.length);
  const subtitle = getRiskReportSubtitle(filter);

  const blocks: unknown[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: title, emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: subtitle },
    },
    { type: 'divider' },
  ];

  // Add each deal
  deals.forEach((deal, index) => {
    const valueFormatted = formatCurrency(deal.value, currencyCode, currencyLocale);
    const riskEmoji = getRiskEmoji(deal.riskScore);
    const risksText = deal.risks.slice(0, 2).join(' • ');

    // Deal section
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${riskEmoji} *<${appUrl}/deals/${deal.id}|${deal.name}>*\n` +
              `${deal.company ? `_${deal.company}_ • ` : ''}${valueFormatted}` +
              (deal.stage_name ? ` • ${deal.stage_name}` : '') +
              `\n:warning: ${risksText}`,
      },
      accessory: {
        type: 'overflow',
        action_id: 'deal_risk_actions',
        options: [
          {
            text: { type: 'plain_text', text: ':clipboard: View Deal', emoji: true },
            value: `view_deal:${deal.id}`,
          },
          {
            text: { type: 'plain_text', text: ':speech_balloon: Draft Check-in', emoji: true },
            value: `draft_checkin:${deal.id}:${deal.name}`,
          },
          {
            text: { type: 'plain_text', text: ':pencil: Log Activity', emoji: true },
            value: `log_activity:${deal.id}:${deal.name}`,
          },
          {
            text: { type: 'plain_text', text: ':arrows_counterclockwise: Update Stage', emoji: true },
            value: `update_stage:${deal.id}:${deal.name}`,
          },
        ],
      },
    });

    // Add divider between deals (not after last)
    if (index < deals.length - 1) {
      blocks.push({ type: 'divider' });
    }
  });

  // Summary and quick filters
  blocks.push(
    { type: 'divider' },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `*Total at risk:* ${deals.length} deal${deals.length !== 1 ? 's' : ''} • ` +
                `*Pipeline value:* ${formatCurrency(deals.reduce((sum, d) => sum + d.value, 0), currencyCode, currencyLocale)}`,
        },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: ':hourglass: Stale', emoji: true },
          action_id: 'risks_filter_stale',
          value: 'stale',
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: ':calendar: Closing Soon', emoji: true },
          action_id: 'risks_filter_closing',
          value: 'closing',
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: ':bar_chart: All Risks', emoji: true },
          action_id: 'risks_filter_all',
          value: 'all',
        },
      ],
    }
  );

  return {
    blocks,
    text: `${title} - ${deals.length} deal${deals.length !== 1 ? 's' : ''} need attention`,
  };
}

/**
 * Get risk report title based on filter
 */
function getRiskReportTitle(filter: string, count: number): string {
  switch (filter) {
    case 'stale':
      return `:hourglass_flowing_sand: ${count} Stale Deal${count !== 1 ? 's' : ''}`;
    case 'closing':
      return `:calendar: ${count} Closing Soon`;
    default:
      return `:warning: ${count} At-Risk Deal${count !== 1 ? 's' : ''}`;
  }
}

/**
 * Get risk report subtitle
 */
function getRiskReportSubtitle(filter: string): string {
  switch (filter) {
    case 'stale':
      return 'Deals with no recent activity or stalled in stage';
    case 'closing':
      return 'Deals closing within the next 2 weeks';
    default:
      return 'Deals needing immediate attention, sorted by risk level';
  }
}

/**
 * Get no risks message based on filter
 */
function getNoRisksMessage(filter: string): string {
  switch (filter) {
    case 'stale':
      return 'No stale deals found. Your pipeline is active! :tada:';
    case 'closing':
      return 'No deals closing soon. Check `/sixty pipeline` for your full pipeline view.';
    default:
      return 'All your deals are healthy. Keep up the momentum! :rocket:';
  }
}

/**
 * Get risk level emoji based on score
 */
function getRiskEmoji(score: number): string {
  if (score >= 50) return ':red_circle:';
  if (score >= 30) return ':large_orange_circle:';
  return ':large_yellow_circle:';
}

/**
 * Format currency value
 */
function formatCurrency(value: number, code: string, locale: string): string {
  if (!value || value === 0) return '-';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    // Fallback formatting
    if (value >= 1000000) {
      return `${code === 'USD' ? '$' : code}${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${code === 'USD' ? '$' : code}${(value / 1000).toFixed(0)}K`;
    }
    return `${code === 'USD' ? '$' : code}${value}`;
  }
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
