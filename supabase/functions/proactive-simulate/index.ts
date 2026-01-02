// supabase/functions/proactive-simulate/index.ts
// Platform admin tool: simulate proactive notifications (Slack + in-app) for a user.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { getAuthContext } from '../_shared/edgeAuth.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const appUrl = Deno.env.get('APP_URL') || Deno.env.get('SITE_URL') || 'https://app.use60.com';

type ProactiveSimulateFeature =
  | 'morning_brief'
  | 'sales_assistant_digest'
  | 'pre_meeting_nudge'
  | 'post_call_summary'
  | 'stale_deal_alert'
  | 'email_reply_alert'
  | 'hitl_followup_email';

type NotificationCategory = 'workflow' | 'deal' | 'task' | 'meeting' | 'system' | 'team';
type NotificationType = 'info' | 'success' | 'warning' | 'error';

type SimulateRequest = {
  orgId: string;
  feature: ProactiveSimulateFeature;
  targetUserId?: string;
  sendSlack?: boolean;
  createInApp?: boolean;
  dryRun?: boolean;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function openDm(botToken: string, slackUserId: string): Promise<string> {
  const res = await fetch('https://slack.com/api/conversations.open', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ users: slackUserId, return_im: true }),
  });
  const payload = await res.json();
  if (!payload.ok || !payload.channel?.id) {
    throw new Error(payload.error || 'Failed to open DM');
  }
  return payload.channel.id as string;
}

async function postMessageWithBlocks(
  botToken: string,
  channel: string,
  text: string,
  blocks: unknown[]
): Promise<{ ts: string; channel: string }> {
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ channel, text, blocks }),
  });
  const payload = await res.json();
  if (!payload.ok || !payload.ts || !payload.channel) {
    throw new Error(payload.error || 'Failed to post Slack message');
  }
  return { ts: payload.ts as string, channel: payload.channel as string };
}

async function updateMessageBlocks(
  botToken: string,
  channel: string,
  ts: string,
  text: string,
  blocks: unknown[]
): Promise<void> {
  const res = await fetch('https://slack.com/api/chat.update', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ channel, ts, text, blocks }),
  });
  const payload = await res.json();
  if (!payload.ok) {
    throw new Error(payload.error || 'Failed to update Slack message');
  }
}

async function getSlackForOrg(
  supabase: ReturnType<typeof createClient>,
  orgId: string
): Promise<{
  slack_team_id: string;
  bot_access_token: string;
} | null> {
  const { data } = await supabase
    .from('slack_org_settings')
    .select('slack_team_id, bot_access_token')
    .eq('org_id', orgId)
    .eq('is_connected', true)
    .maybeSingle();

  if (!data?.slack_team_id || !data?.bot_access_token) return null;
  return { slack_team_id: data.slack_team_id as string, bot_access_token: data.bot_access_token as string };
}

async function getSlackUserIdForSixtyUser(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('slack_user_mappings')
    .select('slack_user_id')
    .eq('org_id', orgId)
    .eq('sixty_user_id', userId)
    .maybeSingle();

  return (data?.slack_user_id as string | undefined) || null;
}

function buildInAppPayload(feature: ProactiveSimulateFeature): {
  title: string;
  message: string;
  type: NotificationType;
  category: NotificationCategory;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
} {
  const meta: Record<ProactiveSimulateFeature, { title: string; message: string; category: NotificationCategory }> = {
    morning_brief: {
      title: 'Morning Brief (Simulated)',
      message: 'Your day is set. Review today’s meetings, tasks, and top deal priorities.',
      category: 'team',
    },
    sales_assistant_digest: {
      title: 'Sales Assistant Digest (Simulated)',
      message: 'You have new action items: respond to emails, address ghost risk, and prep upcoming meetings.',
      category: 'task',
    },
    pre_meeting_nudge: {
      title: 'Pre‑Meeting Nudge (Simulated)',
      message: 'Meeting starts soon — here are your top talking points and risks.',
      category: 'meeting',
    },
    post_call_summary: {
      title: 'Post‑Call Summary (Simulated)',
      message: 'Summary + suggested next steps are ready. Draft follow‑up available.',
      category: 'meeting',
    },
    stale_deal_alert: {
      title: 'Stale Deal Alert (Simulated)',
      message: 'A deal has gone quiet. Suggested next steps are ready.',
      category: 'deal',
    },
    email_reply_alert: {
      title: 'Email Reply Received (Simulated)',
      message: 'New inbound reply received. Suggested response and next steps ready.',
      category: 'task',
    },
    hitl_followup_email: {
      title: 'HITL Follow‑up Email (Simulated)',
      message: 'Approval requested for an AI-generated follow-up email draft.',
      category: 'workflow',
    },
  };

  const item = meta[feature];
  return {
    title: item.title,
    message: item.message,
    type: 'info',
    category: item.category,
    actionUrl: '/platform/proactive-simulator',
    metadata: { source: 'proactive_simulator', feature },
  };
}

