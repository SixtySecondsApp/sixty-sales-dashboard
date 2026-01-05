// supabase/functions/slack-slash-commands/handlers/standup.ts
// Handler for /sixty standup - Team standup digest

import { type SlackMessage } from '../../_shared/slackBlocks.ts';
import { buildErrorResponse } from '../../_shared/slackAuth.ts';
import type { CommandContext } from '../index.ts';

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
}

interface PipelineSummary {
  total_value: number;
  deal_count: number;
  deals_closing_this_week: number;
  deals_at_risk: number;
  new_deals_today: number;
}

interface TeamMeetings {
  total: number;
  byMember: { name: string; count: number }[];
}

interface OverdueTasks {
  total: number;
  byMember: { name: string; count: number }[];
}

interface RecentWins {
  dealName: string;
  value: number;
  closedBy: string;
}

/**
 * Handle /sixty standup command
 * Returns a team standup digest for managers/team leads
 */
export async function handleStandup(ctx: CommandContext): Promise<SlackMessage> {
  const { supabase, userContext, appUrl } = ctx;
  const userId = userContext.userId;
  const orgId = userContext.orgId;

  if (!orgId) {
    return buildErrorResponse('Unable to determine your organization. Please contact support.');
  }

  try {
    // Check if user is a manager or has team access
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role, team_id')
      .eq('id', userId)
      .maybeSingle();

    // Get team members (if manager) or org members (if admin)
    const teamMembers = await getTeamMembers(ctx, userId, orgId, userProfile?.role);

    if (teamMembers.length === 0) {
      return buildErrorResponse(
        'No team members found.\n\nThe standup digest is available for managers and team leads with assigned team members.'
      );
    }

    const memberIds = teamMembers.map(m => m.id);

    // Fetch all standup data in parallel
    const [pipelineSummary, meetings, overdueTasks, recentWins, currencySettings] = await Promise.all([
      getPipelineSummary(ctx, memberIds),
      getTodayMeetings(ctx, memberIds, teamMembers),
      getOverdueTasks(ctx, memberIds, teamMembers),
      getRecentWins(ctx, memberIds, orgId),
      getOrgCurrency(ctx.supabase, orgId),
    ]);

    // Build the standup message
    return buildStandupMessage({
      teamMembers,
      pipelineSummary,
      meetings,
      overdueTasks,
      recentWins,
      currencyCode: currencySettings.currencyCode,
      currencyLocale: currencySettings.currencyLocale,
      appUrl,
    });

  } catch (error) {
    console.error('Error in handleStandup:', error);
    return buildErrorResponse('Failed to generate standup digest. Please try again.');
  }
}

/**
 * Get team members based on user role
 */
async function getTeamMembers(
  ctx: CommandContext,
  userId: string,
  orgId: string,
  role?: string
): Promise<TeamMember[]> {
  const { supabase } = ctx;

  // If admin or manager, get all org members or their team
  if (role === 'admin' || role === 'owner') {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('organization_id', orgId)
      .limit(20);

    return (data || []) as TeamMember[];
  }

  // Get direct reports if user is a manager
  const { data: teamMembers } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('organization_id', orgId)
    .eq('manager_id', userId)
    .limit(20);

  if (teamMembers && teamMembers.length > 0) {
    // Include self in the list
    const { data: self } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', userId)
      .maybeSingle();

    return self ? [self as TeamMember, ...(teamMembers as TeamMember[])] : (teamMembers as TeamMember[]);
  }

  // Fallback: return just self for individual contributors
  const { data: self } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('id', userId)
    .maybeSingle();

  return self ? [self as TeamMember] : [];
}

/**
 * Get pipeline summary for team
 */
async function getPipelineSummary(
  ctx: CommandContext,
  memberIds: string[]
): Promise<PipelineSummary> {
  const { supabase } = ctx;
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Get all active deals
  const { data: deals } = await supabase
    .from('deals')
    .select('id, value, expected_close_date, created_at, status, probability')
    .in('user_id', memberIds)
    .not('status', 'eq', 'closed_won')
    .not('status', 'eq', 'closed_lost');

  if (!deals) {
    return {
      total_value: 0,
      deal_count: 0,
      deals_closing_this_week: 0,
      deals_at_risk: 0,
      new_deals_today: 0,
    };
  }

  const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
  const closingThisWeek = deals.filter(d => {
    if (!d.expected_close_date) return false;
    const closeDate = new Date(d.expected_close_date);
    return closeDate <= weekEnd;
  }).length;

  const atRisk = deals.filter(d => d.probability !== null && d.probability < 30).length;
  const newToday = deals.filter(d => {
    const created = new Date(d.created_at);
    return created >= todayStart;
  }).length;

  return {
    total_value: totalValue,
    deal_count: deals.length,
    deals_closing_this_week: closingThisWeek,
    deals_at_risk: atRisk,
    new_deals_today: newToday,
  };
}

/**
 * Get today's meetings for team
 */
