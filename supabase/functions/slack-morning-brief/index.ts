/**
 * Slack Morning Brief Edge Function
 * 
 * Sends daily morning brief DMs to sales reps with:
 * - Today's meetings
 * - Overdue and due-today tasks
 * - Deals closing this week
 * - Emails needing response
 * - AI-generated insights and priorities
 * 
 * Runs daily via cron (scheduled for 8am user timezone, with dedupe to prevent duplicates).
 * Mirrors all Slack notifications into in-app notifications.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyCronSecret, isServiceRoleAuth } from '../_shared/edgeAuth.ts';
import { getCorsHeaders, handleCorsPreflightRequest, errorResponse, jsonResponse } from '../_shared/corsHelper.ts';
import {
  getSlackOrgSettings,
  getNotificationFeatureSettings,
  getSlackRecipients,
  shouldSendNotification,
  recordNotificationSent,
  deliverToSlack,
  deliverToInApp,
} from '../_shared/proactive/index.ts';
import { buildMorningBriefMessage, type MorningBriefData } from '../_shared/slackBlocks.ts';
import { runSkill } from '../_shared/skillsRuntime.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL = Deno.env.get('APP_URL') || Deno.env.get('SITE_URL') || 'https://app.use60.com';

serve(async (req) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', req, 405);
  }

  try {
    // SECURITY: Fail-closed authentication
    const cronSecret = Deno.env.get('CRON_SECRET');
    const authHeader = req.headers.get('Authorization');
    const isCronAuth = verifyCronSecret(req, cronSecret);
    const isServiceRole = isServiceRoleAuth(authHeader, SUPABASE_SERVICE_ROLE_KEY);

    if (!isCronAuth && !isServiceRole) {
      console.error('[slack-morning-brief] Unauthorized access attempt');
      return errorResponse('Unauthorized', req, 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Get all orgs with Slack connected
    const { data: slackOrgs } = await supabase
      .from('slack_org_settings')
      .select('org_id, bot_access_token, slack_team_id')
      .eq('is_connected', true)
      .not('bot_access_token', 'is', null);

    if (!slackOrgs?.length) {
      return jsonResponse({
        success: true,
        message: 'No Slack-connected orgs found',
        briefsSent: 0,
      }, req);
    }

    let totalBriefsSent = 0;
    const errors: string[] = [];

    // Process each org
    for (const org of slackOrgs) {
      try {
        // Check if morning brief is enabled
        const settings = await getNotificationFeatureSettings(
          supabase,
          org.org_id,
          'morning_brief'
        );

        if (!settings?.isEnabled) {
          continue;
        }

        // Get Slack org settings
        const slackSettings = await getSlackOrgSettings(supabase, org.org_id);
        if (!slackSettings) continue;

        // Get recipients
        const recipients = await getSlackRecipients(supabase, org.org_id);

        // Process each recipient
        for (const recipient of recipients) {
          try {
            // Check dedupe (one brief per day per user)
            const shouldSend = await shouldSendNotification(
              supabase,
              'morning_brief',
              org.org_id,
              recipient.slackUserId,
              undefined
            );

            if (!shouldSend) {
              continue; // Already sent today
            }

            // Build morning brief data
            const briefData = await buildMorningBriefData(
              supabase,
              org.org_id,
              recipient.userId,
              recipient.name || recipient.email || 'there'
            );

            if (!briefData) {
              continue; // No data to show
            }

            // Generate AI insights using skills
            try {
              const skillResult = await runSkill(
                supabase,
                'suggest_next_actions',
                {
                  activityContext: JSON.stringify(briefData),
                  recentActivities: JSON.stringify(briefData.meetings.slice(0, 5)),
                  existingTasks: JSON.stringify([...briefData.tasks.overdue, ...briefData.tasks.dueToday]),
                },
                org.org_id,
                recipient.userId
              );

              if (skillResult.success && skillResult.output) {
                if (Array.isArray(skillResult.output)) {
                  briefData.priorities = skillResult.output
                    .slice(0, 3)
                    .map((item: any) => item.title || item.action || String(item));
                } else if (skillResult.output.priorities) {
                  briefData.priorities = skillResult.output.priorities;
                }
                if (skillResult.output.insights) {
                  briefData.insights = skillResult.output.insights;
                }
              }
            } catch (skillError) {
              console.warn('[slack-morning-brief] Skill execution failed, using defaults:', skillError);
            }

            // Build Slack message
            const slackMessage = buildMorningBriefMessage(briefData);

            // Deliver to Slack
            const slackResult = await deliverToSlack(
              supabase,
              {
                type: 'morning_brief',
                orgId: org.org_id,
                recipientUserId: recipient.userId,
                recipientSlackUserId: recipient.slackUserId,
                title: `Good morning, ${briefData.userName}!`,
                message: slackMessage.text || 'Here\'s your day at a glance.',
                blocks: slackMessage.blocks,
                actionUrl: `${APP_URL}/calendar`,
                inAppCategory: 'team',
                inAppType: 'info',
                metadata: {
                  meetingsCount: briefData.meetings.length,
                  tasksCount: briefData.tasks.overdue.length + briefData.tasks.dueToday.length,
                  dealsCount: briefData.deals.length,
                },
              },
              slackSettings.botAccessToken
            );

            // Record notification sent
            if (slackResult.sent) {
              await recordNotificationSent(
                supabase,
                'morning_brief',
                org.org_id,
                recipient.slackUserId,
                slackResult.channelId,
                slackResult.ts,
                undefined
              );
            }

            // Mirror to in-app
            await deliverToInApp(supabase, {
              type: 'morning_brief',
              orgId: org.org_id,
              recipientUserId: recipient.userId,
              recipientSlackUserId: recipient.slackUserId,
              title: `Good morning, ${briefData.userName}!`,
              message: slackMessage.text || 'Here\'s your day at a glance.',
              actionUrl: `${APP_URL}/calendar`,
              inAppCategory: 'team',
              inAppType: 'info',
              metadata: {
                meetingsCount: briefData.meetings.length,
                tasksCount: briefData.tasks.overdue.length + briefData.tasks.dueToday.length,
                dealsCount: briefData.deals.length,
              },
            });

            if (slackResult.sent) {
              totalBriefsSent++;
            } else {
              errors.push(`Failed to send to ${recipient.email || recipient.userId}: ${slackResult.error}`);
            }
          } catch (userError) {
            console.error(`[slack-morning-brief] Error processing user ${recipient.userId}:`, userError);
            errors.push(`User ${recipient.userId}: ${userError instanceof Error ? userError.message : 'Unknown error'}`);
          }
        }
      } catch (orgError) {
        console.error(`[slack-morning-brief] Error processing org ${org.org_id}:`, orgError);
        errors.push(`Org ${org.org_id}: ${orgError instanceof Error ? orgError.message : 'Unknown error'}`);
      }
    }

    return jsonResponse({
      success: true,
      briefsSent: totalBriefsSent,
      errors: errors.length > 0 ? errors : undefined,
    }, req);
  } catch (error) {
    console.error('[slack-morning-brief] Fatal error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      req,
      500
    );
  }
});

/**
 * Build morning brief data for a user
 */