function baseBlocks(featureLabel: string, subtitle: string): any[] {
  return [
    { type: 'header', text: { type: 'plain_text', text: `⚡ Proactive 60 (Sim) — ${featureLabel}`, emoji: true } },
    { type: 'section', text: { type: 'mrkdwn', text: subtitle } },
    { type: 'context', elements: [{ type: 'mrkdwn', text: `Sent from Proactive Simulator • ${new Date().toLocaleString()}` }] },
    { type: 'divider' },
  ];
}

function buildFeatureBlocks(feature: ProactiveSimulateFeature): { text: string; blocks: any[]; hitlMode?: boolean } {
  switch (feature) {
    case 'morning_brief': {
      const blocks = [
        ...baseBlocks('Morning Brief', '*Top focus today:* 1) respond to pricing email, 2) prep 2 meetings, 3) unblock 1 deal.'),
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: '*📅 Meetings*\n2 today' },
            { type: 'mrkdwn', text: '*✅ Tasks*\n3 due today' },
            { type: 'mrkdwn', text: '*👻 Ghost risk*\n1 at risk' },
            { type: 'mrkdwn', text: '*💰 Pipeline*\n2 deals need attention' },
          ],
        },
        { type: 'divider' },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Open app', emoji: true },
              url: `${appUrl}/dashboard`,
            },
          ],
        },
      ];
      return { text: 'Proactive 60 Morning Brief (Simulated)', blocks };
    }

    case 'sales_assistant_digest': {
      const tasks = [
        { title: 'Reply to Acme pricing request', dueInDays: 0 },
        { title: 'Send breakup email to Beta (ghost risk)', dueInDays: 1 },
      ];

      const blocks: any[] = [
        ...baseBlocks('Sales Assistant Digest', '*Action items detected:* 2 urgent tasks you can one-click into Sixty.'),
      ];

      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: `🔴 *${t.title}*\nSuggested due: ${t.dueInDays} day(s)` },
          accessory: {
            type: 'button',
            text: { type: 'plain_text', text: '➕ Create Task', emoji: true },
            action_id: `sim_add_task_${i + 1}`,
            value: JSON.stringify({ title: t.title, dueInDays: t.dueInDays }),
            style: 'primary',
          },
        });
      }

      blocks.push({ type: 'divider' });
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '➕ Add all tasks', emoji: true },
            action_id: 'add_all_tasks',
            value: JSON.stringify({ tasks }),
            style: 'primary',
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Dismiss', emoji: true },
            action_id: 'dismiss_tasks',
            value: JSON.stringify({ source: 'proactive_simulator' }),
          },
        ],
      });

      return { text: 'Proactive 60 Sales Assistant Digest (Simulated)', blocks };
    }

    case 'pre_meeting_nudge': {
      const blocks = [
        ...baseBlocks('Pre‑Meeting Nudge', '*Meeting starts in ~10 minutes.* Here are 3 talking points:'),
        { type: 'section', text: { type: 'mrkdwn', text: '1) Confirm success criteria + timeline\n2) Ask about decision process + procurement\n3) Address security review early' } },
        {
          type: 'actions',
          elements: [
            { type: 'button', text: { type: 'plain_text', text: 'Open meeting', emoji: true }, url: `${appUrl}/meetings` },
          ],
        },
      ];
      return { text: 'Proactive 60 Pre‑Meeting Nudge (Simulated)', blocks };
    }

    case 'post_call_summary': {
      const blocks: any[] = [
        ...baseBlocks('Post‑Call Summary', '*Call summary ready.* Key outcomes + next steps:'),
        { type: 'section', text: { type: 'mrkdwn', text: '✅ Prospect confirmed budget and timeline.\n⚠️ Security review is the main blocker.\n🎯 Next step: schedule security call this week.' } },
        { type: 'divider' },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: 'Suggested follow‑up task:' },
          accessory: {
            type: 'button',
            text: { type: 'plain_text', text: '➕ Create Task', emoji: true },
            action_id: 'sim_add_task_postcall',
            value: JSON.stringify({ title: 'Schedule security review call (this week)', dueInDays: 2 }),
            style: 'primary',
          },
        },
      ];
      return { text: 'Proactive 60 Post‑Call Summary (Simulated)', blocks };
    }

    case 'stale_deal_alert': {
      const blocks = [
        ...baseBlocks('Stale Deal Alert', '⚠️ *Deal has had no activity for 14+ days.*'),
        { type: 'section', text: { type: 'mrkdwn', text: '*Recommended action:* send a short check-in + propose 2 times for next steps.' } },
        {
          type: 'actions',
          elements: [
            { type: 'button', text: { type: 'plain_text', text: 'Open pipeline', emoji: true }, url: `${appUrl}/pipeline` },
            {
              type: 'button',
              text: { type: 'plain_text', text: '➕ Create Task', emoji: true },
              action_id: 'sim_add_task_stale_deal',
              value: JSON.stringify({ title: 'Send check-in email + propose times', dueInDays: 1 }),
              style: 'primary',
            },
          ],
        },
      ];
      return { text: 'Proactive 60 Stale Deal Alert (Simulated)', blocks };
    }

    case 'email_reply_alert': {
      const blocks = [
        ...baseBlocks('Email Reply Received', '📧 *New inbound reply received.* Summary:'),
        { type: 'section', text: { type: 'mrkdwn', text: '“We can do Thursday, but need security details first.”\n\nSuggested reply: confirm Thursday + attach security overview.' } },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: '➕ Create Task', emoji: true },
              action_id: 'sim_add_task_email_reply',
              value: JSON.stringify({ title: 'Reply with security overview + confirm Thursday', dueInDays: 0 }),
              style: 'primary',
            },
            { type: 'button', text: { type: 'plain_text', text: 'Open Gmail', emoji: true }, url: 'https://mail.google.com' },
          ],
        },
      ];
      return { text: 'Proactive 60 Email Reply Alert (Simulated)', blocks };
    }

    case 'hitl_followup_email': {
      // HITL blocks are constructed after we create the approval record, because the approvalId must be embedded in action_id.
      const blocks = [
        ...baseBlocks('HITL Follow‑up Email', '*Preparing approval…* This message will update with Approve/Edit/Reject buttons.'),
        { type: 'section', text: { type: 'mrkdwn', text: 'Draft: “Thanks for today — here are next steps…”' } },
      ];
      return { text: 'Proactive 60 HITL Follow‑up Email (Simulated)', blocks, hitlMode: true };
    }
  }
}

