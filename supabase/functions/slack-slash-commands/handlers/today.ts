// supabase/functions/slack-slash-commands/handlers/today.ts
// Handler for /sixty today - Day at a glance

import { buildDayAtGlanceMessage, type DayAtGlanceData, type SlackMessage } from '../../_shared/slackBlocks.ts';
import type { CommandContext } from '../index.ts';

/**
 * Handle /sixty today command
 * Returns a day-at-a-glance summary with meetings, tasks, deals closing, and alerts
 */
export async function handleToday(ctx: CommandContext): Promise<SlackMessage> {
  const { supabase, userContext, payload, appUrl } = ctx;
  const userId = userContext.userId;
  const orgId = userContext.orgId;

  // Get today's date range
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  // End of week for closing deals
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
  weekEnd.setHours(23, 59, 59, 999);

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, first_name')
    .eq('id', userId)
    .maybeSingle();

  const userName = profile?.full_name || profile?.first_name || 'there';

  // Fetch data in parallel
  const [meetingsResult, tasksResult, dealsResult, emailCategoriesResult] = await Promise.all([
    // Today's meetings
    getMeetings(ctx, userId, orgId, todayStart, todayEnd),
    // Tasks due
    getTasks(ctx, userId, orgId, todayEnd),
    // Deals closing this week
    getDealsClosingThisWeek(ctx, userId, orgId, weekEnd),
    // Email categories (to_respond count)
    getEmailAlerts(ctx, userId),
  ]);

  // Get org settings for currency
  let currencyCode = 'USD';
  let currencyLocale = 'en-US';

  if (orgId) {
    const { data: orgSettings } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', orgId)
      .maybeSingle();

    if (orgSettings?.settings) {
      const settings = orgSettings.settings as Record<string, unknown>;
      currencyCode = (settings.currency_code as string) || 'USD';
      currencyLocale = (settings.currency_locale as string) || 'en-US';
    }
  }

  // Build the day at a glance data
  const data: DayAtGlanceData = {
    userName,
    slackUserId: payload.user_id,
    date: now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }),
    currencyCode,
    currencyLocale,
    meetings: meetingsResult,
    tasks: tasksResult,
    dealsClosingThisWeek: dealsResult,
    emailsToRespond: emailCategoriesResult.toRespond,
    ghostRiskContacts: emailCategoriesResult.ghostRisk,
    appUrl,
  };

  return buildDayAtGlanceMessage(data);
}

/**
 * Get today's meetings for the user
 */
async function getMeetings(
  ctx: CommandContext,
  userId: string,
  orgId: string | undefined,
  todayStart: Date,
  todayEnd: Date
): Promise<DayAtGlanceData['meetings']> {
  try {
    // Query calendar_events for today's meetings
    const { data: events, error } = await ctx.supabase
      .from('calendar_events')
      .select(`
        id,
        title,
        start_time,
        end_time,
        attendees,
        description,
        deal_id,
        deals ( name, value, company )
      `)
      .eq('user_id', userId)
      .gte('start_time', todayStart.toISOString())
      .lte('start_time', todayEnd.toISOString())
      .order('start_time', { ascending: true })
      .limit(10);

    if (error) {
      console.error('Error fetching meetings:', error);
      return [];
    }

    return (events || []).map((e: any) => {
      const startTime = new Date(e.start_time);
      return {
        time: startTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }),
        title: e.title || 'Meeting',
        companyName: e.deals?.company || extractCompanyFromAttendees(e.attendees),
        dealValue: e.deals?.value,
        meetingId: e.id,
      };
    });
  } catch (error) {
    console.error('Error in getMeetings:', error);
    return [];
  }
}

/**
 * Get overdue and due today tasks
 */
