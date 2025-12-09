// supabase/functions/slack-daily-digest/index.ts
// Posts Daily Standup Digest to Slack - triggered by cron or manual call

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { buildDailyDigestMessage, type DailyDigestData } from '../_shared/slackBlocks.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
const appUrl = Deno.env.get('APP_URL') || Deno.env.get('SITE_URL') || 'https://use60.com';

interface OrgDigestData {
  orgId: string;
  teamName: string;
  botToken: string;
  channelId: string;
  timezone: string;
}

/**
 * Format date for display
 */
function formatDate(date: Date, timezone: string): string {
  try {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: timezone,
    });
  } catch {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}

/**
 * Format time for display
 */
function formatTime(date: Date | string, timezone: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  try {
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
    });
  } catch {
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }
}

/**
 * Get today's meetings for an org
 */
async function getTodaysMeetings(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  userMappings: Map<string, string>
): Promise<DailyDigestData['meetings']> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data: meetings } = await supabase
    .from('calendar_events')
    .select(`
      id,
      title,
      start_time,
      user_id,
      profiles:user_id (
        full_name,
        email
      )
    `)
    .eq('org_id', orgId)
    .gte('start_time', today.toISOString())
    .lt('start_time', tomorrow.toISOString())
    .order('start_time', { ascending: true });

  if (!meetings) return [];

  return meetings.map((m) => {
    const profile = m.profiles as { full_name?: string; email?: string } | null;
    const userName = profile?.full_name || profile?.email || 'Unknown';
    return {
      time: formatTime(m.start_time, 'UTC'),
      userName,
      slackUserId: userMappings.get(m.user_id),
      title: m.title || 'Untitled Meeting',
    };
  });
}

/**
 * Get overdue tasks for an org
 */
async function getOverdueTasks(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  userMappings: Map<string, string>
): Promise<DailyDigestData['overdueTasks']> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: tasks } = await supabase
    .from('tasks')
    .select(`
      id,
      title,
      due_date,
      user_id,
      profiles:user_id (
        full_name,
        email
      )
    `)
    .eq('org_id', orgId)
    .lt('due_date', today.toISOString())
    .in('status', ['pending', 'in_progress', 'proposed'])
    .order('due_date', { ascending: true })
    .limit(10);

  if (!tasks) return [];

  return tasks.map((t) => {
    const profile = t.profiles as { full_name?: string; email?: string } | null;
    const userName = profile?.full_name || profile?.email || 'Unknown';
    const daysOverdue = Math.ceil((today.getTime() - new Date(t.due_date).getTime()) / (1000 * 60 * 60 * 24));
    return {
      userName,
      slackUserId: userMappings.get(t.user_id),
      task: t.title,
      daysOverdue,
    };
  });
}

/**
 * Get tasks due today for an org
 */
async function getDueTodayTasks(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  userMappings: Map<string, string>
): Promise<DailyDigestData['dueTodayTasks']> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data: tasks } = await supabase
    .from('tasks')
    .select(`
      id,
      title,
      user_id,
      profiles:user_id (
        full_name,
        email
      )
    `)
    .eq('org_id', orgId)
    .gte('due_date', today.toISOString())
    .lt('due_date', tomorrow.toISOString())
    .in('status', ['pending', 'in_progress', 'proposed'])
    .limit(10);

  if (!tasks) return [];

  return tasks.map((t) => {
    const profile = t.profiles as { full_name?: string; email?: string } | null;
    const userName = profile?.full_name || profile?.email || 'Unknown';
    return {
      userName,
      slackUserId: userMappings.get(t.user_id),
      task: t.title,
    };
  });
}

/**
 * Get pipeline stats for the week
 */
async function getWeekStats(
  supabase: ReturnType<typeof createClient>,
  orgId: string
): Promise<DailyDigestData['weekStats']> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  // Get closed deals this week
  const { data: closedDeals } = await supabase
    .from('deals')
    .select('value')
    .eq('org_id', orgId)
    .eq('stage', 'signed')
    .gte('updated_at', weekAgo.toISOString());

  // Get meeting count this week
  const { count: meetingsCount } = await supabase
    .from('meetings')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('created_at', weekAgo.toISOString());

  // Get activity count this week
  const { count: activitiesCount } = await supabase
    .from('activities')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('created_at', weekAgo.toISOString());

  // Get total pipeline value
  const { data: pipeline } = await supabase
    .from('deals')
    .select('value')
    .eq('org_id', orgId)
    .in('stage', ['sql', 'opportunity', 'verbal']);

  const dealsCount = closedDeals?.length || 0;
  const dealsValue = closedDeals?.reduce((sum, d) => sum + (d.value || 0), 0) || 0;
  const pipelineValue = pipeline?.reduce((sum, d) => sum + (d.value || 0), 0) || 0;

  return {
    dealsCount,
    dealsValue,
    meetingsCount: meetingsCount || 0,
    activitiesCount: activitiesCount || 0,
    pipelineValue,
  };
}

/**
 * Get stale deals info
 */
async function getStaleDeals(
  supabase: ReturnType<typeof createClient>,
  orgId: string
): Promise<{ count: number; details: string }> {
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const { data: staleDeals } = await supabase
    .from('deals')
    .select('title, value, stage, updated_at')
    .eq('org_id', orgId)
    .in('stage', ['sql', 'opportunity', 'verbal'])
    .lt('updated_at', twoWeeksAgo.toISOString())
    .order('value', { ascending: false })
    .limit(5);

  if (!staleDeals || staleDeals.length === 0) {
    return { count: 0, details: '' };
  }

  const details = staleDeals.map((d) => {
    const daysStale = Math.ceil((Date.now() - new Date(d.updated_at).getTime()) / (1000 * 60 * 60 * 24));
    return `- ${d.title} ($${(d.value || 0).toLocaleString()}, ${d.stage}, ${daysStale} days stale)`;
  }).join('\n');

  return { count: staleDeals.length, details };
}