function buildHitlBlocks(approvalId: string): any[] {
  const draft = [
    'Subject: Great meeting — next steps',
    '',
    'Hi there,',
    '',
    'Thanks for the time today. Here are the next steps we agreed:',
    '- Security review call this week',
    '- Confirm success criteria and timeline',
    '',
    'Would Thursday at 2pm work for the security review?',
    '',
    'Best,',
    'Andrew',
  ].join('\n');

  return [
    ...baseBlocks('HITL Follow‑up Email', '*Approval required.* Review and approve/edit this draft:'),
    { type: 'section', text: { type: 'mrkdwn', text: `\`\`\`\n${draft}\n\`\`\`` } },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Approve', emoji: true },
          style: 'primary',
          action_id: `approve::email_draft::${approvalId}`,
          value: JSON.stringify({}),
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Edit', emoji: true },
          action_id: `edit::email_draft::${approvalId}`,
          value: JSON.stringify({}),
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Reject', emoji: true },
          style: 'danger',
          action_id: `reject::email_draft::${approvalId}`,
          value: JSON.stringify({}),
        },
      ],
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: '_This is a simulation. No email will be sent unless you wire a callback._' }],
    },
  ];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  try {
    const body = (await req.json()) as SimulateRequest;
    if (!body?.orgId) return json({ success: false, error: 'orgId is required' }, 400);
    if (!body?.feature) return json({ success: false, error: 'feature is required' }, 400);

    const authCtx = await getAuthContext(req, supabase, supabaseServiceKey);

    // Require platform admin for this simulator (safe by default)
    if (authCtx.mode === 'user' && !authCtx.isPlatformAdmin) {
      return json({ success: false, error: 'Unauthorized: platform admin required' }, 403);
    }

    const targetUserId = body.targetUserId || authCtx.userId;
    if (!targetUserId) return json({ success: false, error: 'targetUserId is required' }, 400);

    const sendSlack = body.sendSlack !== false;
    const createInApp = body.createInApp !== false;
    const dryRun = body.dryRun === true;

    const debug: Record<string, unknown> = {
      orgId: body.orgId,
      feature: body.feature,
      targetUserId,
      sendSlack,
      createInApp,
      dryRun,
    };

    // Build planned outputs up-front (even in dry run)
    const { text, blocks, hitlMode } = buildFeatureBlocks(body.feature);
    const inAppPayload = buildInAppPayload(body.feature);

    const result: any = {
      success: true,
      feature: body.feature,
      orgId: body.orgId,
      targetUserId,
      slack: { attempted: sendSlack, sent: false } as any,
      inApp: { attempted: createInApp, created: false } as any,
      hitl: {} as any,
      debug: { ...debug, plannedSlackText: text, plannedSlackBlocksCount: blocks.length },
    };

    if (dryRun) {
      result.debug.plannedSlackBlocks = blocks;
      result.debug.plannedInAppPayload = inAppPayload;
      return json(result);
    }

    // Slack send (if enabled)
    if (sendSlack) {
      const slack = await getSlackForOrg(supabase, body.orgId);
      if (!slack) {
        result.slack.error = 'Slack is not connected for this org';
      } else {
        const slackUserId = await getSlackUserIdForSixtyUser(supabase, body.orgId, targetUserId);
        if (!slackUserId) {
          result.slack.error = 'No Slack user mapping for target user (link Slack under Slack Settings → Personal Slack)';
        } else {
          const dmChannelId = await openDm(slack.bot_access_token, slackUserId);
          // Post base message
          const posted = await postMessageWithBlocks(slack.bot_access_token, dmChannelId, text, blocks);
          result.slack.sent = true;
          result.slack.channelId = posted.channel;
          result.slack.ts = posted.ts;

          // If this is a HITL simulation, create approval record and update message with action buttons.
          if (hitlMode) {
            // Create approval using the stored message identifiers.
            const originalContent = {
              subject: 'Great meeting — next steps',
              body: 'Simulated email draft content',
              to: 'prospect@example.com',
            };

            const { data: approvalId, error: approvalError } = await supabase.rpc('create_hitl_approval', {
              p_org_id: body.orgId,
              p_user_id: targetUserId,
              p_resource_type: 'email_draft',
              p_resource_id: crypto.randomUUID(),
              p_resource_name: 'Simulated follow-up email',
              p_slack_team_id: slack.slack_team_id,
              p_slack_channel_id: posted.channel,
              p_slack_message_ts: posted.ts,
              p_original_content: originalContent,
              p_callback_type: null,
              p_callback_target: null,
              p_callback_metadata: { source: 'proactive_simulator' },
              p_expires_hours: 24,
              p_created_by: authCtx.userId,
              p_slack_thread_ts: null,
              p_metadata: { feature: 'hitl_followup_email', source: 'proactive_simulator' },
            });

            if (approvalError || !approvalId) {
              result.hitl.error = approvalError?.message || 'Failed to create HITL approval';
            } else {
              result.hitl.approvalId = approvalId as string;
              const hitlBlocks = buildHitlBlocks(approvalId as string);
              await updateMessageBlocks(slack.bot_access_token, posted.channel, posted.ts, text, hitlBlocks);
            }
          }
        }
      }
    }

    // In-app mirror (if enabled)
    if (createInApp) {
      const { data: inserted, error: insertError } = await supabase
        .from('notifications')
        .insert({
          user_id: targetUserId,
          title: inAppPayload.title,
          message: inAppPayload.message,
          type: inAppPayload.type,
          category: inAppPayload.category,
          metadata: inAppPayload.metadata || {},
          action_url: inAppPayload.actionUrl || null,
          read: false,
        })
        .select('id')
        .single();

      if (insertError) {
        result.inApp.error = insertError.message;
      } else {
        result.inApp.created = true;
        result.inApp.notificationId = inserted?.id as string | undefined;
      }
    }

    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[proactive-simulate] error:', message);
    return json({ success: false, error: message }, 500);
  }
});