async function getTasks(
  ctx: CommandContext,
  userId: string,
  orgId: string | undefined,
  todayEnd: Date
): Promise<DayAtGlanceData['tasks']> {
  try {
    const now = new Date();

    // Get overdue tasks
    const { data: overdueTasks } = await ctx.supabase
      .from('tasks')
      .select('id, title, due_date, deal_id, deals ( name )')
      .eq('assigned_to', userId)
      .in('status', ['pending', 'in_progress'])
      .lt('due_date', now.toISOString())
      .order('due_date', { ascending: true })
      .limit(5);

    // Get due today tasks
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const { data: dueTodayTasks } = await ctx.supabase
      .from('tasks')
      .select('id, title, due_date, deal_id, deals ( name )')
      .eq('assigned_to', userId)
      .in('status', ['pending', 'in_progress'])
      .gte('due_date', todayStart.toISOString())
      .lte('due_date', todayEnd.toISOString())
      .order('due_date', { ascending: true })
      .limit(5);

    const overdue = (overdueTasks || []).map((t: any) => {
      const dueDate = new Date(t.due_date);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      return {
        title: t.title,
        daysOverdue: Math.max(1, daysOverdue),
        dealName: t.deals?.name,
      };
    });

    const dueToday = (dueTodayTasks || []).map((t: any) => ({
      title: t.title,
      dealName: t.deals?.name,
    }));

    return { overdue, dueToday };
  } catch (error) {
    console.error('Error in getTasks:', error);
    return { overdue: [], dueToday: [] };
  }
}

/**
 * Get deals closing this week
 */
async function getDealsClosingThisWeek(
  ctx: CommandContext,
  userId: string,
  orgId: string | undefined,
  weekEnd: Date
): Promise<DayAtGlanceData['dealsClosingThisWeek']> {
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const { data: deals } = await ctx.supabase
      .from('deals')
      .select(`
        id,
        name,
        value,
        stage_id,
        expected_close_date,
        deal_stages ( name )
      `)
      .eq('owner_id', userId)
      .not('status', 'eq', 'closed_won')
      .not('status', 'eq', 'closed_lost')
      .gte('expected_close_date', todayStart.toISOString())
      .lte('expected_close_date', weekEnd.toISOString())
      .order('expected_close_date', { ascending: true })
      .order('value', { ascending: false })
      .limit(5);

    return (deals || []).map((d: any) => {
      const closeDate = new Date(d.expected_close_date);
      const daysUntilClose = Math.ceil((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        id: d.id,
        name: d.name,
        value: d.value || 0,
        stage: d.deal_stages?.name || 'Unknown',
        daysUntilClose: Math.max(0, daysUntilClose),
      };
    });
  } catch (error) {
    console.error('Error in getDealsClosingThisWeek:', error);
    return [];
  }
}

/**
 * Get email alerts (to_respond count and ghost risk)
 */
async function getEmailAlerts(
  ctx: CommandContext,
  userId: string
): Promise<{ toRespond: number; ghostRisk: number }> {
  try {
    // Get emails needing response
    const { count: toRespondCount } = await ctx.supabase
      .from('emails')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('category', 'to_respond')
      .eq('is_read', false);

    // Get contacts at ghost risk (no activity in 7+ days)
    const ghostThreshold = new Date();
    ghostThreshold.setDate(ghostThreshold.getDate() - 7);

    const { count: ghostCount } = await ctx.supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .lt('last_interaction_at', ghostThreshold.toISOString())
      .not('last_interaction_at', 'is', null);

    return {
      toRespond: toRespondCount || 0,
      ghostRisk: Math.min(ghostCount || 0, 10), // Cap at 10 for display
    };
  } catch (error) {
    console.error('Error in getEmailAlerts:', error);
    return { toRespond: 0, ghostRisk: 0 };
  }
}

/**
 * Extract company name from attendees list (simple heuristic)
 */
function extractCompanyFromAttendees(attendees: unknown): string | undefined {
  if (!attendees || !Array.isArray(attendees)) return undefined;

  for (const attendee of attendees) {
    const email = typeof attendee === 'string' ? attendee : (attendee as any)?.email;
    if (email && typeof email === 'string') {
      // Skip common personal domains
      if (email.includes('@gmail.') || email.includes('@yahoo.') || email.includes('@hotmail.') || email.includes('@outlook.')) {
        continue;
      }
      // Extract domain and convert to company name
      const domain = email.split('@')[1];
      if (domain) {
        const company = domain.split('.')[0];
        return company.charAt(0).toUpperCase() + company.slice(1);
      }
    }
  }
  return undefined;
}