async function getTodayMeetings(
  ctx: CommandContext,
  memberIds: string[],
  members: TeamMember[]
): Promise<TeamMeetings> {
  const { supabase } = ctx;
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const { data: meetings } = await supabase
    .from('calendar_events')
    .select('user_id')
    .in('user_id', memberIds)
    .gte('start_time', todayStart.toISOString())
    .lte('start_time', todayEnd.toISOString());

  if (!meetings || meetings.length === 0) {
    return { total: 0, byMember: [] };
  }

  // Count by member
  const countMap = new Map<string, number>();
  meetings.forEach(m => {
    countMap.set(m.user_id, (countMap.get(m.user_id) || 0) + 1);
  });

  const byMember = members
    .filter(m => countMap.has(m.id))
    .map(m => ({
      name: m.full_name.split(' ')[0], // First name only
      count: countMap.get(m.id) || 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    total: meetings.length,
    byMember,
  };
}

/**
 * Get overdue tasks for team
 */
async function getOverdueTasks(
  ctx: CommandContext,
  memberIds: string[],
  members: TeamMember[]
): Promise<OverdueTasks> {
  const { supabase } = ctx;
  const now = new Date();

  const { data: tasks } = await supabase
    .from('tasks')
    .select('assigned_to')
    .in('assigned_to', memberIds)
    .in('status', ['pending', 'in_progress'])
    .lt('due_date', now.toISOString());

  if (!tasks || tasks.length === 0) {
    return { total: 0, byMember: [] };
  }

  // Count by member
  const countMap = new Map<string, number>();
  tasks.forEach(t => {
    if (t.assigned_to) {
      countMap.set(t.assigned_to, (countMap.get(t.assigned_to) || 0) + 1);
    }
  });

  const byMember = members
    .filter(m => countMap.has(m.id))
    .map(m => ({
      name: m.full_name.split(' ')[0],
      count: countMap.get(m.id) || 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    total: tasks.length,
    byMember,
  };
}

/**
 * Get recent wins (closed-won deals in last 7 days)
 */
async function getRecentWins(
  ctx: CommandContext,
  memberIds: string[],
  orgId: string
): Promise<RecentWins[]> {
  const { supabase } = ctx;
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: wins } = await supabase
    .from('deals')
    .select(`
      name,
      value,
      user_id,
      profiles!deals_user_id_fkey ( full_name )
    `)
    .in('user_id', memberIds)
    .eq('status', 'closed_won')
    .gte('updated_at', weekAgo.toISOString())
    .order('value', { ascending: false })
    .limit(3);

  if (!wins) return [];

  return wins.map((w: any) => ({
    dealName: w.name,
    value: w.value || 0,
    closedBy: w.profiles?.full_name?.split(' ')[0] || 'Team',
  }));
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
 * Build the standup Slack message
 */
function buildStandupMessage(data: {
  teamMembers: TeamMember[];
  pipelineSummary: PipelineSummary;
  meetings: TeamMeetings;
  overdueTasks: OverdueTasks;
  recentWins: RecentWins[];
  currencyCode: string;
  currencyLocale: string;
  appUrl: string;
}): SlackMessage {
  const {
    teamMembers,
    pipelineSummary,
    meetings,
    overdueTasks,
    recentWins,
    currencyCode,
    currencyLocale,
    appUrl,
  } = data;

  const formatCurrency = (value: number): string => {
    try {
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

  const blocks: unknown[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `:sunrise: Team Standup • ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`,
        emoji: true,
      },
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `*Team:* ${teamMembers.length} member${teamMembers.length !== 1 ? 's' : ''}` },
      ],
    },
    { type: 'divider' },
  ];

  // Pipeline Summary
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*:bar_chart: Pipeline Summary*\n' +
            `• *Active Pipeline:* ${formatCurrency(pipelineSummary.total_value)} (${pipelineSummary.deal_count} deals)\n` +
            `• *Closing This Week:* ${pipelineSummary.deals_closing_this_week} deal${pipelineSummary.deals_closing_this_week !== 1 ? 's' : ''}\n` +
            (pipelineSummary.deals_at_risk > 0 ? `• *At Risk:* ${pipelineSummary.deals_at_risk} deal${pipelineSummary.deals_at_risk !== 1 ? 's' : ''} :warning:\n` : '') +
            (pipelineSummary.new_deals_today > 0 ? `• *New Today:* ${pipelineSummary.new_deals_today} :new:` : ''),
    },
  });

  // Recent Wins
  if (recentWins.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*:trophy: Recent Wins (7 days)*\n' +
              recentWins.map(w =>
                `• *${w.dealName}* - ${formatCurrency(w.value)} (${w.closedBy})`
              ).join('\n'),
      },
    });
  }

  blocks.push({ type: 'divider' });

  // Today's Meetings
  if (meetings.total > 0) {
    const meetingDetails = meetings.byMember.length > 0
      ? ` (${meetings.byMember.map(m => `${m.name}: ${m.count}`).join(', ')})`
      : '';
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:calendar: *Today's Meetings:* ${meetings.total}${meetingDetails}`,
      },
    });
  } else {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ':calendar: *No meetings scheduled today* - Great day for prospecting!',
      },
    });
  }

  // Overdue Tasks
  if (overdueTasks.total > 0) {
    const taskDetails = overdueTasks.byMember.length > 0
      ? ` (${overdueTasks.byMember.map(m => `${m.name}: ${m.count}`).join(', ')})`
      : '';
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:rotating_light: *Overdue Tasks:* ${overdueTasks.total}${taskDetails}`,
      },
    });
  } else {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: ':white_check_mark: *No overdue tasks* - Team is on track!',
      },
    });
  }

  blocks.push({ type: 'divider' });

  // Quick Actions
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: ':bar_chart: View Pipeline', emoji: true },
        action_id: 'standup_view_pipeline',
        value: 'pipeline',
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: ':warning: View Risks', emoji: true },
        action_id: 'standup_view_risks',
        value: 'risks',
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: ':clipboard: Team Tasks', emoji: true },
        action_id: 'standup_view_tasks',
        url: `${appUrl}/tasks`,
      },
    ],
  });

  return {
    blocks,
    text: `Team Standup - ${pipelineSummary.deal_count} active deals worth ${formatCurrency(pipelineSummary.total_value)}`,
  };
}