/**
 * Generate AI insights
 */
async function generateInsights(
  meetingsCount: number,
  overdueCount: number,
  dueTodayCount: number,
  staleDealsCount: number,
  weekStats: DailyDigestData['weekStats']
): Promise<string[]> {
  if (!anthropicApiKey) {
    return ['Review your pipeline for deals needing attention.'];
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        temperature: 0.5,
        system: 'You are a sales operations analyst. Generate 2-3 brief, actionable insights for a team morning digest. Each insight should be one concise sentence. Return ONLY valid JSON.',
        messages: [{
          role: 'user',
          content: `Generate insights based on:
- Today's meetings: ${meetingsCount}
- Overdue tasks: ${overdueCount}
- Tasks due today: ${dueTodayCount}
- Stale deals (14+ days): ${staleDealsCount}
- Deals closed this week: ${weekStats.dealsCount} ($${weekStats.dealsValue.toLocaleString()})
- Pipeline value: $${weekStats.pipelineValue.toLocaleString()}

Return JSON: { "insights": ["insight1", "insight2"] }`
        }],
      }),
    });

    if (!response.ok) {
      throw new Error('AI API error');
    }

    const result = await response.json();
    const content = result.content[0]?.text;
    const parsed = JSON.parse(content);
    return parsed.insights || [];
  } catch (error) {
    console.error('Error generating insights:', error);
    return ['Review your pipeline and prioritize follow-ups with stale deals.'];
  }
}

/**
 * Post message to Slack
 */
async function postToSlack(
  botToken: string,
  channel: string,
  message: { blocks: unknown[]; text: string }
): Promise<{ ok: boolean; ts?: string; error?: string }> {
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel,
      blocks: message.blocks,
      text: message.text,
    }),
  });

  return response.json();
}

/**
 * Get user mappings for an org
 */
async function getUserMappings(
  supabase: ReturnType<typeof createClient>,
  orgId: string
): Promise<Map<string, string>> {
  const { data } = await supabase
    .from('slack_user_mappings')
    .select('sixty_user_id, slack_user_id')
    .eq('org_id', orgId);

  const map = new Map<string, string>();
  data?.forEach((m) => {
    if (m.sixty_user_id && m.slack_user_id) {
      map.set(m.sixty_user_id, m.slack_user_id);
    }
  });
  return map;
}

/**
 * Process digest for a single org
 */
async function processOrgDigest(
  supabase: ReturnType<typeof createClient>,
  org: OrgDigestData
): Promise<{ success: boolean; error?: string }> {
  try {
    const userMappings = await getUserMappings(supabase, org.orgId);

    // Gather all data
    const [meetings, overdueTasks, dueTodayTasks, weekStats, staleDeals] = await Promise.all([
      getTodaysMeetings(supabase, org.orgId, userMappings),
      getOverdueTasks(supabase, org.orgId, userMappings),
      getDueTodayTasks(supabase, org.orgId, userMappings),
      getWeekStats(supabase, org.orgId),
      getStaleDeals(supabase, org.orgId),
    ]);

    // Generate AI insights
    const insights = await generateInsights(
      meetings.length,
      overdueTasks.length,
      dueTodayTasks.length,
      staleDeals.count,
      weekStats
    );

    // Build digest data
    const digestData: DailyDigestData = {
      teamName: org.teamName,
      date: formatDate(new Date(), org.timezone),
      meetings,
      overdueTasks,
      dueTodayTasks,
      insights,
      weekStats,
      appUrl,
    };

    // Build and send message
    const message = buildDailyDigestMessage(digestData);
    const result = await postToSlack(org.botToken, org.channelId, message);

    if (!result.ok) {
      return { success: false, error: result.error };
    }

    // Record sent notification
    await supabase.from('slack_notifications_sent').insert({
      org_id: org.orgId,
      feature: 'daily_digest',
      entity_type: 'digest',
      entity_id: org.orgId,
      recipient_type: 'channel',
      recipient_id: org.channelId,
      slack_ts: result.ts,
      slack_channel_id: org.channelId,
    });

    return { success: true };
  } catch (error) {
    console.error('Error processing org digest:', org.orgId, error);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if this is a manual trigger for a specific org
    let targetOrgId: string | null = null;
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      targetOrgId = body.orgId || null;
    }

    // Get all orgs with daily_digest enabled
    let query = supabase
      .from('slack_notification_settings')
      .select(`
        org_id,
        channel_id,
        schedule_timezone,
        slack_org_settings!inner (
          bot_access_token,
          slack_team_name,
          is_connected
        ),
        organizations!inner (
          name
        )
      `)
      .eq('feature', 'daily_digest')
      .eq('is_enabled', true)
      .eq('slack_org_settings.is_connected', true);

    if (targetOrgId) {
      query = query.eq('org_id', targetOrgId);
    }

    const { data: orgs, error } = await query;

    if (error) {
      console.error('Error fetching orgs:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch organizations' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!orgs || orgs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No orgs configured for daily digest' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process each org
    const results = await Promise.all(
      orgs.map((org) => {
        const settings = org.slack_org_settings as { bot_access_token: string; slack_team_name?: string };
        const organization = org.organizations as { name?: string };
        return processOrgDigest(supabase, {
          orgId: org.org_id,
          teamName: organization?.name || settings?.slack_team_name || 'Team',
          botToken: settings.bot_access_token,
          channelId: org.channel_id,
          timezone: org.schedule_timezone || 'UTC',
        });
      })
    );

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    console.log(`Daily digest sent: ${successCount} success, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: orgs.length,
        successCount,
        failedCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in daily digest:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