async function buildMorningBriefData(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  userId: string,
  userName: string
): Promise<MorningBriefData | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekFromNow = new Date(today);
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  // Get org currency settings
  const { data: org } = await supabase
    .from('organizations')
    .select('currency_code, currency_locale')
    .eq('id', orgId)
    .single();

  // Get today's meetings
  const { data: meetings } = await supabase
    .from('calendar_events')
    .select(`
      id,
      title,
      start_time,
      end_time,
      contacts:contact_id (full_name, companies:company_id (name)),
      deals:deal_id (id, title, value, stage)
    `)
    .eq('user_id', userId)
    .gte('start_time', today.toISOString())
    .lt('start_time', tomorrow.toISOString())
    .order('start_time', { ascending: true });

  // Get overdue tasks
  const { data: overdueTasks } = await supabase
    .from('tasks')
    .select('id, title, due_date, deals:deal_id (title)')
    .eq('user_id', userId)
    .eq('completed', false)
    .lt('due_date', today.toISOString())
    .order('due_date', { ascending: true })
    .limit(10);

  // Get due-today tasks
  const { data: dueTodayTasks } = await supabase
    .from('tasks')
    .select('id, title, deals:deal_id (title)')
    .eq('user_id', userId)
    .eq('completed', false)
    .gte('due_date', today.toISOString())
    .lt('due_date', tomorrow.toISOString())
    .limit(10);

  // Get deals closing this week
  const { data: deals } = await supabase
    .from('deals')
    .select('id, title, value, stage, close_date, health_status')
    .eq('user_id', userId)
    .in('stage', ['sql', 'opportunity', 'verbal', 'proposal', 'negotiation'])
    .not('close_date', 'is', null)
    .lte('close_date', weekFromNow.toISOString())
    .order('close_date', { ascending: true })
    .limit(5);

  // Get emails to respond count (from email_categorizations)
  const { count: emailsToRespond } = await supabase
    .from('email_categorizations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('category', 'to_respond')
    .is('responded_at', null);

  // Format meetings
  const formattedMeetings = (meetings || []).map((m: any) => {
    const startTime = new Date(m.start_time);
    const contact = m.contacts?.[0];
    const deal = m.deals?.[0];
    
    return {
      time: startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      title: m.title,
      contactName: contact?.full_name,
      companyName: contact?.companies?.name,
      dealValue: deal?.value,
      isImportant: deal?.stage === 'proposal' || deal?.stage === 'negotiation',
    };
  });

  // Format tasks
  const formattedOverdueTasks = (overdueTasks || []).map((t: any) => {
    const dueDate = new Date(t.due_date);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      title: t.title,
      daysOverdue,
      dealName: t.deals?.title,
    };
  });

  const formattedDueTodayTasks = (dueTodayTasks || []).map((t: any) => ({
    title: t.title,
    dealName: t.deals?.title,
  }));

  // Format deals
  const formattedDeals = (deals || []).map((d: any) => {
    const closeDate = d.close_date ? new Date(d.close_date) : null;
    const daysUntilClose = closeDate 
      ? Math.ceil((closeDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      : undefined;
    
    return {
      name: d.title,
      id: d.id,
      value: d.value || 0,
      stage: d.stage,
      closeDate: d.close_date,
      daysUntilClose,
      isAtRisk: d.health_status === 'at_risk' || d.health_status === 'off_track',
    };
  });

  return {
    userName,
    date: today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
    currencyCode: org?.currency_code,
    currencyLocale: org?.currency_locale,
    meetings: formattedMeetings,
    tasks: {
      overdue: formattedOverdueTasks,
      dueToday: formattedDueTodayTasks,
    },
    deals: formattedDeals,
    emailsToRespond: emailsToRespond || 0,
    insights: [],
    priorities: [],
    appUrl: APP_URL,
  };
}
